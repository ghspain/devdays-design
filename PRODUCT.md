# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Equipo organizador de GitHub Community Spain (ghspain) que prepara materiales visuales de eventos. *(Inferido de ROADMAP/README y del objetivo declarado en sesión; no confirmado directamente.)* No está decidido si voluntarios de eventos locales generan sus propios materiales — decidir en el futuro.

## Product Purpose
Generador de banners e imágenes sociales para eventos de la comunidad, con vista previa en vivo (Canvas) y exportación en un clic. Existe para que el equipo produzca visuales rápidos y consistentes sin diseñadores: presets por evento, catálogos locales de speakers y patrocinadores, y descarga en lote (PNG/JPG/ZIP). El éxito es un banner correcto a la primera, con validación visual antes de exportar.

## Positioning
Un editor de canvas guiado y coherente con validación visual integrada (overflow, truncado, contraste WCAG, área segura) para los formatos concretos de los eventos de la comunidad — no un editor genérico ni un CRM de eventos. Los presets de formato son específicos: Event Cover, Speaker Profile, Speaker Banner, Social Promo, Luma Cover.

## Operating Context
- Eventos actuales: Dev Days; y, según objetivo declarado en sesión, dos meetups de la comunidad con diseño distinto (uno más cercano a la estética de la web de GitHub). *(Los presets de meetups están en ROADMAP como alcance; no todos implementados aún.)*
- Catálogos locales deliberadamente reducidos en `data/` (`people.csv`, `sponsors.csv`), separados del dato canónico en ghspain/Planning. La app debe funcionar sin red ni credenciales.
- Flujo típico: elegir preset de evento → elegir speaker/sponsors → editar campos → revisar validación → exportar (PNG/JPG, 1x/2x, ZIP de todos los formatos).
- Historial local de banners en el navegador (IndexedDB/localStorage); sin backend.

## Capabilities and Constraints
- Render 100% en Canvas del navegador; React 19 + TypeScript + Vite.
- Variantes de evento: ciudad separada de edición (Professional/Students).
- Barra de registro (CTA + URL) en Social Promo y Speaker Banner; hasta 3 logos de partners en Luma covers y social promos.
- Temas con tarjetas de vista previa; indicadores de truncado junto al campo.
- Alcance explícitamente excluido (ROADMAP): sincronización con Planning/Luma/GitHub, publicación en redes, CRM de speakers, datos privados.
- App desplegada como página de proyecto de GitHub (base `/devdays-design/`).

## Brand Commitments
- Nombre: "Dev Days: Social Image Creator". Comunidad: GitHub Community Spain.
- Tipografías Mona Sans / Mona Sans Mono autoalojadas (decisión vinculante establecida; confirmada como intencional pese a avisos del detector).
- *Anotado por el usuario en sesión (no implementado aún):* uno de los meetups futuros debe tener un diseño "más parecido a la web de GitHub".

## Evidence on Hand
- README.md, ROADMAP.md (alcance, épicos #12/#26/#53/#71 completados).
- Catálogos reales en `data/`: speakers (Celonis, GitHub Community Spain, TechRiders…), sponsors y presets.
- Suite de tests visuales Playwright (~220 tests) que documenta comportamiento esperado por formato y anchura.
- No hay testimonios, métricas de uso ni casos de estudio: no fabricar.

## Product Principles
1. Coherencia ante todo: cada formato renderiza lo que el sidebar promete, y viceversa.
2. Validar antes de exportar: el error de un banner se detecta en el editor, no en la red social.
3. Autonomía local: funciona sin red, sin credenciales y sin backend.
4. El esencial primero: los controles avanzados se pliegan; la descarga principal es un solo botón claro.

## Accessibility & Inclusion
La validación del producto aplica contraste WCAG sobre los banners generados (epic #26). La UI del editor sigue patrones Primes (componentes @primer/react) y soporte móvil completo. No se ha fijado un estándar formal adicional (WCAG 2.1 AA como objetivo de la UI: decisión abierta).
