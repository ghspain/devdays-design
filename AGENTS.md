# devdays-design

React + Vite banner generator for DevDays events (Canvas rendering, presets, speaker packs).

## Workflow

Substantial work (features, fixes, refactors) must go through the **phased-delivery** skill:
`.github/skills/phased-delivery/SKILL.md` - investigate, open an epic plus numbered phase issues,
implement and validate phase by phase, and land a PR that closes each phase. Issue and PR titles
describe product outcomes, never methodology names.

Before adding tooling or skills, check the team catalogs (svg153/skills,
ghspain/github-build-or-reuse) and reuse via `apm install` instead of copying.

## Validation gates

```bash
npm run lint
npm run build
npm run test:visual   # Playwright; set E2E_PORT if 4173 is busy
```
