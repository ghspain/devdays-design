# Dev Days Design roadmap

This repository stays focused on generating event visual assets. It is not the
community CRM, event database, or social publishing system.

## In scope

1. Local speaker catalogue with a reduced `people.csv` contract.
2. Local sponsor catalogue with `sponsors.csv` and direct upload fallback.
3. Presets for Dev Days, Community Meetup, and online events. ✅
4. Editable event title, edition, city, venue, date, and registration fields.
5. Visual validation for overflow, safe areas, contrast, and logo limits.
6. Batch generation of the supported image formats from one event state.

## Explicitly deferred

- Direct GitHub or Planning synchronisation.
- Luma API creation or event updates.
- Slack, LinkedIn, X, or other communication publishing.
- Full speaker CRM, contact details, biographies, or private data.

## Delivery order

1. Load and select local speakers and sponsors. ✅
2. Apply and edit event presets. ✅
3. Add visual validation feedback before export. ✅
4. Generate a ZIP containing all selected event materials. ✅

## Coherence pass (epic #12)

A spec-driven pass to align the editor's UI and behaviour after the rapid growth
of #6–#11. Tracked as an epic with one issue per phase:

- Epic: ghspain/devdays-design#12 — UI and functional coherence pass.
- Phase 1: #14 — presets must not change the banner format.
- Phase 2: #13 — Speaker Profile renders speakers inside the canvas.
- Phase 3: #16 — coherent speaker management from the Planning catalogue.
- Phase 4: #17 — align sidebar sections and format groups with the renderer.
- Phase 5: #15 — full validation pass (lint, build, visual tests).

## Editor coherence pass (epic #53)

A follow-up coherence pass addressing mobile layout, draft persistence, format
clarity, and actionable validation feedback. Tracked as an epic with one issue
per phase:

- Epic: ghspain/devdays-design#53 — Editor coherence and usability pass.
- Phase 1: #57 — mobile editing keeps every field clear of the action bar.
- Phase 2: #54 — event drafts survive reloads before export (IndexedDB).
- Phase 3: #56 — formats and downloads explain the asset being created.
- Phase 4: #55 — validation takes users directly to the field to fix.
- Phase 5: #64 — Organizers can compare formats and themes visually.
- Phase 6: #65 — Organizers can switch between fields and preview on mobile.
- Phase 7: #66 — New organizers understand formats, presets, themes, and exports.

## Editor coherence and polish pass (epic #71)

A polish pass on the editor: mobile footer clearance, download hierarchy,
sidebar reordering, truncation indicators, and theme previews. Tracked as an
epic with one issue per phase:

- Epic: ghspain/devdays-design#71 — Editor coherence and polish pass.
- Phase 1: #72 — mobile editing keeps fields clear of the footer at every width.
- Phase 2: #73 — the PNG download is the primary action and the ZIP is secondary.
- Phase 3: #74 — the sidebar leads with essentials and folds advanced controls.
- Phase 4: #75 — fields that truncate in the banner are flagged next to the field.
- Phase 5: #76 — theme cards show a visual preview of each theme.

## Visual validation (epic #26)

Roadmap item 5 shipped as a spec-driven epic with one issue per phase:

- Epic: ghspain/devdays-design#26 — visual validation before export.
- Phase 1: #27 — detection engine (overflow/truncation and dropped-content flags).
- Phase 2: #28 — pixel checks on the rendered canvas (WCAG contrast, safe area).
- Phase 3: #29 — validation feedback panel in the sidebar.
- Phase 4: #30 — full test pass (per-format coverage, stress runs) and roadmap update.
- Hardening follow-ups (PR #33): #23 — staleness guards in the async banner renderer; #24 —
  adaptive settle probe in the footer regression test; #32 — unbreakable-word truncation and a
  more robust background estimate for the contrast check.

The local files act as a stable, human-editable contract. A future integration
may import from Planning, but the editor must remain usable without network
access or external credentials.
