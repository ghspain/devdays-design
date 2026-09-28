# Impeccable editor clarity

- **Objective**: Resolve the five supplied Impeccable editor findings while preserving GHSpain design identity and existing format/export behavior.
- **Problem / why**: Dark Primer field labels were hard to read; design validation could be mistaken for print approval; event context was hidden; the speaker catalogue was long; export choices had unclear scope.
- **Authorized scope**: Contrast, readiness copy, initial Event context, local speaker/session catalogue search and selected summary, badge export hierarchy; focused Playwright coverage.
- **Constraints**: Keep Primer and existing React flows; keep Mona Sans; no new editor/parser dependency; never describe uncalibrated badge output as print-ready. User confirmed Event should open at first load.
- **Route**: Implementation was performed inline before the current ODD routing rules replaced the prior AGENTS.md. This feature crosses 4+ files and would route to delegated mapping/writer under current rules; no implementation delegation occurred. Do not misrepresent that as compliant. An independent reviewer was delegated, then interrupted when the replacement AGENTS.md required explicit credential/session authorization for remote work. The user has now authorized the active GitHub CLI session for repository operations.
- **TDD mode/source/runner**: No project TDD mode was identified in inspected instructions; ordinary validation used npm + Playwright. No RED-before-implementation evidence is claimed.
- **Delivery strategy**: `single-pr`; one combined issue/PR because all five concerns converge on the editor flow and share App.tsx behavior.

## Tasks

- [x] **C1: Make dark Primer labels readable** — imported Primer functional light/dark theme tokens and BaseStyles; added computed contrast browser assertion. **Evidence**: `tests/visual/shell-theme.spec.ts`; `npm run lint`, `npm run build`, full Playwright suite.
- [x] **C2: Separate design checks from printer calibration** — Speaker Badge success label names front/back design checks and preserves physical calibration caveat. **Evidence**: `tests/visual/print-geometry.spec.ts`.
- [x] **C3: Show event context at first load** — Event and Format open by default while user accordion state persists across format changes; user chose this option. **Evidence**: `tests/visual/sidebar-sections.spec.ts`.
- [x] **C4: Make Planning speakers scannable** — local search across name/session, results/empty state, pending count, and compact selected summary ahead of cards. **Evidence**: `tests/visual/primer-speakers.spec.ts`.
- [x] **C5: Clarify badge export scope** — single primary PNG CTA, explicit both-side and Event Pack secondary controls and count copy. **Evidence**: `tests/visual/download-hierarchy.spec.ts`, `tests/visual/speaker-badge-export.spec.ts`, `tests/visual/format-export-explanations.spec.ts`.
- [ ] **C6: Finish remote delivery** — PR #183 exists and closes #182, and the user has explicitly authorized remote operations on this repository using the active GitHub CLI session. The previously observed `visual-smoke` check was pending; an independent reviewer had been interrupted before reporting. Recheck the current PR and complete review before any merge.

## Verification

- `npm run lint` — passed.
- `npm run build` — passed; existing >500 kB bundle warning remains.
- `$env:E2E_PORT='4188'; npm run test:visual` — 434 passed, 8 skipped.
- Focused desktop/mobile suite after the final UI/test edit — 42 passed.
- `git diff --check` — passed (only CRLF normalization warnings on modified test files).
- Impeccable `detect --json` — only generic Mona Sans warning; preserved because brand/design docs require Mona Sans.
- Commit: `f7b4e86` (`Fix editor contrast and clarify badge workflow`), on `codex/impeccable-dark-primer-contrast`; task-document commits `0244505`, `f681a27`, and `4e7f4a5` are local and ahead of origin. Their push is now authorized.

## Next step

Push the local task-document commits to the authorized PR branch; recheck PR #183 and CI, perform independent review under current RDD policy, address findings, and merge only if approved and all protections pass.
