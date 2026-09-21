# devdays-design

React + Vite banner generator for DevDays events (Canvas rendering, presets, speaker packs).

## Workflow

Substantial work (features, fixes, refactors) must go through the **phased-delivery** skill:
`.github/skills/phased-delivery/SKILL.md` - investigate, open an epic plus numbered phase issues,
implement and validate phase by phase, and land a PR that closes each phase. Issue and PR titles
describe product outcomes, never methodology names.

Before adding tooling or skills, check the team catalogs (svg153/skills,
ghspain/github-build-or-reuse) and reuse via `apm install` instead of copying.

Each PR gets an independent reviewer sub-agent (`glm5.3-flash`) that validates the issue,
the diff, the gates and the live UI before approving; coding sub-agents run on
`qwen3.8-flash`. Merge only after reviewer approval.

## Validation gates

```bash
npm run lint
npm run build
npm run test:visual   # Playwright; set E2E_PORT if 4173 is busy
```
