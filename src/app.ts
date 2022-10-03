import { Probot } from 'probot';
import { useCounter } from '@operate-first/probot-metrics';
import {
  createTokenSecret,
  deleteTokenSecret,
} from '@operate-first/probot-kubernetes';

import { REROLL_COMMAND } from './constants';
import { wrapOperationWithMetrics } from './utils';

import handleIssueCreate from './handles/issueCreate';

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
      console.log('bad context', context);
      return;
    }
    const labels = { install, action };
    numberOfActionsTotal.labels(labels).inc();
  });

  // secret is created when this event runs
  app.on('installation.created', async (context) => {
    numberOfInstallTotal.labels({}).inc();

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

  app.on('issues.opened', async (context) => {
    console.log('received issue');

    const install = context.payload.installation?.id || 0;
    await handleIssueCreate(context, operationsTriggered, install);
  });

  app.on('issue_comment.created', async (context) => {
    console.log('type of context:', typeof context);
    const { isBot, payload } = context;
    const { comment, sender } = payload;
    // only the author should be able to make comments
    if (isBot || sender.id !== payload.issue.user.id) {
      console.log('skipping bot comment');
      return;
    }
    // re-create the PR
    if (comment.body.trim() === REROLL_COMMAND) {
      const install = context.payload.installation?.id || 0;
      await handleIssueCreate(context, operationsTriggered, install);
    }
    console.log('done');
  });

  app.on('installation.deleted', async (context: any) => {
    numberOfUninstallTotal.labels({}).inc();

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
