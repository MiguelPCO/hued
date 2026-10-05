# Hallazgos de la suite de tests

Fecha: 2026-10-05 · Suite: `pnpm test` / `pnpm test:ci`.
La suite encontró 9 bugs (H-01 a H-09). Cada uno se fijó con un `it.failing` que referencia su ID; al corregirlo, el `it.failing` pasa a `it` normal y queda como regresión. Hoy 8 están corregidos y 1 abierto (H-03, necesita la URL pública real).

## Resumen

| ID | Severidad | Área | Resumen | Estado |
|---|---|---|---|---|
| H-03 | Alta | Legal | `PRIVACY_URL` es el marcador `[RELLENAR: …]`; Ajustes y paywall la pasan a `Linking.openURL` | **Abierto** (`it.failing` en `legal.test.ts`) |
| H-04 | Alta | Arquetipos | Franja, Banner y Lateral hardcodeaban 5 ranuras: con 3 colores quedaban huecos y con 8 se salían del lienzo | Corregido |
| H-07 | Media | Pantalla de paleta | Si `getPalette` fallaba, spinner infinito | Corregido |
| H-08 | Media | Inicio | Si `listPalettes` fallaba, spinner infinito | Corregido |
| H-02 | Media | Navegación | `app/_layout.tsx` registraba `onboarding` sin existir `app/onboarding.tsx` | Corregido |
| H-09 | Media | Controles | `PaletteSizeControl` y `CornerControl` usaban el `onChange`/`disabled` del primer render durante el arrastre | Corregido |
| H-05 | Baja | Accesibilidad | `textTertiary` y `error` sobre `bgPrimary` no llegaban a contraste AA (3,55:1 y 3,68:1) | Corregido |
| H-06 | Baja | Suscripción | El contador diario de exportaciones se reiniciaba a medianoche UTC, no local | Corregido |
| H-01 | Baja | UI | `Button` descartaba la prop `style` | Corregido |

## Abierto

### H-03 — Política de privacidad sin URL · Alta
- **Qué pasa:** `src/lib/legal.ts` exporta `PRIVACY_URL = '[RELLENAR: URL pública de legal/privacidad.md]'`.
- **Impacto:** en Ajustes y paywall el enlace no abre nada útil (en iOS `openURL` rechaza la promesa); App Store (5.1.1) y Google Play exigen una política pública antes de publicar.
- **Evidencia:** `legal.test.ts › PRIVACY_URL is a public https URL` (`it.failing`).
- **Cómo cerrarlo:** publicar `legal/privacidad.md` (p. ej. GitHub Pages), poner la URL real en `legal.ts` y pasar el `it.failing` a `it`.

## Corregidos

### H-01 — `Button` ignoraba `style`
`Button` aplica ahora `style` (objeto o función `({ pressed }) => …`) después de los estilos propios, así que el llamador puede sobrescribirlos. Tests en `Button.test.tsx`.

### H-02 — Ruta `onboarding` inexistente
Se quitó `<Stack.Screen name="onboarding" />` de `app/_layout.tsx` hasta que exista la pantalla (el estado `onboardingCompleted` de `settingsStore` se mantiene). `layouts.test.tsx` comprueba que toda `Stack.Screen` registrada tiene archivo de ruta y fija el helper `routeFileExists`. Cuando se cree el onboarding, registrar la ruta y añadirla a ese test.

### H-04 — Arquetipos de 5 ranuras
`StripArchetype` y `BannerArchetype` reparten `width / colors.length` y `SideArchetype` `height / colors.length` (mínimo 1 para la paleta vacía). `archetypes.render.test.tsx` cubre 3 arquetipos × tamaños 3 y 8, y la paridad vista previa/exportación sigue verde. **Pendiente de revisión visual en dispositivo:** con 8 colores las barras de Franja miden 45 px y las de Banner 45 px de ancho; comprobar que caben el hex y el nombre.

### H-05 — Contraste
`brown500` pasa de #8A6F5C a #755E4E (4,61:1 sobre `bgPrimary`) y `error500` de #DC2626 a #BF2121 (4,63:1). `textPlaceholder` comparte `brown500` y también se cubre. **Decisión de diseño a validar:** el nuevo `error` queda muy cerca de `red500` (el rojo de la marca, #C21717); cualquier rojo que cumpla AA sobre `cream200` cae ahí. Alternativa: dejar `error` como estaba para iconos y usar el rojo oscuro solo para texto.

### H-06 — Reinicio del contador a medianoche UTC
`settingsStore.todayString()` construye ahora la fecha local (`getFullYear/getMonth/getDate`). Los tests que comparan con "hoy" usan `toLocaleDateString('en-CA')`, independiente de la implementación. `settingsStore.timezone.test.ts` fija el caso 22:30Z (00:30 locales del día siguiente) y el inverso. Los contadores guardados con fecha UTC pueden reiniciarse un día antes una sola vez al actualizar.

