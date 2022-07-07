<p align="center">
  <a href="https://github.com/apps/{{name}}">
    <img src="https://github.com/{{org-repo}}/main/static/robot.svg" width="160" alt="Probot's logo, a cartoon robot" />
  </a>
</p>
<h3 align="center"><a href="https://github.com/apps/{{name}}">{{name}}</a></h3>
<p align="center">{{description}}</p>
<p align="center">
  <a href="https://github.com/{{org-repo}}/releases">
    <img alt="GitHub tag (latest by date)" src="https://img.shields.io/github/v/tag/{{org-repo}}">
  </a>
  <a href="https://github.com/{{org-repo}}/actions?query=workflow%3APush">
    <img alt="Build Status" src="https://img.shields.io/github/workflow/status/{{org-repo}}/Push">
  </a>
  <a href="https://github.com/{{org-repo}}">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/{{org-repo}}">
  </a>
  <a href="https://github.com/{{org-repo}}/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  </a>
  <a href="https://github.com/{{org-repo}}/issues?q=is%3Aissue+is%3Aopen+label%3Akind%2Fbug">
    <img alt="Reported bugs" src="https://img.shields.io/github/issues-search/{{org-repo}}?color=red&label=reported%20bugs&query=is%3Aopen%20label%3Akind%2Fbug">
  </a>
  <a href="https://github.com/{{org-repo}}/issues?q=is%3Aissue+is%3Aopen+label%3Akind%2Fbug">
    <img alt="Feature requests" src="https://img.shields.io/github/issues-search/{{org-repo}}?label=feature%20requests&query=is%3Aopen%20label%3Akind%2Ffeature">
  </a>
</p>

---

Please describe how your application works.

## Contributions

See [`CONTRIBUTING.md`](CONTRIBUTING.md) on how to contribute.

---

## Credit

See [`ACKNOWLEDGMENTS.md`](ACKNOWLEDGMENTS.md).

<p align="center">
  <a href="https://argocd.operate-first.cloud/applications/{{name}}">
    <img alt="ArgoCD status" src="https://argocd.operate-first.cloud/api/badge?name={{name}}&revision=true">
  </a><br />
  <a href="https://console-openshift-console.apps.smaug.na.operate-first.cloud/k8s/cluster/projects/{{prod-namespace}}">
    <img alt="OpenShift namespace" src="https://img.shields.io/badge/OpenShift-{{prod-namespace}}-white?logo=redhatopenshift&logoColor=white&labelColor=ee0000">
  </a>
  <a href="https://peribolos.operate-first.cloud">
    <img alt="Route status" src="https://img.shields.io/website?label=Availability&url=https%3A%2F%2F{{route}}%2Fhealthz">
  </a><br />
  <a href="https://quay.io/repository/{{quay_org}}/{{image}}?tab=tags">
    <img alt="Controller image" src="https://img.shields.io/badge/Quay-{{org}}%2F{{repo}}-blue">
  </a>
</p>
