# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web, local-first, deployable as a static GitHub Pages application.

## Users

Primary users are GitHub Community Spain organizers preparing visual and printable materials for community events.

Secondary users may include trusted local-event volunteers who need to generate event assets from approved templates without becoming designers or having access to private community systems.

## Product Purpose

This product is evolving from a Dev Days social-image generator into a reusable **event asset studio** for GitHub Community Spain.

Its purpose is to generate consistent event materials from shared event and people data, across social, digital, networking, and print use cases. The same event project should be able to produce social posts, speaker assets, event covers, speaker and attendee badges, and future printable materials without duplicating event data or rebuilding each design by hand.

The current banner generator is not discarded. It becomes the first production-ready asset family inside the broader studio.

## Product Promise

An organizer should be able to choose what they need to create, load or provide the relevant event data, adjust the content visually, validate the result, and export one asset or a complete event kit with confidence.

The default experience should remain guided and template-driven. The product may become more visual and direct-manipulation oriented, but it is not intended to become a generic Canva replacement.

## Positioning

The product is a **local-first, template-driven event production tool**, not a generic image editor, CRM, registration platform, or social publishing platform.

It combines:

- reusable event and person data,
- GitHub Community Spain visual themes,
- constrained templates,
- live visual editing,
- validation before export,
- batch generation,
- print-aware exports,
- privacy-friendly local processing.

The differentiator is the connection between structured event data and a reusable family of assets. Organizers should not have to re-enter the same speaker, event, sponsor, or attendee information for every output.

## Product Model

The target domain model is broader than the current `BannerState` model.

### Event Project

A working context containing the event data and the assets being produced for that event.

Typical data includes:

- event identity, edition, city, venue, date, agenda and public URLs,
- organizers and sponsors,
- people and their event participations,
- attendee data imported for a specific production session,
- selected visual theme and templates,
- generated assets and export settings.

### Person

A reusable public identity such as a speaker, host, organizer, collaborator or guest.

Canonical public person data belongs in `ghspain/Planning` when appropriate. This application should consume a safe projection of that data instead of creating a second canonical person database.

### Participation

The relationship between a person and an event, such as speaker, host, moderator, organizer, guest, volunteer or partner.

### Asset

One generated output. Assets belong to families rather than being represented as one growing banner enum.

Initial and planned families include:

- event social,
- speaker social,
- event covers,
- speaker badges,
- attendee badges,
- organizer/staff/partner badges,
- print materials,
- post-event materials.

### Template

The layout and content contract for an asset. Templates define which data fields, layers, constraints, sides and export profiles apply.

Templates should be reusable across compatible events and themes.

### Theme

The event visual identity applied to compatible templates. Theme and template remain separate concepts.

### Side

Assets may have one or more sides. Social assets are normally front-only. Badges can have front and back sides.

### QR Destination

A QR code is a reusable content element, not a speaker-only field. Supported destinations should include:

- none,
- a selected public person profile,
- event agenda,
- registration or event page,
- sponsor website,
- custom URL.

Person-profile destinations may resolve to GitHub, LinkedIn, X or a personal website when those values exist.

### Export Profile

Defines how an asset is delivered, for example:

- social PNG/JPG dimensions,
- SVG where appropriate,
- individual badge images,
- print-ready PDF,
- A4/A3 badge sheets,
- front/back duplex settings,
- batch ZIP packages.

## Core Use Cases

### 1. Event social assets

Generate event promotion assets such as event announcements, registration promos, Luma covers and other channel-specific materials.

This is the current mature capability and remains in scope.

### 2. Speaker social assets

Generate one or more social assets per speaker or session, including existing square and portrait formats and multi-speaker layouts.

These are promotional assets and are distinct from physical speaker badges.

### 3. Speaker badges

Select a known speaker from event data and generate a front/back networking badge.

The front may contain photo, public name, role, event identity and a selected public handle. The back may contain a configurable QR destination and supporting text.

### 4. Attendee badges

Upload an attendee CSV, map input columns to the badge data contract, validate rows, preview representative records, and batch-generate badges.

Attendee data should be processed locally by default and should not become part of the canonical `Planning` people catalogue unless there is a separate explicit reason to do so.

### 5. Event kits

Generate a selected collection of assets for one event from the same event project, for example social assets, speaker cards, covers and printable badges.

The current "Event pack" ZIP is the first version of this concept.

## Current Implementation as Foundation

The following existing capabilities are retained and should be evolved rather than removed:

- live browser canvas rendering,
- the four current formats: Luma Cover, Social Promo, Speaker Profile and Speaker Banner,
- event themes,
- speaker and sponsor catalogues,
- multi-speaker cards,
- draft persistence,
- export history,
- PNG/JPG export,
- ZIP event pack generation,
- overflow, truncation, contrast and safe-area validation,
- responsive editor behavior,
- Primer-based accessible controls,
- Playwright visual regression coverage.

