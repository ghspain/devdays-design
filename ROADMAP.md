# Event Studio roadmap

This repository is evolving from a Dev Days banner generator into a local-first event asset studio for GitHub Community Spain.

The roadmap preserves the existing social-image workflows and uses them as the production foundation for speaker badges, attendee badges, print outputs and broader event kits.

`PRODUCT.md` defines the product boundary and domain model. `DESIGN.md` defines how the application maps the GHSpain Dev Days design system and GitHub Primer into the editor and generated assets.

## Roadmap rules

1. Do not remove working banner capabilities just to simplify the refactor.
2. Refactor the domain before adding many badge-specific conditionals to `BannerState` and `renderBanner.ts`.
3. Deliver vertical slices that organizers can review in the real application.
4. Keep GitHub Pages and local-first processing as the default architecture until a concrete requirement needs a backend.
5. Keep reusable public person/event data canonical in `ghspain/Planning`.
6. Treat attendee imports as event-specific operational data, not as a new CRM.
7. Use `ghspain/devdays-design-system` as the visual authority for Dev Days artwork and Primer for application-shell interaction patterns.
8. Use the existing master tracker #146 for phase issues and dependencies; its existence does not waive review and merge of this product direction before implementation begins. Do not create duplicate P0/P1 epics. Decompose future P2+ work only after the P0/P1 path validates the shared abstractions.

## What remains in scope from the current product

Nothing in the current production workflow is intentionally removed by this roadmap.

The following capabilities remain supported and become foundations for later work:

- Luma Cover,
- Social Promo,
- Speaker Profile,
- Speaker Banner,
- Dev Days / Community Meetup / Online themes,
- local speaker, sponsor and organizer catalogues,
- multiple speakers and paired speaker layouts,
- live preview,
- draft persistence,
- export history,
- visual validation,
- PNG/JPG export,
- ZIP event packs,
- responsive/mobile editing,
- accessible Primer controls,
- Playwright visual regression coverage.

Existing persisted states may require migrations as the domain model evolves, but existing output behavior should remain reproducible.

## Target product structure

The product should move from one large banner model toward a registry of event asset families:

```text
Event Project
  |
  +-- Event data
  +-- People and participations
  +-- Sponsors / organizers
  +-- Operational attendee import
  +-- Theme
  |
  +-- Assets
      +-- Event social
      +-- Speaker social
      +-- Covers
      +-- Speaker badges
      +-- Attendee badges
      +-- Staff / organizer / partner badges
      +-- Print materials
      +-- Post-event assets
```

Each asset is composed from:

```text
data + template + theme + side(s) + export profile
```

This is the architectural direction for future epics. It is not a requirement to rewrite every existing module before the first useful feature can ship.

# Delivery roadmap

## Phase 0 - Product and architecture alignment [NOW]

Goal: agree on the product before multiplying formats and editor conditionals.

### Deliverables