### H-07 / H-08 — Spinner infinito si falla la base de datos
La pantalla de paleta (`getPalette`) y el inicio (`listPalettes`) muestran ahora "No se pudo cargar la paleta." / "No se pudieron cargar tus paletas." con botón "Reintentar", y avisan a Sentry. En el inicio, si ya había datos cargados y una recarga posterior falla, se conservan los datos y solo se avisa a Sentry. Tests de fallo y de recuperación tras reintentar en `palette.test.tsx` e `index.test.tsx`.

### H-09 — Closures obsoletos en los controles deslizantes
`CornerControl` y `PaletteSizeControl` leen `onChange` (y `disabled`) de refs actualizados en cada render; el responder se crea una vez con `useState(() => …)`. Los 3 tests (`CornerControl.test.tsx`, `PaletteSizeControl.test.tsx`) quedan como regresión; `pan.live()` en `test/panResponder.ts` lee los handlers del View del render actual.

## Mejoras y observaciones

Sin `it.failing`, para decidir:

- **Lint (resuelto el 2026-10-05):** `pnpm lint` tenía 19 errores y 17 advertencias sobre el código previo (la suite sumó más advertencias). Ahora pasa con `--max-warnings 0` y `test:ci` lo incluye (`typecheck` + `lint` + `jest --coverage --ci`). `react-hooks/refs` marca `PanResponder.create` con refs leídos solo dentro de los gestos (falso positivo): se desactiva en esa línea con justificación en `CornerControl`, `PaletteSizeControl` y `LibreEditOverlay`; el responder de los dos controles se crea ahora con `useState(() => …)`. `Sheet` crea sus `Animated.Value` con `useState`; el inicio y `CornerControl` dejaron de llamar a `setState` dentro de un efecto. En tests: `eslint.config.js` desactiva `no-require-imports`, `import/first` y `no-dynamic-env-var` bajo `__tests__/` y `test/` (convenciones de `jest.mock`). H-09 sigue sin corregir: el lint no lo detecta.
- **Paywall:** el `label` "Procesando..." nunca se ve: `Button` sustituye la etiqueta por un spinner cuando `loading`.
- **Inicio:** en `handleGallery`, `if (picking) return` es inalcanzable desde la UI.
- `ArchetypeId` se declara en tres sitios (`@/types/palette`, `settingsStore.ts`, `analytics/events.ts` con `string`).
- `EditTabs` pasa `onLockedPress` con el mismo disparador (`watermark_tap`) para opciones premium bloqueadas; hoy ninguna lo está (`premium` sin usar), así que la ruta de bloqueo solo se prueba de forma sintética (el test marca un arquetipo como `premium`) y la analítica las atribuiría mal.
- `CropTab` decide la rama web con una constante de módulo (`process.env.EXPO_OS`): no se puede probar sin recargar el módulo.

## Cobertura (medida el 2026-10-05)

| Carpeta | Líneas | Funciones | Ramas | Umbral de líneas |
|---|---|---|---|---|
| src/lib | 98,00 % | 90,10 % | 94,64 % | 96 % |
| src/components | 98,25 % | 96,13 % | 95,57 % | 96 % |
| app | 96,04 % | 87,85 % | 87,98 % | 94 % |
| Total | 97,63 % | 92,28 % | 93,37 % | — |

Cifras agregadas por carpeta (suma de todos los ficheros bajo cada ruta de `coverageThreshold`). Los umbrales se fijan en `floor(medido) - 2` para que el CI detecte cualquier caída real de cobertura sin saltar por ruido. Umbrales completos (líneas / sentencias / funciones / ramas): `src/lib` 96/95/88/92, `src/components` 96/95/94/93, `app` 94/90/85/85. Los objetivos iniciales del spec (90/75/60 de líneas) ya se superaban de sobra.

La paridad entre vista previa y exportación (`exportPalette.parity.test.tsx`) cubre tanto la rama de marcador de posición como la de foto cargada.

## Límites de la suite (qué NO valida)

- **Píxeles reales:** Skia está mockeado; los arquetipos se verifican por geometría y textos del árbol, no por render.
- **Cámara, permisos de Android y rendimiento** (extracción < 800 ms, export < 2 s): hacen falta dispositivo y la lista manual de `SEGURIDAD-20260918.md`.
- **Módulos nativos** (SQLite real, MMKV, RevenueCat, PostHog): se simulan; la integración con SQLite se cubre con una base en memoria que serializa a JSON.
- **Gestos reales:** se prueban llamando a los handlers de `PanResponder`, no con toques.
- **Rama web de `CropTab`** (constante de módulo).
- **E2E en dispositivo** (Maestro/Detox): fuera de alcance; siguiente paso natural.
