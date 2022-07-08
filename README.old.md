<p align="center">
  <a href="https://github.com/operate-first/probot-template">
    <img src="https://raw.githubusercontent.com/operate-first/probot-template/main/static/robot.svg" width="160" alt="Probot's logo, a cartoon robot" />
  </a>
</p>
<h3 align="center"><a href="https://github.com/operate-first/probot-template">Probot on Kubernetes - template repository</a></h3>
<p align="center">
  <a href="https://github.com/operate-first/probot-template">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/operate-first/probot-template">
  </a>
  <a href="https://github.com/operate-first/probot-template/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  </a>
  <a href="https://github.com/operate-first/probot-template/issues?q=is%3Aissue+is%3Aopen+label%3Akind%2Fbug">
    <img alt="Reported bugs" src="https://img.shields.io/github/issues-search/operate-first/probot-template?color=red&label=reported%20bugs&query=is%3Aopen%20label%3Akind%2Fbug">
  </a>
  <a href="https://github.com/operate-first/probot-template/issues?q=is%3Aissue+is%3Aopen+label%3Akind%2Fbug">
    <img alt="Feature requests" src="https://img.shields.io/github/issues-search/operate-first/probot-template?label=feature%20requests&query=is%3Aopen%20label%3Akind%2Ffeature">
  </a>
</p>

---

## How to use

