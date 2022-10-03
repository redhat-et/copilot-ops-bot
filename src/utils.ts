import { Context } from 'probot';
import { Counter } from 'prom-client';
import { getTokenSecretName } from '@operate-first/probot-kubernetes';
import parseIssueForm from '@operate-first/probot-issue-form';

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

const regeneratePR = async () => {
  console.log('regenerating');
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

const generateTaskRunPayload = (
  name: string,
  context: any,
  userInput: string
) => ({
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
        value: context.issue().issue_number,
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
    ],
  },
});

export { regeneratePR, wrapOperationWithMetrics, generateTaskRunPayload };
