#!/bin/sh

mustache $1 manifests/base/controller/kustomization.yaml > tmpfile
mv tmpfile manifests/base/controller/kustomization.yaml

mustache $1 manifests/base/tasks/kustomization.yaml > tmpfile
mv tmpfile manifests/base/tasks/kustomization.yaml

mustache $1 manifests/base/kustomization.yaml > tmpfile
mv tmpfile manifests/base/kustomization.yaml

mustache $1 manifests/overlays/stage/kustomization.yaml > tmpfile
mv tmpfile manifests/overlays/stage/kustomization.yaml

mustache $1 manifests/overlays/prod/kustomization.yaml > tmpfile
mv tmpfile manifests/overlays/prod/kustomization.yaml

mustache $1 src/app.ts > tmpfile
mv tmpfile src/app.ts

mustache $1 package.json > tmpfile
mv tmpfile package.json

mustache $1 package-lock.json > tmpfile
mv tmpfile package-lock.json

mv README.md README.old.md
mustache $1 README.template.md > tmpfile
mv tmpfile README.md

mustache $1 CONTRIBUTING.md > tmpfile
mv tmpfile CONTRIBUTING.md

mustache $1 CODE_OF_CONDUCT.md > tmpfile
mv tmpfile CODE_OF_CONDUCT.md

mustache $1 SUPPORT.md > tmpfile
mv tmpfile SUPPORT.md

mustache $1 SECURITY.md > tmpfile
mv tmpfile SECURITY.md

mustache $1 .github/workflows/pr.yaml > tmpfile
mv tmpfile .github/workflows/pr.yaml

mustache $1 .github/workflows/push.yaml > tmpfile
mv tmpfile .github/workflows/push.yaml

mustache $1 .github/workflows/release.yaml > tmpfile
mv tmpfile .github/workflows/release.yaml
