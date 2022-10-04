import { Probot } from 'probot';
import { useCounter } from '@operate-first/probot-metrics';
import {
  APIS,
  createTokenSecret,
  deleteTokenSecret,
  getNamespace,
  updateTokenSecret,
  useApi,
} from '@operate-first/probot-kubernetes';

import { LABEL_COPILOT_OPS_BOT } from './constants';
import {
  addBotLabel,
  generateTaskRunPayload,
  getBranchName,
  getIssueNumber,
  getOriginalUserInput,
  isCopilotOpsPR,
  isReroll,
  rerollUserInput,
  wrapOperationWithMetrics,
} from './utils';

import { handleIssueCreate } from './handles/issueCreate';

export default (
  app: Probot
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
    name: 'num_of_install_total',
    help: 'Total number of installs received',
    labelNames: [],
  });
  const numberOfUninstallTotal = useCounter({
    name: 'num_of_uninstall_total',
    help: 'Total number of uninstalls received',
    labelNames: [],
  });
  const numberOfActionsTotal = useCounter({
    name: 'num_of_actions_total',
    help: 'Total number of actions received',
    labelNames: ['install', 'action'],
  });
  const operationsTriggered = useCounter({
    name: 'operations_triggered',
    help: 'Metrics for action triggered by the operator with respect to the kubernetes operations.',
    labelNames: ['install', 'operation', 'status', 'method'],
  });

  app.onAny((context) => {
    const action = (context?.payload as any)?.action;
    const install = (context?.payload as any)?.installation?.id;
    console.log('onAny', action, install);
    if (!action || !install) {
      // console.log('bad context', context);
      return;
    }
    const labels = { install, action };
    numberOfActionsTotal.labels(labels).inc();
  });

  // secret is created when this event runs
  app.on('installation.created', async (context) => {
    numberOfInstallTotal.labels({}).inc();

    // create a label to mark copilot-ops PRs
    const { octokit, payload } = context;
    const { repositories } = payload;
    if (typeof repositories !== 'undefined') {
      for (let i = 0; i < repositories.length; i++) {
        console.log('creating label for', repositories[i].full_name);
        const [owner, repo] = repositories[i].full_name.split('/');
        await octokit.issues
          .createLabel({
            name: LABEL_COPILOT_OPS_BOT,
            owner: owner,
            repo: repo,
          })
          .catch(() => {
            // potential data race?
            console.error(
              `could not create label for repository ${owner}/${repo}`
            );
          });
      }
    }

    // Create secret holding the access token
    await wrapOperationWithMetrics(
      createTokenSecret(context),
      {
        install: context.payload.installation.id,
        method: 'createSecret',
      },
      operationsTriggered
    );
  });

  app.onError((e) => {
    console.log('error:', e.message);
    console.log(`error on event: ${e.event.name}, id: ${e.event.id}`);
  });

  app.on('pull_request.opened', async (context) => {
    const { isBot, payload } = context;
    console.log('opened a pull request');
    console.log(`bot opened pr: ${isBot}`);
    if (isBot) {
      console.log('bot created issue, adding labels');
      addBotLabel(
        context,
        payload.pull_request.number,
        payload.repository.owner.login,
        payload.repository.name
      );
    }
  });

  app.on('issues.opened', async (context) => {
    console.log('received issue');
    const install = context.payload.installation?.id || 0;
    await handleIssueCreate(context, operationsTriggered, install);
  });

  // e.g. comments are of the format: /reroll [new input]
  // where [new input] is optional
  app.on('issue_comment.created', async (context) => {
    const { isBot, payload } = context;
    const { comment, issue, repository } = payload;
    const { full_name } = repository;

    console.log(
      `a new comment was created in ${full_name} on issue #${issue.number}: ${comment.body}`
    );

    // bot shouldnt make any comments
    if (isBot) {
      return;
    }

    // is this our PR?
    if (isCopilotOpsPR(issue)) {
      return;
    }
    if (!isReroll(comment.body)) {
      console.log('nothing to do');
    }

    let userInput = rerollUserInput(comment.body);

    // determine the issue number
    const issueNumber = getIssueNumber(issue);
    if (typeof issueNumber === 'undefined') {
      console.error(
        `could not get original issueNumber from issue #${issue.number}`
      );
      return;
    }

    userInput = await getOriginalUserInput(
      issue,
      issueNumber,
      context,
      payload.repository.owner.login,
      payload.repository.name
    );
    if (userInput === '') {
      console.error('could not parse user input');
      return;
    }
    const head = getBranchName(issueNumber);

    const install = context.payload.installation?.id || 0;
    await wrapOperationWithMetrics(
      updateTokenSecret(context).catch((e) => {
        console.log('caught error while updating token: ', e);
      }),
      {
        install,
        method: 'updateSecret',
      },
      operationsTriggered
    )
      .then(() => {
        console.log('secret successfully updated');
      })
      .catch((e) => {
        console.log('error updating token: ', e);
      });

    // Trigger example taskrun
    console.log('scheduleTaskRun', getNamespace());
    await wrapOperationWithMetrics(
      useApi(APIS.CustomObjectsApi).createNamespacedCustomObject(
        'tekton.dev',
        'v1beta1',
        getNamespace(),
        'taskruns',
        generateTaskRunPayload(head, context, userInput, issueNumber.toString())
      ),
      {
        install,
        method: 'scheduleTaskRun',
      },
      operationsTriggered
    );
  });

  app.on('installation.deleted', async (context) => {
    numberOfUninstallTotal.labels({}).inc();
    const { payload, octokit } = context;
    const { repositories } = payload;
    // clean up labels
    if (typeof repositories !== 'undefined') {
      for (let i = 0; i < repositories.length; i++) {
        console.log('creating label for', repositories[i].full_name);
        const [owner, repo] = repositories[i].full_name.split('/');
        await octokit.issues.deleteLabel({
          name: LABEL_COPILOT_OPS_BOT,
          owner: owner,
          repo: repo,
        });
      }
    }
    // Delete secret containing the token
    await wrapOperationWithMetrics(
      deleteTokenSecret(context),
      {
        install: context.payload.installation!.id,
        method: 'deleteSecret',
      },
      operationsTriggered
    );
  });
};
