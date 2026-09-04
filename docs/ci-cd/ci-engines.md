---
sidebar_position: 2
---

# CI Engines: GitHub Actions and Jenkins

Both tools run a defined sequence of steps when a trigger fires. They differ on one axis that drives almost everything else: who operates the machine. GitHub Actions is managed by GitHub and native to a GitHub repository; Jenkins is a server you host yourself, tied to no particular version-control system.

## GitHub Actions: anatomy

Automation is declared in YAML files under `.github/workflows/`. Each file is a **workflow** — one automated process bound to a set of triggers. A workflow contains one or more **jobs**, which run in parallel by default; one job waits for another through a `needs` dependency. Every job is assigned a **runner**, the machine that executes it, and runs as an ordered list of **steps** that share that runner's filesystem for the life of the job. A step is one of two things: a shell command (`run:`), or an **action** (`uses:`) — a reusable, versioned unit of behaviour, such as `actions/checkout` (clones the code) or `docker/build-push-action` (builds and pushes an image). Jobs are isolated because each gets its own runner; data moves between them through a published artifact or cache, not a shared disk.

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew build
      - run: ./gradlew test
```

Read top to bottom: on a push to `main` or any pull request, start a fresh Ubuntu runner, check out the code, build, then test.

## Jenkins: anatomy

Jenkins is a long-running **automation server** with two roles. The **controller** schedules work, serves the web UI, and holds configuration; **agents** are separate worker machines that execute the builds (older documentation calls these "master" and "slaves"). The controller can run builds itself, but offloading to agents is standard for isolation and scale. A pipeline is defined in a **Jenkinsfile** written in a **DSL** — a domain-specific language, a small purpose-built syntax — layered on Groovy, a scripting language that runs on the JVM. The modern form is **declarative**: a `pipeline` block containing **stages**, each stage a logical phase (Build, Test, Deploy) holding **steps**, the actual commands.

```groovy
pipeline {
  agent any
  stages {
    stage('Build') {
      steps { sh './gradlew build' }
    }
    stage('Test') {
      steps { sh './gradlew test' }
    }
  }
}
```

`agent any` runs on any available agent; each `sh` step runs a shell command; stages run sequentially unless wrapped in a `parallel` block.

Jenkins installs with a minimal core that can schedule and run jobs and little else. Almost every integration a real pipeline needs — Git, Docker, Kubernetes, credential storage, notifications — is added as a **plugin**: an extension installed into the Jenkins server, often contributing new steps you can then call in a Jenkinsfile. The ecosystem is vast, so Jenkins reaches almost any tool; the cost is that a pipeline depends on a stack of independently-versioned plugins whose upgrades and version conflicts are the classic Jenkins maintenance tax.

## The terminology trap

The word **job** does not mean the same thing in each tool. In GitHub Actions a job is a *mid-level* unit inside a workflow — one runner's worth of work. In Jenkins a "job" (also "item" or "project") is the *top-level* thing you create, and a Pipeline is one kind of job. So a Jenkins job maps roughly to an entire Actions *workflow*, while the parallelizable unit inside a single run is an Actions *job* on one side and a Jenkins *stage* on the other.

## Where the build actually runs

Both tools split into hosted and self-managed execution, and it is the same trade-off in each.

GitHub **hosted runners** are ephemeral VMs that GitHub creates fresh for each job and destroys afterward, preloaded with common toolchains and billed per minute (public repositories run free). A fresh VM per job gives strong isolation and reproducibility with no effort. **Self-hosted runners** are machines you register and maintain, used when a job needs a private network, specialised hardware such as a GPU, or software the hosted images lack — or when volume makes per-minute billing expensive. The cost is that you now patch, secure, and scale them, and because a self-hosted runner can carry state between jobs, GitHub advises against attaching one to a public repository, where a pull request from a fork could run untrusted code on your machine.

Jenkins is self-managed by definition — the controller and every agent are infrastructure you own — so it sits permanently on the self-hosted side of that trade-off. Its agents can be fixed VMs or provisioned on demand; the Kubernetes plugin, for example, starts a fresh pod per build, recreating the ephemeral isolation that hosted runners give by default.

## Which a team picks

GitHub Actions wins on operational simplicity: nothing to run, configuration living beside the code, first-class pull-request status checks, and a large action ecosystem — at the price of coupling to GitHub and of YAML that grows awkward once the logic gets genuinely complex. Jenkins wins on control and reach: it works with any source host, runs on-prem or air-gapped, and expresses arbitrary logic in full Groovy — at the price of being infrastructure you must operate. The common real pattern is a split rather than a clean win: teams on GitHub adopt Actions for new repositories while keeping Jenkins for on-prem, legacy, or unusually complex builds, and some run both indefinitely.
