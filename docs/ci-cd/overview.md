---
sidebar_position: 1
---

# The CI/CD Pipeline: End-to-End Flow

## What CI/CD names

CI/CD is the automated path a code change travels from a commit in a repository to a running deployment, with building, testing, packaging, and releasing performed by tooling rather than by hand. It is two disciplines joined at a seam: CI proves a change is safe to ship, and CD moves the shippable result into an environment.

## Source: how a change enters

A change enters the pipeline when commits reach the **remote** repository (GitHub, GitLab, Bitbucket) — most commonly through a branch push, in team workflows usually accompanied by a pull request. A pull request is not required, though: trunk-based teams push directly to the main branch.

## The trigger: the precise mechanism

Saying "the push triggers the pipeline" is shorthand. Precisely: when the remote receives the pushed commits, it registers the change and notifies whichever CI systems are subscribed to it — as an internal **event** in GitHub Actions, or as a **webhook** sent to an external server such as Jenkins. The CI system watches the remote, not the developer's machine.

A push is only one trigger type. Opening or updating a pull request is a distinct event, and runs can also start from tag pushes, a schedule (cron), or a manual UI/API call. Whether an event actually starts a run is then gated by **filters** — branch filters (for example, only `main` or `feature/*`) and often path filters (only when files under a given directory change).

In one line: *the remote registers a push and notifies subscribed CI systems, which run only if the event matches their configured triggers and filters.*

## Continuous Integration (CI)

*Integration* is the practice of merging every contributor's changes into a shared mainline frequently, proving on each change that the codebase still builds and passes its checks. A CI run therefore checks out the code, builds it, runs the test suites, and typically the linters and security scanners; if every configured check passes the change may merge, and if any fails it is blocked. A successful run may also emit a **build artifact** — a deployable unit such as a JAR, a binary, or a container image — though not always: pull-request checks often build and test only to gate the merge, publishing nothing.

## Packaging: Docker and the registry

For services deployed as containers, the artifact is a container image, and **Docker** is the dominant way to produce it. A Dockerfile declares how to assemble the application with its exact dependencies and required OS libraries into an **image** — a versioned, self-contained unit that runs identically wherever a container runtime is present. The image is pushed to an **image registry**, a store for versioned images: Docker Hub, GitHub Container Registry, or AWS's **ECR**. Containerization is the common modern case, not a universal law — some pipelines instead ship JARs to virtual machines or function bundles to a serverless platform.

## Continuous Delivery / Deployment (CD)

CD releases the artifact into environments, conventionally progressing dev → staging → production. **Continuous Delivery** means every change that passes CI is kept in a deployable state, but promoting it to production is a deliberate, usually human-approved action. **Continuous Deployment** means there is no manual gate: every change that passes the pipeline is released to production automatically. A team can practise Delivery without Deployment, but not the reverse.

CD is also where two opposing delivery models live:

- **Push-based.** The CI/CD tool (Jenkins, GitHub Actions) holds credentials to the target environment and executes the deployment itself as the final step — for example by running `kubectl apply`, `helm upgrade`, or a cloud deploy command.
- **Pull-based (GitOps).** A Git repository holds the system's **desired state** as declarative manifests, and an agent running inside the target environment continuously watches that repository and **reconciles** the environment to match it. **ArgoCD** implements this model and is specific to Kubernetes.

## Runtime: Kubernetes

The deployed artifact has to run somewhere, and for containerized systems that is often **Kubernetes**, a container **orchestrator**. Given the images to run, Kubernetes schedules the resulting containers across a pool of machines, restarts them when they fail, scales their count in response to load when so configured, and performs rolling updates so a release need not incur downtime. It is **declarative**: you submit the desired state as manifests (YAML), and Kubernetes continuously works to make the actual state match. Kubernetes is a common runtime, not the only one — services also run directly on virtual machines, on other orchestrators, or on serverless platforms.

## Cloud substrate: AWS

Underneath these stages sits the cloud provider, supplying compute, storage, networking, and managed versions of the pieces above. On **AWS**, the ones that appear in a pipeline are ECR (image registry), EKS (managed Kubernetes), EC2 (raw virtual machines), ECS (AWS's own container orchestrator, an alternative to Kubernetes), Fargate (a serverless compute mode — not an orchestrator itself — that runs containers for ECS or EKS without your managing the machines), Lambda (serverless functions), and IAM (the identity system that authorizes each of these to act).

## Observability and rollback

After release the running system is watched through health checks, metrics, logs, and traces, and a misbehaving release is returned to the last known-good version, sometimes automatically on a failed health signal. More advanced setups practise **progressive delivery**: a **canary** release sends the new version to a small slice of traffic first and widens it only if the version stays healthy, while a **blue-green** release runs two complete environments and switches traffic from the old to the new in one step (and back, to roll back).

## Tool-to-stage map

GitHub Actions and Jenkins are CI engines that can *also* perform push-based CD. Docker packages the artifact; a registry such as ECR stores it. ArgoCD is a GitOps CD tool, and only for Kubernetes. Kubernetes is the runtime orchestrator. AWS is the substrate hosting all of it. One common end-to-end stack: GitHub → GitHub Actions (CI, builds the image) → ECR (registry) → ArgoCD (GitOps CD) → EKS (Kubernetes on AWS).

## The dividing line

The conventional boundary between the two halves: CI ends when a tested, shippable artifact exists, and CD begins when that artifact is placed into a running environment — with packaging (image plus registry) as the seam between them. Treat this as the standard conceptual split rather than a strict rule, because real pipelines sometimes cross it — for instance, a CI run that also deploys to a temporary review environment.
