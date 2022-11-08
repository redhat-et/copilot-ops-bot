1. kind cluster

2. deploy tekton on the cluster from the https://github.com/tektoncd/pipeline/releases:
```
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/previous/v0.38.3/release.yaml
```

3. build copilot-ops image

```
export KIND_EXPERIMENTAL_PROVIDER=podman
make
make image
podman tag quay.io/copilot-ops/copilot-ops:latest quay.io/copilot-ops/copilot-ops:local-build
# podman build -t localhost/copilot-ops/copilot-ops .
podman save quay.io/copilot-ops/copilot-ops:local-build -o copilot-ops-image.tar
kind load image-archive copilot-ops-image.tar
```


4. build bot image (TBD)
5. deploy the bot manifests - includes tekton Task (one of the steps image is of the copilot-ops)

```
kubectl create ns copilot-ops-bot
kubectl config set-context --current --namespace copilot-ops-bot
kubectl apply -f manifests/base/tasks/task.yaml
kubectl apply -f manifests/base/controller/secret_openai.yaml
kubectl get task copilot-ops-task -o yaml
kubectl get taskrun copilot-ops-bot-copilot-ops-fix-issue-34-fhcnz -o yaml
kubectl get pod copilot-ops-bot-copilot-ops-fix-issue-34-fhcnz-pod -o yaml

```



6. deploy the bot pod - deployment
    - bot will fetch events from smee.io
    - for dev we run the bot locally - `npm run dev`

6. on issue.created event the bot creates a TaskRun (referes to the Task)



7. next step is going to create/update the PR


8. Useful commands
    - npm run build
    - npm run start
    - kubectl apply -f manifests/base/tasks/task.yaml
    - kubectl apply -f manifests/base/controller/secret_openai.yaml
    - oc login

    for messing with pods:
    - kubectl get pods
    - kubectl describe pod ...
    - kubectl get secrets
    - kubectl logs ...
    - oc get ns