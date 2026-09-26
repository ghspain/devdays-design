---
impeccable: design-schema 1
name: DevDays Design
mode: operate
platform: web
north-star: torre-de-control
---

# Design — DevDays Design

Editor web para que el equipo organizador de GitHub Community Spain genere imágenes
de speakers y eventos (Canvas rendering, presets, speaker packs).

## Overview

**Estrella del Norte — "Torre de control".** La app es una herramienta precisa y
confiable: el panel de UI claro (estética Primer/GitHub light) es la sala de control
donde todo se lee y se ajusta con calma; el canvas oscuro (`#0d1117` / `#010409`) es
el escenario iluminado donde la pieza final es la protagonista absoluta. El acento
cambia con el tema del evento (verde Dev Days, púrpura Community Meetup, azul
Online), pero la estructura —tipografía Mona Sans, tokens Primer, densidad sobria—
nunca se mueve.

- **Modo:** Operate — el visitante completa una tarea (generar y descargar una imagen).
- **Character:** técnico, sereno, preciso. Brand lives in precise details.

## Colors

### Tokens base (src/App.css `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--vscode-bg` | `#ffffff` | Fondo de la UI clara |
| `--vscode-bg-elev-1` | `#f6f8fa` | Superficies elevadas (paneles, secciones) |
| `--vscode-border` | `#d1d9e0` | Bordes de paneles, inputs, secciones |
| `--vscode-text` | `#1f2328` | Texto principal |
| `--vscode-text-muted` | `#59636e` | Texto secundario/etiquetas |
| `--vscode-accent` | `#0969da` | Acción primaria, enlaces |
| `--vscode-accent-hover` | `#0550ae` | Hover de acción primaria |
| `--vscode-danger` | `#cf222e` | Acciones destructivas |
| `--app-warning` | `#9a6700` | Badges/severity de warning (token, nunca hardcodear) |
| `--app-error` | `#cf222e` | Badges/severity de error (token, nunca hardcodear) |
| `--app-canvas-bg` | `#010409` | Fondo del escenario (siempre oscuro) |

### Acentos por tema de evento (`src/constants.ts` — EVENT_THEMES)

| Tema | Accent | Fondo canvas | Aplicación |
|---|---|---|---|
| Dev Days | `#0abf40` (verde) | `#0d1117` | Verde GitHub sobre canvas oscuro |
| Community Meetup | `#a371f7` (púrpura) | `#0d1117` | Púrpura Primer |
| Online (GitHub style) | `#0969da` (azul) | `#ffffff` | Estética web de GitHub en claro |

El acento del evento se usa **solo dentro del canvas** (etiquetas, logo, Luma city
color). La UI del editor nunca hereda el acento del tema: su acento propio es
siempre `#0969da`.

### Carácter de color

- Neutralidad Primer (grises `#1f2328`→`#59636e`→`#d1d9e0`) con un único acento.
- Contraste doble: UI clara en el shell, canvas oscuro en el escenario; nunca
  mezclar grises de ambos mundos (el re-declare de tokens en `.stage` lo garantiza).
- Semántica estricta: warning ≠ error (`#9a6700` ámbar vs `#cf222e` rojo), siempre
  vía token `--app-*`.

## Typography

| Uso | Fuente | Peso |
|---|---|---|
| UI del editor | system stack (`-apple-system, Segoe UI, Noto Sans, …`) + Primer | 400 / 500 / 600 |
| Canvas display (ciudad, título evento, speaker) | **Mona Sans** | 500 / 600 |
| Canvas mono (edi­ción, fecha, footer, labels) | **Mona Sans Mono** | 500 / 600 |

- Escala UI: `0.72rem` (micro-labels) → `0.75–0.82rem` (labels/body) →
  `0.875–0.95rem` (títulos de sección) → `1.05rem` (título topbar) → `1.85rem`
  (heading de página). La UI vive en tamaños pequeños: densidad de herramienta.
- El canvas es independiente: los tamaños se calculan en px sobre la resolución
  final (1080/1350) y no siguen la escala de la UI.
- Mona Sans/Mona Sans Mono son vinculantes (Brand Commitment en PRODUCT.md): no
  sustituir en canvas, no usarlas como fuente de UI general.

## Layout

- **Shell:** `topbar` (52px) + `editor-body` de tres zonas — sidebar de controles,
  escenario central, paneles de acción (downloads, presets). Altura 100vh, sin
  scroll de página; cada zona scrollea por su cuenta.
- **Sidebar:** secciones colapsables con cabecera sticky; cada sección es una
  tarjeta `#ffffff` con borde `#d1d9e0`.
- **Escenario:** centrado, con toolbar flotante; la pieza se escala al hueco
  disponible manteniendo ratio.
- **Espaciado:** gaps de `0.35rem` (pares de controles) / `0.6rem` (grupos) /
  `0.9rem`–`1rem` (padding de paneles). Ritmo compacto pero respirado.

