1. kind cluster

2. deploy tekton on the cluster from the https://github.com/tektoncd/pipeline/releases:
```
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/previous/v0.38.3/release.yaml
```

3. build copilot-ops image

```
podman build -t localhost/copilot-ops/copilot-ops .
podman save localhost/copilot-ops/copilot-ops -o copilot-ops-image.tar
kind load image-archive copilot-ops-image.tar
```


4. build bot image (TBD)
5. deploy the bot manifests - includes tekton Task (one of the steps image is of the copilot-ops)

```
kubectl create ns copilot-ops-bot
kubectl config set-context --current --namespace copilot-ops-bot
kubectl apply -f manifests/base/tasks/copilot-ops.yaml
kubectl get task copilot-ops -o yaml
```

6. deploy the bot pod - deployment
    - bot will fetch events from smee.io
    - for dev we run the bot locally - `npm run dev`

6. on issue.created event the bot creates a TaskRun (referes to the Task)


7. next step is going to create/update the PR