- [x] Reframe `PRODUCT.md` from social-image generator to event asset studio.
- [x] Preserve the current banner/social functionality as an explicit product foundation.
- [x] Define the target concepts: Event Project, Person, Participation, Asset, Template, Theme, Side, QR Destination and Export Profile.
- [x] Define local-first attendee privacy boundaries.
- [x] Establish `ghspain/devdays-design-system` as visual source of truth for Dev Days artwork.
- [x] Define Primer light/dark application surfaces as a semantic mapping, not a literal inverse of the dark deck palette.
- [ ] Review and approve this product direction.
- [x] Track implementation epics and issue dependencies in [the GHSpain Event Studio tracker](https://github.com/ghspain/devdays-design/issues/146); follow its dependency graph.

### Exit criterion

We can describe a speaker badge, attendee badge and social asset using the same domain vocabulary without adding a one-off data model for each.

---

## Phase 1 - Domain foundation and renderer boundaries [P0]

Goal: create extension points before adding the new physical-asset families.

### Work

- [x] Current formats resolve through reusable asset and template contracts. (#105)
- [x] Existing social assets render through isolated renderer boundaries. (#106)
- [x] Existing drafts and history migrate through a versioned state boundary. (#107)
- [x] A test asset can be registered without changing unrelated social switches. (#108)

### Suggested target boundaries

```text
src/domain/
  event
  person
  participation
  asset
  template
  qr
  export-profile

src/templates/
  social/
  badges/
  covers/

src/renderers/
  canvas/
  svg/
  print/
```

Directory names are provisional. The architectural responsibilities are the important part.

### Exit criterion

A new asset family can be registered without editing a central type union, renderer switch and editor switch in several unrelated locations.

---

## Phase 2 - Canonical public profile projection from Planning [P0]

Goal: reuse public GHSpain person data instead of copying profile fields into another canonical store.

### Current evidence

The local `data/people.csv` currently contains only the subset needed by the banner generator.

`ghspain/Planning/data/people.csv` already contains reusable public fields such as:

- GitHub,
- LinkedIn,
- X,
- website,
- avatar,
- public bio,
- professional title.

### Work

- [x] Event Studio defines a safe public person projection from Planning. (#110)
- [x] Maintainers can refresh the local public profile projection reproducibly. (#111)
  - [x] Speaker selection exposes verified public profile destinations. (#112)
- Keep `person_id` stable across Planning and the local projection.
- Add an import/sync generation path that can refresh the static local catalogue without adding runtime credentials.
- Continue supporting local/fallback avatar uploads where remote assets cannot be exported safely.
- Define freshness behavior for fields such as role/title and public URLs.

### Exit criterion

Selecting a known speaker gives the asset system the approved public identity fields needed for both social assets and QR-enabled badges.

---

## Phase 3 - Reusable QR destination system [P0]

Goal: make QR codes a reusable asset element rather than a speaker-specific URL field.

### Supported destination types

- none,
- person profile,
- event agenda,
- event/registration page,
- sponsor website,
- custom URL.

### Person profile choices

- GitHub,
- LinkedIn,
- X,
- website.

### Work

- [x] QR destinations resolve independently from the asset that uses them. (#114)
- [x] Templates can render deterministic QR elements entirely in the browser. (#115)
- [x] Organizers can choose and validate a QR destination before export. (#116)
- Generate QR codes client-side.
- Allow template defaults and per-asset override.
- Allow optional human-readable handle/URL text.
- Validate empty/invalid destinations before export.
- Keep generated QR content deterministic for visual/regression testing.

### Exit criterion

Any compatible template can place a validated QR element without knowing whether the subject is a speaker, attendee, organizer or sponsor.

---

## Phase 4 - Multi-side assets and speaker badge vertical slice [P0]

Goal: prove the new model end-to-end with the smallest high-value physical asset.

### Speaker badge flow

```text
Create
  -> Speaker badge
  -> Select event
  -> Select speaker
  -> Choose/edit front
  -> Choose QR destination
  -> Review back
  -> Validate
  -> Export
```

### Front

Potential template fields:

- speaker photo,
- public name,
- professional title / short role,
- event identity,
- SPEAKER marker,
- selected networking handle.

### Back

Potential template fields:

- QR code,
- readable handle or URL,
- event/community identity,
- optional agenda/event information.

### Editor behavior

- Front / Back tabs or equivalent direct navigation.
- CSS 3D flip may be used as a presentation interaction, but Three.js is not required.
- Existing form controls remain available while the new workspace model is introduced.

### Exports

First slice:

- front PNG,
- back PNG,
- combined badge export contract ready for the print phase.

### Exit criterion

A speaker selected from GHSpain data can produce a front/back networking badge with a configurable QR and no manual data duplication.

---

## Phase 5 - Studio workspace evolution [P1]

Goal: evolve the current form-plus-preview UI into a more visual editing experience without building a general-purpose design tool.

### Direction

```text
Assets / templates | Artboard | Contextual properties
```

### Work

- Task-first entry: "What do you want to create?"
- Asset/template browser instead of requiring users to understand internal format IDs.
- Central artboard as the main editing surface.
- Click/select an element to reveal its properties.
- Constrained drag/reposition/resize only for template elements that permit it.
- Alignment, safe areas and template limits remain enforceable.
- Front/back navigation integrated into the workspace.
- Keep responsive/mobile editing usable.

### Technology decision gate

Evaluate a 2D scene/editor library before implementing direct manipulation.

Candidates to assess include:

- Konva / react-konva,
- Fabric.js,
- a smaller internal adapter if the required interactions remain limited.

Do not introduce Three.js as the editing foundation. 3D can be evaluated later for optional physical mockups.

### Exit criterion

An organizer can edit a supported template by interacting with the artboard while the template remains constrained and brand-safe.

---

## Phase 6 - Attendee CSV import and mapping [P1]

Goal: support large event badge runs without turning Planning into an attendee CRM.

### Flow

```text
Upload CSV
  -> Detect columns
  -> Map fields
  -> Validate rows
  -> Review warnings/errors
  -> Choose badge template
  -> Configure QR rule
  -> Generate batch
```

### Requirements

- CSV parsing runs locally.
- Column names are not assumed. Organizers can map arbitrary source columns to the badge contract.
- Required and optional fields are explicit.
- Invalid rows can be identified and corrected or excluded.
- Imported attendee data is session-only by default.
- The UI offers an explicit clear-data action.
- No attendee CSV is committed or uploaded to GitHub Pages infrastructure.

### Delivery phases

- [x] Attendee CSV files are parsed locally without persisting rows by default. (#129)
- [ ] Organizers can map arbitrary CSV columns to the attendee badge contract. (#130)
- [ ] Imported attendees are validated row by row before badge generation. (#131)
- [ ] Organizers preview representative attendee badges and can clear imported data explicitly. (#132)

### Representative preview strategy

Do not render hundreds of badges in the editor at once.

Preview a useful sample such as:

- first row,
- longest name,
- rows with missing optional fields,
- representative badge types,
- a small random sample.

### Exit criterion

An organizer can safely import a real attendee file and understand exactly which rows will generate which badge data before starting a batch.

---

## Phase 7 - Attendee badge and badge roles [P1]

Goal: generalize the speaker badge template family to attendee and event-team roles.

### Initial badge roles

- attendee,
- speaker,
- organizer,
- staff,
- volunteer,
- sponsor/partner.

Roles may share one structural template while changing color, label, QR defaults or visible fields.

### Default QR examples

| Badge role | Suggested default |
| --- | --- |
| Speaker | selected public profile |
| Attendee | agenda/event page |
| Organizer | agenda/community page |
| Staff | agenda/event page |
| Sponsor | sponsor website |

Defaults remain editable.

### Exit criterion

The badge system is role-driven and template-driven, not implemented as separate renderer copies for each role.

---

## Phase 8 - Batch render pipeline [P1]

Goal: generate hundreds or thousands of assets without freezing the editor or reusing the small speaker-pack loop as-is.

### Work

- dedicated render queue,
- chunked processing,
- progress reporting,
- cancel/retry behavior,
- deterministic filenames,
- bounded memory use,
- investigate Web Workers / OffscreenCanvas where browser support and measured performance justify them,
- preserve validation reporting across the batch.

### Exit criterion

A realistic attendee batch can be generated reliably with visible progress and without making the page unusable.

---

## Phase 9 - Print production [P1]

Goal: treat physical output as a real production workflow rather than as another PNG resolution.

### Print model

Support template/export metadata such as:

- physical width/height,
- DPI,
- bleed,
- safe area,
- crop marks,
- page size,
- margins/gaps,
- duplex front/back alignment,
- long-edge / short-edge flip where relevant.

### Exports

- individual high-resolution assets,
- SVG where the renderer permits it,
- print-ready PDF,
- A4/A3 badge sheets,
- front/back sheets aligned for duplex printing.

### Exit criterion

The generated output can be sent to a printer with known physical dimensions and predictable front/back registration.

---

## Phase 10 - Event Kits [P2]

Goal: evolve the current ZIP Event Pack into a selectable production package for one event.

Example:

```text
Dev Days Madrid

Social
  [x] event announcement
  [x] speaker assets
  [x] Luma cover

Print
  [x] speaker badges
  [x] organizer badges
  [x] attendee badges
  [ ] agenda sheets
```

### Work

- select asset families to generate,
- show expected output counts,
- validate the complete kit,
- create structured folders/manifests,
- allow re-running only failed or changed outputs where useful.

### Exit criterion

One event project can generate a coherent set of digital and printable materials without re-entering event data.

---

## Phase 11 - Additional event materials [P2]

Candidate templates, prioritized only from real event needs:

- agenda social card,
- schedule/agenda print sheet,
- room signage,
- directional signage,
- sponsor panel,
- registration reminder,
- last-call social card,
- thank-you speaker card,
- thank-you sponsor card,
- post-event recap cover.

Do not implement the whole catalogue speculatively. The template system should make each additional asset cheap once a real use case exists.

---

## Phase 12 - Shared projects and remote integrations [P3]

Goal: add server-side infrastructure only when local-first stops being enough.

Possible triggers:

- several organizers need to edit the same event project,
- cross-device continuity is required,
- role-based access is required,
- Planning/Luma synchronization must happen at runtime,
- generated artifacts need durable shared storage.

Only then evaluate authentication, database/storage and backend hosting.

Direct social publishing remains a separate product decision, not an implied consequence of adding a backend.

---

## Phase 13 - Optional 3D physical preview [P3]

Goal: improve presentation confidence, not editing fundamentals.

Possible use cases:

- lanyard mockup,
- badge front/back rotation,
- physical scale visualization.

This phase may use Three.js or another 3D layer if it provides clear value. It does not replace the 2D asset renderer/editor.

# Completed foundation

The previous roadmap work remains valuable and is not superseded by the broader product vision.

## UI and functional coherence pass - epic #12

Completed work aligned format behavior, speaker rendering, catalogue management, sidebar sections and state normalization.

Key phases: #13, #14, #15, #16, #17.

## Visual validation - epic #26

Completed work added truncation, dropped-content, contrast and safe-area validation with pre-export feedback.

Key phases: #27, #28, #29, #30, plus hardening follow-ups #23, #24 and #32.

## Primer editor migration - epic #39

Completed work moved the editor controls toward GitHub Primer patterns and accessible components.

Key phases: #40, #41, #42 and #43.

## Event visual themes - epic #48

Completed work made event appearance data-driven and added Dev Days, Community Meetup and GitHub-style online themes.

Key phases: #49, #50, #51 and #52.

## Guided/reliable editor - epic #53

Completed work improved mobile behavior, draft persistence, format clarity, validation navigation, visual format/theme selection and onboarding.

Key phases: #54, #55, #56, #57, #64, #65 and #66.

## Editor coherence and polish - epic #71

Completed work refined action hierarchy, progressive disclosure, text-fit guidance and theme previews.

Key phases: #72, #73, #74, #75 and #76.

## Critique follow-up - epic #83

Completed work consolidated downloads, reduced sidebar density, differentiated validation severities, added undo for destructive actions and improved format-change feedback.

Key phases: #78, #79, #80, #81 and #82.

## Multi-speaker cards - epic #87

The existing speaker asset workflow supports one/two-speaker grouping and vertical pair layouts, with current follow-up work tracked independently.

# Deferred / explicit non-goals

These are not part of the near-term implementation roadmap:

- replacing `ghspain/Planning` with a CRM inside this repository,
- attendee registration/check-in management,
- private contact-data management,
- direct LinkedIn/X/Slack publishing,
- a general-purpose unconstrained design editor,
- mandatory backend infrastructure,
- 3D-first editing.

# Execution tracker

The near-term roadmap is decomposed in the [GHSpain Event Studio tracker](https://github.com/ghspain/devdays-design/issues/146), including the dependency graph and phase acceptance criteria. Follow that tracker when implementing; do not create a duplicate epic tree. The roadmap defines product direction and longer-term scope, while the tracker is authoritative for execution order.

Phases 10+ remain intentionally at roadmap level. Decompose them only after the P0/P1 path proves the shared asset, template, batch and print abstractions in production.
