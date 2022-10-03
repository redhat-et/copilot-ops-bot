import { Context } from 'probot';
import { Counter } from 'prom-client';
import {
  getNamespace,
  useApi,
  APIS,
  updateTokenSecret,
} from '@operate-first/probot-kubernetes';

import {
  parseIssueInfo,
  wrapOperationWithMetrics,
  generateTaskRunPayload,
} from '../utils';

export default async (
  context: Context,
  operationsTriggered: Counter<string>,
  install: number
) => {
  const issueInfo = await parseIssueInfo(context);
  if (!issueInfo) return; // not an issue for us

  const { issue_number } = issueInfo;

  const head = `copilot-ops-fix-issue-${issue_number}`;

  // Update token in case it expired
  console.log('updateSecret', getNamespace());
  console.log('updating secret...');
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
  console.log('update secret done');

  // Trigger example taskrun
  console.log('scheduleTaskRun', getNamespace());
  await wrapOperationWithMetrics(
    useApi(APIS.CustomObjectsApi).createNamespacedCustomObject(
      'tekton.dev',
      'v1beta1',
      getNamespace(),
      'taskruns',
      generateTaskRunPayload(head, context, issueInfo.userInput)
    ),
    {
      install,
      method: 'scheduleTaskRun',
    },
    operationsTriggered
  );
};
