# 🎨 GHSpain Event Studio

**Create consistent event assets from reusable event data, with live preview, validation and local-first export.**

This repository currently ships a mature social/banner generator and is evolving into a broader event asset studio for GitHub Community Spain.

The existing Dev Days workflows remain supported. The next product direction expands the same foundation toward speaker badges, attendee badges, front/back assets, batch generation and print-ready event materials.

See:

- [`PRODUCT.md`](PRODUCT.md) for the product definition and boundaries.
- [`ROADMAP.md`](ROADMAP.md) for the delivery plan and dependency order.
- [`DESIGN.md`](DESIGN.md) for the application design direction.
- [`ghspain/devdays-design-system`](https://github.com/ghspain/devdays-design-system) for the Dev Days visual source of truth.

---

## 🚀 Try It Locally

1. 📦 Install dependencies:

	```bash
	npm install
	```

2. ▶️ Start the development server:

	```bash
	npm run dev
	```

3. 🌐 Open in your browser:

	```text
	http://localhost:5173/devdays-design/
	```

## 🎯 Current Production Capabilities

- **Live canvas rendering:** see asset updates in real time while editing.
- **Ready-to-use formats:** Luma Cover, Social Promo, Speaker Profile and Speaker Banner.
- **Multiple event themes:** Dev Days, Community Meetup and GitHub-style online events.
- **Speaker workflows:** catalogue selection, editable profiles, multiple speakers and paired speaker layouts.
- **Branding support:** organization and partner logos with format-aware limits.
- **Registration content:** CTA + URL support where the selected format uses it.
- **Visual validation:** truncation, dropped content, contrast and safe-area feedback before export.
- **Export pipeline:** PNG/JPG plus ZIP event packs.
- **Draft persistence and history:** recover current work and previously generated assets locally.
- **Responsive editing:** desktop split view plus mobile Fields / Preview flow.
- **Accessible controls:** Primer-based interaction patterns with Playwright visual coverage.

These capabilities are foundations for the broader Event Studio roadmap, not legacy functionality scheduled for removal.

## 🧭 Product Direction

The target model is:

```text
Event Project
  +-- reusable event/person data
  +-- theme
  +-- templates
  +-- assets
      +-- event social
      +-- speaker social
      +-- covers
      +-- speaker badges
      +-- attendee badges
      +-- print materials
  +-- exports
```

Planned product areas include:

- configurable QR destinations,
- front/back badge designs,
- public profile reuse from `ghspain/Planning`,
- attendee CSV import and column mapping,
- large batch generation,
- print-ready PDF and duplex badge sheets,
- a more visual artboard-based editing experience,
- selectable Event Kits containing digital and printable materials.

The application remains local-first and compatible with GitHub Pages for the planned phases. A backend is deferred until a concrete shared-project or synchronization requirement needs it.

## Local Catalogues and Canonical Data

The `data/` directory contains a deliberately reduced operational catalogue for the current application.

Reusable public person and participation data should remain canonical in [`ghspain/Planning`](https://github.com/ghspain/Planning). This application should consume a safe projection of the fields it needs rather than creating a second canonical people database.

Attendee imports are different: they are event-specific operational input and should be processed locally by default rather than committed to the repository or promoted into Planning automatically.

## 🎨 Design System

Generated Dev Days artwork follows the extracted visual language maintained in [`ghspain/devdays-design-system`](https://github.com/ghspain/devdays-design-system): Mona Sans, near-black surfaces, Copilot green/lime/purple/blue accents, gradients and composition principles.

The application shell uses GitHub Primer interaction patterns and may support light or dark surfaces. Light mode should use semantic Primer/GitHub tokens, not a literal inversion of the dark artwork palette.

See [`DESIGN.md`](DESIGN.md) for the mapping between the external design system and the editor workspace.

## 🛠️ Tech Stack

Current implementation:

- ⚛️ **React 19** + **TypeScript**
- ⚡ **Vite 7** for dev server and bundling
- 🎨 **HTML Canvas** for current asset rendering
- 🔤 **Mona Sans** & **Mona Sans Mono** variable fonts (self-hosted)
- 🧩 **@primer/react** + **@primer/octicons-react** for application controls/icons
- 📦 **JSZip** for browser-side packages
- 🧪 **Playwright** for visual and interaction coverage
- 🧹 **ESLint**

Future roadmap phases may introduce additional 2D editing and print-generation libraries after focused evaluation. Three.js is not planned as the core editor technology.

## 📁 Current Project Structure

```text
src/
├─ App.tsx
├─ App.css
├─ types.ts
├─ constants.ts
├─ lib/
│  ├─ renderBanner.ts
│  ├─ canvasText.ts
│  ├─ catalog.ts
│  ├─ draft.ts
│  ├─ exportPack.ts
│  ├─ history.ts
│  ├─ image.ts
│  ├─ pixelChecks.ts
│  └─ validate.ts
└─ assets/
data/
tests/
```

The roadmap deliberately plans to split the large application/domain/renderer responsibilities before many new physical-asset formats are added.

## 🖥️ How to Run Locally

Prerequisites:

- Node.js 20+
- npm 10+

Commands:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run test:visual
npm run preview
```

## 🤝 How to Contribute

1. Fork the repository.
2. Create a focused branch.
3. Keep changes aligned with `PRODUCT.md`, `ROADMAP.md` and `DESIGN.md`.
4. Preserve or explicitly migrate current output behavior when changing domain/rendering architecture.
5. Run lint, build and relevant Playwright coverage.
6. Open a pull request with the user flow and validation evidence.

## 📬 Contact

Open an issue for questions, suggestions or bug reports.
