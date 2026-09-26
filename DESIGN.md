---
impeccable: design-schema 1
name: GHSpain Event Studio
mode: operate
platform: web
north-star: event-studio
---

# Design - GHSpain Event Studio

This document defines the application-level design direction for `ghspain/devdays-design` as it evolves from a social banner editor into a broader event asset studio.

It does not replace the visual source material in `ghspain/devdays-design-system`.

## Design source hierarchy

Use these sources in order:

1. **`ghspain/devdays-design-system`** for the Dev Days / GitHub Copilot visual language used by generated artwork.
2. **GitHub Primer** for application-shell controls, accessibility patterns, interaction semantics and light/dark UI surfaces.
3. **This file** for how those systems are combined inside the Event Studio product.
4. Local component styles only when the previous layers do not provide the required behavior.

The design-system repository is derived from the official GitHub Dev Days decks and is intentionally dark-first. It defines Mona Sans typography, near-black surfaces, Copilot green/lime/purple/blue accents, gradients, spacing character and composition principles.

The Event Studio application is allowed to have a light or dark editor shell. A light shell is **not** a mathematical color inversion of the dark Dev Days palette. It should use semantic Primer/GitHub light tokens while retaining the same typography, spacing discipline, interaction patterns and brand accents where appropriate.

## North star

**Event Studio: structured control around a visual artboard.**

The generated asset is the protagonist. The application exists to help an organizer create it quickly, safely and consistently.

The UI should feel like a lightweight GitHub-native production tool, not like a generic admin form and not like a full creative suite.

Core character:

- technical,
- calm,
- precise,
- visual,
- constrained,
- fast to understand,
- confident for batch production.

## Product surfaces

The product has two related but distinct visual surfaces.

### 1. Application shell

The editor/workspace around the asset.

Use:

- Primer components and interaction patterns,
- GitHub light/dark semantic surfaces,
- restrained depth and borders,
- one clear primary action per action group,
- compact but readable tool density,
- accessible keyboard/focus behavior.

### 2. Generated artwork

The social, badge, cover or print asset being created.

Use:

- the selected event theme,
- the GHSpain Dev Days design system where the event uses that identity,
- Mona Sans / Mona Sans Mono,
- template-specific layout rules,
- explicit safe areas and validation constraints.

The editor shell must not accidentally recolor generated artwork. Theme choice belongs to the asset, not to the surrounding tool chrome.

## Color system

### Canonical Dev Days artwork palette

From `ghspain/devdays-design-system`:

| Role | Value | Use |
| --- | --- | --- |
| Background base | `#000000` | Deep canvas/background |
| Elevated dark | `#0C1116` | Cards / panels in generated artwork |
| Elevated dark 2 | `#121613` | Alternate dark surface |
| Copilot green | `#5EEC83` | Primary brand accent |
| Lime | `#D3FA36` | High-energy highlight |
| Copilot purple | `#B870FF` | AI / Copilot accent |
| Blue | `#3194FF` | Supporting cool accent |
| Cyan | `#9EECFF` | Supporting highlight |
| Primary text | `#FFFFFF` | Text on dark artwork |
| Muted text | approx `#8B949E` | Secondary text on dark artwork |

Existing event-theme values in the application may differ because they predate the extracted design system. Do not perform a blind palette replacement inside this documentation PR. Palette convergence should be an implementation issue with screenshot/pixel review so existing event assets are not silently changed.

### Application shell light mode

Use semantic Primer/GitHub light roles such as:

| Role | Current reference |
| --- | --- |
| Base surface | `#ffffff` |
| Subtle/elevated surface | `#f6f8fa` |
| Border | `#d1d9e0` |
| Primary text | `#1f2328` |
| Muted text | `#59636e` |
| Interactive accent | `#0969da` |
| Danger | `#cf222e` |
| Warning | `#9a6700` |

These are application semantics, not an alternative event brand.

