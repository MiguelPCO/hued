# Hallazgos de la suite de tests

Fecha: 2026-10-05 · Suite: `pnpm test` / `pnpm test:ci` · Cada hallazgo está fijado con un `it.failing` que referencia su ID.
Cuando se corrija un bug, su test pasará a fallar con "expected to fail but passed": convertirlo en `it` normal y marcar el hallazgo como corregido.

## Resumen

| ID | Severidad | Área | Resumen | Test |
|---|---|---|---|---|
| H-04 | Alta | Arquetipos | Franja, Banner y Lateral hardcodean 5 ranuras: con 3 colores quedan huecos y con 8 se salen del lienzo | `archetypes.render.test.tsx` |
| H-03 | Alta | Legal | `PRIVACY_URL` es el marcador `[RELLENAR: …]`; Ajustes y paywall la pasan a `Linking.openURL` | `legal.test.ts` |
| H-07 | Media | Pantalla de paleta | Si `getPalette` falla, spinner infinito | `palette.test.tsx` |
| H-08 | Media | Inicio | Si `listPalettes` falla, spinner infinito | `index.test.tsx` |
| H-02 | Media | Navegación | `app/_layout.tsx` registra `onboarding` y no existe `app/onboarding.tsx` | `layouts.test.tsx` |
| H-09 | Media | Controles | `PaletteSizeControl` y `CornerControl` usan el `onChange`/`disabled` del primer render durante el arrastre | `PaletteSizeControl.test.tsx`, `CornerControl.test.tsx` |
| H-05 | Baja | Accesibilidad | `textTertiary` y `error` sobre `bgPrimary` no llegan a contraste AA (3,55:1 y 3,68:1) | `tokens.test.ts` |
| H-06 | Baja | Suscripción | El contador diario de exportaciones se reinicia a medianoche UTC, no local | `settingsStore.timezone.test.ts` |
| H-01 | Baja | UI | `Button` descarta la prop `style` | `Button.test.tsx` |

## Detalle

### H-04 — Arquetipos de 5 ranuras con paletas de 3 u 8 colores · Alta
- **Qué pasa:** `StripArchetype` y `BannerArchetype` calculan `barW = width / 5`; `SideArchetype`, `rowH = height / 5`. `Grid` sí se generalizó (`computeGridCells`).
- **Impacto:** con 8 colores, Franja dibuja 8 barras de 72 px: la octava empieza en x = 504 y la tira llega hasta x = 576 (7·72 + 72) en un lienzo de 360, así que las barras 6–8 (x ≥ 360) caen fuera del lienzo; con 3, el 40 % de la franja queda vacío. Se ve en pantalla y en el PNG exportado.
- **Evidencia:** `it.failing` ×6 en `archetypes.render.test.tsx` (3 arquetipos × tamaños 3 y 8); los equivalentes con 5 colores pasan.
- **Sugerencia:** repartir por `palette.colors.length` (como `computeGridCells`) y extraer un `computeBarCells(n, width, height, axis)` testeable.

### H-03 — Política de privacidad sin URL · Alta
- **Qué pasa:** `src/lib/legal.ts` exporta `PRIVACY_URL = '[RELLENAR: URL pública de legal/privacidad.md]'`.
- **Impacto:** en Ajustes y paywall el enlace no abre nada útil (en iOS `openURL` rechaza la promesa); App Store (5.1.1) y Google Play exigen una política pública antes de publicar.
- **Evidencia:** `legal.test.ts › PRIVACY_URL is a public https URL`.
- **Sugerencia:** publicar `legal/privacidad.md` (p. ej. GitHub Pages) y poner la URL real.

### H-07 / H-08 — Spinner infinito si la base de datos falla · Media
- **Qué pasa:** `app/palette/[id].tsx` hace `getPalette(id).then(...)` sin `catch`/`finally`; `app/(tabs)/index.tsx` captura el error pero no cambia `hasPalettes` (queda `null`).
- **Impacto:** un fallo de SQLite deja la pantalla cargando para siempre, sin mensaje ni reintento (en la pantalla de paleta, además, un rechazo sin capturar).
- **Evidencia:** `palette.test.tsx › leaves the spinner when the database fails`; `index.test.tsx › leaves the spinner…`. Cada uno tiene un test normal "guarda" que fija los estados vecinos, para que el `it.failing` no pase por un fallo ajeno.
- **Sugerencia:** `finally { setLoading(false) }` y un estado de error con botón "Reintentar".
- **Cómo lo detectan los tests:** el de H-07 simula el fallo con un thenable que entrega el error al manejador de rechazo que reciba (`await` + `finally` o `.then(cb, onErr)` lo reciben; el `.then(cb)` actual no). El de H-08 usa `mockRejectedValue`. Ambos pasan a fallar con esas variantes de arreglo.
- **Al corregir:** el criterio correcto es que no quede ningún `ActivityIndicator` en pantalla. El `it.failing` de H-08 solo comprueba que aparece el texto "Hued"; si el arreglo muestra un estado de error sin ese texto, reescribir la aserción como "no queda `ActivityIndicator`" en vez de adaptar el arreglo al test.

