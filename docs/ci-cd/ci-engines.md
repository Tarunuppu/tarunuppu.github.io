---
sidebar_position: 2
---

# CI Engines: GitHub Actions and Jenkins

Both tools run a defined sequence of steps when a trigger fires. They differ on one axis that drives almost everything else: who operates the machine. GitHub Actions is managed by GitHub and native to a GitHub repository; Jenkins is a server you host yourself, tied to no particular version-control system.

## GitHub Actions: anatomy

Automation is declared in YAML files under `.github/workflows/`. Each file is a **workflow** — one automated process bound to a set of triggers. A workflow contains one or more **jobs**, which run in parallel by default; one job waits for another through a `needs` dependency. Every job is assigned a **runner**, the machine that executes it, and runs as an ordered list of **steps** that share that runner's filesystem for the life of the job. A step is one of two things: a shell command (`run:`), or an **action** (`uses:`) — a reusable, versioned unit of behaviour referenced as `owner/repo@version`, naming an already-published repository you call rather than code you write, such as `actions/checkout@v4` (version 4 of GitHub's official action, which clones your repository onto the otherwise-empty runner) or `docker/build-push-action` (builds and pushes an image). Jobs are isolated because each gets its own runner; data moves between them through a published artifact or cache, not a shared disk.

```yaml
name: ci

on:
  push:
    branches: [main]              # merges/pushes to main
  pull_request:
    branches: [main]              # PRs targeting main
  workflow_dispatch:              # manual run from the UI or API
  schedule:
    - cron: '0 3 * * 1'           # weekly, Monday 03:00 UTC

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: gradle           # reuse Gradle dependencies between runs

      - name: Check formatting and lint
        run: ./gradlew spotlessCheck checkstyleMain

      - name: Build
        run: ./gradlew build -x test

      - name: Unit tests
        run: ./gradlew test

      - name: Integration tests
        run: ./gradlew integrationTest

      - name: Publish test report
        if: always()              # upload even if an earlier step failed
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: build/reports/tests/
```

Read top to bottom: on any of its triggers, GitHub starts a fresh Ubuntu runner, checks out the code, installs JDK 21 with a warm Gradle cache, runs the formatting and lint checks, then the build, then the unit and integration tests, and finally publishes the test report even when an earlier step has failed.

The `on:` block lists the triggers. The four most useful in practice are a push to the mainline, a pull request targeting it, a manual `workflow_dispatch` started from the UI or API, and a `schedule` on a cron expression for periodic work such as nightly or weekly runs. A single workflow may subscribe to any combination of them.

Because the workflow file is committed to the repository, each branch carries its own copy of `.github/workflows/`, and the copies may differ — a workflow edited on a feature branch changes CI only on that branch until it is merged. Which branch's copy runs depends on the event. A `push` runs the workflow as it exists on the pushed branch, so a new branch that does not yet contain a workflow file triggers nothing. A `pull_request` instead runs the workflow from the base branch it targets, not the version inside the pull request, which stops an untrusted contribution from rewriting the pipeline that judges it. Scheduled and other repository-level events run only the default branch's copy. The practical effect is that edits to pull-request and scheduled workflows take hold only once merged into the branch that governs them.

## Jenkins: anatomy

Unlike GitHub Actions, Jenkins is not part of any hosting platform. It is a standalone application — written in Java — that you download, install, and run yourself, and it runs as a persistent **server**: a process that stays up continuously, reached through a web interface where jobs are configured and builds are watched. Nothing about it is provided for you. You decide where it lives — a virtual machine, a container, or an on-prem box — and you keep it running, patched, and reachable. That one fact, that Jenkins is infrastructure you operate rather than a capability built into your code host, is the origin of every other difference from GitHub Actions below.

The server has two internal roles. The **controller** schedules work, serves the web UI, and holds configuration; **agents** are separate worker machines that execute the builds (older documentation calls these "master" and "slaves"). The controller can run builds itself, but offloading to agents is standard for isolation and scale. A pipeline is defined in a **Jenkinsfile** written in a **DSL** — a domain-specific language, a small purpose-built syntax — layered on Groovy, a scripting language that runs on the JVM. The modern form is **declarative**: a `pipeline` block containing **stages**, each stage a logical phase (Build, Test, Deploy) holding **steps**, the actual commands.

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