### Application shell dark mode

Dark mode should map the same semantic roles to Primer-compatible dark surfaces. Where the Dev Days palette already matches GitHub dark surfaces, reuse compatible values deliberately rather than by coincidence.

A future implementation issue should define the exact light/dark token mapping and remove legacy `--vscode-*` naming where it no longer reflects the product.

## Typography

### Generated artwork

Use the design-system families:

- **Mona Sans Display / Mona Sans** for display and headings,
- **Mona Sans** for body content,
- **Mona Sans Mono** for metadata, handles, technical labels and code-like content when appropriate.

### Application shell

Primer/system UI typography remains appropriate for dense controls. Mona Sans may be used selectively for product identity or high-level headings, but the editor should not sacrifice control readability or native GitHub familiarity.

The shell and the artwork do not need identical type scales.

## Layout evolution

### Current model

The current editor is primarily:

```text
controls | preview
```

This remains valid during the transition and must not be broken before the studio workspace is ready.

### Target workspace

The long-term desktop model is:

```text
+------------------+---------------------------+--------------------+
| Assets/Templates |                           | Properties         |
|                  |         ARTBOARD          |                    |
| Event            |                           | selected element   |
| Speakers         |                           | data + appearance  |
| Attendees        |                           | QR / image / text  |
| Sponsors         |                           |                    |
+------------------+---------------------------+--------------------+
| Front / Back     | Zoom / validation         | Export             |
+------------------+---------------------------+--------------------+
```

The exact panel arrangement can change after prototyping. The principles are more important than the diagram:

- the artboard gets the strongest visual priority,
- context-specific properties replace a permanently huge form,
- task/asset navigation is distinct from element properties,
- export and validation remain visible without covering editable content,
- multi-side assets expose Front / Back clearly,
- mobile may use focused tabs rather than shrinking the full desktop studio.

## Task-first entry

The first question should increasingly become **what do you want to create?** rather than **which internal format ID do you want?**

Candidate task cards:

- Event social,
- Speaker social,
- Speaker badge,
- Attendee badges,
- Event covers,
- Print materials.

After selecting the task, the product can show only compatible templates, data and controls.

Internal format/template IDs remain implementation details.

## Artboard interaction model

The target editor is a constrained 2D production surface.

Useful direct interactions include:

- click/select text, image, QR or logo elements,
- edit selected-element properties,
- reposition elements only when the template allows it,
- resize/crop images within allowed bounds,
- alignment and snapping where useful,
- show safe areas and print boundaries,
- lock structural/brand elements,
- restore template defaults.

The template remains authoritative. Direct manipulation must not make it easy to create invalid or off-brand output.

### Technology direction

Before implementing direct manipulation, evaluate a 2D scene/editor layer such as:

- Konva / react-konva,
- Fabric.js,
- a smaller adapter over existing Canvas rendering if interaction needs remain limited.

Do not use Three.js as the core editor technology. Three.js may be evaluated later for optional 3D lanyard or badge mockups.

## Multi-side assets

Badges introduce first-class sides.

The editor should represent them explicitly:

```text
[ Front ] [ Back ]
```

Requirements:

- switching sides never loses edits,
- front/back use the same asset record,
- each side can have a different layer/template configuration,
- validation runs per side and at the combined print level,
- export labels clearly state whether the action exports one side, both sides or a print sheet.

A CSS flip animation can be used as an optional preview interaction, but normal tab navigation must remain accessible and predictable.

## QR component

QR is a reusable content component.

Properties should support:

- destination type,
- resolved URL,
- profile source when destination is a person profile,
- optional visible handle/URL,
- error-correction/quiet-zone rules if needed by print validation,
- size constrained by the template.

QR selection should be presented as a meaningful destination choice, not as a raw URL field by default.

## Badge design principles

A networking badge must prioritize recognition before decoration.

Front hierarchy should generally be:

1. name,
2. role or organization,
3. badge type such as SPEAKER / ATTENDEE / STAFF,
4. networking identity/handle,
5. event identity,
6. photo when the selected template uses one.

Back hierarchy should generally be:

1. QR destination,
2. readable destination/handle,
3. event or community context,
4. optional agenda/event information.

Do not overfill physical badges. Long bios and session descriptions belong elsewhere.

## Attendee import UX

CSV import is a dedicated flow, not another collapsible sidebar section.

Recommended stages:

```text
Upload -> Map -> Validate -> Preview -> Configure -> Generate
```

The UI must show:

- detected source columns,
- mapped product fields,
- required/optional status,
- invalid-row count,
- warnings,
- records that will be excluded,
- clear-data action,
- privacy/local-processing explanation.

Large datasets should use a virtualized/table-oriented review, not hundreds of rendered badge cards.

## Batch generation UX

Batch generation is a production operation and needs explicit feedback.

Show:

- total records/assets,
- completed count,
- current stage,
- warnings/errors,
- cancel when technically safe,
- retry/re-run failed outputs where supported.

Do not make the user infer whether the browser is frozen.

## Print visualization

Print-aware templates should be able to display overlays for:

- trim boundary,
- bleed,
- safe area,
- crop marks where relevant,
- front/back orientation,
- physical dimensions.

These overlays are editor aids and must not appear in normal exported artwork unless explicitly requested as printer marks.

## Existing component rules to preserve during transition

Until the studio shell replaces them, current editor components remain valid:

- Primer FormControl/Select/TextInput patterns,
- accessible visual format/theme cards,
- warning vs error severity distinction,
- undo for reversible removals,
- draft save status,
- validation links to affected fields,
- one dominant download action per action group,
- mobile Fields / Preview separation,
- `prefers-reduced-motion` support.

## Depth and shape

Keep depth restrained.

Application UI:

- borders first,
- soft shadows for floating controls,
- stronger shadows only for overlays/dialogs,
- moderate radii,
- pills only for statuses/tags,
- no decorative glassmorphism.

Generated artwork may use the stronger gradients, halos and visual motifs allowed by the event design system.

## Design rules

1. **One visual authority.** Dev Days artwork follows `ghspain/devdays-design-system`; the application does not invent a competing local brand.
2. **Semantic light/dark modes.** Primer tokens define app-shell surfaces. Never create light mode by mechanically inverting dark colors.
3. **Artwork is the hero.** Tool chrome supports the artboard rather than competing with it.
4. **Task before implementation detail.** Users choose outcomes such as Speaker badge, not internal renderer IDs.
5. **Properties follow selection.** Show controls relevant to the selected task/element instead of one permanent wall of fields.
6. **Template constraints are a feature.** Brand-safe limits are more valuable than unlimited freedom.
7. **Front/back is explicit.** Multi-side assets are modeled and navigated as such.
8. **Batch is not a grid of hundreds of canvases.** Review data efficiently, preview representative cases, then generate.
9. **Print gets physical rules.** Millimeters, bleed, safe area and duplex alignment are not approximated as social-pixel settings.
10. **Accessibility remains structural.** Keyboard behavior, focus, semantics, motion preferences and non-color severity cues survive every visual redesign.
11. **No forced 3D.** Use 2D tools for 2D production. Add 3D only for a later physical-preview use case.
12. **Refactor without visual regression.** Existing event assets remain reproducible until a deliberate redesign is reviewed.

## Immediate design work after this documentation is approved

Before implementation epics for the full studio UI, create focused visual proposals for:

1. task-first creation/home,
2. the desktop studio workspace,
3. Speaker Badge front/back editing,
4. attendee CSV mapping/validation,
5. batch-generation progress,
6. print preview with safe/bleed overlays.

Those proposals should use this design direction and the external Dev Days design system as constraints, then be validated before a large frontend rewrite begins.