### H-02 — Ruta `onboarding` inexistente · Media
- **Qué pasa:** `app/_layout.tsx` declara `<Stack.Screen name="onboarding" … />`; no hay `app/onboarding.tsx`.
- **Impacto:** expo-router avisa de la ruta inexistente; el onboarding previsto (y el momento natural para pedir el consentimiento) no existe.
- **Evidencia:** `layouts.test.tsx › every registered Stack.Screen has a route file`.
- **Sugerencia:** crear la pantalla o quitar el registro hasta entonces.
- **Al corregir:** el test normal que fija el helper `routeFileExists` en el mismo archivo (3 rutas fijas y `onboarding` ausente) también habrá que actualizarlo.

### H-09 — Closures obsoletos en los controles deslizantes · Media
- **Qué pasa:** `useRef(PanResponder.create({...}))` evalúa `create` en cada render pero conserva el primero; sus handlers capturan el `onChange` y el `disabled` de ese render.
- **Causa (fijada por los tests):** tras un cambio de props, el arrastre sigue llamando al `onChange` antiguo y respetando el `disabled` antiguo.
- **Impacto probable (deducido del código; los tests solo fijan la causa):** en `PaletteSizeControl`, el padre (`handlePaletteSizeChange`) depende de `palette`; tras la primera extracción, arrastrar de nuevo llama a la versión antigua, cuyo `palette.colors.length` obsoleto puede tratar como "sin cambios" un tamaño legítimo (p. ej. volver a 5 tras pasar a 3), dejando el control mostrando un valor que la paleta no tiene. `CornerControl` tiene el mismo patrón (latente hoy).
- **Evidencia:** 3 `it.failing` con ID H-09 (`onChange` obsoleto en ambos controles; `PaletteSizeControl` arrastra aunque esté `disabled`).
- **Sugerencia:** guardar `onChange`/`disabled` en refs actualizados en cada render, o crear el responder con `useMemo` dependiente de ellos.
- **Al corregir:** los `it.failing` leen los handlers del View que los lleva en el render actual (`pan.live()` en `test/panResponder.ts`), no `configs[0]`; por eso pasan a fallar ("Failing test passed…") tanto con la variante de refs como con la de `useMemo`. Quitar entonces `.failing` en los 3 tests.
- **Relación con el lint:** son los mismos sitios que marca `react-hooks/refs` (ver "Mejoras y observaciones").

### H-05 — Contraste insuficiente · Baja
- `Colors.textTertiary` (#8A6F5C) sobre `bgPrimary` (#FDDCA9) = 3,55:1 ("Añadir nombre" en Ajustes); `Colors.error` (#DC2626) sobre `bgPrimary` = 3,68:1 (mensajes de error). Ambos < 4,5:1.
- `Colors.textPlaceholder` es también `brown500`, el mismo color que `textTertiary`, así que comparte el fallo.
- **Sugerencia:** oscurecer `brown500` y `error500` para texto, o usar `brown700`/un rojo más oscuro en esos casos.

### H-06 — Reinicio del contador a medianoche UTC · Baja
- `settingsStore.todayString()` usa `toISOString()`. En España (UTC+1/+2) el contador se reinicia a la 01:00–02:00 locales, no a medianoche.
- **Sugerencia:** construir la fecha local (`getFullYear/getMonth/getDate`).
- **Al corregir:** las aserciones de los tests de integración `exportGate` y `captureToExport`, y las de `test/__tests__/screens/palette.test.tsx` (su `today()` y el `beforeEach` usan la fecha UTC; los tests del límite diario fallarán 1–2 h al día), que comparan con `new Date().toISOString().slice(0, 10)` pasarán a fallar entre 1 y 2 h al día (cuando fecha local y UTC difieren); hay que construirlas con la misma fecha local.

### H-01 — `Button` ignora `style` · Baja
- `style` se extrae de las props y nunca se aplica; hoy ningún llamador lo pasa, pero la API lo admite (`PressableProps`).

## Mejoras y observaciones

Sin `it.failing`, para decidir:

- **Lint en rojo antes de la suite:** `pnpm lint` falla con 19 errores y 17 advertencias (14 autocorregibles) sobre el código previo. Los errores son sobre todo `react-hooks/refs` ("Cannot access refs during render") en `Sheet.tsx`, `CornerControl.tsx`, `PaletteSizeControl.tsx` y `LibreEditOverlay.tsx`, más `app/(tabs)/index.tsx`, `CameraView.tsx` y `CropTab.tsx`. Por eso `test:ci` no incluye lint (`typecheck` + `jest --coverage --ci`).
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