1. Create a new repository from this template
2. Follow a guide at Probot on [how to create and configure a GitHubApp](https://probot.github.io/docs/development/#manually-configuring-a-github-app)
3. Create a Quay.io repository to host the controller container image
   - Create a new Quay.io registry as an empty registry (go to [quay.io/new](https://quay.io/new/), select your namespace and mark the repository as _Public_)
   - Create a robot account (go to Quay.io, in top right corner select _Account Settings_, then second tab from the top _Robot Accounts -> Create Robot Account_)
   - Grant this bot account __Write__ access to your new container repository
   - Save robot credentials as `QUAY_USERNAME` and `QUAY_PASSWORD` in the repository secrets (on GitHub repository page open _Settings -> Secrets -> Actions -> New repository secret_)
   - In order to [properly expire container images](./.github/actions/set-expiration/action.yaml) we also need `QUAY_OAUTH_TOKEN`. You can either use your own account token or (better) create new Quay Application in your organization. To do so, go to `https://quay.io/organization/<org_name>`, then _Applications -> Create New Application_. Copy the OAuth Token and save it as `QUAY_OAUTH_TOKEN` in the repository secrets
4. Template all references (you can also do this manually, see [`./scripts/template.sh`](./scripts/template.sh) for list of files to adjust)

    ```sh
    go install github.com/cbroglie/mustache/cmd/mustache@latest

    cat <<EOM > /tmp/data.yaml
    name: application-name
    description: Some text
    prod-namespace: namespaceA
    stage-namespace: namespaceB
    image: quay_image_name
    quay_org: quay_org
    org: github_org
    team: team-name
    repo: repo
    email: some-contact@domain.com
    EOM

    ./scripts/template.sh /tmp/data.yaml
    ```

5. Create credentials secrets for deployment based on your GitHub app data

    ```sh
    # Copy secret from base
    cp manifests/base/controller/secret.yaml manifests/overlays/stage/secret.enc.yaml
    cp manifests/base/controller/secret.yaml manifests/overlays/prod/secret.enc.yaml

    # edit manifests/overlays/*/secret.enc.yaml filling in all data
    vim manifests/overlays/*/secret.enc.yaml

    # Encrypt them via sops
    sops -e -i --pgp="0508677DD04952D06A943D5B4DC4116D360E3276" manifests/overlays/stage/secret.enc.yaml
    sops -e -i --pgp="0508677DD04952D06A943D5B4DC4116D360E3276" manifests/overlays/prod/secret.enc.yaml
    ```

6. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and happily hack on `src/app.ts`.
7. We recommend installing [DCO](https://probot.github.io/apps/dco/), [Renovate](https://www.mend.io/free-developer-tools/renovate/), [Semantic PRs](https://github.com/apps/semantic-prs) GitHub apps.

## Template overview

- `ACKNOWLEDGMENTS.md` - Recognize and credit project this tooling builds upon
- `.aicoe-ci.yaml` - Config for [AI-CoE CI](https://github.com/AICoE/aicoe-ci) (disables default checks if the app is installed in organization, can be removed if AI-CoE CI is not used)
- `app.yml` - GitHub app manifest which can be used for automated app creation, see GitHub documentation [here](https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app-from-a-manifest) and Probot documentation [here](https://probot.github.io/docs/development/#configuring-a-github-app)
- `CODE_OF_CONDUCT.md` - Code of conduct for contributors and users
- `CONTRIBUTING.md` - Guidelines on contributing, expected workflows
- `CONTRIBUTORS.md` - List of contributors
- `.env.example` - Environment variables to set when running Probot locally
- `jest.config.js` - Setup for tests
- `.github` - Configuration for local repository
  - `actions` - [Custom GitHub Actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions)
    - `build` - Builds a container image via [Source to Image](https://github.com/openshift/source-to-image)
    - `check-maintainer-role` - Verifies user permissions (used to check if user is eligible to create a release for example)
    - `set-expiration` - Sets container image tag expiration in Quay.io
    - `test` - Runs tests against the controller
  - `ISSUE_TEMPLATE` - Standard set of issue templates available in the repo
    - `bug_report.md`
    - `feature_request.md`
    - `promote.md` - Triggers a workflow which promotes images used in `manifests/overlays/stage` to `manifests/overlays/prod` (creates a Pull Request, only maintainers are allowed)
    - `release.md` - Triggers a workflow which releases from default main branch to GitHub releases and Quay.io
    - `security.md` - Used by users to nofity maintainers about security vulnerabilities found in the service
  - `renovate.json` - Config for [Renovate app](https://github.com/marketplace/renovate) to keep your dependencies (Node.js and Github Actions) up to date
  - `workflows` - Github Actions workflows
    - `promote.yaml` - Triggered by issues created by `promote.md` issue template. **Important:** make sure `kind/promote` and `bot` labels are present in the repo. Promotes images used in `manifests/overlays/stage` to `manifests/overlays/prod` (creates a Pull Request, only maintainers are allowed)
    - `pr.yaml` - Runs tests and attempts to build a container image out of a Pull Request
    - `push.yaml` - Runs tests, builds and pushes a container image to Quay.io on push events
    - `release.yaml` - Triggered by issues created by `release.md` issue template. **Important:** make sure `kind/release` and `bot` labels are present in the repo. Releases from default main branch to GitHub releases and Quay.io
- `.gitignore`
- `.gitleaks.toml` - Exclude `test/fixtures/mock-cert.pem` from [Gitleaks](https://github.com/zricethezav/gitleaks) scans to save you a headache
- `LICENSE` - License file
- `manifests` - Folder contains all manifests structured for [Kustomize](https://kustomize.io/)
  - `base`
    - `controller` - Contains all manifests related to the controller deployment itself
    - `tasks` - Tekton task manifests for heavy lifting on cluster, contains example task
  - `overlays` - Overlay for each environment
- `OWNERS` - Used if the repo is connected to Prow, see documentation [here](https://www.kubernetes.dev/docs/guide/owners/), can be removed if Prow is not used
- `package.json` - Node.js package manifest
- `package-lock.json` - Node.js package manifest lock file
- `.pre-commit-config.yaml` - Configuration for [pre-commit](https://pre-commit.com/)
- `.prow.yaml` - Configuration for Prow
- `README.md` - This file, moved to `README.old.md` after the repo is templated
- `README.template.md` - New README file after templating the repo
- `.s2ibase` - Reference to the used Source to Image builder image
- `scripts` - Hacks and helpers
  - `build-image.sh` - Creates a local build of Source to Image container image
  - `template.sh` - Templates the repository
- `SECURITY.md` - Security policy, see GitHub documentation [here](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository)
- `src` - Source for the controller
  - `app.ts` - Controller definition
  - `index.ts` - Runner/entrypoint for the controller
- `static/robot.svg` - Probot logo for you to customize
- `SUPPORT.md` - Support process definition, how and where to ask for help
- `test` - Store your controller tests here
  - `app.test.ts` - Empty test suite
  - `fixtures/mock-cert.pem` - Mock certificate
- `.thoth.yaml` - Configuration file for [Thoth Station](https://thoth-station.ninja/) (disables default checks if the AI-CoE CI app is installed in organization, can be removed if AI-CoE CI is not used)
- `tsconfig.json` - Typescript configuration file

## Resources

- [Probot documentation](https://probot.github.io/docs/)
- [Probot extensions by Operate First](https://github.com/operate-first/probot-extensions)
- Example: [Peribolos as a service](https://github.com/operate-first/peribolos-as-a-service)

## Contributions

See [`CONTRIBUTING.md`](CONTRIBUTING.md) on how to contribute.

---

## Credit

See [`ACKNOWLEDGMENTS.md`](ACKNOWLEDGMENTS.md).