## Elevation & Depth

Tres niveles de sombra tokenizados (nunca hardcodear):

| Token | Valor | Uso |
|---|---|---|
| `--app-shadow-soft` | `rgba(31,35,40,0.04)` | Cards en reposo, secciones |
| `--app-shadow-medium` | `rgba(31,35,40,0.08)` | Elementos flotantes (toolbar, dropdowns) |
| `--app-shadow-strong` | `rgba(31,35,40,0.12)` | Overlays (drawer de history, toasts) |

Sombras compuestas (elevación) y anillos de foco, también tokenizados:

| Token | Valor | Uso |
|---|---|---|
| `--app-elevation-1` | `0 1px 3px rgba(31,35,40,0.16)` | Elementos con elevación sutil (botón de marca en topbar) |
| `--app-elevation-2` | `0 4px 12px rgba(0,0,0,0.15)` | Diálogos flotantes (confirmación de reset) |
| `--app-elevation-3` | `0 8px 24px rgba(31,35,40,0.3)` | Toasts / elementos overlay prominentes |
| `--app-focus-ring` | `0 0 0 1px var(--vscode-accent)` | Foco exterior de inputs/selects/textareas |
| `--app-focus-ring-inset` | `0 0 0 1px var(--vscode-accent) inset` | Selección de opciones tipo card (card-option, export-type) |

En el escenario las sombras re-declaradas son más profundas
(`rgba(1,4,9,0.45)`) porque el fondo es oscuro. El brillo ambiental del shell son
dos `radial-gradient` muy tenues (`rgba(9,105,218,0.04/0.02)`), apenas un aliento
azul — nunca decoración visible.

## Shapes

Radios en escala de 4 pasos (con `999px` para pills):

| Radio | Uso |
|---|---|
| `6px` | Botones, inputs, badges (defecto) |
| `8px` | Iconos contenedor (topbar-icon), cards pequeñas |
| `10px` | Cards de sección, swatches |
| `12–14px` | Cards grandes (theme preview, resolution cards), drawer |
| `999px` | Pills de estado, badges redondos |

Bordes de 1px `#d1d9e0` en light / `#30363d` en dark. Sin bordes gruesos ni
sombras duras: la profundidad viene de sombras suaves, no de bordes.

## Components

Componentes canónicos observados en `src/App.tsx` + `src/App.css`:

- **Download CTA hierarchy:** botón primario `#0969da` para la acción dominante
  (descarga de la pieza actual), botones secundarios outline para formatos
  alternativos. Un solo nivel de énfasis por grupo.
- **Validation badges:** pill `999px` con token semántico — warning `--app-warning`,
  error `--app-error` — con icono distinto por severidad. Nunca confundir tonos.
- **Theme preview cards:** mini-cards (`14px` radius) con swatch del acento del
  evento y nombre; estado seleccionado con borde de acento `#0969da`.
- **Toast:** `--app-shadow-strong`, radio `10px`, aparece abajo; usa
  `prefers-reduced-motion` (todas las animaciones se respetan).
- **Collapsible section:** cabecera clickable con chevron, contenido en tarjeta
  blanca; por defecto colapsadas las secciones secundarias (densidad cognitiva).
- **Primer FormControl/Select:** para todos los inputs de formularios; los estilos
  custom nunca reimplementan lo que Primer ya da.

## Do's and Don'ts

**Do**
- Usar tokens `--app-*` y `--vscode-*` para todo color/sombra; añadir token nuevo
  antes que hardcodear un valor.
- Mantener el acento de evento confinado al canvas.
- Respetar `prefers-reduced-motion` en cualquier animación nueva.
- Mona Sans (display) + Mona Sans Mono (datos) en el canvas, siempre.
- Distinguir warning de error con token, icono y texto.

**Don't**
- No introducir un segundo acento en la UI del editor (solo `#0969da`).
- No mezclar grises del shell claro con los del escenario oscuro fuera de `.stage`.
- No usar Mona Sans Mono como fuente de la UI general.
- No crear sombras o radios fuera de la escala documentada.
- No meter decoración (glows, gradients) visible: el brillo ambiental es subliminal.

## Named Rules

1. **Dos mundos, un puente:** UI clara (Primer light) para controlar, canvas oscuro
   para exhibir. Los tokens se re-declaran en `.stage`; nunca cruzar valores.
2. **Acento del evento solo en la pieza:** el verde/púrpura/azul pertenece a la
   imagen generada; la herramienta es siempre GitHub-azul.
3. **Token primero:** cualquier color o sombra nueva entra como custom property
   con nombre `--app-*` y uso documentado aquí.
4. **Un énfasis por grupo:** en cada bloque de acciones hay exactamente un
   primario; el resto son outline o quiet.
5. **Densidad de herramienta, calma de sala de control:** compacto en píxeles,
   generoso en claridad; todo lo destructivo pide confirmación.
