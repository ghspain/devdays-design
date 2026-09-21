---
name: phased-delivery
description: "Deliver any non-trivial feature, fix or refactor through a GitHub epic plus numbered phase issues, then implement and validate phase by phase. Use when starting substantial work, when a request mixes several bugs/features, or when the user asks to plan or track work in phases ('hazlo por fases', 'crea los issues'). Issue and PR titles must stay free of methodology jargon."
license: MIT
metadata:
  author: svg153
  version: "1.0"
---

# Phased Delivery (epic + phase issues)

Turn a vague request ("arregla X, y tambien Y") into a tracked, verifiable chain:
**investigate -> epic issue -> phase issues -> implement per phase -> validate -> PR that closes each phase.**

## 0. Build or reuse first

Before writing any new tooling (scripts, skills, CI helpers), check whether it already exists:

1. Search the team catalogs: [svg153/skills](https://github.com/svg153/skills) and [ghspain/github-build-or-reuse](https://github.com/ghspain/github-build-or-reuse).
2. Reuse external skills **via apm**, never by copy-pasting their content:

   ```bash
   apm install svg153/skills/skills/<name> --target agent-skills   # one skill
   apm install --frozen                                            # from committed apm.lock.yaml
   apm audit                                                       # provenance/license check
   ```

   Commit `apm.yml` / `apm.lock.yaml` so the pin is reproducible.
3. Only build locally what no catalog covers; keep it project-specific.

## 1. Investigate before planning

- Reproduce every reported symptom in the running app before writing issues (Playwright probes or manual click-through). Record the **root cause**, not the complaint.
- Note environment gotchas found while probing (e.g. a port already serving a different app) and fix them as part of the relevant phase.

## 2. Create the epic and phase issues

Prerequisites (check once per repo):

```bash
gh api repos/ghspain/devdays-design --jq .has_issues   # if false: PATCH {"has_issues":true}
gh label create epic  --repo ghspain/devdays-design --color 5319e7
gh label create phase --repo ghspain/devdays-design --color a2eeef
```

Rules:

- **Epic issue**: label `epic`, title `Epic: <theme>` (e.g. "Epic: UI and functional coherence pass"). Body: context, confirmed root causes, phase list with links.
- **One issue per phase**: labels `phase` + `bug`/`enhancement`, title `Phase N: <observable outcome>` written as user-visible behaviour, never as an internal task.
- **No methodology jargon in titles or headings** (no "GSD", sprint names, persona names...). The process lives in this skill; titles describe the product outcome.
- Number phases by execution order (P0-breaking first). Each body must contain: problem, approach, and **acceptance criteria as testable bullets** - every bullet becomes a Playwright assertion or a lint/build gate.
- Link phases to the epic as sub-issues (the API needs the database id, not the issue number):

```bash
$dbId = gh api repos/ghspain/devdays-design/issues/<N> --jq .id
gh api -X POST repos/ghspain/devdays-design/issues/<epic>/sub_issues -F sub_issue_id=$dbId
```

## 3. Implement phase by phase

- One branch for the whole epic is fine when phases share files (`<user>-<theme>`); one PR per phase when they are independent.
- Commit per logical unit; always end commit messages with the `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` trailer.
- Do not silently change scope: if a phase reveals a new bug, add a new phase issue instead of absorbing it.

## 4. Validate before opening the PR

Run the project gates and a Playwright spec **per acceptance criterion** added in `tests/visual/`:

```bash
npm run lint
npm run build
$env:E2E_PORT='4188'; npm run test:visual   # 4173 may be squatted by another session's vite
```

- `playwright.config.ts` honours `E2E_PORT`; CI keeps the default 4173.
- Never trust `reuseExistingServer` blindly - assert the page title/root element identifies *this* app in `beforeEach`.
- Tests must fail if the phase regresses: encode the symptom (e.g. "changing preset keeps format", "avatar pixels stay inside the canvas bounds").

## 5. Open the PR and close the loop

- PR body: summary, per-phase changes, validation evidence, and one `Closes #<N>` line per phase issue.
- Comment the PR link on the epic issue.
- After merge: phase issues auto-close; close the epic only when every phase (including validation) is done. Update `ROADMAP.md` with the same wording as the issue titles.

## Checklist

- [ ] Build-or-reuse check done (apm for external skills, lockfile committed)
- [ ] Symptoms reproduced, root causes in the epic body
- [ ] Epic + phase issues created, labelled, sub-issue linked, jargon-free titles
- [ ] Acceptance criteria written as testable bullets
- [ ] lint + build + targeted Playwright specs green
- [ ] PR with `Closes #...` per phase, link commented on epic
- [ ] `ROADMAP.md` updated
