import { Probot } from "probot";
import { useCounter } from "@operate-first/probot-metrics";
import {
  APIS,
  createTokenSecret,
  deleteTokenSecret,
  getNamespace,
  updateTokenSecret,
  useApi,
} from "@operate-first/probot-kubernetes";

import { LABEL_COPILOT_OPS_BOT } from "./constants";
import {
  generateTaskRunPayload,
  getBranchName,
  getIssueNumber,
  getOriginalUserInput,
  isOurIssue,
  isReroll,
  rerollUserInput,
  wrapOperationWithMetrics,
} from "./utils";

import { handleIssueCreate } from "./handles/issueCreate";

export default (
  app: Probot,
  // {
  //   getRouter,
  // }: { getRouter?: ((path?: string | undefined) => Router) | undefined }
) => {
  // Expose additional routes for /healthz and /metrics
  // if (!getRouter) {
  //   console.log('router is not defined')
  //   app.log.error('Missing router.');
  //   return;
  // }
  // const router = getRouter();
  // router.get('/healthz', (_, response) => response.status(200).send('OK'));
  // exposeMetrics(router, '/metrics');

  // Register tracked metrics
  const numberOfInstallTotal = useCounter({
    name: "num_of_install_total",
    help: "Total number of installs received",
    labelNames: [],
  });
  const numberOfUninstallTotal = useCounter({
    name: "num_of_uninstall_total",
    help: "Total number of uninstalls received",
    labelNames: [],
  });
  const numberOfActionsTotal = useCounter({
    name: "num_of_actions_total",
    help: "Total number of actions received",
    labelNames: ["install", "action"],
  });
  const operationsTriggered = useCounter({
    name: "operations_triggered",
    help: "Metrics for action triggered by the operator with respect to the kubernetes operations.",
    labelNames: ["install", "operation", "status", "method"],
  });

  app.onAny((context) => {
    const action = (context?.payload as any)?.action;
    const install = (context?.payload as any)?.installation?.id;
    if (!action || !install) {
      // console.log('bad context', context);
      return;
    }
    const labels = { install, action };
    numberOfActionsTotal.labels(labels).inc();
  });

  // secret is created when this event runs
  app.on("installation.created", async (context) => {
    numberOfInstallTotal.labels({}).inc();

    // create a label to mark copilot-ops PRs
    const { octokit, payload } = context;
    const { repositories } = payload;
    if (typeof repositories !== "undefined") {
      for (let i = 0; i < repositories.length; i++) {
        context.log.info("creating label for", repositories[i].full_name);
        const [owner, repo] = repositories[i].full_name.split("/");
        await octokit.issues
          .createLabel({
            name: LABEL_COPILOT_OPS_BOT,
            owner: owner,
            repo: repo,
          })
          .catch(() => {
            // potential data race?
            context.log.error(
              `could not create label for repository ${owner}/${repo}`,
            );
          });
      }
    }

    // Create secret holding the access token
    await wrapOperationWithMetrics(
      createTokenSecret(context),
      {
        install: context.payload.installation.id,
        method: "createSecret",
      },
      operationsTriggered,
    );
  });

  app.onError((e) => {
    console.log("error:", e.message);
    console.log(`error on event: ${e.event.name}, id: ${e.event.id}`);
  });

  app.on("issues.opened", async (context) => {
    context.log.info("received issue");
    const { payload } = context;
    const { repository, installation } = payload;
    const install = installation?.id || 0;
    await handleIssueCreate(context, operationsTriggered, install, repository);
  });

  // e.g. comments are of the format: /reroll [new input]
  // where [new input] is optional
  app.on("issue_comment.created", async (context) => {
    const { isBot, payload, octokit } = context;
    const { comment, issue, repository } = payload;
    const { full_name } = repository;

    context.log.debug(
      `a new comment was created in ${full_name} on issue #${issue.number}: ${comment.body}`,
    );

    // we should only respond to non-bot comments on the relevant threads
    const shouldComment = await isOurIssue(context, issue, repository);
    if (!shouldComment || isBot) {
      context.log.debug("ignoring comment");
      return;
    }

    // only two commands currently supported: reroll
    if (comment.body.startsWith("/help")) {
      // comment help information
      // FIXME: make this cleaner, study what other bots do for commands
      const helpBody =
        "Supported commands:\n- `help`: Display this message (usage: `/help`)\n- `reroll`: Try to generate another result with the original prompt (usage: `/reroll`)\n- `reroll [text]`: Generate another result using the text input (usage: `/reroll Create a new PVC with 5Gi`)\n";
      await octokit.issues
        .createComment({
          body: helpBody,
          issue_number: issue.number,
          owner: repository.owner.login,
          repo: repository.name,
        })
        .catch((e) => console.error("could not create help comment:", e));
      return;
    }
    if (!isReroll(comment.body)) {
      context.log.debug("no other command selected");
      return;
    }

    // acknowledge comments
    await octokit.reactions
      .createForIssueComment({
        comment_id: comment.id,
        content: "eyes",
        owner: repository.owner.login,
        repo: repository.name,
      })
      .catch((e) => context.log.error("could not react to comment: %s", e));

    let userInput = rerollUserInput(comment.body);

    // determine the issue number
    const issueNumber = getIssueNumber(issue);
    if (typeof issueNumber === "undefined") {
      context.log.error(
        `could not get original issueNumber from issue #${issue.number}`,
      );
      return;
    }

    userInput = await getOriginalUserInput(
      issue,
      issueNumber,
      context,
      payload.repository.owner.login,
      payload.repository.name,
    );
    if (userInput === "") {
      context.log.error("could not parse user input");
      return;
    }
    const head = getBranchName(issueNumber);

    const install = context.payload.installation?.id || 0;
    await wrapOperationWithMetrics(
      updateTokenSecret(context).catch((e) => {
        context.log.error("caught error while updating token: %s", e);
      }),
      {
        install,
        method: "updateSecret",
      },
      operationsTriggered,
    )
      .then(() => {
        context.log.debug("secret successfully updated");
      })
      .catch((e) => {
        context.log.debug("error updating token: %s", e);
      });

    // Trigger example taskrun
    context.log.debug("scheduleTaskRun in namespace: %s", getNamespace());
    await wrapOperationWithMetrics(
      useApi(APIS.CustomObjectsApi).createNamespacedCustomObject(
        "tekton.dev",
        "v1beta1",
        getNamespace(),
        "taskruns",
        generateTaskRunPayload(
          head,
          context,
          userInput,
          issueNumber.toString(),
        ),
      ),
      {
        install,
        method: "scheduleTaskRun",
      },
      operationsTriggered,
    );
  });

  app.on("installation.deleted", async (context) => {
    numberOfUninstallTotal.labels({}).inc();
    const { payload } = context;
    const { repositories } = payload;
    context.log.info(
      "copilot ops bot has been deleted from the following repositories: %j",
      repositories,
    );
    // Delete secret containing the token
    await wrapOperationWithMetrics(
      deleteTokenSecret(context),
      {
        install: context.payload.installation?.id,
        method: "deleteSecret",
      },
      operationsTriggered,
    );
  });
};
