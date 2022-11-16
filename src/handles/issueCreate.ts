import { Context } from 'probot';
import { Counter } from 'prom-client';
import {
  getNamespace,
  useApi,
  APIS,
  updateTokenSecret,
} from '@operate-first/probot-kubernetes';

import { Repository } from '@octokit/webhooks-types/schema';

import {
  parseIssueInfo,
  wrapOperationWithMetrics,
  generateTaskRunPayload,
  getBranchName,
} from '../utils';

/** Handle an issue creation event.
 *
 * @param context Probot Context object.
 * @param operationsTriggered Metrics object.
 * @param install Installation ID.
 * @param repo The GitHub repo where the issue was created.
 * @returns
 */
export const handleIssueCreate = async (
  context: Context,
  operationsTriggered: Counter<string>,
  install: number,
  repo: Repository
) => {
  const { octokit } = context;
  const issueInfo = await parseIssueInfo(context);
  if (!issueInfo) return; // not an issue for us

  const { issue_number } = issueInfo;

  // mark issue as seen
  await octokit.reactions
    .createForIssue({
      content: 'eyes',
      issue_number: issue_number,
      owner: repo.owner.login,
      repo: repo.name,
    })
    .catch((e) =>
      console.error(`failed to mark issue #${issue_number} as seen`, e)
    );

  const head = getBranchName(issue_number);
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
