# Suite de tests completa — diseño

Fecha: 2026-10-04 · Estado: pendiente de revisión

## Objetivo

Una suite profesional que cubra todo el proyecto Hued para detectar errores y mejoras, no solo para subir un porcentaje de cobertura. Corre en PC, sin dispositivo.

## Alcance

Entra:
- Unit sobre `src/lib`.
- Componentes con `@testing-library/react-native` (RNTL).
- Pantallas de `app/`.
- Integración del flujo capturar → editar → exportar, con mocks nativos.
- Informe de hallazgos.

No entra:
- E2E en dispositivo (Maestro/Detox).
- Comparación de píxeles reales con CanvasKit.
- Auditoría de rendimiento, accesibilidad en dispositivo y `pnpm audit`.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Skia y módulos nativos | Mock central propio (`test/setup.ts` + `__mocks__`) | Rápido y determinista. CanvasKit (WASM) es lento y frágil. |
| Bugs encontrados | Solo reportar | Cada bug queda como `it.failing` + entrada en `HALLAZGOS.md`. El usuario decide qué arreglar. |
| Tests existentes (19 suites) | No se tocan | Sus `jest.mock` locales siguen mandando sobre los globales. |
| Código de producción | No se modifica | Si algo hay que cambiarlo para poder testearlo, se consulta antes. |

## Estado de partida (2026-10-04)

- 19 suites, 140 tests, `tsc` limpio. Solo lógica pura en `src/lib` y una prueba de `PaletteGrid`.
- Faltan `@testing-library/react-native` y `react-test-renderer`. No hay `jest.setup`, `__mocks__`, umbral de cobertura ni CI.
- Sin tests: `dateUtils`, `avatar`, `db/schema`, `db/client`, `analytics`, `revenuecat/client`, `legal`, `tokens`, registro de arquetipos, los 6 arquetipos, `LibreEditOverlay`, componentes de UI y edición, las 6 pantallas.

## Fase A — Infraestructura

- Dev deps: `@testing-library/react-native`, `react-test-renderer@19.2.3`.
- Config Jest (en `package.json`, donde ya vive):
  - `setupFilesAfterEnv: ["<rootDir>/test/setup.ts"]`
  - `collectCoverageFrom`: `src/**/*.{ts,tsx}` y `app/**/*.{ts,tsx}`, excluyendo `__tests__`, `src/types`, `SkiaSmokeTest`.
  - `coverageThreshold` por carpeta (ver Fase F).
- Scripts: `test:coverage` (`jest --coverage`) y `test:ci` (`tsc --noEmit && eslint . --max-warnings 0 && jest --coverage --ci`).
- Carpeta `test/`:
  - `setup.ts`: mocks globales de Skia, MMKV, expo-sqlite, `expo-file-system/legacy`, `expo-media-library/legacy`, expo-image-picker, image-crop-picker, expo-camera, RevenueCat, PostHog, Sentry y expo-router.
  - `mocks/skia.tsx`: componentes Skia como elementos de host inspeccionables (`Rect`, `RoundedRect`, `Text`, `Image`, `Group`, `BackdropBlur`) que conservan sus props.
  - `factories.ts`: `makePalette`, `makeColor`, `makeLayoutConfig`.
  - `render.tsx`: wrapper de RNTL con el router mockeado.

## Fase B — Lógica `lib`

Tests nuevos:
- `dateUtils`.
- `avatar`.
- `db/schema` y `db/client`: migraciones, idempotencia, versión.
- `analytics/events` y `analytics/posthog`: opt-in apagado por defecto, `optIn`/`optOut`, sin captura sin consentimiento.
- `revenuecat/client`: `init` sin clave no hace nada, compra, restaurar, escritura al `settingsStore`.
- `legal`: URLs bien formadas.
- `tokens`: contraste WCAG AA de los pares texto/fondo declarados.
- `data/archetypes`: todo `ArchetypeId` tiene entrada con definición válida.

Refuerzo de tests existentes con casos límite: `extract` (imagen vacía, paleta de 3 y de 8 colores, colores duplicados), `exportPalette`, `colorMath`, `normalize`.

## Fase C — Componentes

- UI: `Button`, `Card`, `Text`, `Sheet`, `Icon`, `StripeBar`.
- Edición: `OptionCarousel` (bloqueo por paywall), `CornerControl`, `PaletteSizeControl`, `EditTabs`, `CropTab`, `PaletteCard`, `PaletteGrid`.
- Lienzo:
  - Los 6 arquetipos (Strip, Editorial, Grid, Banner, Side, Libre): se inspecciona el árbol Skia producido (número de swatches, geometría, textos, `cardStyle`).
  - `ArchetypeCanvas` (despacho por registro), `Watermark`, `LibreEditOverlay`.
  - **Paridad preview/export**: para cada arquetipo y configuración, preview y export dibujan lo mismo. Invariante no negociable de `CLAUDE.md`.

## Fase D — Pantallas

`app/(tabs)/index`, `capture`, `settings` (interruptor de analítica), `app/paywall`, `app/palette/[id]`, `app/_layout`. Estados vacío, cargando y error, y permisos denegados.

## Fase E — Integración

- Flujo capturar → `processCapture` → editar → exportar.
- Compuerta de exportación: la cuarta exportación gratis abre el paywall; el contador reinicia al cambiar de día (bug ya encontrado una vez).
- Consentimiento de analítica de punta a punta.
- Persistencia: guardar, reabrir y comprobar que se conserva el `layoutConfig`.

## Fase F — Informe y cobertura

- `docs/testing/HALLAZGOS.md`: severidad, evidencia, mejora sugerida. Cada bug es un `it.failing` que referencia su ID (`H-01`, …).
- Línea base de cobertura medida al terminar la Fase E; los umbrales se fijan en esa línea base y suben por fases. Objetivos: `src/lib` ≥ 90 %, `src/components` ≥ 75 %, `app/` ≥ 60 %.

## Reglas de calidad

- Patrón AAA, nombres de tests en inglés (como los actuales), un archivo por módulo, junto a él en `__tests__/`.
- Sin snapshots.
- Tiempo y aleatoriedad controlados (fake timers, `Date` fijo).
- Deterministas: sin red ni disco real.
- Se prueba comportamiento, no implementación. Consultas RNTL por rol, texto o `testID`.

## Límites

Los mocks no validan píxeles reales, cámara, permisos de Android ni rendimiento. Eso queda para la lista manual de `SEGURIDAD-20260918.md` y, más adelante, un E2E en dispositivo.

## Criterios de éxito

- `pnpm test:ci` pasa en limpio.
- Cobertura por encima de los umbrales de la Fase F.
- Todo módulo de `src/` y `app/` tiene al menos un archivo de test.
- `HALLAZGOS.md` lista cada fallo encontrado con su test `it.failing`.
