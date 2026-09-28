# Impeccable editor clarity

- **Objective**: Resolve the five supplied Impeccable editor findings while preserving GHSpain design identity and existing format/export behavior.
- **Problem / why**: Dark Primer field labels were hard to read; design validation could be mistaken for print approval; event context was hidden; the speaker catalogue was long; export choices had unclear scope.
- **Authorized scope**: Contrast, readiness copy, initial Event context, local speaker/session catalogue search and selected summary, badge export hierarchy; focused Playwright coverage.
- **Constraints**: Keep Primer and existing React flows; keep Mona Sans; no new editor/parser dependency; never describe uncalibrated badge output as print-ready. User confirmed Event should open at first load.
- **Route**: Prior implementation was inline before the current ODD routing rules replaced the prior AGENTS.md; under current rules it would have required delegated mapping/writer work. This follow-up used a delegated language-policy audit (mapping trigger), then an inline one-file AGENTS.md change plus PR body update. Ledger and mirror upkeep is delegated because two artifacts must stay synchronized. Do not claim application tests were rerun for the docs-only change.
- **TDD mode/source/runner**: No project TDD mode was identified in inspected instructions; ordinary validation used npm + Playwright. No RED-before-implementation evidence is claimed.
- **Delivery strategy**: `single-pr`; one combined issue/PR because all five concerns converge on the editor flow and share App.tsx behavior.

## Tasks

- [x] **C1: Make dark Primer labels readable** — imported Primer functional light/dark theme tokens and BaseStyles; added computed contrast browser assertion. **Evidence**: `tests/visual/shell-theme.spec.ts`; `npm run lint`, `npm run build`, full Playwright suite.
- [x] **C2: Separate design checks from printer calibration** — Speaker Badge success label names front/back design checks and preserves physical calibration caveat. **Evidence**: `tests/visual/print-geometry.spec.ts`.
- [x] **C3: Show event context at first load** — Event and Format open by default while user accordion state persists across format changes; user chose this option. **Evidence**: `tests/visual/sidebar-sections.spec.ts`.
- [x] **C4: Make Planning speakers scannable** — local search across name/session, results/empty state, pending count, and compact selected summary ahead of cards. **Evidence**: `tests/visual/primer-speakers.spec.ts`.
- [x] **C5: Clarify badge export scope** — single primary PNG CTA, explicit both-side and Event Pack secondary controls and count copy. **Evidence**: `tests/visual/download-hierarchy.spec.ts`, `tests/visual/speaker-badge-export.spec.ts`, `tests/visual/format-export-explanations.spec.ts`.
- [ ] **C6: Finish remote delivery** — PR #183 exists and closes #182. Current head is `987c6d9`; `gh pr checks 183` showed `visual-smoke` pending at update time. The independent reviewer found no blocking issues on prior head `075bc7e`. GitHub rejected the APPROVE submission because the active CLI account owns the PR. Formal approval from a different eligible account is still required; do not merge until approved.
- [x] **C7: Correct PR language and repository policy** — Verified no language requirement in AGENTS.md or `.github/skills/phased-delivery/SKILL.md`, no PR template/config, and English issue #182 plus PRs #172–#180; Spanish PR text came from the Spanish chat default, not repository settings. Updated PR #183 body in English and added the English repo-content policy to AGENTS.md. Commit `987c6d9` pushed; the push also delivered local ledger commit `aa190ad`, making `987c6d9` the current PR head. **Evidence**: `git diff --check` passed for AGENTS.md; no application tests rerun for this docs-only change.

## Verification

- `npm run lint` — passed.
- `npm run build` — passed; existing >500 kB bundle warning remains.
- `$env:E2E_PORT='4188'; npm run test:visual` — 434 passed, 8 skipped.
- Focused desktop/mobile suite: 42 passed in the implementation run; reviewer rerun: 96 passed, 6 skipped.
- `git diff --check` — passed (only CRLF normalization warnings on modified test files).
- Native RDD assessment: gentle-ai is unavailable in this environment; assessment and preflight STATUS could not run. Treat review as due; do not infer low risk.
- Impeccable `detect --json` — only generic Mona Sans warning; preserved because brand/design docs require Mona Sans.
- Implementation commit: `f7b4e86` (`Fix editor contrast and clarify badge workflow`); ODD docs commit `aa190ad` was delivered by the push with `987c6d9` (`docs: require English repository content`). Current PR head is `987c6d9`; `gh pr checks 183` showed `visual-smoke` pending at the time of this update. Formal approval from a different eligible account remains outstanding.

## Next step

Obtain a GitHub APPROVE from another eligible reviewer account/session; after the formal review and all required protections pass, merge PR #183. Do not bypass self-review or branch protection.
