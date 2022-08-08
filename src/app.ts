//import { Probot, Context } from 'probot';
import { Probot } from 'probot';
import { 
  // exposeMetrics,
  useCounter
} from '@operate-first/probot-metrics';
import {
  APIS,
  createTokenSecret,
  deleteTokenSecret,
  getNamespace,
  getTokenSecretName,
  updateTokenSecret,
  useApi,
} from '@operate-first/probot-kubernetes';

const issueForm = require('@operate-first/probot-issue-form');

const generateTaskPayload = (name: string, context: any) => ({
  apiVersion: 'tekton.dev/v1beta1',
  kind: 'TaskRun',
  metadata: {
    // "copilot-ops-bot" to match the prefix in manifests/base/tasks/kustomization.yaml namePrefix
    // (not necessary for functionality, just for consistency)
    generateName: `copilot-ops-bot-${name}-`,
  },
  spec: {
    taskRef: {
      // "copilot-ops-bot" to match the prefix in manifests/base/tasks/kustomization.yaml namePrefix
      // necessary for functionality
      name: 'copilot-ops-bot-' + name,
    },
    params: [
      {
        name: 'SECRET_NAME',
        value: getTokenSecretName(context),
      },
      {
        name: 'CONTEXT',
        value: JSON.stringify(context.payload),
      },
    ],
  },
});

export default (
  app: Probot,
  // {
  //   getRouter,
  // }: { getRouter?: ((path?: string | undefined) => Router) | undefined }
) => {
  console.timeLog('entered copilot-ops-bot')
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

  // Simple callback wrapper - executes and async operation and based on the result it inc() operationsTriggered counted
  const wrapOperationWithMetrics = (callback: Promise<any>, labels: any) => {
    const response = callback
      .then(() => ({
        status: 'Succeeded',
      }))
      .catch(() => ({
        status: 'Failed',
      }));

    operationsTriggered
      .labels({
        ...labels,
        ...response,
        operation: 'k8s',
      })
      .inc();
  };

  app.onAny((context: any) => {
    //console.log("AAAAAAAAAAAAAAAAAAAA\n\n\n\n")
    //console.log(context.payload)
    //console.log("typeof action:", context.payload.action )
    //On any event inc() the counter
    if (typeof context === 'undefined') {
      console.log('code is borken')
      return;
    }
    if (typeof context.payload === 'undefined') {
      console.log('context.payload is undefined, context:', context);
      return;
    }
    if (typeof context.payload.action === 'undefined') {
      console.log('context.payload.action is undefined, context.payload:', context.payload);
      return;
    }
    if (typeof context.payload.installation === 'undefined') {
      console.log('context.payload.installation is undefined, context.payload:', context.payload);
      return;
    }
    numberOfActionsTotal
      .labels({
        install: context.payload.installation.id,
        action: context.payload.action,
      })
      .inc();
  });

  app.on('installation.created', async (context: any) => {
    console.log("typeof context", typeof context);
    console.log('typeof context.payload', typeof context.payload);
    numberOfInstallTotal.labels({}).inc();

    // Create secret holding the access token
    wrapOperationWithMetrics(createTokenSecret(context), {
      install: context.payload.installation.id,
      method: 'createSecret',
    });
  });

  app.on('push', async (context: any) => {
    // Update token in case it expired
    wrapOperationWithMetrics(updateTokenSecret(context), {
      install: context!.payload!.installation!.id,
      method: 'updateSecret',
    });

    // Trigger example taskrun
    wrapOperationWithMetrics(
      useApi(APIS.CustomObjectsApi).createNamespacedCustomObject(
        'tekton.dev',
        'v1beta1',
        getNamespace(),
        'taskruns',
        generateTaskPayload('example', context)
      ),
      {
        install: context.payload.installation.id,
        method: 'scheduleExampleTaskRun',
      }
    );
  });

  // app.on("issues.opened", async (context: Context) => {
  //   const params = context.issue({ body: "Hello World!" });


  //   console.log("issue created successfully")
  //   //return context.octokit.issues.createComment(params)
  // })

  app.on('issues.opened', async(context) => {
    //console.log("typeof context:", typeof context);
    //console.log('typeof context.payload:', typeof context.payload);

    console.log("this is running")
    // try {
      const data = await issueForm.parse(context);
      console.log(data);
    // } catch {
    //   console.log("broked")
    //   app.log.info('Issue was not created using correct template')
    // }
  });

  // app.on('issues.opened', async(_context) => {
  //   console.log("issue has been created")
  //   //console.log(context);
  // });

  app.on('issue_comment.created', async(_context) => {
    console.log("dummy test is activating")
    //app.log.info(context);
  });

  app.on('installation.deleted', async (context: any) => {
    numberOfUninstallTotal.labels({}).inc();

    // Delete secret containing the token
    wrapOperationWithMetrics(deleteTokenSecret(context), {
      install: context.payload.installation!.id,
      method: 'deleteSecret',
    });
  });
};