The product evolution must preserve working outputs or provide an explicit migration path when domain types are refactored.

## Data Sources and Ownership

### Canonical community data

`ghspain/Planning` remains the source of truth for reusable public person identity and event participation data when that information belongs to community planning.

Its richer `people.csv` already supports public fields such as GitHub, LinkedIn, X, website, avatar, bio and professional title. This application should consume only the fields required for asset generation.

### Local operational catalogue

The local `data/` directory remains useful as a static, offline-capable projection or fixture. It must not silently become a competing source of truth.

### Attendee imports

Attendee CSV data is event-specific operational input. By default it should remain in browser memory for the current production session, with explicit controls if local persistence is later offered.

Private attendee data must not be committed to the repository.

## Design Authority

The visual source of truth for Dev Days and GitHub Copilot-inspired event artwork is the separate repository:

`ghspain/devdays-design-system`

It contains the extracted Dev Days design language, including Mona Sans typography, dark surfaces, Copilot green/lime/purple/blue accents, gradients and composition principles.

This application should consume or map those design decisions rather than maintaining an unrelated brand system locally.

The editor shell and the generated artwork are related but not identical surfaces:

- generated Dev Days artwork follows the Dev Days design system,
- the editor shell may use GitHub Primer light or dark application surfaces,
- a light application shell must use semantic GitHub/Primer tokens rather than a literal mathematical inversion of the dark Dev Days palette,
- event-specific themes may vary the generated artwork while preserving the overall GHSpain/GitHub visual language.

See `DESIGN.md` for the application-level mapping.

## Interaction Direction

The current form-plus-preview model is a useful base but should evolve toward a studio workspace:

- task-first creation instead of forcing users to understand internal format IDs,
- asset/template browsing,
- a central artboard,
- contextual properties for the selected element,
- front/back navigation for multi-side assets,
- direct visual selection and constrained manipulation where it improves speed,
- batch and print workflows as dedicated flows instead of overloading the social editor.

A 2D editing model is the primary need. Three-dimensional presentation may be considered later for optional lanyard or badge mockups, but it is not a prerequisite for the editor.

## Operating Context

- The application should continue to work on GitHub Pages for the planned local-first phases.
- No backend is required for QR generation, CSV import, local validation, Canvas/SVG generation, ZIP export or client-side PDF generation.
- A backend becomes justified only when shared projects, authentication, server-side persistence, cross-device collaboration or remote integrations become product requirements.
- The product should remain useful without network credentials whenever practical.

## Privacy and Safety Principles

1. Attendee data is processed locally by default.
2. No private attendee CSV is committed to the repository.
3. Browser persistence of attendee data must be explicit and clear to the organizer.
4. The UI should provide an obvious way to clear imported attendee data.
5. Public person profiles used for QR codes must come from explicit public fields or an organizer-supplied URL.

## Product Principles

1. **One event, many assets.** Enter reusable information once and produce multiple consistent outputs.
2. **Structured data before duplicated copy.** Reuse canonical person and participation data where it exists.
3. **Template constraints over generic freedom.** Make good event design easy without requiring design expertise.
4. **Visual editing where it helps.** Direct manipulation should shorten workflows, not turn the product into an unconstrained graphics editor.
5. **Validate before production.** Social and print problems should be visible before files are exported or printed.
6. **Local-first by default.** Static deployment and browser-side processing are product advantages, especially for attendee data.
7. **Batch is a first-class workflow.** Hundreds of attendee badges are not treated as hundreds of manual single-image edits.
8. **Print is not just another PNG size.** Physical dimensions, safe area, bleed, duplex alignment and PDF layout need their own production rules.
9. **Preserve working capabilities during refactors.** Architecture changes must not casually regress current event production.
10. **Design source of truth stays external.** The product follows `ghspain/devdays-design-system` and Primer rather than inventing an isolated local brand language.

## Explicit Non-Goals for the Current Horizon

- becoming the community CRM,
- becoming an event registration/check-in platform,
- publishing directly to LinkedIn, X, Slack or other communication channels,
- building a full general-purpose Canva/Figma clone,
- requiring a backend before a concrete collaboration or synchronization use case needs it,
- using 3D as the core editing technology.

These may be revisited independently if a real workflow justifies them.

## Success Criteria

The product is succeeding when an organizer can:

1. select an event and an asset task,
2. reuse existing public event/person data or import the required operational data,
3. reach a correct visual result with minimal manual design work,
4. detect content and print problems before export,
5. export one asset or a complete production batch reliably,
6. do so without leaking attendee data or depending on unnecessary infrastructure.
