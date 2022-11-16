import { Context } from 'probot';
import { Counter } from 'prom-client';
import { getTokenSecretName } from '@operate-first/probot-kubernetes';
import parseIssueForm from '@operate-first/probot-issue-form';
import { LABEL_COPILOT_OPS_BOT, REROLL_COMMAND } from './constants';

import { Issue } from '@octokit/webhooks-types/schema';

// Simple callback wrapper - executes and async operation and based on the result it inc() operationsTriggered counted
const wrapOperationWithMetrics = async (
  promise: Promise<any>,
  labels: any,
  counter: Counter<string>
) => {
  labels.operation = 'k8s';
  try {
    await promise;
    labels.status = 'Succeeded';
  } catch (err) {
    labels.status = 'Failed';
    console.error('Error', err);
    throw err;
  } finally {
    counter.labels(labels).inc();
  }
};

export const parseIssueInfo = async (context: Context) => {
  try {
    const form = await parseIssueForm(context);
    if (!form.botInput) return;
    const issue = context.issue();
    console.log('issue.opened', issue);
    return {
      ...issue,
      userInput:
        typeof form.botInput === 'string'
          ? form.botInput
          : form.botInput.join('\n'),
    };
  } catch (err) {
    console.log('error parsing form: ', err);
    return;
  }
};

/** Returns a TaskRunPayload.
 *
 * @param name A name which will be used to identify the Task.
 * @param context Context from the event call.
 * @param userInput User's input to generate from.
 * @param issueNum The number of the original issue.
 * @returns
 */
const generateTaskRunPayload = (
  name: string,
  context: any,
  userInput: string,
  issueNum?: string
) => {
  const issueNumber = issueNum || context.issue().issue_number;
  let finalIssueNum: string;
  if (typeof issueNumber !== 'string') {
    if (typeof issueNumber === 'number') {
      finalIssueNum = issueNumber.toString();
    } else {
      throw 'issueNumber is not a valid type';
    }
  } else {
    finalIssueNum = issueNumber;
  }
  return {
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
        // name: 'copilot-ops-bot-' + name,
        name: 'copilot-ops-task',
      },
      params: [
        {
          name: 'REPO_NAME',
          value: context.issue().repo,
        },
        {
          name: 'ISSUE_NUMBER',
          value: finalIssueNum,
        },
        {
          name: 'ISSUE_OWNER',
          value: context.issue().owner,
        },
        {
          name: 'SECRET_NAME',
          value: getTokenSecretName(context),
        },
        {
          name: 'USER_INPUT',
          value: userInput,
        },
        {
          name: 'PR_FLAG',
          value: LABEL_COPILOT_OPS_BOT,
        },
      ],
    },
  };
};

/** Returns a generated branch name which the PR is based on.
 *
 * @param issueNumber Number of the original issue created.
 * @returns
 */
export const getBranchName = (issueNumber: number) => {
  return `copilot-ops-fix-issue-${issueNumber}`;
};

/** Parses a given comment and extract the user's input
 *
 * @param body The comment body.
 */
export const rerollUserInput = (body: string): string => {
  // remove command
  const newBody = body.replace(REROLL_COMMAND, '').trim();
  return newBody;
};

/** Determines whether the given comment is for the reroll command or not.
 *
 * @param body contents from the comment
 */
export const isReroll = (body: string): boolean => {
  const trimmed = body.trimStart();
  return trimmed.startsWith(REROLL_COMMAND);
};

/** Parses the given PR's body and returns the linking issue.
 * If the issue cannot be parsed, then a -1 is returned.
 *
 * @param body Pull-Request description.
 * @return Corresponding issue number.
 */
export const getIssueNumberFromPR = (body: string): number => {
  const issueNumRegexp = new RegExp(/Fixes #(\d+)/, 'g');
  const matches = issueNumRegexp.exec(body);
  if (matches === null) {
    return -1;
  }
  if (matches.length < 2) {
    return -1;
  }
  const issueNum = matches[1];
  return parseInt(issueNum);
};

/** Extracts the prompt from the bare issue.
 *
 * @param issueBody Issue body.
 */
const stripPrompt = (issueBody: string): string => {
  const promptOffset = 2;
  const asLines = issueBody.split('\n').splice(promptOffset);
  return asLines.join('\n');
};

export const getOriginalUserInput = async (
  issue: Issue,
  issueNumber: number,
  context: Context,
  owner: string,
  repoName: string
) => {
  const { octokit } = context;
  let userInput: string;
  // comment was made on PR, not original issue
  if (issueNumber !== issue.number) {
    const originalIssue = await octokit.issues.get({
      issue_number: issueNumber,
      owner: owner,
      repo: repoName,
    });
    const { body } = originalIssue.data;
    if (typeof body === 'undefined' || body === null) {
      userInput = '';
    } else {
      userInput = stripPrompt(body);
      console.log(`parsed input for reroll: "${userInput}"`);
    }
  }
  // parse the user input from the original issue
  else {
    const issueInfo = await parseIssueInfo(context);
    userInput = issueInfo?.userInput || '';
  }
  return userInput;
};

export const getIssueNumber = (issue: Issue) => {
  let issueNumber: number;
  if (typeof issue.pull_request !== 'undefined') {
    if (issue.body === null) {
      return;
    }
    issueNumber = getIssueNumberFromPR(issue.body);
  } else {
    issueNumber = issue.number;
  }
  return issueNumber;
};

export const isCopilotOpsPR = (issue: Issue) => {
  const labels = issue.labels || [];
  const existingLabel = labels.find((v) => v.name === LABEL_COPILOT_OPS_BOT);
  return typeof existingLabel === 'undefined';
};

export const addBotLabel = async (
  context: Context,
  issueNumber: number,
  owner: string,
  repo: string
) => {
  const { octokit } = context;
  await octokit.issues
    .addLabels({
      issue_number: issueNumber,
      owner,
      repo,
      labels: [LABEL_COPILOT_OPS_BOT],
    })
    .catch((e) => console.error('could not apply label:', e));
};

export { wrapOperationWithMetrics, generateTaskRunPayload };
