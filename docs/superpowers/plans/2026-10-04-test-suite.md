# Suite de tests completa — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cubrir todo Hued (`src/lib`, componentes, pantallas de `app/` y los flujos de punta a punta) con una suite Jest profesional que corra en PC, y dejar un informe de hallazgos con cada bug encontrado.

**Architecture:** `jest-expo` + `@testing-library/react-native` v13. Un `test/setup.ts` central mockea Skia y todos los módulos nativos (Skia pasa a ser *host elements* inspeccionables). Los tests de arquetipos leen el árbol Skia producido; los de gestos capturan `PanResponder.create` y llaman a sus handlers; la integración usa los módulos reales con una base de paletas en memoria. Los bugs se fijan como `it.failing` con ID `H-xx`.

**Tech Stack:** Jest 29.7, jest-expo 57, `@testing-library/react-native@^13.3.3`, `react-test-renderer@19.2.3`, TypeScript strict, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-04-test-suite-design.md`

## Global Constraints

- **No se toca código de producción.** Si algo exige un cambio para poder testearlo, parar y consultar. Los bugs se reportan con `it.failing`, no se arreglan.
- Los 19 tests existentes no se modifican. Sus `jest.mock` locales ganan sobre los globales de `test/setup.ts`.
- Nombres de tests en inglés, patrón AAA, un archivo por módulo en `__tests__/` junto a él. **Excepción:** los tests de pantallas de `app/` y los de integración van en `test/__tests__/…` (cualquier archivo dentro de `app/` se convertiría en ruta de expo-router).
- Sin snapshots. Sin red ni disco real. Tiempo y azar controlados (`jest.useFakeTimers`, `Date` fijo).
- Se prueba comportamiento observable, no implementación. Excepción documentada: los gestos se prueban llamando a los handlers capturados de `PanResponder`.
- Commits convencionales (`test(scope): …`). **Sin línea `Co-Authored-By`** (regla del usuario). Identidad git del repo: `Miguel` / `xtremzmiguel@gmail.com`.
- Cada `it.failing` lleva el ID del hallazgo en el nombre (`H-01` … `H-09`). Si un `it.failing` pasa a *fallar* con "expected to fail but passed", el bug ya no existe: pasarlo a `it` normal y marcarlo corregido en `HALLAZGOS.md`.
- Zona horaria de la suite: `Europe/Madrid`, fijada en `test/globalSetup.js` (un `process.env.TZ` dentro de un test no surte efecto: Jest da a cada test una copia de `process.env`).
- Los tests no pueden recargar React con `jest.isolateModules` si renderizan componentes (habría dos copias de React y fallarían los hooks): `isolateModules` solo se usa en tests de `lib` sin JSX.
- Comandos: PowerShell. Ruta del proyecto: `D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued`. Dev server (si hiciera falta) en :4000.
- Umbrales de cobertura objetivo: `src/lib` ≥ 90 %, `src/components` ≥ 75 %, `app/` ≥ 60 %.

## Review Focus

Entradas que el spec no nombra y que más probablemente romperán algo. Cada línea tiene su test en la tarea indicada.

1. **Paleta de 3 y de 8 colores en Franja, Banner y Lateral** — esperado: todas las muestras dentro del lienzo y cubriendo la franja entera. Hoy hardcodean 5. → Task 10 (H-04).
2. **Paleta con 0 colores** (durante la extracción, `colors: []`) — esperado: los 6 arquetipos se dibujan sin lanzar. → Task 10.
3. **Cambio de día en hora local** (España UTC+1/+2) — esperado: el contador de exportaciones gratis se reinicia a medianoche local. → Task 7 (H-06).
4. **La base de datos falla al abrir** (`getPalette`/`listPalettes` rechazan) — esperado: la pantalla sale del spinner y muestra algo accionable. → Task 16 (H-08, inicio) y Task 17 (H-07, editor).
5. **Props que cambian mientras se arrastra** y **filas guardadas antes de que existieran `paletteSize`/`freeformSwatches`** — esperado: el control usa el `onChange` vigente y los consumidores asumen un `LayoutConfig` completo. → Task 9 (H-09) y Task 7 (`palettes-legacy`).

## Mapa de archivos

**Crear (infraestructura, Task 1):**
- `test/setup.ts` — mocks globales y matchers.
- `test/mocks/skia.ts` — Skia como *host elements* (`SkRect`, `SkText`…).
- `test/mocks/expoCamera.tsx` — `CameraView` con `takePictureAsync`.
- `test/factories.ts` — `makeColor`, `makeColors`, `makeLayoutConfig`, `makePalette`.
- `test/skiaTree.ts` — `findAll`, `findTexts`, `treeSignature` sobre `toJSON()`.
- `test/router.ts` — acceso tipado a los mocks de `expo-router`.
- `test/panResponder.ts` — captura de `PanResponder.create`.
- `test/fakePaletteDb.ts` — implementación en memoria de `@/lib/db/palettes` (Task 17).
- `test/__tests__/infra.test.tsx` — humo de la infraestructura.

**Modificar (Task 1):** `package.json` (deps, scripts, config jest), `tsconfig.json` (alias `@test/*`, `@app/*`).

**Desviación respecto al spec:** el spec preveía un `test/render.tsx` (wrapper con router mockeado). No hace falta: `expo-router` se mockea globalmente en `test/setup.ts` y `test/router.ts` da acceso tipado a esos mocks. Tampoco se prueba `src/components/test/SkiaSmokeTest.tsx` (componente de desarrollo, excluido de la cobertura); el criterio de éxito "todo módulo tiene un test" se entiende sin él.

**Crear (tests):** uno por módulo, listados en cada tarea.

**Crear (informe, Task 19):** `docs/testing/HALLAZGOS.md`.

---

## Fase A — Infraestructura

### Task 1: Dependencias, config Jest y utilidades de test

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `test/globalSetup.js`, `test/setup.ts`, `test/mocks/skia.ts`, `test/mocks/expoCamera.tsx`, `test/factories.ts`, `test/skiaTree.ts`, `test/router.ts`, `test/panResponder.ts`
- Test: `test/__tests__/infra.test.tsx`

**Interfaces:**
- Produces (todas las tareas posteriores dependen de esto):
  - `@test/factories`: `makeColor(o?: Partial<ExtractedColor>): ExtractedColor`, `makeColors(count: number): ExtractedColor[]`, `makeLayoutConfig(o?: Partial<LayoutConfig>): LayoutConfig`, `makePalette(o?: Partial<Palette>): Palette` (5 colores por defecto).
  - `@test/skiaTree`: `interface HostNode { type: string; props: Record<string, unknown>; children: Array<HostNode | string> | null }`, `findAll(json: unknown, type: string): HostNode[]`, `findTexts(json: unknown): string[]`, `treeSignature(json: unknown): string`.
  - `@test/router`: `routerMock` (`push|replace|back|dismissAll|canDismiss|navigate`: `jest.Mock`), `searchParamsMock: jest.Mock`, `resetRouterMocks(): void`.
  - `@test/panResponder`: `capturePanResponders(): { configs: PanResponderCallbacks[]; restore(): void }`, `gesture(dx?: number, dy?: number): PanResponderGestureState`, `touch(locationX: number): GestureResponderEvent`.
  - `@test/mocks/expoCamera`: `takePictureAsync: jest.Mock`, `useCameraPermissions: jest.Mock`.
  - Alias de módulos: `@test/*` → `test/*`, `@app/*` → `app/*`.
  - Nombres de *host elements* Skia: `SkCanvas`, `SkGroup`, `SkRect`, `SkRoundedRect`, `SkCircle`, `SkText`, `SkImage`, `SkBackdropBlur`, `SkLinearGradient`.
  - La memoria MMKV simulada vive en `globalThis.__HUED_MMKV__` (un `Map<string, string>`) y se vacía tras cada test.

- [ ] **Step 1: Instalar dependencias de test**

```powershell
cd D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued
pnpm add -D @testing-library/react-native@^13.3.3 react-test-renderer@19.2.3 @types/react-test-renderer@^19.1.0
```

Expected: instala sin conflictos de peer deps. RNTL v14 (que exige `test-renderer`) queda fuera a propósito.

- [ ] **Step 2: Ejecutar lint una vez para conocer la línea base**

```powershell
pnpm lint
```

Expected: anotar si pasa. Si falla, **no** corregir aquí: apuntar el resumen para `HALLAZGOS.md` (Task 19) y dejar `lint` fuera de `test:ci`.

- [ ] **Step 3: Añadir alias a `tsconfig.json`**

En `compilerOptions.paths`, añadir dos entradas al final del objeto existente:

```json
      "@/data/*": ["./src/data/*"],
      "@test/*": ["./test/*"],
      "@app/*": ["./app/*"]
```

- [ ] **Step 4: Configurar Jest en `package.json`**

En la clave `"jest"` (que ya tiene `preset`, `testMatch`, `testPathIgnorePatterns`, `transformIgnorePatterns`), añadir:

```json
    "globalSetup": "<rootDir>/test/globalSetup.js",
    "setupFilesAfterEnv": ["<rootDir>/test/setup.ts"],
    "moduleNameMapper": {
      "^@test/(.*)$": "<rootDir>/test/$1",
      "^@app/(.*)$": "<rootDir>/app/$1"
    },
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "app/**/*.{ts,tsx}",
      "!src/**/__tests__/**",
      "!src/**/*.d.ts",
      "!src/types/**",
      "!src/components/test/**"
    ]
```

Y en `"scripts"`:

```json
    "test:coverage": "jest --coverage",
    "test:ci": "pnpm typecheck && jest --coverage --ci",
```

(Si en el Step 2 `lint` pasó, usar `"test:ci": "pnpm typecheck && pnpm lint && jest --coverage --ci"`.)

- [ ] **Step 4b: Crear `test/globalSetup.js` (zona horaria fija)**

Jest da a cada test una *copia* de `process.env`, así que asignar `TZ` dentro de un test no cambia la zona real. Se fija una vez, en el proceso padre, antes de lanzar los workers. `Europe/Madrid` hace la suite determinista (igual en CI que en tu PC) y es la zona real del usuario.

```js
// Se ejecuta una vez en el proceso padre; los workers de Jest heredan el entorno.
module.exports = async () => {
  process.env.TZ = 'Europe/Madrid';
};
```

- [ ] **Step 5: Crear `test/mocks/skia.ts`**

```ts
// Skia reemplazado por elementos host con prefijo `Sk` para poder inspeccionar
// el árbol que producen los arquetipos sin cargar CanvasKit (WASM).
// Los nombres no chocan con los de React Native (`Text`, `Image`).
export const skiaMock = {
  Canvas: 'SkCanvas',
  Group: 'SkGroup',
  Rect: 'SkRect',
  RoundedRect: 'SkRoundedRect',
  Circle: 'SkCircle',
  Text: 'SkText',
  Image: 'SkImage',
  BackdropBlur: 'SkBackdropBlur',
  LinearGradient: 'SkLinearGradient',
  vec: jest.fn((x: number, y: number) => ({ x, y })),
  rect: jest.fn((x: number, y: number, width: number, height: number) => ({ x, y, width, height })),
  rrect: jest.fn((r: unknown, rx: number, ry: number) => ({ rect: r, rx, ry })),
  matchFont: jest.fn(() => ({ __font: true })),
  useImage: jest.fn(() => null),
  drawAsImage: jest.fn(() => Promise.resolve({ encodeToBase64: jest.fn(() => 'base64-png') })),
  ImageFormat: { PNG: 4 },
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unpremul: 2 },
  Skia: {
    Data: {
      fromURI: jest.fn(() => Promise.resolve({})),
      fromBytes: jest.fn((bytes: Uint8Array) => ({ _bytes: bytes })),
    },
    Image: { MakeImageFromEncoded: jest.fn(() => null) },
  },
};
```

- [ ] **Step 6: Crear `test/mocks/expoCamera.tsx`**

```tsx
import { createElement, forwardRef, useImperativeHandle } from 'react';
import type { ReactNode } from 'react';

export const takePictureAsync = jest.fn();
export const useCameraPermissions = jest.fn();

export const CameraView = forwardRef<unknown, { children?: ReactNode }>(function CameraViewMock(
  props,
  ref
) {
  useImperativeHandle(ref, () => ({ takePictureAsync }));
  return createElement('ExpoCameraView', props as object, props.children);
});

export const expoCameraMock = { CameraView, useCameraPermissions };
```

- [ ] **Step 7: Crear `test/setup.ts`**

```ts
import '@testing-library/react-native/extend-expect';

declare global {
  // eslint-disable-next-line no-var
  var __HUED_MMKV__: Map<string, string> | undefined;
}

jest.mock('@shopify/react-native-skia', () => require('./mocks/skia').skiaMock);

jest.mock('expo-camera', () => require('./mocks/expoCamera').expoCameraMock);

// Memoria compartida entre registros de módulos (jest.isolateModules) para poder
// simular un "reinicio de la app" que conserva lo persistido.
jest.mock('react-native-mmkv', () => {
  const memory = (globalThis.__HUED_MMKV__ ??= new Map<string, string>());
  return {
    createMMKV: () => ({
      getString: (key: string) => memory.get(key),
      set: (key: string, value: string) => {
        memory.set(key, value);
      },
      remove: (key: string) => {
        memory.delete(key);
      },
    }),
  };
});

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openCropper: jest.fn() },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

jest.mock('posthog-react-native', () => {
  const PostHog = jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    optIn: jest.fn(),
    optOut: jest.fn(),
    ready: jest.fn(() => Promise.resolve()),
    optedOut: false,
  }));
  return {
    __esModule: true,
    default: PostHog,
    PostHogProvider: ({ children }: { children?: unknown }) => children,
  };
});

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: (component: unknown) => component,
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');

jest.mock('expo-router', () => {
  const React = require('react');
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => false),
    navigate: jest.fn(),
  };
  const withScreen = (host: string, screenHost: string) =>
    Object.assign(
      ({ children }: { children?: unknown }) => React.createElement(host, null, children),
      { Screen: (props: Record<string, unknown>) => React.createElement(screenHost, props) }
    );
  return {
    router,
    Stack: withScreen('Stack', 'StackScreen'),
    Tabs: withScreen('Tabs', 'TabsScreen'),
    Link: 'Link',
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});

afterEach(() => {
  globalThis.__HUED_MMKV__?.clear();
});
```

- [ ] **Step 8: Crear `test/factories.ts`**

```ts
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor, LayoutConfig, Palette } from '@/types/palette';

const HEXES = ['#FFF6E8', '#FDDCA9', '#E76219', '#C21717', '#562717', '#3A1A0F', '#16A34A', '#2563EB'];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function makeColor(overrides: Partial<ExtractedColor> = {}): ExtractedColor {
  return {
    hex: '#C21717',
    rgb: [194, 23, 23],
    lab: [40, 60, 45],
    name: 'Rojo',
    hslLightness: 0.43,
    weight: 0.2,
    ...overrides,
  };
}

/** `count` colores distintos, ordenados de claro a oscuro como los deja `extractColors`. */
export function makeColors(count: number): ExtractedColor[] {
  return Array.from({ length: count }, (_, i) => {
    const hex = HEXES[i % HEXES.length];
    return makeColor({
      hex,
      rgb: hexToRgb(hex),
      lab: [100 - (i * 80) / Math.max(count, 1), 0, 0],
      name: `Color ${i + 1}`,
      hslLightness: 1 - i / Math.max(count, 1),
      weight: 1 / count,
    });
  });
}

export function makeLayoutConfig(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
  return { ...DEFAULT_LAYOUT_CONFIG, ...overrides };
}

export function makePalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: 'p1',
    imageUri: 'file:///documents/palettes/p1/full.jpg',
    thumbnailUri: 'file:///documents/palettes/p1/thumb.jpg',
    colors: makeColors(5),
    layoutConfig: makeLayoutConfig(),
    collectionId: null,
    meta: { capturedAt: 1000, source: 'gallery', aspectRatio: 'original' },
    createdAt: 1000,
    updatedAt: 1000,
    isFavorite: false,
    exportCount: 0,
    ...overrides,
  };
}
```

- [ ] **Step 9: Crear `test/skiaTree.ts`**

```ts
// Utilidades sobre `render(...).toJSON()` de RNTL. Evitan depender de tipos de
// react-test-renderer y permiten buscar elementos host por nombre.
export interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: Array<HostNode | string> | null;
}

function asNodes(json: unknown): HostNode[] {
  if (!json) return [];
  return Array.isArray(json) ? (json as HostNode[]) : [json as HostNode];
}

export function findAll(json: unknown, type: string): HostNode[] {
  const found: HostNode[] = [];
  const walk = (node: HostNode | string) => {
    if (typeof node === 'string') return;
    if (node.type === type) found.push(node);
    node.children?.forEach(walk);
  };
  asNodes(json).forEach(walk);
  return found;
}

export function findTexts(json: unknown): string[] {
  return findAll(json, 'SkText').map((node) => String(node.props.text));
}

/** Serialización estable del árbol, sin la escala (`transform`) que difiere entre preview y export. */
export function treeSignature(json: unknown): string {
  return JSON.stringify(json, (key, value) => (key === 'transform' ? undefined : value));
}
```

- [ ] **Step 10: Crear `test/router.ts`**

```ts
import { router, useLocalSearchParams } from 'expo-router';

export const routerMock = router as unknown as {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  dismissAll: jest.Mock;
  canDismiss: jest.Mock;
  navigate: jest.Mock;
};

export const searchParamsMock = useLocalSearchParams as unknown as jest.Mock;

export function resetRouterMocks(): void {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.dismissAll.mockClear();
  routerMock.navigate.mockClear();
  routerMock.canDismiss.mockReset();
  routerMock.canDismiss.mockReturnValue(false);
  searchParamsMock.mockReset();
  searchParamsMock.mockReturnValue({});
}
```

- [ ] **Step 11: Crear `test/panResponder.ts`**

```ts
import { PanResponder } from 'react-native';
import type {
  GestureResponderEvent,
  PanResponderCallbacks,
  PanResponderGestureState,
} from 'react-native';

/**
 * Sustituye `PanResponder.create` para guardar la config de cada responder y
 * poder invocar sus handlers (`onPanResponderGrant`, `…Move`, `…Release`) con
 * eventos sintéticos. El responder real exige historial de toques de RN.
 * Los componentes llaman a `create` en cada render: `configs[0]` es la del primer render.
 */
export function capturePanResponders(): { configs: PanResponderCallbacks[]; restore: () => void } {
  const configs: PanResponderCallbacks[] = [];
  const spy = jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    configs.push(config);
    return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
  });
  return { configs, restore: () => spy.mockRestore() };
}

export function gesture(dx = 0, dy = 0): PanResponderGestureState {
  return { dx, dy } as PanResponderGestureState;
}

export function touch(locationX: number): GestureResponderEvent {
  return { nativeEvent: { locationX } } as GestureResponderEvent;
}
```

- [ ] **Step 12: Escribir el test de humo `test/__tests__/infra.test.tsx`**

```tsx
import { render } from '@testing-library/react-native';
import { Group, Rect, Text as SkText } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

import { makeColors, makePalette } from '@test/factories';
import { capturePanResponders, gesture } from '@test/panResponder';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';
import { findAll, findTexts, treeSignature } from '@test/skiaTree';

describe('test infrastructure', () => {
  it('factories build a complete, internally consistent palette', () => {
    const palette = makePalette();

    expect(palette.colors).toHaveLength(5);
    expect(palette.layoutConfig.paletteSize).toBe(5);
    expect(palette.thumbnailUri).toContain('thumb.jpg');
  });

  it('makeColors returns distinct colors ordered light to dark', () => {
    const colors = makeColors(8);

    expect(new Set(colors.map((c) => c.hex)).size).toBe(8);
    for (let i = 0; i < colors.length - 1; i++) {
      expect(colors[i].hslLightness).toBeGreaterThan(colors[i + 1].hslLightness);
    }
  });

  it('Skia is mocked as inspectable host elements', () => {
    const view = render(
      <Group>
        <Rect x={0} y={0} width={10} height={10} color="#FF0000" />
        <SkText x={1} y={2} text="hola" font={null} color="#000000" />
      </Group>
    );

    expect(findAll(view.toJSON(), 'SkRect')).toHaveLength(1);
    expect(findTexts(view.toJSON())).toEqual(['hola']);
  });

  it('treeSignature ignores the transform prop only', () => {
    const a = { type: 'SkGroup', props: { transform: [{ scale: 1 }], x: 1 }, children: null };
    const b = { type: 'SkGroup', props: { transform: [{ scale: 3 }], x: 1 }, children: null };
    const c = { type: 'SkGroup', props: { transform: [{ scale: 1 }], x: 2 }, children: null };

    expect(treeSignature(a)).toBe(treeSignature(b));
    expect(treeSignature(a)).not.toBe(treeSignature(c));
  });

  it('expo-router is mocked and resettable', () => {
    routerMock.push('/x');
    searchParamsMock.mockReturnValue({ id: 'a' });

    resetRouterMocks();

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(searchParamsMock()).toEqual({});
    expect(routerMock.canDismiss()).toBe(false);
  });

  it('PanResponder.create is captured so handlers can be called directly', () => {
    const { PanResponder } = require('react-native');
    const { configs, restore } = capturePanResponders();
    const onMove = jest.fn();

    PanResponder.create({ onPanResponderMove: onMove });
    configs[0].onPanResponderMove?.({} as never, gesture(5, 7));
    restore();

    expect(onMove).toHaveBeenCalledWith({}, { dx: 5, dy: 7 });
  });

  it('runs in the Europe/Madrid time zone', () => {
    // 22:30 UTC del 4-oct es ya el 5-oct en Madrid (UTC+2)
    expect(new Date('2026-10-04T22:30:00Z').getDate()).toBe(5);
  });

  it('the file system mock exposes both app directories', () => {
    expect(FileSystem.documentDirectory).toBe('file:///documents/');
    expect(FileSystem.cacheDirectory).toBe('file:///cache/');
  });

  it('MMKV memory is shared across module registries and cleared after each test', () => {
    let first!: { set: (k: string, v: string) => void };
    let second!: { getString: (k: string) => string | undefined };
    jest.isolateModules(() => {
      first = require('react-native-mmkv').createMMKV({ id: 'a' });
    });
    jest.isolateModules(() => {
      second = require('react-native-mmkv').createMMKV({ id: 'b' });
    });

    first.set('k', 'v');

    expect(second.getString('k')).toBe('v');
  });

  it('starts each test with an empty MMKV memory', () => {
    expect(globalThis.__HUED_MMKV__?.size ?? 0).toBe(0);
  });
});
```

- [ ] **Step 13: Ejecutar la suite completa**

```powershell
pnpm test
pnpm typecheck
```

Expected: PASS en las 20 suites (19 existentes + `infra`). `tsc` sin errores. Si algún test existente falla por un mock global, **no tocar el test**: acotar el mock global en `test/setup.ts` hasta que pase.

- [ ] **Step 14: Commit**

```powershell
git add package.json pnpm-lock.yaml tsconfig.json test
git commit -m "test(infra): add RNTL, central native mocks, factories and gesture helpers"
```


---

## Fase B — Lógica `lib`

### Task 2: `dateUtils`, `legal`, `tokens` y valores por defecto de `palette`

**Files:**
- Test: `src/lib/utils/__tests__/dateUtils.test.ts`, `src/lib/__tests__/legal.test.ts`, `src/lib/__tests__/tokens.test.ts`, `src/types/__tests__/palette.test.ts`

**Interfaces:**
- Consumes: `formatDateEs(timestamp: number): string`; `TERMS_URL`, `PRIVACY_URL: string`; `Primitive`, `Colors`, `Spacing`, `FontSize`, `Radius`, `Duration` de `@/lib/tokens`.
- Produces: hallazgos **H-03** (`PRIVACY_URL` es un marcador) y **H-05** (dos pares de contraste no llegan a AA).

- [ ] **Step 1: Escribir `dateUtils.test.ts`**

```ts
import { formatDateEs } from '../dateUtils';

describe('formatDateEs', () => {
  it('formats a timestamp as day, short month and year in Spanish', () => {
    expect(formatDateEs(Date.UTC(2026, 9, 4, 12))).toBe('4 oct 2026');
  });

  it('does not zero-pad the day', () => {
    expect(formatDateEs(Date.UTC(2026, 0, 5, 12))).toBe('5 ene 2026');
  });

  it('uses the local calendar day, not the UTC one', () => {
    // 23:30 UTC del 4-oct ya es 5-oct en Madrid
    expect(formatDateEs(Date.UTC(2026, 9, 4, 23, 30))).toBe('5 oct 2026');
  });
});
```

- [ ] **Step 2: Escribir `legal.test.ts`**

```ts
import { PRIVACY_URL, TERMS_URL } from '../legal';

const HTTPS_URL = /^https:\/\/[\w.-]+(\/\S*)?$/;

describe('legal links', () => {
  it('TERMS_URL is a public https URL', () => {
    expect(TERMS_URL).toMatch(HTTPS_URL);
  });

  // H-03: PRIVACY_URL sigue siendo el marcador "[RELLENAR: …]". `Linking.openURL`
  // lo recibe desde Ajustes y desde el paywall, y Apple (5.1.1) y Google Play
  // exigen una política de privacidad pública.
  it.failing('PRIVACY_URL is a public https URL (H-03)', () => {
    expect(PRIVACY_URL).toMatch(HTTPS_URL);
  });
});
```

- [ ] **Step 3: Escribir `tokens.test.ts`**

```ts
import { Colors, Duration, FontSize, Primitive, Radius, Spacing } from '../tokens';

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type ColorKey = keyof typeof Colors;

describe('Primitive palette', () => {
  it.each(Object.entries(Primitive))('%s is a 6-digit hex color', (_name, value) => {
    expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('Semantic colors', () => {
  it('map onto primitives (no ad-hoc hex for brand colors)', () => {
    expect(Colors.bgPrimary).toBe(Primitive.cream200);
    expect(Colors.textPrimary).toBe(Primitive.brown800);
    expect(Colors.accent).toBe(Primitive.red500);
    expect(Colors.accentSubtle).toBe(Primitive.amber400);
  });

  it('keeps the export canvas background pure white so photos pop', () => {
    expect(Colors.canvasBg).toBe('#FFFFFF');
  });
});

describe('WCAG contrast', () => {
  const AA_PAIRS: Array<[string, ColorKey, ColorKey]> = [
    ['textPrimary on bgPrimary', 'textPrimary', 'bgPrimary'],
    ['textSecondary on bgPrimary', 'textSecondary', 'bgPrimary'],
    ['textPrimary on bgElevated', 'textPrimary', 'bgElevated'],
    ['textSecondary on bgElevated', 'textSecondary', 'bgElevated'],
    ['textTertiary on bgElevated (tab bar)', 'textTertiary', 'bgElevated'],
    ['accentForeground on accent (CTA)', 'accentForeground', 'accent'],
    ['textPrimary on accentSubtle (chips)', 'textPrimary', 'accentSubtle'],
    ['textInverse on bgInverse', 'textInverse', 'bgInverse'],
    ['accent on bgPrimary (links)', 'accent', 'bgPrimary'],
  ];

  it.each(AA_PAIRS)('%s reaches AA (4.5:1)', (_label, fg, bg) => {
    expect(contrast(Colors[fg], Colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('primary text on the base background reaches AAA (7:1)', () => {
    expect(contrast(Colors.textPrimary, Colors.bgPrimary)).toBeGreaterThanOrEqual(7);
  });

  it('keeps orange as a decorative-only accent (documented to fail AA for text)', () => {
    expect(contrast(Primitive.white, Primitive.orange500)).toBeLessThan(4.5);
  });

  // H-05: estos dos pares se usan como texto sobre `bgPrimary` (Ajustes: "Añadir
  // nombre"; mensajes de error en paywall, pantalla de paleta y recorte) y no llegan a AA.
  it.failing('textTertiary on bgPrimary reaches AA (H-05: 3.55:1)', () => {
    expect(contrast(Colors.textTertiary, Colors.bgPrimary)).toBeGreaterThanOrEqual(4.5);
  });

  it.failing('error on bgPrimary reaches AA (H-05: 3.68:1)', () => {
    expect(contrast(Colors.error, Colors.bgPrimary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Scales', () => {
  it('Spacing follows the 4pt grid (except the 1px hairline)', () => {
    Object.entries(Spacing)
      .filter(([key]) => key !== 'px')
      .forEach(([, value]) => expect(value % 4).toBe(0));
  });

  it('FontSize is strictly increasing', () => {
    const sizes = Object.values(FontSize);
    sizes.slice(1).forEach((size, i) => expect(size).toBeGreaterThan(sizes[i]));
  });

  it('Radius is strictly increasing from sharp to pill', () => {
    const radii = Object.values(Radius);
    radii.slice(1).forEach((radius, i) => expect(radius).toBeGreaterThan(radii[i]));
  });

  it('Duration is increasing from fast to slow', () => {
    expect(Duration.fast).toBeLessThan(Duration.normal);
    expect(Duration.normal).toBeLessThan(Duration.slow);
  });
});
```

- [ ] **Step 4: Escribir `src/types/__tests__/palette.test.ts`**

```ts
import { ARCHETYPES } from '@/data/archetypes';
import { DEFAULT_LAYOUT_CONFIG } from '../palette';

describe('DEFAULT_LAYOUT_CONFIG', () => {
  it('starts on an archetype that exists in the registry', () => {
    expect(Object.keys(ARCHETYPES)).toContain(DEFAULT_LAYOUT_CONFIG.archetypeId);
  });

  it('gives a publication-ready look without any adjustment (editorial defaults)', () => {
    expect(DEFAULT_LAYOUT_CONFIG).toMatchObject({
      showHex: true,
      showName: true,
      showRGB: false,
      fontFamily: 'sans',
      cornerRadius: 16,
      cardStyle: 'filled',
    });
  });

  it('leaves the watermark preference off (the free-tier gate decides, not the default)', () => {
    expect(DEFAULT_LAYOUT_CONFIG.watermarkVisible).toBe(false);
  });

  it('defaults to a supported palette size', () => {
    expect(DEFAULT_LAYOUT_CONFIG.paletteSize).toBe(5);
    expect(DEFAULT_LAYOUT_CONFIG.paletteSize).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_LAYOUT_CONFIG.paletteSize).toBeLessThanOrEqual(8);
  });

  it('has no Libre swatches until the Libre archetype generates them', () => {
    expect(DEFAULT_LAYOUT_CONFIG.freeformSwatches).toEqual([]);
  });
});
```

- [ ] **Step 5: Ejecutar**

```powershell
pnpm jest src/lib/utils/__tests__/dateUtils.test.ts src/lib/__tests__/legal.test.ts src/lib/__tests__/tokens.test.ts src/types
```

Expected: PASS. Los 3 `it.failing` cuentan como pasados. Si `formatDateEs` devolviera otro formato (ICU distinto), ajustar solo la cadena esperada y anotarlo.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/utils/__tests__/dateUtils.test.ts src/lib/__tests__/legal.test.ts src/lib/__tests__/tokens.test.ts src/types/__tests__/palette.test.ts
git commit -m "test(lib): cover dateUtils, legal links, design-token contrast and layout defaults (H-03, H-05)"
```

---

### Task 3: Base de datos — `schema` y `client`

**Files:**
- Test: `src/lib/db/__tests__/schema.test.ts`, `src/lib/db/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `MIGRATIONS: { name: string; sql: string }[]` de `../schema`; `getDb(): Promise<SQLiteDatabase>` de `../client`.
- Produces: garantía de que las migraciones se aplican una vez, en orden y de forma atómica.

- [ ] **Step 1: Escribir `schema.test.ts`**

```ts
import { MIGRATIONS } from '../schema';

describe('MIGRATIONS', () => {
  it('has unique names numbered consecutively from 001', () => {
    const names = MIGRATIONS.map((m) => m.name);

    expect(new Set(names).size).toBe(names.length);
    names.forEach((name, i) => {
      expect(name).toMatch(new RegExp(`^${String(i + 1).padStart(3, '0')}_[a-z_]+$`));
    });
  });

  it('every migration carries non-empty SQL', () => {
    MIGRATIONS.forEach((m) => expect(m.sql.trim().length).toBeGreaterThan(0));
  });

  it('001 creates the palettes table, its indexes and the migrations ledger', () => {
    const sql = MIGRATIONS[0].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS palettes');
    expect(sql).toContain('idx_palettes_created_at');
    expect(sql).toContain('idx_palettes_favorite');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS migrations');
  });

  it('002 creates collections and links palettes to them', () => {
    const sql = MIGRATIONS[1].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS collections');
    expect(sql).toContain('ALTER TABLE palettes ADD COLUMN collection_id');
    expect(sql).toContain('idx_palettes_collection');
  });

  it('palettes keep every column the data layer reads', () => {
    const sql = MIGRATIONS[0].sql + MIGRATIONS[1].sql;
    [
      'id', 'image_uri', 'thumbnail_uri', 'colors', 'layout_config', 'meta',
      'created_at', 'updated_at', 'is_favorite', 'export_count', 'collection_id',
    ].forEach((column) => expect(sql).toContain(column));
  });
});
```

- [ ] **Step 2: Escribir `client.test.ts`**

```ts
import { MIGRATIONS } from '../schema';

interface FakeTxn {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
}

function makeDb(applied: string[] = []) {
  const txn: FakeTxn = {
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn(() => Promise.resolve()),
  };
  return {
    txn,
    execAsync: jest.fn(() => Promise.resolve()),
    getAllAsync: jest.fn(() => Promise.resolve(applied.map((name) => ({ name })))),
    withExclusiveTransactionAsync: jest.fn((fn: (t: FakeTxn) => Promise<void>) => fn(txn)),
  };
}

// `client.ts` guarda la conexión en una variable de módulo: un registro nuevo por test.
function load() {
  let client!: typeof import('../client');
  let sqlite!: { openDatabaseAsync: jest.Mock };
  jest.isolateModules(() => {
    sqlite = require('expo-sqlite');
    client = require('../client');
  });
  return { client, sqlite };
}

describe('getDb', () => {
  it('opens hued.db and applies every migration in order, each in its own transaction', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    const result = await client.getDb();

    expect(result).toBe(db);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledWith('hued.db');
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(MIGRATIONS.length);
    expect(db.txn.execAsync.mock.calls.map((c) => c[0])).toEqual(MIGRATIONS.map((m) => m.sql));
    expect(db.txn.runAsync.mock.calls.map((c) => c[1])).toEqual(MIGRATIONS.map((m) => m.name));
  });

  it('creates the migrations ledger before reading which migrations ran', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();

    expect(db.execAsync.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS migrations');
    expect(db.execAsync.mock.invocationCallOrder[0]).toBeLessThan(db.getAllAsync.mock.invocationCallOrder[0]);
  });

  it('skips migrations that were already applied', async () => {
    const db = makeDb([MIGRATIONS[0].name]);
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();

    expect(db.txn.execAsync.mock.calls.map((c) => c[0])).toEqual(MIGRATIONS.slice(1).map((m) => m.sql));
  });

  it('opens no transaction when the schema is already up to date', async () => {
    const db = makeDb(MIGRATIONS.map((m) => m.name));
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();

    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('shares one connection between concurrent callers', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    const [a, b] = await Promise.all([client.getDb(), client.getDb()]);

    expect(a).toBe(b);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached connection on later calls', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();
    await client.getDb();

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed open so the next call retries', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(db);

    await expect(client.getDb()).rejects.toThrow('disk full');
    await expect(client.getDb()).resolves.toBe(db);

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('does not record a migration whose SQL failed (safe to retry)', async () => {
    const db = makeDb();
    db.txn.execAsync.mockRejectedValueOnce(new Error('syntax error'));
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await expect(client.getDb()).rejects.toThrow('syntax error');

    expect(db.txn.runAsync).not.toHaveBeenCalled();
  });

  it('retries pending migrations after a failure instead of caching the broken connection', async () => {
    const db = makeDb();
    db.withExclusiveTransactionAsync.mockRejectedValueOnce(new Error('locked'));
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await expect(client.getDb()).rejects.toThrow('locked');
    await expect(client.getDb()).resolves.toBe(db);

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Ejecutar**

```powershell
pnpm jest src/lib/db/__tests__/schema.test.ts src/lib/db/__tests__/client.test.ts
```

Expected: PASS (14 tests).

- [ ] **Step 4: Comprobar que el test puede fallar (mutation check)**

En `src/lib/db/client.ts` quitar temporalmente el `.catch(...)` que pone `_dbPromise = null`, ejecutar el comando anterior y comprobar que **falla** `forgets a failed open…`. Restaurar con `git checkout src/lib/db/client.ts`.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db/__tests__/schema.test.ts src/lib/db/__tests__/client.test.ts
git commit -m "test(db): cover migration schema and connection/migration lifecycle"
```

---

### Task 4: Analítica y consentimiento

**Files:**
- Test: `src/lib/analytics/__tests__/events.test.ts`, `src/lib/analytics/__tests__/posthog.test.ts`, `src/components/__tests__/AnalyticsConsentSheet.test.tsx`

**Interfaces:**
- Consumes: `trackEvent(event, props): void`; `posthog: PostHog | null`; `<AnalyticsConsentSheet />`; `useSettingsStore` (`analyticsPromptShown`).
- Produces: garantía de privacidad (art. 22.2 LSSI): sin consentimiento no se captura nada.

- [ ] **Step 1: Escribir `events.test.ts`**

```ts
import { trackEvent } from '../events';
import { posthog } from '../posthog';

jest.mock('../posthog', () => ({ posthog: { capture: jest.fn() } }));

const capture = (posthog as unknown as { capture: jest.Mock }).capture;

beforeEach(() => capture.mockClear());

describe('trackEvent', () => {
  it('forwards the event name and its props to PostHog', () => {
    trackEvent('paywall_shown', { trigger: 'export_limit' });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('paywall_shown', { trigger: 'export_limit' });
  });

  it('sends events without extra properties unchanged', () => {
    trackEvent('subscription_restored', {});

    expect(capture).toHaveBeenCalledWith('subscription_restored', {});
  });

  it('is a silent no-op when PostHog is not configured', () => {
    jest.isolateModules(() => {
      jest.doMock('../posthog', () => ({ posthog: null }));
      const { trackEvent: isolatedTrackEvent } = require('../events');

      expect(() => isolatedTrackEvent('app_opened', { source: 'cold_start' })).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Escribir `posthog.test.ts`**

```ts
const ENV_KEY = 'EXPO_PUBLIC_POSTHOG_KEY';
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

function load(key?: string) {
  if (key === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = key;
  let mod!: typeof import('../posthog');
  let PostHog!: jest.Mock;
  jest.isolateModules(() => {
    PostHog = require('posthog-react-native').default;
    mod = require('../posthog');
  });
  return { mod, PostHog };
}

describe('posthog client', () => {
  it('is null and never constructs a client without a key', () => {
    const { mod, PostHog } = load();

    expect(mod.posthog).toBeNull();
    expect(PostHog).not.toHaveBeenCalled();
  });

  it('is null for an empty key (empty = disabled, like Sentry and RevenueCat)', () => {
    const { mod } = load('');

    expect(mod.posthog).toBeNull();
  });

  it('constructs the EU client with the configured key', () => {
    const { mod, PostHog } = load('phc_test_key');

    expect(mod.posthog).not.toBeNull();
    expect(PostHog).toHaveBeenCalledWith('phc_test_key', expect.objectContaining({ host: 'https://eu.i.posthog.com' }));
  });

  it('starts opted out: nothing is captured until the user accepts (art. 22.2 LSSI)', () => {
    const { PostHog } = load('phc_test_key');

    expect(PostHog.mock.calls[0][1].defaultOptIn).toBe(false);
  });

  it('disables the requests that optOut would not stop (flags, remote config, surveys)', () => {
    const { PostHog } = load('phc_test_key');

    expect(PostHog.mock.calls[0][1]).toMatchObject({
      preloadFeatureFlags: false,
      disableRemoteConfig: true,
      disableSurveys: true,
    });
  });
});
```

- [ ] **Step 3: Escribir `AnalyticsConsentSheet.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';
import { AnalyticsConsentSheet } from '../AnalyticsConsentSheet';

let mockPosthog: { optIn: jest.Mock; optOut: jest.Mock } | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));

const TITLE = '¿Nos ayudas a mejorar Hued?';

beforeEach(() => {
  mockPosthog = { optIn: jest.fn(), optOut: jest.fn() };
  useSettingsStore.setState({ analyticsPromptShown: false });
});

describe('AnalyticsConsentSheet', () => {
  it('asks for consent on first launch when analytics is configured', () => {
    render(<AnalyticsConsentSheet />);

    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getByText('Aceptar')).toBeOnTheScreen();
    expect(screen.getByText('No, gracias')).toBeOnTheScreen();
  });

  it('stays hidden when no PostHog key is configured (nothing to consent to)', () => {
    mockPosthog = null;

    render(<AnalyticsConsentSheet />);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('stays hidden once the prompt was already answered', () => {
    useSettingsStore.setState({ analyticsPromptShown: true });

    render(<AnalyticsConsentSheet />);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('accepting opts in, records the answer and closes the sheet', () => {
    render(<AnalyticsConsentSheet />);

    fireEvent.press(screen.getByText('Aceptar'));

    expect(mockPosthog?.optIn).toHaveBeenCalledTimes(1);
    expect(mockPosthog?.optOut).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('declining opts out and records the answer', () => {
    render(<AnalyticsConsentSheet />);

    fireEvent.press(screen.getByText('No, gracias'));

    expect(mockPosthog?.optOut).toHaveBeenCalledTimes(1);
    expect(mockPosthog?.optIn).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
  });

  it('dismissing the sheet without choosing counts as a refusal', () => {
    render(<AnalyticsConsentSheet />);

    act(() => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });

    expect(mockPosthog?.optOut).toHaveBeenCalledTimes(1);
    expect(mockPosthog?.optIn).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
  });

  it('explains that photos and colors are never collected', () => {
    render(<AnalyticsConsentSheet />);

    expect(screen.getByText(/Nunca incluye tus fotos ni tus colores/)).toBeOnTheScreen();
  });
});
```

- [ ] **Step 4: Ejecutar**

```powershell
pnpm jest src/lib/analytics src/components/__tests__/AnalyticsConsentSheet.test.tsx
```

Expected: PASS (15 tests). Si `posthog.test.ts` ve la clave `null` con la variable puesta, `babel-preset-expo` está inlining `process.env.EXPO_PUBLIC_*`; en ese caso sustituir `process.env[ENV_KEY]` en el test por `jest.replaceProperty(process, 'env', { ...process.env, [ENV_KEY]: key })` dentro de `load` y documentarlo.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/analytics/__tests__ src/components/__tests__/AnalyticsConsentSheet.test.tsx
git commit -m "test(analytics): cover opt-in default, event forwarding and consent sheet"
```

---

### Task 5: Cliente de RevenueCat

**Files:**
- Test: `src/lib/revenuecat/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `init(): void`, `getOfferings(): Promise<PurchasesOffering | null>`, `purchasePackage(pkg): Promise<CustomerInfo>`, `restorePurchases(): Promise<CustomerInfo>`; `useSettingsStore.getState().{subscriptionStatus, subscriptionExpiresAt}`.
- Produces: garantía de que el estado de suscripción llega al store por las 4 vías (arranque, listener, compra, restauración).

- [ ] **Step 1: Escribir `client.test.ts`**

```ts
import type { PurchasesPackage } from 'react-native-purchases';

const ENV_KEY = 'EXPO_PUBLIC_REVENUECAT_API_KEY';
const EXPIRES = '2027-01-01T00:00:00.000Z';

const premiumInfo = { entitlements: { active: { hued_pro: { expirationDate: EXPIRES } } } };
const lifetimeInfo = { entitlements: { active: { hued_pro: { expirationDate: null } } } };
const freeInfo = { entitlements: { active: {} } };

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

afterEach(() => {
  delete process.env[ENV_KEY];
});

// `initialized` es una variable de módulo: un registro nuevo por test.
function load(apiKey?: string) {
  if (apiKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = apiKey;
  let client!: typeof import('../client');
  let Purchases!: Record<string, jest.Mock>;
  let store!: typeof import('@/lib/store/settingsStore').useSettingsStore;
  jest.isolateModules(() => {
    Purchases = require('react-native-purchases').default;
    store = require('@/lib/store/settingsStore').useSettingsStore;
    client = require('../client');
  });
  return { client, Purchases, store };
}

describe('init', () => {
  it('does nothing without an API key', () => {
    const { client, Purchases } = load();

    client.init();

    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
  });

  it('configures the SDK once even if called repeatedly', () => {
    const { client, Purchases } = load('rc_test');

    client.init();
    client.init();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'rc_test' });
    expect(Purchases.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
  });

  it('enables verbose logging in development builds', () => {
    const { client, Purchases } = load('rc_test');

    client.init();

    expect(Purchases.setLogLevel).toHaveBeenCalledWith('DEBUG');
  });

  it('syncs the entitlement into the store on cold start', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.getCustomerInfo.mockResolvedValueOnce(premiumInfo);

    client.init();
    await flushPromises();

    expect(store.getState().subscriptionStatus).toBe('premium');
    expect(store.getState().subscriptionExpiresAt).toBe(new Date(EXPIRES).getTime());
  });

  it('keeps the persisted state when the cold-start sync fails (offline)', async () => {
    const { client, Purchases, store } = load('rc_test');
    store.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: 5 });
    Purchases.getCustomerInfo.mockRejectedValueOnce(new Error('offline'));

    client.init();
    await flushPromises();

    expect(store.getState().subscriptionStatus).toBe('premium');
    expect(store.getState().subscriptionExpiresAt).toBe(5);
  });

  it('applies later entitlement changes pushed by the SDK (renewals, expirations)', async () => {
    const { client, Purchases, store } = load('rc_test');
    client.init();
    await flushPromises();
    const listener = Purchases.addCustomerInfoUpdateListener.mock.calls[0][0];

    listener(premiumInfo);
    expect(store.getState().subscriptionStatus).toBe('premium');

    listener(freeInfo);
    expect(store.getState().subscriptionStatus).toBe('free');
    expect(store.getState().subscriptionExpiresAt).toBeNull();
  });
});

describe('getOfferings', () => {
  it('returns the current offering', async () => {
    const { client, Purchases } = load('rc_test');
    Purchases.getOfferings.mockResolvedValueOnce({ current: { identifier: 'default' } });

    await expect(client.getOfferings()).resolves.toEqual({ identifier: 'default' });
  });

  it('returns null when there is no current offering', async () => {
    const { client, Purchases } = load('rc_test');
    Purchases.getOfferings.mockResolvedValueOnce({ current: null });

    await expect(client.getOfferings()).resolves.toBeNull();
  });

  it('propagates SDK errors so the paywall can show them', async () => {
    const { client, Purchases } = load('rc_test');
    Purchases.getOfferings.mockRejectedValueOnce(new Error('network'));

    await expect(client.getOfferings()).rejects.toThrow('network');
  });
});

describe('purchasePackage', () => {
  const pkg = { identifier: '$rc_monthly' } as PurchasesPackage;

  it('writes the new entitlement to the store before returning', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.purchasePackage.mockResolvedValueOnce({ customerInfo: premiumInfo });

    const info = await client.purchasePackage(pkg);

    expect(Purchases.purchasePackage).toHaveBeenCalledWith(pkg);
    expect(info).toBe(premiumInfo);
    expect(store.getState().subscriptionStatus).toBe('premium');
  });

  it('stores a lifetime purchase without an expiry date', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.purchasePackage.mockResolvedValueOnce({ customerInfo: lifetimeInfo });

    await client.purchasePackage(pkg);

    expect(store.getState().subscriptionStatus).toBe('premium');
    expect(store.getState().subscriptionExpiresAt).toBeNull();
  });

  it('leaves the store untouched when the purchase is cancelled or fails', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.purchasePackage.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { userCancelled: true }));

    await expect(client.purchasePackage(pkg)).rejects.toMatchObject({ userCancelled: true });

    expect(store.getState().subscriptionStatus).toBe('free');
  });
});

describe('restorePurchases', () => {
  it('writes the restored entitlement to the store', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.restorePurchases.mockResolvedValueOnce(premiumInfo);

    await client.restorePurchases();

    expect(store.getState().subscriptionStatus).toBe('premium');
  });

  it('downgrades to free when nothing is restored', async () => {
    const { client, Purchases, store } = load('rc_test');
    store.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: 99 });
    Purchases.restorePurchases.mockResolvedValueOnce(freeInfo);

    await client.restorePurchases();

    expect(store.getState().subscriptionStatus).toBe('free');
    expect(store.getState().subscriptionExpiresAt).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar**

```powershell
pnpm jest src/lib/revenuecat/__tests__/client.test.ts
```

Expected: PASS (13 tests). Mismo aviso de inlining de `EXPO_PUBLIC_*` que en Task 4.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/revenuecat/__tests__/client.test.ts
git commit -m "test(revenuecat): cover init, offerings, purchase and restore syncing to the store"
```

---

### Task 6: Avatar y selector de galería

**Files:**
- Test: `src/lib/profile/__tests__/avatar.test.ts`, `src/components/capture/__tests__/GalleryPicker.test.ts`

**Interfaces:**
- Consumes: `pickAvatarFromCamera()`, `pickAvatarFromGallery(): Promise<{type:'picked';uri}|{type:'denied'}|{type:'cancelled'}>`, `saveAvatar(sourceUri): Promise<string>`, `launchGalleryPicker(): Promise<PickResult>`.

- [ ] **Step 1: Escribir `avatar.test.ts`**

```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { pickAvatarFromCamera, pickAvatarFromGallery, saveAvatar } from '../avatar';

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('pickAvatarFromCamera', () => {
  it('returns denied without opening the camera when permission is refused', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(pickAvatarFromCamera()).resolves.toEqual({ type: 'denied' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user closes the camera', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarFromCamera()).resolves.toEqual({ type: 'cancelled' });
  });

  it('returns the captured uri without editing and with 0.8 quality', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg' }] } as never);

    await expect(pickAvatarFromCamera()).resolves.toEqual({ type: 'picked', uri: 'file:///cam.jpg' });
    expect(picker.launchCameraAsync).toHaveBeenCalledWith({ allowsEditing: false, quality: 0.8 });
  });
});

describe('pickAvatarFromGallery', () => {
  it('returns denied without opening the library when permission is refused', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(pickAvatarFromGallery()).resolves.toEqual({ type: 'denied' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user leaves the library', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarFromGallery()).resolves.toEqual({ type: 'cancelled' });
  });

  it('returns only images, unedited, with 0.8 quality', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.jpg' }] } as never);

    await expect(pickAvatarFromGallery()).resolves.toEqual({ type: 'picked', uri: 'file:///pic.jpg' });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
  });
});

describe('saveAvatar', () => {
  const dest = 'file:///documents/profile/avatar.jpg';

  it('copies into the profile folder and cache-busts the returned uri', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);

    const uri = await saveAvatar('file:///tmp/new.jpg');

    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith('file:///documents/profile/', { intermediates: true });
    expect(fs.copyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/new.jpg', to: dest });
    expect(uri).toBe(`${dest}?t=1234`);
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('deletes the previous avatar first because copyAsync does not overwrite', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true } as never);

    await saveAvatar('file:///tmp/new.jpg');

    expect(fs.deleteAsync).toHaveBeenCalledWith(dest);
    expect(fs.deleteAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.copyAsync.mock.invocationCallOrder[0]);
  });

  it('produces a different uri on every save so <Image> refreshes', async () => {
    const now = jest.spyOn(Date, 'now');
    fs.getInfoAsync.mockResolvedValue({ exists: false } as never);

    now.mockReturnValueOnce(1);
    const first = await saveAvatar('file:///a.jpg');
    now.mockReturnValueOnce(2);
    const second = await saveAvatar('file:///a.jpg');

    expect(first).not.toBe(second);
  });

  it('propagates a failed copy so the caller can report it', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
    fs.copyAsync.mockRejectedValueOnce(new Error('no space'));

    await expect(saveAvatar('file:///a.jpg')).rejects.toThrow('no space');
  });

  it('throws when the document directory is unavailable', async () => {
    Object.defineProperty(fs, 'documentDirectory', { value: null, configurable: true });

    await expect(saveAvatar('file:///a.jpg')).rejects.toThrow('FileSystem.documentDirectory is null');

    Object.defineProperty(fs, 'documentDirectory', { value: 'file:///documents/', configurable: true });
  });
});
```

Nota: `restoreAllMocks` restaura los `spyOn` de `Date.now`; los `jest.fn` creados en el mock global conservan su implementación por defecto porque `restoreAllMocks` solo afecta a spies.

- [ ] **Step 2: Escribir `GalleryPicker.test.ts`**

```ts
import * as ImagePicker from 'expo-image-picker';

import { trackEvent } from '@/lib/analytics/events';
import { launchGalleryPicker } from '../GalleryPicker';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const track = trackEvent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('launchGalleryPicker', () => {
  it('returns denied and records nothing when permission is refused', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(launchGalleryPicker()).resolves.toEqual({ type: 'denied' });

    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('opens an images-only, unedited, full-quality picker and reports start + completion', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///g.jpg' }] } as never);

    await expect(launchGalleryPicker()).resolves.toEqual({ type: 'picked', uri: 'file:///g.jpg' });

    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    expect(track).toHaveBeenNthCalledWith(1, 'capture_started', { source: 'gallery' });
    expect(track).toHaveBeenNthCalledWith(2, 'capture_completed', { source: 'gallery', duration_ms: 0 });
  });

  it('reports a cancelled pick and returns cancelled', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(launchGalleryPicker()).resolves.toEqual({ type: 'cancelled' });

    expect(track).toHaveBeenCalledWith('capture_cancelled', { source: 'gallery', stage: 'pick' });
    expect(track).not.toHaveBeenCalledWith('capture_completed', expect.anything());
  });
});
```

- [ ] **Step 3: Ejecutar**

```powershell
pnpm jest src/lib/profile src/components/capture/__tests__/GalleryPicker.test.ts
```

Expected: PASS (14 tests).

- [ ] **Step 4: Commit**

```powershell
git add src/lib/profile/__tests__ src/components/capture/__tests__/GalleryPicker.test.ts
git commit -m "test(capture): cover avatar picking/saving and gallery picker flow"
```

---

### Task 7: Color, búsqueda, exportación (paridad), zona horaria y filas antiguas

**Files:**
- Test: `src/lib/color/__tests__/colorMath.edge.test.ts`, `src/lib/search/__tests__/normalize.edge.test.ts`, `src/lib/color/__tests__/extract.edge.test.ts`, `src/lib/export/__tests__/exportPalette.parity.test.tsx`, `src/lib/store/__tests__/settingsStore.timezone.test.ts`, `src/lib/db/__tests__/palettes-legacy.test.ts`

**Interfaces:**
- Consumes: `extractColors(uri, k?)`, `ExtractError`; `exportPalette(palette, config, resolution)`, `RESOLUTIONS`; `ArchetypeCanvas`, `CANVAS_W`, `CANVAS_H`; `ARCHETYPES`; `useSettingsStore.resetExportCountIfNewDay()`; `getPalette`, `listPalettes`.
- Produces: **H-06** (el contador diario se reinicia a medianoche UTC) y la garantía de paridad preview/export, invariante no negociable de `CLAUDE.md`.

- [ ] **Step 0: Escribir `colorMath.edge.test.ts` y `normalize.edge.test.ts`**

`colorMath.edge.test.ts` (valores de referencia sRGB/D65 de la literatura, tolerancia de ±0,5 en Lab):

```ts
import { rgbToHex, rgbToHsl, rgbToLab } from '../colorMath';

describe('rgbToHex — edge cases', () => {
  it('rounds fractional channels to the nearest integer', () => {
    expect(rgbToHex(127.5, 0.4, 254.6)).toBe('#8000FF');
  });

  it('always produces an uppercase 7-character hex', () => {
    for (const [r, g, b] of [[0, 0, 0], [1, 2, 3], [171, 205, 239], [255, 255, 255]]) {
      expect(rgbToHex(r, g, b)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('round-trips through its own parse', () => {
    const hex = rgbToHex(18, 52, 86);

    expect(hex).toBe('#123456');
    expect([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]).toEqual([18, 52, 86]);
  });
});

describe('rgbToHsl — hues', () => {
  it.each([
    ['red', [255, 0, 0], 0],
    ['yellow', [255, 255, 0], 60],
    ['green', [0, 255, 0], 120],
    ['cyan', [0, 255, 255], 180],
    ['blue', [0, 0, 255], 240],
    ['magenta', [255, 0, 255], 300],
    ['rose (red with some blue)', [255, 0, 128], 330],
  ] as Array<[string, [number, number, number], number]>)('%s has hue %i°', (_name, [r, g, b], hue) => {
    expect(rgbToHsl(r, g, b)[0]).toBeCloseTo(hue, 0);
  });

  it('greys have zero saturation and hue', () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 128 / 255]);
  });

  it('keeps the hue inside [0, 360) and saturation/lightness inside [0, 1]', () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const [h, s, l] = rgbToHsl(r, g, b);
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(1);
          expect(l).toBeGreaterThanOrEqual(0);
          expect(l).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('rgbToLab — reference colors (sRGB, D65)', () => {
  it.each([
    ['red', [255, 0, 0], [53.24, 80.09, 67.2]],
    ['green', [0, 255, 0], [87.74, -86.18, 83.18]],
    ['blue', [0, 0, 255], [32.3, 79.19, -107.86]],
  ] as Array<[string, [number, number, number], [number, number, number]]>)('%s', (_name, [r, g, b], expected) => {
    const lab = rgbToLab(r, g, b);

    expected.forEach((value, i) => expect(lab[i]).toBeCloseTo(value, 0));
  });

  it('greys are neutral (a ≈ b ≈ 0)', () => {
    const [, a, b] = rgbToLab(128, 128, 128);

    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  it('lightness grows with the grey level', () => {
    const levels = [0, 64, 128, 192, 255].map((v) => rgbToLab(v, v, v)[0]);

    levels.slice(1).forEach((L, i) => expect(L).toBeGreaterThan(levels[i]));
  });
});
```

`normalize.edge.test.ts`:

```ts
import { normalize, paletteMatchesQuery } from '../normalize';

describe('normalize — edge cases', () => {
  it('strips every Spanish diacritic', () => {
    expect(normalize('ÁÉÍÓÚ áéíóú Ññ Üü')).toBe('aeiou aeiou nn uu');
  });

  it('is idempotent', () => {
    const once = normalize('Índigo Añil');

    expect(normalize(once)).toBe(once);
  });

  it('keeps spaces and punctuation untouched', () => {
    expect(normalize('  Verde-Oliva  ')).toBe('  verde-oliva  ');
  });

  it('handles the empty string', () => {
    expect(normalize('')).toBe('');
  });
});

describe('paletteMatchesQuery — edge cases', () => {
  const names = ['Índigo Profundo', 'Coral Suave'];

  it('matches partial prefixes and accented queries against unaccented names', () => {
    expect(paletteMatchesQuery(names, 'ind')).toBe(true);
    expect(paletteMatchesQuery(['Indigo'], 'ÍNDIGO')).toBe(true);
  });

  it('trims the query but compares names as they are', () => {
    expect(paletteMatchesQuery(names, '  coral  ')).toBe(true);
  });

  it('matches a multi-word query only inside a single color name', () => {
    expect(paletteMatchesQuery(names, 'indigo prof')).toBe(true);
    expect(paletteMatchesQuery(names, 'indigo coral')).toBe(false);
  });

  it('treats an empty palette with an empty query as a match', () => {
    expect(paletteMatchesQuery([], '')).toBe(true);
  });
});
```

- [ ] **Step 1: Escribir `extract.edge.test.ts`**

```ts
import { Skia } from '@shopify/react-native-skia';

import { extractColors, ExtractError } from '../extract';

const makeImage = (pixels: Uint8Array) => ({
  width: () => 10,
  height: () => 10,
  readPixels: jest.fn().mockReturnValue(pixels),
});

function solid(r: number, g: number, b: number, count: number, alpha = 255): Uint8Array {
  const buf = new Uint8Array(count * 4);
  for (let i = 0; i < count * 4; i += 4) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = alpha;
  }
  return buf;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  parts.forEach((p) => {
    out.set(p, offset);
    offset += p.length;
  });
  return out;
}

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;
const decode = Skia.Image.MakeImageFromEncoded as jest.Mock;

function useImage(pixels: Uint8Array) {
  decode.mockReturnValue(makeImage(pixels));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
});

describe('extractColors — images with real structure', () => {
  it('separates a two-tone image into its two colors with equal weight', async () => {
    useImage(concat(solid(255, 0, 0, 400), solid(0, 0, 255, 400)));

    const colors = await extractColors('file:///t.jpg', 2);

    expect(colors.map((c) => c.hex)).toEqual(['#FF0000', '#0000FF']); // claro → oscuro
    colors.forEach((c) => expect(c.weight).toBeCloseTo(0.5, 5));
  });

  it('ignores transparent pixels', async () => {
    useImage(concat(solid(10, 200, 30, 400), solid(255, 0, 0, 400, 0)));

    const colors = await extractColors('file:///t.jpg', 2);

    colors.forEach((c) => expect(c.hex).toBe('#0AC81E'));
  });

  it('reads the thumbnail it was given', async () => {
    useImage(solid(1, 2, 3, 400));

    await extractColors('file:///the-thumb.jpg', 3);

    expect(mockFetch).toHaveBeenCalledWith('file:///the-thumb.jpg');
  });
});

describe('extractColors — degenerate inputs', () => {
  it('rejects a fully transparent image with an ExtractError', async () => {
    useImage(solid(0, 0, 0, 400, 0));

    await expect(extractColors('file:///t.jpg')).rejects.toThrow(ExtractError);
    await expect(extractColors('file:///t.jpg')).rejects.toThrow('Too few opaque pixels: 0');
  });

  it('rejects an image with fewer sampled pixels than colors requested', async () => {
    useImage(solid(1, 2, 3, 4)); // 4 píxeles → 1 muestra (se muestrea 1 de cada 4)

    await expect(extractColors('file:///t.jpg', 5)).rejects.toThrow('Too few opaque pixels: 1');
  });

  it('still returns paletteSize entries when the image has fewer distinct colors', async () => {
    useImage(concat(solid(255, 0, 0, 400), solid(0, 255, 0, 400), solid(0, 0, 255, 400)));

    const colors = await extractColors('file:///t.jpg', 8);

    expect(colors).toHaveLength(8);
    expect(colors.reduce((sum, c) => sum + c.weight, 0)).toBeCloseTo(1, 5);
  });
});

describe('extractColors — output consistency', () => {
  it('every hex matches its own rgb', async () => {
    useImage(concat(solid(200, 30, 90, 400), solid(20, 180, 220, 400)));

    const colors = await extractColors('file:///t.jpg', 5);

    colors.forEach((c) => {
      expect(parseInt(c.hex.slice(1), 16)).toBe((c.rgb[0] << 16) | (c.rgb[1] << 8) | c.rgb[2]);
    });
  });

  it('weights are never negative and never exceed 1', async () => {
    useImage(concat(solid(200, 30, 90, 600), solid(20, 180, 220, 200)));

    const colors = await extractColors('file:///t.jpg', 4);

    colors.forEach((c) => {
      expect(c.weight).toBeGreaterThanOrEqual(0);
      expect(c.weight).toBeLessThanOrEqual(1);
    });
  });
});
```

- [ ] **Step 2: Escribir `exportPalette.parity.test.tsx`**

```tsx
import { render } from '@testing-library/react-native';
import { drawAsImage, Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { ArchetypeCanvas, CANVAS_H, CANVAS_W } from '@/components/compose/ArchetypeCanvas';
import { ARCHETYPES } from '@/data/archetypes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId, LayoutConfig } from '@/types/palette';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts, treeSignature } from '@test/skiaTree';
import { exportPalette, RESOLUTIONS } from '../exportPalette';

const draw = drawAsImage as jest.Mock;
const fromURI = Skia.Data.fromURI as jest.Mock;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;

const palette = makePalette({ colors: makeColors(5) });
const IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

const CONFIGS: Array<[string, Partial<LayoutConfig>]> = [
  ['defaults', {}],
  ['outlined with RGB labels', { cardStyle: 'outlined', showRGB: true }],
  ['blur, pill corners, serif', { cardStyle: 'blur', cornerRadius: PILL_CORNER_RADIUS, fontFamily: 'serif' }],
  ['labels off, watermark on', { showHex: false, showName: false, showRGB: false, watermarkVisible: true }],
  [
    'libre with custom swatches',
    {
      freeformSwatches: palette.colors.map((_, i) => ({
        x: 20 + i * 10, y: 30 + i * 60, width: 90 + i * 5, height: 50, colorIndex: i,
      })),
    },
  ],
];

function previewTree(config: LayoutConfig): string {
  const view = render(<ArchetypeCanvas palette={palette} config={config} />);
  const canvas = findAll(view.toJSON(), 'SkCanvas')[0];
  view.unmount();
  return treeSignature(canvas.children?.[0]);
}

async function exportedElement(config: LayoutConfig, resolution: keyof typeof RESOLUTIONS = '1x') {
  await exportPalette(palette, config, resolution);
  return draw.mock.calls.at(-1)![0];
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
});

afterEach(() => jest.restoreAllMocks());

describe.each(['free', 'premium'] as const)('preview/export parity — %s user', (status) => {
  beforeEach(() => useSettingsStore.setState({ subscriptionStatus: status }));

  describe.each(IDS)('%s archetype', (archetypeId) => {
    it.each(CONFIGS)('draws the same Skia tree in preview and export: %s', async (_name, overrides) => {
      const config = makeLayoutConfig({ archetypeId, ...overrides });

      const element = await exportedElement(config);
      const view = render(element);
      const exported = treeSignature(view.toJSON());
      view.unmount();

      expect(exported).toBe(previewTree(config));
    });
  });
});

describe('exportPalette', () => {
  it.each(Object.entries(RESOLUTIONS))('%s keeps the 360x450 canvas aspect ratio', (_key, { width, height }) => {
    expect(width / height).toBeCloseTo(CANVAS_W / CANVAS_H, 5);
  });

  it.each(Object.entries(RESOLUTIONS))('%s rasterizes the design canvas at width / 360', async (key, { width }) => {
    const element = await exportedElement(makeLayoutConfig(), key as keyof typeof RESOLUTIONS);

    expect(element.props.transform).toEqual([{ scale: width / CANVAS_W }]);
  });

  it('throws when Skia returns no image', async () => {
    draw.mockResolvedValueOnce(null);

    await expect(exportPalette(palette, makeLayoutConfig(), '1x')).rejects.toThrow('Skia drawAsImage returned null');
  });

  it('falls back to the grey placeholder when the photo cannot be loaded', async () => {
    fromURI.mockRejectedValueOnce(new Error('missing file'));

    const element = await exportedElement(makeLayoutConfig({ archetypeId: 'strip' }));
    const view = render(element);

    expect(findAll(view.toJSON(), 'SkRect').some((r) => r.props.color === '#E5E5E5')).toBe(true);
  });

  it('writes a timestamped PNG into the cache directory and returns its uri', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const uri = await exportPalette(palette, makeLayoutConfig(), '1x');

    expect(uri).toBe('file:///cache/hued-export-1700000000000.png');
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(uri, 'base64-png', { encoding: 'base64' });
  });

  it('is non-interactive: exports never contain React Native views (no edit overlay)', async () => {
    const element = await exportedElement(makeLayoutConfig({ archetypeId: 'libre' }));
    const view = render(element);

    expect(findAll(view.toJSON(), 'View')).toHaveLength(0);
  });

  it('free users always get the watermark', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'free' });

    const view = render(await exportedElement(makeLayoutConfig({ watermarkVisible: false })));

    expect(findTexts(view.toJSON()).filter((t) => t === 'hued')).toHaveLength(2); // texto + sombra
  });

  it('premium users get no watermark unless they asked for it', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });

    const off = render(await exportedElement(makeLayoutConfig({ watermarkVisible: false })));
    expect(findTexts(off.toJSON())).not.toContain('hued');
    off.unmount();

    const on = render(await exportedElement(makeLayoutConfig({ watermarkVisible: true })));
    expect(findTexts(on.toJSON())).toContain('hued');
  });
});
```

- [ ] **Step 3: Escribir `settingsStore.timezone.test.ts`**

```ts
import { useSettingsStore } from '../settingsStore';

afterEach(() => {
  jest.useRealTimers();
});

describe('daily export counter and the local calendar day (suite runs in Europe/Madrid)', () => {
  it('runs in the expected time zone', () => {
    expect(new Date('2026-10-04T22:30:00Z').getDate()).toBe(5);
  });

  it('keeps the count within the same local day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
    useSettingsStore.setState({ exportDailyCount: 2, exportDailyResetDate: '2026-10-04' });

    useSettingsStore.getState().resetExportCountIfNewDay();

    expect(useSettingsStore.getState().exportDailyCount).toBe(2);
  });

  // H-06: `todayString()` usa `toISOString()` (UTC). Un usuario en España que exportó
  // a las 23:30 locales tiene hasta las 02:00 (verano) sin recuperar sus 3 exportaciones.
  it.failing('resets at local midnight, not at UTC midnight (H-06)', () => {
    // 21:30Z = 23:30 locales del 4-oct → 22:30Z = 00:30 locales del 5-oct
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T22:30:00Z'));
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: '2026-10-04' });

    useSettingsStore.getState().resetExportCountIfNewDay();

    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
  });
});
```

- [ ] **Step 4: Escribir `palettes-legacy.test.ts`**

```ts
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import { getDb } from '../client';
import { getPalette, listPalettes } from '../palettes';

jest.mock('../client');

const mockDb = { getFirstAsync: jest.fn(), getAllAsync: jest.fn() };
(getDb as jest.Mock).mockResolvedValue(mockDb);

// Fila guardada antes de que existieran `paletteSize`, `freeformSwatches` y las fuentes nuevas.
const legacyLayout = {
  archetypeId: 'grid',
  position: 0,
  showHex: true,
  showName: false,
  showRGB: false,
  fontFamily: 'serif',
  cornerRadius: 24,
  cardStyle: 'outlined',
  watermarkVisible: false,
};

const legacyRow = {
  id: '01HXLEGACY000000000000000A',
  image_uri: 'file:///palettes/a/full.jpg',
  thumbnail_uri: 'file:///palettes/a/thumb.jpg',
  colors: '[]',
  layout_config: JSON.stringify(legacyLayout),
  collection_id: null,
  meta: JSON.stringify({ capturedAt: 1, source: 'camera', aspectRatio: 'original' }),
  created_at: 1,
  updated_at: 1,
  is_favorite: 1,
  export_count: 2,
};

beforeEach(() => jest.clearAllMocks());

describe('rows saved before newer LayoutConfig fields existed', () => {
  it('getPalette fills in paletteSize and freeformSwatches from the defaults', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    expect(palette?.layoutConfig.paletteSize).toBe(DEFAULT_LAYOUT_CONFIG.paletteSize);
    expect(palette?.layoutConfig.freeformSwatches).toEqual([]);
  });

  it('keeps every value the user had stored', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    expect(palette?.layoutConfig).toMatchObject({
      archetypeId: 'grid',
      fontFamily: 'serif',
      cornerRadius: 24,
      cardStyle: 'outlined',
      showName: false,
    });
  });

  it('listPalettes applies the same defaults to every row', async () => {
    mockDb.getAllAsync.mockResolvedValue([legacyRow, { ...legacyRow, id: 'b' }]);

    const palettes = await listPalettes();

    expect(palettes).toHaveLength(2);
    palettes.forEach((p) => {
      expect(p.layoutConfig.paletteSize).toBe(5);
      expect(p.layoutConfig.freeformSwatches).toEqual([]);
    });
  });

  it('a stored paletteSize wins over the default', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      ...legacyRow,
      layout_config: JSON.stringify({ ...legacyLayout, paletteSize: 8 }),
    });

    const palette = await getPalette(legacyRow.id);

    expect(palette?.layoutConfig.paletteSize).toBe(8);
  });

  it('maps the integer flags and counters to their domain types', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    expect(palette?.isFavorite).toBe(true);
    expect(palette?.exportCount).toBe(2);
  });
});
```

- [ ] **Step 5: Ejecutar**

```powershell
pnpm jest src/lib/color src/lib/search src/lib/export src/lib/store/__tests__/settingsStore.timezone.test.ts src/lib/db/__tests__/palettes-legacy.test.ts
```

Expected: PASS. Los 60 casos de paridad (6 arquetipos × 5 configuraciones × 2 estados) deben pasar sin `it.failing`. Si un caso de paridad falla, **es un hallazgo real**: marcarlo `it.failing` con el siguiente ID libre, anotarlo y seguir.

- [ ] **Step 6: Comprobar que el test de paridad puede fallar (mutation check)**

En `src/lib/export/exportPalette.tsx` cambiar temporalmente `const CANVAS_H = 450;` por `460` y ejecutar solo el archivo de paridad: deben fallar los tests de paridad y `keeps the 360x450 canvas aspect ratio`. Restaurar con `git checkout src/lib/export/exportPalette.tsx`.

- [ ] **Step 7: Commit**

```powershell
git add src/lib
git commit -m "test(lib): add color/search edge cases, extraction, preview/export parity, timezone and legacy-row tests (H-06)"
```


---

## Fase C — Componentes

### Task 8: Componentes de UI (`Button`, `Card`, `Text`, `Icon`, `StripeBar`, `Sheet`)

**Files:**
- Test: `src/components/ui/__tests__/Button.test.tsx`, `Card.test.tsx`, `Text.test.tsx`, `Icon.test.tsx`, `StripeBar.test.tsx`, `Sheet.test.tsx`

**Interfaces:**
- Consumes: `<Button label variant size loading fullWidth icon disabled style onPress />`, `<Card variant padding style />`, `<Text variant weight color style />`, `<Icon name size color />`, `<StripeBar />`, `<Sheet visible onClose style>`.
- Produces: hallazgo **H-01** (`Button` descarta la prop `style`).

- [ ] **Step 1: Escribir `Button.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Colors } from '@/lib/tokens';
import { Button } from '../Button';

type StyleFn = (state: { pressed: boolean }) => unknown;

function pressableStyle(pressed = false): Record<string, unknown> {
  const { style } = screen.UNSAFE_getByType(Pressable).props as { style: StyleFn };
  return StyleSheet.flatten(style({ pressed }) as never) as Record<string, unknown>;
}

function labelStyle(label: string): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByText(label).props.style) as Record<string, unknown>;
}

describe('Button', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} />);

    fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} disabled />);

    fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label while loading and blocks presses', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} loading />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText('Guardar')).toBeNull();
    fireEvent.press(screen.UNSAFE_getByType(ActivityIndicator));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders an optional icon next to the label', () => {
    const { Text } = require('react-native');
    render(<Button label="Compartir" icon={<Text>ICON</Text>} />);

    expect(screen.getByText('ICON')).toBeOnTheScreen();
    expect(screen.getByText('Compartir')).toBeOnTheScreen();
  });

  it.each([
    ['primary', Colors.accent],
    ['secondary', Colors.bgSecondary],
    ['ghost', 'transparent'],
    ['destructive', Colors.error],
  ] as const)('%s variant uses its background', (variant, background) => {
    render(<Button label="x" variant={variant} />);

    expect(pressableStyle().backgroundColor).toBe(background);
  });

  it('secondary has a hairline border', () => {
    render(<Button label="x" variant="secondary" />);

    expect(pressableStyle()).toMatchObject({ borderWidth: 1, borderColor: Colors.borderDefault });
  });

  it.each([
    ['sm', 36],
    ['md', 48],
    ['lg', 56],
  ] as const)('%s size keeps a %i px minimum touch height', (size, minHeight) => {
    render(<Button label="x" size={size} />);

    expect(pressableStyle().minHeight).toBe(minHeight);
  });

  it('fullWidth stretches to 100%', () => {
    render(<Button label="x" fullWidth />);

    expect(pressableStyle().width).toBe('100%');
  });

  it('dims while pressed and more while disabled', () => {
    render(<Button label="x" disabled />);

    expect(pressableStyle(true).opacity).toBe(0.4); // disabled gana sobre pressed
    expect(pressableStyle(false).opacity).toBe(0.4);
  });

  it('dims slightly while pressed', () => {
    render(<Button label="x" />);

    expect(pressableStyle(true).opacity).toBe(0.8);
    expect(pressableStyle(false).opacity).toBeUndefined();
  });

  it('colors the label per variant', () => {
    const { rerender } = render(<Button label="x" variant="primary" />);
    expect(labelStyle('x').color).toBe(Colors.accentForeground);

    rerender(<Button label="x" variant="ghost" />);
    expect(labelStyle('x').color).toBe(Colors.accent);

    rerender(<Button label="x" variant="secondary" />);
    expect(labelStyle('x').color).toBe(Colors.textPrimary);
  });

  // H-01: `style` se extrae de las props pero nunca se aplica al Pressable.
  it.failing('applies the style prop passed by the caller (H-01)', () => {
    render(<Button label="x" style={{ marginTop: 12 }} />);

    expect(pressableStyle().marginTop).toBe(12);
  });
});
```

- [ ] **Step 2: Escribir `Card.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing } from '@/lib/tokens';
import { Card } from '../Card';

function cardStyle(): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByTestId('card').props.style) as Record<string, unknown>;
}

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card testID="card">
        <Text>dentro</Text>
      </Card>
    );

    expect(screen.getByText('dentro')).toBeOnTheScreen();
  });

  it('is an elevated, padded, rounded card by default', () => {
    render(<Card testID="card" />);

    expect(cardStyle()).toMatchObject({
      borderRadius: Radius.xl,
      backgroundColor: Colors.bgElevated,
      overflow: 'hidden',
      padding: Spacing.md,
      shadowOpacity: 0.08,
    });
  });

  it('outlined has a border and no shadow', () => {
    render(<Card testID="card" variant="outlined" />);

    expect(cardStyle()).toMatchObject({ borderWidth: 1, borderColor: Colors.borderDefault });
    expect(cardStyle().shadowOpacity).toBeUndefined();
  });

  it('flat uses the secondary background', () => {
    render(<Card testID="card" variant="flat" />);

    expect(cardStyle().backgroundColor).toBe(Colors.bgSecondary);
  });

  it('padding={false} removes the inner padding', () => {
    render(<Card testID="card" padding={false} />);

    expect(cardStyle().padding).toBeUndefined();
  });

  it('lets the caller override styles last and forwards view props', () => {
    render(<Card testID="card" style={{ padding: 2 }} accessibilityLabel="Tarjeta" />);

    expect(cardStyle().padding).toBe(2);
    expect(screen.getByLabelText('Tarjeta')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Escribir `Text.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors, FontFamily, FontSize } from '@/lib/tokens';
import { Text } from '../Text';

function textStyle(label = 'hola'): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByText(label).props.style) as Record<string, unknown>;
}

describe('Text', () => {
  it('defaults to the body variant in the primary ink color', () => {
    render(<Text>hola</Text>);

    expect(textStyle()).toMatchObject({
      fontSize: FontSize.md,
      color: Colors.textPrimary,
      fontFamily: FontFamily.sans,
    });
  });

  it.each([
    ['display', FontSize['4xl'], FontFamily.display],
    ['h1', FontSize['2xl'], FontFamily.display],
    ['h2', FontSize.xl, FontFamily.sans],
    ['h3', FontSize.lg, FontFamily.sans],
    ['body', FontSize.md, FontFamily.sans],
    ['small', FontSize.sm, FontFamily.sans],
    ['caption', FontSize.xs, FontFamily.sans],
    ['label', FontSize.sm, FontFamily.sans],
  ] as const)('%s variant has the right size and family', (variant, size, family) => {
    render(<Text variant={variant}>hola</Text>);

    expect(textStyle()).toMatchObject({ fontSize: size, fontFamily: family });
  });

  it('caption is secondary-colored unless overridden', () => {
    render(<Text variant="caption">hola</Text>);

    expect(textStyle().color).toBe(Colors.textSecondary);
  });

  it('the weight prop overrides the variant weight', () => {
    render(<Text variant="h2" weight="bold">hola</Text>);

    expect(textStyle().fontWeight).toBe('700');
  });

  it('the color prop overrides the default color', () => {
    render(<Text color="#123456">hola</Text>);

    expect(textStyle().color).toBe('#123456');
  });

  it('the style prop wins over everything else', () => {
    render(<Text color="#123456" style={{ color: '#ABCDEF' }}>hola</Text>);

    expect(textStyle().color).toBe('#ABCDEF');
  });

  it('forwards native text props', () => {
    render(<Text numberOfLines={1}>hola</Text>);

    expect(screen.getByText('hola').props.numberOfLines).toBe(1);
  });
});
```

- [ ] **Step 4: Escribir `Icon.test.tsx` y `StripeBar.test.tsx`**

`Icon.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { Colors } from '@/lib/tokens';
import { findAll } from '@test/skiaTree';
import { Icon } from '../Icon';

function iconProps(element: ReactElement) {
  const view = render(element);
  return findAll(view.toJSON(), 'MaterialIcons')[0].props;
}

describe('Icon', () => {
  it('renders the requested glyph at 24px in the primary ink color by default', () => {
    expect(iconProps(<Icon name="home" />)).toMatchObject({ name: 'home', size: 24, color: Colors.textPrimary });
  });

  it('accepts a custom size and color', () => {
    expect(iconProps(<Icon name="delete" size={18} color="#FF0000" />)).toMatchObject({
      name: 'delete',
      size: 18,
      color: '#FF0000',
    });
  });
});
```

`StripeBar.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Primitive } from '@/lib/tokens';
import { StripeBar } from '../StripeBar';

describe('StripeBar', () => {
  it('draws the four Kodak-stripe bands in order', () => {
    const json = render(<StripeBar />).toJSON() as { props: { style: unknown }; children: Array<{ props: { style: unknown } }> };

    const colors = json.children.map((band) => StyleSheet.flatten(band.props.style as never).backgroundColor);

    expect(colors).toEqual([Primitive.brown800, Primitive.red500, Primitive.orange500, Primitive.amber400]);
  });

  it('is a 4px-high horizontal row', () => {
    const json = render(<StripeBar />).toJSON() as { props: { style: unknown } };

    expect(StyleSheet.flatten(json.props.style as never)).toMatchObject({ flexDirection: 'row', height: 4 });
  });
});
```

- [ ] **Step 5: Escribir `Sheet.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Modal, Pressable, Text } from 'react-native';

import { Sheet } from '../Sheet';

let parallel: jest.SpyInstance;

beforeEach(() => {
  parallel = jest.spyOn(Animated, 'parallel').mockReturnValue({ start: jest.fn() } as never);
});

afterEach(() => jest.restoreAllMocks());

describe('Sheet', () => {
  it('shows its children when visible', () => {
    render(<Sheet visible onClose={jest.fn()}><Text>contenido</Text></Sheet>);

    expect(screen.getByText('contenido')).toBeOnTheScreen();
  });

  it('renders nothing when hidden', () => {
    render(<Sheet visible={false} onClose={jest.fn()}><Text>contenido</Text></Sheet>);

    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('appears and disappears as `visible` changes', () => {
    const { rerender } = render(<Sheet visible={false} onClose={jest.fn()}><Text>contenido</Text></Sheet>);

    rerender(<Sheet visible onClose={jest.fn()}><Text>contenido</Text></Sheet>);
    expect(screen.getByText('contenido')).toBeOnTheScreen();

    rerender(<Sheet visible={false} onClose={jest.fn()}><Text>contenido</Text></Sheet>);
    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('closes when the backdrop is tapped', () => {
    const onClose = jest.fn();
    render(<Sheet visible onClose={onClose}><Text>contenido</Text></Sheet>);

    fireEvent.press(screen.UNSAFE_getAllByType(Pressable)[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the Android back button', () => {
    const onClose = jest.fn();
    render(<Sheet visible onClose={onClose}><Text>contenido</Text></Sheet>);

    screen.UNSAFE_getByType(Modal).props.onRequestClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('animates in when shown and out when hidden', () => {
    const { rerender } = render(<Sheet visible onClose={jest.fn()}><Text>x</Text></Sheet>);
    expect(parallel).toHaveBeenCalledTimes(1);

    rerender(<Sheet visible={false} onClose={jest.fn()}><Text>x</Text></Sheet>);
    expect(parallel).toHaveBeenCalledTimes(2);
  });

  it('forwards view props and extra styles to the sheet container', () => {
    render(
      <Sheet visible onClose={jest.fn()} testID="sheet" style={{ paddingBottom: 99 }}>
        <Text>x</Text>
      </Sheet>
    );

    expect(screen.getByTestId('sheet')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 6: Ejecutar**

```powershell
pnpm jest src/components/ui
```

Expected: PASS; `it.failing` de H-01 cuenta como pasado. Dos puntos donde la API de RN/RNTL puede diferir: (1) si `fireEvent.press` sobre un `Pressable` deshabilitado sí dispara `onPress`, sustituir esas aserciones por `expect(screen.UNSAFE_getByType(Pressable).props.disabled).toBe(true)`; (2) si `jest.spyOn(Animated, 'parallel')` no es posible en `Sheet.test.tsx`, borrar solo el test `animates in when shown…`. Anotar cualquier ajuste en el commit.

- [ ] **Step 7: Commit**

```powershell
git add src/components/ui/__tests__
git commit -m "test(ui): cover Button, Card, Text, Icon, StripeBar and Sheet (H-01)"
```

---

### Task 9: Controles de edición (`OptionCarousel`, `CornerControl`, `PaletteSizeControl`)

**Files:**
- Test: `src/components/palette/__tests__/OptionCarousel.test.tsx`, `CornerControl.test.tsx`, `PaletteSizeControl.test.tsx`

**Interfaces:**
- Consumes: `<OptionCarousel options activeKey onSelect onLockedPress disabled />`; `<CornerControl presets value onChange onLockedPress />`; `<PaletteSizeControl value onChange disabled />`; `capturePanResponders`, `gesture`, `touch`.
- Produces: hallazgo **H-09** (los `PanResponder` de `CornerControl` y `PaletteSizeControl` se crean una vez con `useRef` y conservan el `onChange`/`disabled` del primer render).

- [ ] **Step 1: Escribir `OptionCarousel.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors } from '@/lib/tokens';
import { OptionCarousel } from '../OptionCarousel';

const OPTIONS = [
  { key: 'a', label: 'Alfa' },
  { key: 'b', label: 'Beta', premium: true },
  { key: 'c', label: 'Gamma' },
];

beforeEach(() => useSettingsStore.setState({ subscriptionStatus: 'free' }));

describe('OptionCarousel', () => {
  it('renders every option label', () => {
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={jest.fn()} />);

    expect(screen.getByText('Alfa')).toBeOnTheScreen();
    expect(screen.getByText('Gamma')).toBeOnTheScreen();
  });

  it('selects a free option', () => {
    const onSelect = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Gamma'));

    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('highlights only the active option', () => {
    render(<OptionCarousel options={OPTIONS} activeKey="c" onSelect={jest.fn()} />);

    const backgrounds = screen
      .UNSAFE_getAllByType(TouchableOpacity)
      .map((pill) => StyleSheet.flatten(pill.props.style).backgroundColor);

    expect(backgrounds).toEqual([Colors.bgElevated, Colors.bgElevated, Colors.accent]);
  });

  it('locks premium options for free users and routes the tap to onLockedPress', () => {
    const onSelect = jest.fn();
    const onLockedPress = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} onLockedPress={onLockedPress} />);

    fireEvent.press(screen.getByText('Beta 🔒'));

    expect(onLockedPress).toHaveBeenCalledWith('b');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not throw when a locked option is tapped without an onLockedPress handler', () => {
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={jest.fn()} />);

    expect(() => fireEvent.press(screen.getByText('Beta 🔒'))).not.toThrow();
  });

  it('unlocks premium options for premium users', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    const onSelect = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Beta'));

    expect(onSelect).toHaveBeenCalledWith('b');
    expect(screen.queryByText(/🔒/)).toBeNull();
  });

  it('blocks every selection while disabled', () => {
    const onSelect = jest.fn();
    const onLockedPress = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} onLockedPress={onLockedPress} disabled />);

    fireEvent.press(screen.getByText('Gamma'));
    fireEvent.press(screen.getByText('Beta 🔒'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onLockedPress).not.toHaveBeenCalled();
  });

  it('supports numeric keys', () => {
    const onSelect = jest.fn();
    render(
      <OptionCarousel options={[{ key: 0, label: 'Recta' }, { key: 16, label: 'Redonda' }]} activeKey={0} onSelect={onSelect} />
    );

    fireEvent.press(screen.getByText('Redonda'));

    expect(onSelect).toHaveBeenCalledWith(16);
  });
});
```

- [ ] **Step 2: Escribir `CornerControl.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { CornerControl } from '../CornerControl';

const PRESETS = [
  { key: 0, label: 'Recta' },
  { key: 16, label: 'Redonda' },
  { key: 9999, label: 'Píldora' },
];

let pan: ReturnType<typeof capturePanResponders>;

beforeEach(() => {
  jest.useFakeTimers();
  pan = capturePanResponders();
});

afterEach(() => {
  pan.restore();
  jest.useRealTimers();
});

const frame = () => act(() => { jest.advanceTimersByTime(20); });

function layoutTrack(width: number) {
  const track = screen.UNSAFE_root.findAll((n) => n.type === 'View' && typeof n.props.onLayout === 'function')[0];
  fireEvent(track, 'layout', { nativeEvent: { layout: { width } } });
}

const input = () => screen.UNSAFE_getByType(TextInput);

describe('CornerControl — presets and numeric field', () => {
  it('shows the presets and the current radius in px', () => {
    render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    expect(screen.getByText('Recta')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('16')).toBeOnTheScreen();
  });

  it('selecting a preset reports its radius', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent.press(screen.getByText('Píldora'));

    expect(onChange).toHaveBeenCalledWith(9999);
  });

  it('commits a typed value on blur', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), '42');
    fireEvent(input(), 'blur');

    expect(onChange).toHaveBeenLastCalledWith(42);
    expect(screen.getByDisplayValue('42')).toBeOnTheScreen();
  });

  it('reverts to the current value when the text is not a number', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), 'abc');
    fireEvent(input(), 'blur');

    expect(onChange).toHaveBeenLastCalledWith(16);
    expect(screen.getByDisplayValue('16')).toBeOnTheScreen();
  });

  it('never commits a negative radius', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), '-5');
    fireEvent(input(), 'blur');

    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('limits the field to 4 digits and uses a numeric keypad', () => {
    render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    expect(input().props.maxLength).toBe(4);
    expect(input().props.keyboardType).toBe('number-pad');
  });

  it('follows the value prop while the field is not being edited', () => {
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    rerender(<CornerControl presets={PRESETS} value={30} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('30')).toBeOnTheScreen();
  });

  it('does not overwrite what the user is typing when the prop changes', () => {
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), '7');
    rerender(<CornerControl presets={PRESETS} value={99} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('7')).toBeOnTheScreen();
  });
});

describe('CornerControl — slider', () => {
  it('maps the first touch to a radius proportional to the track width', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    frame();

    expect(onChange).toHaveBeenCalledWith(90);
  });

  it('drives the rest of the drag from the horizontal delta', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => {
      pan.configs[0].onPanResponderGrant?.(touch(90), gesture());
      pan.configs[0].onPanResponderMove?.({} as never, gesture(45));
    });
    frame();

    expect(onChange).toHaveBeenLastCalledWith(135);
  });

  it('clamps the radius between 0 and 180', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);
    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    frame();

    act(() => { pan.configs[0].onPanResponderMove?.({} as never, gesture(1000)); });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(180);

    act(() => { pan.configs[0].onPanResponderMove?.({} as never, gesture(-1000)); });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('coalesces many touch ticks into one onChange per animation frame', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => {
      pan.configs[0].onPanResponderGrant?.(touch(0), gesture());
      pan.configs[0].onPanResponderMove?.({} as never, gesture(18));
      pan.configs[0].onPanResponderMove?.({} as never, gesture(36));
    });
    frame();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(36);
  });

  it('ignores touches before the track has been measured', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(50), gesture()); });
    frame();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops a pending frame when unmounted', () => {
    const onChange = jest.fn();
    const { unmount } = render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    unmount();
    frame();

    expect(onChange).not.toHaveBeenCalled();
  });

  // H-09: `useRef(PanResponder.create({...}))` conserva los handlers del primer render;
  // un `onChange` nuevo (props que cambian) nunca se usa durante el arrastre.
  it.failing('reports slider changes to the latest onChange prop (H-09)', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={first} />);
    layoutTrack(180);
    rerender(<CornerControl presets={PRESETS} value={16} onChange={latest} />);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    frame();

    expect(latest).toHaveBeenCalledWith(90);
    expect(first).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Escribir `PaletteSizeControl.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { PaletteSizeControl } from '../PaletteSizeControl';

let pan: ReturnType<typeof capturePanResponders>;

beforeEach(() => {
  pan = capturePanResponders();
});

afterEach(() => pan.restore());

function layoutTrack(width: number) {
  const track = screen.UNSAFE_root.findAll((n) => n.type === 'View' && typeof n.props.onLayout === 'function')[0];
  fireEvent(track, 'layout', { nativeEvent: { layout: { width } } });
}

const grant = (x: number) => act(() => { pan.configs[0].onPanResponderGrant?.(touch(x), gesture()); });
const move = (dx: number) => act(() => { pan.configs[0].onPanResponderMove?.({} as never, gesture(dx)); });
const release = () => act(() => { pan.configs[0].onPanResponderRelease?.({} as never, gesture()); });

describe('PaletteSizeControl — presets and label', () => {
  it('shows the presets and the current count', () => {
    render(<PaletteSizeControl value={5} onChange={jest.fn()} />);

    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('8')).toBeOnTheScreen();
    expect(screen.getByText('5 colores')).toBeOnTheScreen();
  });

  it('clamps an out-of-range value into 3–8', () => {
    const { rerender } = render(<PaletteSizeControl value={12} onChange={jest.fn()} />);
    expect(screen.getByText('8 colores')).toBeOnTheScreen();

    rerender(<PaletteSizeControl value={1} onChange={jest.fn()} />);
    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  it('selecting a preset reports it immediately', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={5} onChange={onChange} />);

    fireEvent.press(screen.getByText('8'));

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('blocks presets while a re-extraction is running', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={5} onChange={onChange} disabled />);

    fireEvent.press(screen.getByText('8'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('follows the value prop when idle', () => {
    const { rerender } = render(<PaletteSizeControl value={5} onChange={jest.fn()} />);

    rerender(<PaletteSizeControl value={3} onChange={jest.fn()} />);

    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });
});

describe('PaletteSizeControl — slider', () => {
  it('previews the dragged size live but only commits on release', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    grant(100); // 3 + round(100/200 * 5) = 6

    expect(screen.getByText('6 colores')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();

    release();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('continues the drag from the horizontal delta', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    grant(100);
    move(40); // +1 colour
    release();

    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('clamps the dragged size between 3 and 8', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={5} onChange={onChange} />);
    layoutTrack(200);

    grant(100);
    move(1000);
    expect(screen.getByText('8 colores')).toBeOnTheScreen();
    move(-1000);
    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  it('commits when the gesture is terminated by the system', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    grant(100);
    act(() => { pan.configs[0].onPanResponderTerminate?.({} as never, gesture()); });

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('ignores touches before the track is measured', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);

    grant(100);
    release();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  it('a release without a preceding grant commits nothing', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    release();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not let the parent value jump the thumb mid-drag', () => {
    const { rerender } = render(<PaletteSizeControl value={3} onChange={jest.fn()} />);
    layoutTrack(200);
    grant(100);

    rerender(<PaletteSizeControl value={4} onChange={jest.fn()} />);

    expect(screen.getByText('6 colores')).toBeOnTheScreen();
  });

  it('snaps back to the real value when the re-extraction fails', () => {
    const { rerender } = render(<PaletteSizeControl value={3} onChange={jest.fn()} />);
    layoutTrack(200);
    grant(140); // 3 + round(3.5) = 7
    release();
    expect(screen.getByText('7 colores')).toBeOnTheScreen();

    rerender(<PaletteSizeControl value={3} onChange={jest.fn()} disabled />); // extrayendo
    rerender(<PaletteSizeControl value={3} onChange={jest.fn()} disabled={false} />); // falló: value no cambió

    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  // H-09: el responder se crea con `useRef` en el primer render y conserva su `onChange`.
  // El padre (`handlePaletteSizeChange`) depende de `palette`: tras la primera extracción
  // el `onChange` vigente es otro, pero el arrastre sigue llamando al antiguo.
  it.failing('reports the release to the latest onChange prop (H-09)', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(<PaletteSizeControl value={3} onChange={first} />);
    layoutTrack(200);
    rerender(<PaletteSizeControl value={3} onChange={latest} />);

    grant(100);
    release();

    expect(latest).toHaveBeenCalledWith(6);
    expect(first).not.toHaveBeenCalled();
  });

  it.failing('ignores a drag that starts while a re-extraction is running (H-09)', () => {
    const onChange = jest.fn();
    const { rerender } = render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);
    rerender(<PaletteSizeControl value={3} onChange={onChange} disabled />);

    grant(100);
    release();

    expect(screen.getByText('3 colores')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Ejecutar**

```powershell
pnpm jest src/components/palette/__tests__/OptionCarousel.test.tsx src/components/palette/__tests__/CornerControl.test.tsx src/components/palette/__tests__/PaletteSizeControl.test.tsx
```

Expected: PASS (3 `it.failing` de H-09). Si `fireEvent(track, 'layout', …)` no encuentra el handler, comprobar que `findAll` devuelve el `View` que tiene `onLayout` (hay que excluir al `Text`).

- [ ] **Step 5: Commit**

```powershell
git add src/components/palette/__tests__/OptionCarousel.test.tsx src/components/palette/__tests__/CornerControl.test.tsx src/components/palette/__tests__/PaletteSizeControl.test.tsx
git commit -m "test(palette): cover option carousel, corner control and palette-size slider (H-09)"
```

---

### Task 10: Registro de arquetipos y los 6 arquetipos

**Files:**
- Test: `src/data/__tests__/archetypes.test.ts`, `src/components/compose/archetypes/__tests__/archetypes.render.test.tsx`

**Interfaces:**
- Consumes: `ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition>`; cada `Component({ palette, config, width, height, image })`; `generateScatterLayout(count, w, h)`; `findAll`, `findTexts`.
- Produces: hallazgo **H-04** (Franja, Banner y Lateral hardcodean 5 ranuras) y la cobertura de *Review Focus* 1 y 2.

- [ ] **Step 1: Escribir `archetypes.test.ts`**

```ts
import type { ArchetypeId } from '@/types/palette';
import { ARCHETYPES } from '../archetypes';

const IDS: ArchetypeId[] = ['strip', 'editorial', 'grid', 'banner', 'side', 'libre'];
const FONTS = ['sans', 'serif', 'mono', 'condensed', 'display'];

describe('ARCHETYPES registry', () => {
  it('registers exactly the six archetypes', () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s has a complete definition', (id) => {
    const def = ARCHETYPES[id];

    expect(def.id).toBe(id);
    expect(def.displayName.length).toBeGreaterThan(0);
    expect(def.description.length).toBeGreaterThan(20);
    expect(typeof def.Component).toBe('function');
    expect(FONTS).toContain(def.defaultConfig.fontFamily);
  });

  it('display names are unique (they label the carousel pills)', () => {
    const names = IDS.map((id) => ARCHETYPES[id].displayName);

    expect(new Set(names).size).toBe(names.length);
  });

  it('only editorial and banner show a visible blur effect', () => {
    expect(IDS.filter((id) => ARCHETYPES[id].supportsBlur).sort()).toEqual(['banner', 'editorial']);
  });

  it('only libre has an interactive edit overlay', () => {
    expect(IDS.filter((id) => ARCHETYPES[id].EditOverlay)).toEqual(['libre']);
  });

  it('the paywall hook is unset everywhere today', () => {
    IDS.forEach((id) => expect(ARCHETYPES[id].premium).toBeUndefined());
  });
});
```

- [ ] **Step 2: Escribir `archetypes.render.test.tsx`**

```tsx
import { render } from '@testing-library/react-native';
import { matchFont } from '@shopify/react-native-skia';

import { ARCHETYPES } from '@/data/archetypes';
import { Primitive } from '@/lib/tokens';
import type { ArchetypeId, FreeformSwatch, LayoutConfig } from '@/types/palette';
import { makeColor, makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts } from '@test/skiaTree';
import { generateScatterLayout } from '../freeformLayout';

const W = 360;
const H = 450;
const IDS: ArchetypeId[] = ['strip', 'editorial', 'grid', 'banner', 'side', 'libre'];
const GREY = '#E5E5E5';

interface Rect { x: number; y: number; width: number; height: number }

function draw(
  id: ArchetypeId,
  opts: { colors?: number; palette?: ReturnType<typeof makePalette>; config?: Partial<LayoutConfig>; image?: boolean } = {}
) {
  const palette = opts.palette ?? makePalette({ colors: makeColors(opts.colors ?? 5) });
  const config = makeLayoutConfig({ archetypeId: id, ...opts.config });
  const { Component } = ARCHETYPES[id];
  const view = render(
    <Component palette={palette} config={config} width={W} height={H} image={opts.image ? ({} as never) : null} />
  );
  return { json: view.toJSON(), palette, config };
}

/** Bloques de color de las muestras (Banner los pinta con sufijo alfa "CC"). */
function swatches(json: unknown, hexes: string[]) {
  const nodes = [...findAll(json, 'SkRect'), ...findAll(json, 'SkRoundedRect'), ...findAll(json, 'SkCircle')];
  return nodes.filter((n) => hexes.some((h) => n.props.color === h || n.props.color === `${h}CC`));
}

const rectOf = (node: { props: Record<string, unknown> }) => node.props as unknown as Rect;

describe.each(IDS)('%s archetype — shared behaviour', (id) => {
  it.each([3, 5, 8])('draws one color block per color with %i colors', (n) => {
    const { json, palette } = draw(id, { colors: n });

    const hexes = palette.colors.map((c) => c.hex);
    const drawn = swatches(json, hexes).map((node) => String(node.props.color).slice(0, 7));

    expect(drawn.sort()).toEqual([...hexes].sort());
  });

  it('draws the grey placeholder, and no photo, when the image is not loaded', () => {
    const { json } = draw(id);

    expect(findAll(json, 'SkRect').filter((r) => r.props.color === GREY)).toHaveLength(1);
    expect(findAll(json, 'SkImage')).toHaveLength(0);
  });

  it('draws the photo instead of the placeholder once it is loaded', () => {
    const { json } = draw(id, { image: true });

    expect(findAll(json, 'SkImage')).toHaveLength(1);
    expect(findAll(json, 'SkRect').filter((r) => r.props.color === GREY)).toHaveLength(0);
  });

  it('renders an empty palette (while colors are still extracting) without throwing', () => {
    const { json } = draw(id, { colors: 0 });

    expect(swatches(json, [])).toHaveLength(0);
    expect(json).toBeTruthy();
  });

  it('draws no labels when every label toggle is off', () => {
    const { json } = draw(id, { config: { showHex: false, showName: false, showRGB: false } });

    expect(findTexts(json)).toEqual([]);
  });

  it('shows every hex code when showHex is on', () => {
    const { json, palette } = draw(id, { config: { showHex: true, showName: false, showRGB: false } });

    expect(findTexts(json).sort()).toEqual(palette.colors.map((c) => c.hex).sort());
  });

  it('requests a font matching the chosen family', () => {
    draw(id, { config: { fontFamily: 'mono' } });

    expect(matchFont).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: expect.stringMatching(/^(Courier|monospace)$/) })
    );
  });

  it('wraps no label in a blur unless cardStyle is blur', () => {
    const { json } = draw(id, { config: { cardStyle: 'filled' } });

    expect(findAll(json, 'SkBackdropBlur')).toHaveLength(0);
  });
});

describe.each(['strip', 'grid', 'banner', 'side', 'libre'] as ArchetypeId[])('%s archetype — labels', (id) => {
  it('shows every color name when showName is on', () => {
    const { json, palette } = draw(id, { config: { showHex: false, showName: true, showRGB: false } });

    expect(findTexts(json).sort()).toEqual(palette.colors.map((c) => c.name).sort());
  });

  it('shows "RGB r, g, b" per color when showRGB is on', () => {
    const { json, palette } = draw(id, { config: { showHex: false, showName: false, showRGB: true } });

    expect(findTexts(json).sort()).toEqual(palette.colors.map((c) => `RGB ${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]}`).sort());
  });

  it('wraps each swatch label in its own backdrop blur when cardStyle is blur', () => {
    const { json, palette } = draw(id, { config: { cardStyle: 'blur' } });

    expect(findAll(json, 'SkBackdropBlur')).toHaveLength(palette.colors.length);
  });

  it('uses dark text on light swatches and light text on dark ones', () => {
    const palette = makePalette({
      colors: [
        makeColor({ hex: '#FFFFFF', hslLightness: 0.9, name: 'Claro' }),
        makeColor({ hex: '#000000', hslLightness: 0.1, name: 'Oscuro' }),
      ],
    });

    const { json } = draw(id, { palette, config: { showHex: true, showName: false, showRGB: false } });
    const textColor = (hex: string) => findAll(json, 'SkText').find((t) => t.props.text === hex)?.props.color;

    expect(textColor('#FFFFFF')).toBe(Primitive.black);
    expect(textColor('#000000')).toBe(Primitive.white);
  });
});

describe('strip archetype', () => {
  it('puts the photo on the top 70% and five 72px bars below it', () => {
    const { json, palette } = draw('strip');

    const photo = findAll(json, 'SkRect').find((r) => r.props.color === GREY)!;
    const bars = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    expect(rectOf(photo)).toMatchObject({ x: 0, y: 0, width: 360, height: 315 });
    bars.forEach((bar, i) => expect(bar).toMatchObject({ x: i * 72, y: 315, width: 72, height: 135 }));
  });
});

describe('grid archetype', () => {
  it.each([3, 4, 5, 6, 7, 8])('keeps %i cells inside the bottom half and fills it exactly', (n) => {
    const { json, palette } = draw('grid', { colors: n });

    const cells = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    cells.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(W + 0.001);
      expect(c.y).toBeGreaterThanOrEqual(H / 2 - 0.001);
      expect(c.y + c.height).toBeLessThanOrEqual(H + 0.001);
    });
    expect(cells.reduce((area, c) => area + c.width * c.height, 0)).toBeCloseTo(W * (H / 2), 3);
  });

  it('makes the last cell full-width when the count is odd', () => {
    const { json, palette } = draw('grid', { colors: 5 });

    const last = rectOf(swatches(json, palette.colors.map((c) => c.hex)).at(-1)!);

    expect(last.width).toBe(360);
  });
});

describe('banner archetype', () => {
  it('overlays a translucent 48px strip at the bottom with five bars', () => {
    const { json, palette } = draw('banner');

    const overlay = findAll(json, 'SkRect').find((r) => r.props.color === 'rgba(0,0,0,0.35)')!;
    const bars = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    expect(rectOf(overlay)).toMatchObject({ x: 0, y: 402, width: 360, height: 48 });
    bars.forEach((bar, i) => expect(bar).toMatchObject({ x: i * 72, y: 402, width: 72, height: 48 }));
  });

  it('paints each bar with 80% opacity so the photo shows through', () => {
    const { json, palette } = draw('banner');

    palette.colors.forEach((c) => {
      expect(findAll(json, 'SkRect').some((r) => r.props.color === `${c.hex}CC`)).toBe(true);
    });
  });
});

describe('side archetype', () => {
  it('puts the photo on the left 60% and five 90px rows on the right', () => {
    const { json, palette } = draw('side');

    const photo = findAll(json, 'SkRect').find((r) => r.props.color === GREY)!;
    const rows = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    expect(rectOf(photo)).toMatchObject({ x: 0, y: 0, width: 216, height: 450 });
    rows.forEach((row, i) => expect(row).toMatchObject({ x: 216, y: i * 90, width: 144, height: 90 }));
  });
});

describe('H-04 — fixed five-slot layouts with other palette sizes', () => {
  // Franja y Banner reparten `width / 5`; Lateral reparte `height / 5`.
  const STRIPS: Array<[ArchetypeId, 'width' | 'height']> = [
    ['strip', 'width'],
    ['banner', 'width'],
    ['side', 'height'],
  ];

  function fillsStrip(id: ArchetypeId, axis: 'width' | 'height', n: number) {
    const { json, palette } = draw(id, { colors: n });
    const rects = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    rects.forEach((r) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W + 0.001);
      expect(r.y + r.height).toBeLessThanOrEqual(H + 0.001);
    });
    const covered = rects.reduce((sum, r) => sum + r[axis], 0);
    expect(covered).toBeCloseTo(axis === 'width' ? W : H, 3);
  }

  it.each(STRIPS)('%s fills its strip with the default 5 colors', (id, axis) => {
    fillsStrip(id, axis, 5);
  });

  for (const [id, axis] of STRIPS) {
    for (const size of [3, 8]) {
      it.failing(`${id} keeps ${size} swatches inside the canvas and filling the strip (H-04)`, () => {
        fillsStrip(id, axis, size);
      });
    }
  }
});

describe('editorial archetype', () => {
  it('centers one 14px dot per color on a horizontal line at 82% of the height', () => {
    const { json, palette } = draw('editorial');

    const dots = findAll(json, 'SkCircle').filter((c) => palette.colors.some((col) => col.hex === c.props.color));

    expect(dots).toHaveLength(5);
    dots.forEach((dot) => expect(dot.props).toMatchObject({ r: 14, cy: 369 }));
    const xs = dots.map((d) => d.props.cx as number);
    expect((xs[0] + xs[4]) / 2).toBeCloseTo(180, 5);
  });

  it('always writes labels in white over the dark gradient', () => {
    const { json } = draw('editorial');

    findAll(json, 'SkText').forEach((t) => expect(t.props.color).toBe('#FFFFFF'));
  });

  it('captions the dominant (first) color name only', () => {
    const { json, palette } = draw('editorial', { config: { showHex: false, showName: true } });

    expect(findTexts(json)).toEqual([palette.colors[0].name]);
  });

  it('omits the caption when showName is off', () => {
    const { json, palette } = draw('editorial', { config: { showHex: true, showName: false } });

    expect(findTexts(json)).toEqual(palette.colors.map((c) => c.hex));
  });

  it('never draws RGB labels (not part of this layout)', () => {
    const { json } = draw('editorial', { config: { showRGB: true } });

    expect(findTexts(json).some((t) => t.startsWith('RGB'))).toBe(false);
  });

  it('wraps each hex label and the caption in a blur when cardStyle is blur', () => {
    const { json } = draw('editorial', { config: { cardStyle: 'blur', showHex: true, showName: true } });

    expect(findAll(json, 'SkBackdropBlur')).toHaveLength(5 + 1);
  });

  it('draws the dark gradient over the lower part of the photo', () => {
    const { json } = draw('editorial');

    expect(findAll(json, 'SkLinearGradient')).toHaveLength(1);
  });
});

describe('libre archetype', () => {
  const custom = (n: number): FreeformSwatch[] =>
    Array.from({ length: n }, (_, i) => ({ x: 10 + i * 20, y: 20 + i * 70, width: 120, height: 60, colorIndex: i }));

  it('places each swatch where the user left it, with the configured corner radius', () => {
    const swatchesCfg = custom(5);
    const { json, palette } = draw('libre', { config: { freeformSwatches: swatchesCfg, cornerRadius: 12 } });

    const drawn = findAll(json, 'SkRoundedRect');

    expect(drawn).toHaveLength(5);
    drawn.forEach((node, i) => {
      const { x, y, width, height } = swatchesCfg[i];
      expect(node.props).toMatchObject({ x, y, width, height, r: 12, color: palette.colors[i].hex });
    });
  });

  it('falls back to a scatter layout when the stored swatches do not match the colors', () => {
    const { json } = draw('libre', { config: { freeformSwatches: custom(3) } }); // 3 guardadas, 5 colores

    const expected = generateScatterLayout(5, W, H);
    const drawn = findAll(json, 'SkRoundedRect');

    expect(drawn).toHaveLength(5);
    drawn.forEach((node, i) => {
      expect(node.props).toMatchObject({
        x: expected[i].x, y: expected[i].y, width: expected[i].width, height: expected[i].height,
      });
    });
  });

  it('draws swatches in array order so the last one is on top', () => {
    const reordered = custom(5).reverse();
    const { json } = draw('libre', { config: { freeformSwatches: reordered } });

    expect(findAll(json, 'SkRoundedRect').map((n) => n.props.x)).toEqual(reordered.map((s) => s.x));
  });

  it('skips a swatch whose color no longer exists', () => {
    const withGhost = [...custom(5).slice(0, 4), { x: 0, y: 0, width: 50, height: 50, colorIndex: 9 }];
    const { json } = draw('libre', { colors: 5, config: { freeformSwatches: withGhost } });

    expect(findAll(json, 'SkRoundedRect')).toHaveLength(4);
  });

  it('hides the label on swatches shorter than 32px but still draws them', () => {
    const tiny = custom(5).map((s, i) => (i === 0 ? { ...s, height: 20 } : s));
    const { json, palette } = draw('libre', {
      config: { freeformSwatches: tiny, showHex: true, showName: false, showRGB: false },
    });

    expect(findAll(json, 'SkRoundedRect')).toHaveLength(5);
    expect(findTexts(json)).not.toContain(palette.colors[0].hex);
    expect(findTexts(json)).toHaveLength(4);
  });

  it('offsets labels 6px inside the swatch', () => {
    const { json } = draw('libre', {
      config: { freeformSwatches: custom(5), showHex: true, showName: false, showRGB: false },
    });

    const firstLabel = findAll(json, 'SkText')[0];

    expect(firstLabel.props.x).toBe(10 + 6);
  });
});
```

- [ ] **Step 3: Ejecutar**

```powershell
pnpm jest src/data src/components/compose/archetypes/__tests__/archetypes.render.test.tsx
```

Expected: PASS. Los 6 `it.failing` de H-04 (3 arquetipos × tamaños 3 y 8) cuentan como pasados. Si algún `it` normal de este archivo falla, **no es necesariamente un fallo del test**: leer el árbol (`console.log(JSON.stringify(json, null, 1))`), decidir si es un bug real (→ `it.failing` + hallazgo con ID `H-10`, `H-11`…) o una suposición errónea del test (→ corregir el test).

- [ ] **Step 4: Comprobar que H-04 es real (mutation check)**

En `StripArchetype.tsx` cambiar temporalmente `const barW = width / 5;` por `const barW = width / palette.colors.length;` y ejecutar el archivo: los 2 `it.failing` de `strip` deben fallar con "expected to fail but passed". Restaurar con `git checkout src/components/compose/archetypes/StripArchetype.tsx`.

- [ ] **Step 5: Commit**

```powershell
git add src/data/__tests__ src/components/compose/archetypes/__tests__/archetypes.render.test.tsx
git commit -m "test(compose): cover archetype registry and rendering of all six archetypes (H-04)"
```

---

### Task 11: `Watermark` y `ArchetypeCanvas`

**Files:**
- Test: `src/components/compose/archetypes/__tests__/Watermark.test.tsx`, `src/components/compose/__tests__/ArchetypeCanvas.test.tsx`

**Interfaces:**
- Consumes: `<Watermark width height cornerRadius />`, `getWatermarkTapRegion(width, height)`; `<ArchetypeCanvas palette config onWatermarkPress maxHeight onLibreSwatchesChange />`, `CANVAS_W`, `CANVAS_H`; `useImage` del mock de Skia.

- [ ] **Step 1: Escribir `Watermark.test.tsx`**

```tsx
import { render } from '@testing-library/react-native';

import { findAll } from '@test/skiaTree';
import { getWatermarkTapRegion, Watermark } from '../Watermark';

function marks(width = 360, height = 450, cornerRadius = 16) {
  const view = render(<Watermark width={width} height={height} cornerRadius={cornerRadius} />);
  return findAll(view.toJSON(), 'SkText');
}

describe('Watermark', () => {
  it('draws a white "hued" wordmark with a soft shadow behind it', () => {
    const [shadow, mark] = marks();

    expect(shadow.props.text).toBe('hued');
    expect(mark.props.text).toBe('hued');
    expect(mark.props.color).toBe('rgba(255,255,255,0.6)');
    expect(shadow.props.color).toBe('rgba(0,0,0,0.35)');
    expect(shadow.props.x).toBeCloseTo((mark.props.x as number) + 0.75, 5);
    expect(shadow.props.y).toBeCloseTo((mark.props.y as number) + 0.75, 5);
  });

  it('sits inset from the right edge, slightly below the vertical center', () => {
    const [, mark] = marks(360, 450);

    expect(mark.props.x).toBeCloseTo(313.6, 5); // 360 - 20 margen - 26.4 ancho aprox.
    expect(mark.props.y).toBe(235); // 450/2 + 10
  });

  it('scales with the canvas it is given', () => {
    const [, mark] = marks(720, 900);

    expect(mark.props.x).toBeCloseTo(673.6, 5);
    expect(mark.props.y).toBe(460);
  });

  it('keeps the same placement for every corner radius (always inside the clip)', () => {
    const [, sharp] = marks(360, 450, 0);
    const [, pill] = marks(360, 450, 9999);

    expect(pill.props.x).toBe(sharp.props.x);
    expect(pill.props.y).toBe(sharp.props.y);
  });
});

describe('getWatermarkTapRegion', () => {
  it('is a 64x44 target centered on the mark', () => {
    const region = getWatermarkTapRegion(360, 450);

    expect(region.width).toBe(64);
    expect(region.height).toBe(44);
    expect(region.x + region.width / 2).toBeCloseTo(326.8, 5);
    expect(region.y + region.height / 2).toBe(235);
  });

  it('stays inside the canvas', () => {
    const region = getWatermarkTapRegion(360, 450);

    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.x + region.width).toBeLessThanOrEqual(360);
    expect(region.y + region.height).toBeLessThanOrEqual(450);
  });

  it('contains the origin of the rendered text', () => {
    const [, mark] = marks(360, 450);
    const region = getWatermarkTapRegion(360, 450);

    expect(mark.props.x as number).toBeGreaterThanOrEqual(region.x);
    expect(mark.props.x as number).toBeLessThanOrEqual(region.x + region.width);
    expect(mark.props.y as number).toBeGreaterThanOrEqual(region.y);
    expect(mark.props.y as number).toBeLessThanOrEqual(region.y + region.height);
  });
});
```

- [ ] **Step 2: Escribir `ArchetypeCanvas.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useImage } from '@shopify/react-native-skia';
import { Dimensions, Pressable, StyleSheet } from 'react-native';

import { LibreEditOverlay } from '@/components/compose/LibreEditOverlay';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId, LayoutConfig } from '@/types/palette';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts } from '@test/skiaTree';
import { getWatermarkTapRegion } from '../archetypes/Watermark';
import { generateScatterLayout } from '../archetypes/freeformLayout';
import { ArchetypeCanvas, CANVAS_H, CANVAS_W } from '../ArchetypeCanvas';

const palette = makePalette({ colors: makeColors(5) });

function setWindow(width: number) {
  act(() => {
    Dimensions.set({
      window: { width, height: 800, scale: 1, fontScale: 1 },
      screen: { width, height: 800, scale: 1, fontScale: 1 },
    });
  });
}

function mount(config: Partial<LayoutConfig> = {}, props: Record<string, unknown> = {}) {
  const full = makeLayoutConfig(config);
  const view = render(<ArchetypeCanvas palette={palette} config={full} {...props} />);
  return { view, json: view.toJSON(), config: full };
}

const styleOf = (node: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  useSettingsStore.setState({ subscriptionStatus: 'free' });
  setWindow(360);
});

describe('ArchetypeCanvas — sizing', () => {
  it('exposes the 360x450 design canvas', () => {
    expect([CANVAS_W, CANVAS_H]).toEqual([360, 450]);
  });

  it('scales to the screen width', () => {
    setWindow(720);
    const { json } = mount();

    const [outer] = findAll(json, 'View');
    expect(styleOf(outer)).toMatchObject({ width: 720, height: 900 });
    expect(findAll(json, 'SkGroup')[0].props.transform).toEqual([{ scale: 2 }]);
  });

  it('never exceeds maxHeight: the smaller scale wins', () => {
    setWindow(720);
    const { json } = mount({}, { maxHeight: 450 });

    const [outer] = findAll(json, 'View');
    expect(styleOf(outer)).toMatchObject({ width: 360, height: 450 });
    expect(findAll(json, 'SkGroup')[0].props.transform).toEqual([{ scale: 1 }]);
  });

  it('keeps the width scale when maxHeight is generous', () => {
    setWindow(360);
    const { json } = mount({}, { maxHeight: 2000 });

    expect(findAll(json, 'SkGroup')[0].props.transform).toEqual([{ scale: 1 }]);
  });
});

describe('ArchetypeCanvas — content', () => {
  it('loads the photo from the palette image uri', () => {
    mount();

    expect(useImage).toHaveBeenCalledWith(palette.imageUri);
  });

  it('draws the loaded photo through the archetype', () => {
    (useImage as jest.Mock).mockReturnValueOnce({});
    const { json } = mount({ archetypeId: 'strip' });

    expect(findAll(json, 'SkImage')).toHaveLength(1);
  });

  it.each([
    ['strip', 315],
    ['side', 450],
  ] as Array<[ArchetypeId, number]>)('dispatches to the %s archetype by id', (archetypeId, photoHeight) => {
    const { json } = mount({ archetypeId });

    const photo = findAll(json, 'SkRect').find((r) => r.props.color === '#E5E5E5')!;
    expect(photo.props.height).toBe(photoHeight);
  });

  it('clips the card with the configured corner radius', () => {
    const { json } = mount({ cornerRadius: 24 });

    const clipped = findAll(json, 'SkGroup').find((g) => g.props.clip)!;
    expect(clipped.props.clip).toEqual({ rect: { x: 0, y: 0, width: 360, height: 450 }, rx: 24, ry: 24 });
  });

  it('draws an inset 2px white outline for the outlined card style', () => {
    const { json } = mount({ archetypeId: 'strip', cardStyle: 'outlined', cornerRadius: 12 });

    const outline = findAll(json, 'SkRoundedRect')[0];
    expect(outline.props).toMatchObject({
      x: 1, y: 1, width: 358, height: 448, r: 12, strokeWidth: 2, style: 'stroke', color: '#FFFFFF',
    });
  });

  it('draws no outline for the filled card style', () => {
    const { json } = mount({ archetypeId: 'strip', cardStyle: 'filled' });

    expect(findAll(json, 'SkRoundedRect')).toHaveLength(0);
  });
});

describe('ArchetypeCanvas — watermark', () => {
  it.each([
    ['free', false, true],
    ['free', true, true],
    ['premium', false, false],
    ['premium', true, true],
  ] as const)('%s user with watermarkVisible=%s: shown=%s', (status, preference, shown) => {
    useSettingsStore.setState({ subscriptionStatus: status });
    const { json } = mount({ watermarkVisible: preference });

    expect(findTexts(json).includes('hued')).toBe(shown);
  });

  it('makes the watermark tappable for free users and reports the tap', () => {
    const onWatermarkPress = jest.fn();
    mount({}, { onWatermarkPress });

    const target = screen.UNSAFE_getByType(Pressable);
    fireEvent.press(target);

    expect(onWatermarkPress).toHaveBeenCalledTimes(1);
  });

  it('positions the tap target over the mark, in screen scale', () => {
    setWindow(720);
    mount({}, { onWatermarkPress: jest.fn() });

    const region = getWatermarkTapRegion(360, 450);
    const style = StyleSheet.flatten(screen.UNSAFE_getByType(Pressable).props.style);

    expect(style).toMatchObject({
      left: region.x * 2, top: region.y * 2, width: region.width * 2, height: region.height * 2,
    });
  });

  it('has no tap target for premium users, even with the watermark on', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    mount({ watermarkVisible: true }, { onWatermarkPress: jest.fn() });

    expect(screen.UNSAFE_queryByType(Pressable)).toBeNull();
  });

  it('has no tap target when no handler is given (read-only render)', () => {
    mount();

    expect(screen.UNSAFE_queryByType(Pressable)).toBeNull();
  });
});

describe('ArchetypeCanvas — libre edit overlay', () => {
  const scatter = generateScatterLayout(5, 360, 450);

  it('shows the drag handles on the edit screen (handler present, swatches generated)', () => {
    mount({ archetypeId: 'libre', freeformSwatches: scatter }, { onLibreSwatchesChange: jest.fn() });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).not.toBeNull();
  });

  it('hides the handlers in read-only renders (no handler)', () => {
    mount({ archetypeId: 'libre', freeformSwatches: scatter });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).toBeNull();
  });

  it('hides the handlers until the swatches match the colors (just after a palette-size change)', () => {
    mount({ archetypeId: 'libre', freeformSwatches: [] }, { onLibreSwatchesChange: jest.fn() });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).toBeNull();
  });

  it('never shows handles for the other archetypes', () => {
    mount({ archetypeId: 'grid', freeformSwatches: scatter }, { onLibreSwatchesChange: jest.fn() });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).toBeNull();
  });
});
```

- [ ] **Step 3: Ejecutar**

```powershell
pnpm jest src/components/compose
```

Expected: PASS. Si `Dimensions.set` no existiera en esta versión de RN, sustituirlo por `jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }) }))` con `let mockWidth = 360`, y documentarlo.

- [ ] **Step 4: Commit**

```powershell
git add src/components/compose/archetypes/__tests__/Watermark.test.tsx src/components/compose/__tests__/ArchetypeCanvas.test.tsx
git commit -m "test(compose): cover watermark placement and the preview canvas"
```


---

### Task 12: `LibreEditOverlay` (arrastrar, redimensionar, guías de alineación)

**Files:**
- Test: `src/components/compose/__tests__/LibreEditOverlay.test.tsx`

**Interfaces:**
- Consumes: `<LibreEditOverlay palette config scale canvasW canvasH onFreeformSwatchesChange />`; `capturePanResponders`, `gesture`, `touch`. Orden de responders capturados: por cada *handle* `i`, `configs[2i]` = mover y `configs[2i+1]` = redimensionar (el `useMemo` crea primero el de mover).
- Produces: cobertura del contrato de ADR-0001/0002 a nivel de interacción (la geometría pura ya la cubre `freeformLayout.test.ts`).

- [ ] **Step 1: Escribir `LibreEditOverlay.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/lib/tokens';
import type { FreeformSwatch } from '@/types/palette';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { LibreEditOverlay } from '../LibreEditOverlay';

const SCALE = 2;
const sw = (colorIndex: number, x: number, y: number, width: number, height: number): FreeformSwatch => ({
  x, y, width, height, colorIndex,
});

const SOLO = [sw(0, 10, 10, 100, 100)];
const PAIR = [sw(0, 10, 10, 100, 100), sw(1, 150, 10, 80, 80)];
const THREE = [sw(0, 10, 10, 100, 100), sw(1, 150, 10, 100, 100), sw(2, 10, 200, 60, 80)];

let pan: ReturnType<typeof capturePanResponders>;

beforeEach(() => {
  jest.useFakeTimers();
  pan = capturePanResponders();
});

afterEach(() => {
  pan.restore();
  jest.useRealTimers();
});

const frame = () => act(() => { jest.advanceTimersByTime(20); });

function mount(swatches: FreeformSwatch[], colorCount = 3) {
  const palette = makePalette({ colors: makeColors(colorCount) });
  const config = makeLayoutConfig({ archetypeId: 'libre', freeformSwatches: swatches });
  const onChange = jest.fn();
  const view = render(
    <LibreEditOverlay
      palette={palette}
      config={config}
      scale={SCALE}
      canvasW={360}
      canvasH={450}
      onFreeformSwatchesChange={onChange}
    />
  );
  return { view, onChange };
}

const mover = (i: number) => pan.configs[i * 2];
const resizer = (i: number) => pan.configs[i * 2 + 1];

const grant = (cfg: (typeof pan.configs)[number]) => act(() => { cfg.onPanResponderGrant?.(touch(0), gesture()); });
const move = (cfg: (typeof pan.configs)[number], dx: number, dy: number) =>
  act(() => { cfg.onPanResponderMove?.({} as never, gesture(dx, dy)); });

function lastUpdate(onChange: jest.Mock, prev: FreeformSwatch[]): FreeformSwatch[] {
  const updater = onChange.mock.calls.at(-1)![0] as (p: FreeformSwatch[]) => FreeformSwatch[];
  return updater(prev);
}

const flat = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

function handles() {
  return screen.UNSAFE_root.findAll(
    (n) =>
      n.type === 'View' &&
      n.props.pointerEvents !== 'none' &&
      flat(n).position === 'absolute' &&
      flat(n).left !== undefined &&
      flat(n).width !== undefined
  );
}

function guides() {
  return screen.UNSAFE_root.findAll((n) => n.type === 'View' && n.props.pointerEvents === 'none');
}

describe('LibreEditOverlay — layout', () => {
  it('renders one handle per swatch at its on-screen position and size', () => {
    mount(THREE);

    const boxes = handles().map((h) => {
      const { left, top, width, height } = flat(h);
      return { left, top, width, height };
    });

    expect(boxes).toEqual([
      { left: 20, top: 20, width: 200, height: 200 },
      { left: 300, top: 20, width: 200, height: 200 },
      { left: 20, top: 400, width: 120, height: 160 },
    ]);
  });

  it('skips swatches whose color no longer exists', () => {
    mount(THREE, 2);

    expect(handles()).toHaveLength(2);
  });

  it('renders no handles for an empty layout', () => {
    mount([]);

    expect(handles()).toHaveLength(0);
  });
});

describe('LibreEditOverlay — moving', () => {
  it('brings the touched swatch to the front on grant', () => {
    const { onChange } = mount(THREE);

    grant(mover(0));

    expect(lastUpdate(onChange, THREE).map((s) => s.colorIndex)).toEqual([1, 2, 0]);
  });

  it('moves by the gesture delta converted back to design units', () => {
    const { onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 40, 20);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 30, y: 20, width: 100, height: 100, colorIndex: 0 });
  });

  it('keeps the swatch inside the canvas', () => {
    const { onChange } = mount(SOLO);
    grant(mover(0));

    move(mover(0), 10000, 10000);
    frame();
    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 260, y: 350 });

    move(mover(0), -10000, -10000);
    frame();
    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('only the touched handle changes its swatch', () => {
    const { onChange } = mount(THREE);

    grant(mover(1));
    move(mover(1), 40, 0);
    frame();
    const result = lastUpdate(onChange, THREE);

    expect(result[1].x).toBe(170);
    expect(result[0]).toBe(THREE[0]);
    expect(result[2]).toBe(THREE[2]);
  });

  it('coalesces many touch ticks into one commit per animation frame', () => {
    const { onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 10, 10);
    move(mover(0), 20, 20);
    frame();

    expect(onChange).toHaveBeenCalledTimes(2); // bring-to-front + un solo commit de posición
    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 20, y: 20 });
  });

  it('drops the pending frame when unmounted', () => {
    const { view, onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 10, 10);
    view.unmount();
    frame();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('LibreEditOverlay — alignment guides (ADR-0002)', () => {
  it('snaps the swatch center to the canvas center and draws both guides', () => {
    const { onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 236, 326); // x bruta 128 → centro 178; y bruta 173 → centro 223
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 130, y: 175 });
    const lines = guides().map(flat);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ left: 360, height: 900, width: 1 }); // x = 180 * escala
    expect(lines[1]).toMatchObject({ top: 450, width: 720, height: 1 }); // y = 225 * escala
  });

  it.each(['onPanResponderRelease', 'onPanResponderTerminate'] as const)('%s clears the guides', (handler) => {
    mount(SOLO);
    grant(mover(0));
    move(mover(0), 236, 326);
    frame();
    expect(guides()).toHaveLength(2);

    act(() => { mover(0)[handler]?.({} as never, gesture()); });

    expect(guides()).toHaveLength(0);
  });
});

describe('LibreEditOverlay — resizing', () => {
  it('does not reorder swatches when a resize starts', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('grows from the fixed top-left corner by the converted delta', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));
    move(resizer(0), 40, 20);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 10, y: 10, width: 120, height: 110 });
  });

  it('never shrinks below 24px', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));
    move(resizer(0), -1000, -1000);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ width: 24, height: 24 });
  });

  it('never grows past the canvas edge, without moving the anchored corner', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));
    move(resizer(0), 10000, 10000);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 10, y: 10, width: 350, height: 440 });
  });

  it('snaps to the size of a similar swatch and highlights both', () => {
    const { onChange } = mount(PAIR, 2);

    grant(resizer(0));
    move(resizer(0), -36, -34); // 82x83 bruto → encaja con 80x80 del otro
    frame();

    expect(lastUpdate(onChange, PAIR)[0]).toMatchObject({ width: 80, height: 80 });
    const highlighted = handles().filter((h) => flat(h).borderWidth === 2);
    expect(highlighted).toHaveLength(2);
    highlighted.forEach((h) => expect(flat(h).borderColor).toBe(Colors.accent));

    act(() => { resizer(0).onPanResponderRelease?.({} as never, gesture()); });
    expect(handles().filter((h) => flat(h).borderWidth === 2)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar**

```powershell
pnpm jest src/components/compose/__tests__/LibreEditOverlay.test.tsx
```

Expected: PASS. Si `handles()` devuelve un número distinto de swatches, imprimir `screen.UNSAFE_root.findAll((n) => n.type === 'View').map((n) => flat(n))` y ajustar solo el predicado.

- [ ] **Step 3: Commit**

```powershell
git add src/components/compose/__tests__/LibreEditOverlay.test.tsx
git commit -m "test(compose): cover Libre edit overlay drag, resize, clamping and alignment guides"
```

---

### Task 13: `EditTabs` y `CropTab`

**Files:**
- Test: `src/components/palette/__tests__/EditTabs.test.tsx`, `src/components/palette/__tests__/CropTab.test.tsx`

**Interfaces:**
- Consumes: `<EditTabs paletteId imageUri config updateConfig onImageUpdated onPaletteSizeChange onResetLibreLayout paletteSizeChanging onLockedPress />`; `<CropTab paletteId imageUri paletteSize onImageUpdated />`; `extractColors`, `ExtractError`, `updatePaletteImage`, `updatePaletteColors`, `optimize`, `thumbnail`.

- [ ] **Step 1: Escribir `EditTabs.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Switch } from 'react-native';

import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { ARCHETYPES } from '@/data/archetypes';
import { trackEvent } from '@/lib/analytics/events';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId } from '@/types/palette';
import { makeLayoutConfig } from '@test/factories';
import { EditTabs } from '../EditTabs';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('../CropTab', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    CropTab: (p: { paletteId: string; paletteSize: number }) =>
      createElement(Text, null, `CropTab:${p.paletteId}:${p.paletteSize}`),
  };
});

type Props = ComponentProps<typeof EditTabs>;

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    paletteId: 'p1',
    imageUri: 'file:///full.jpg',
    config: makeLayoutConfig(),
    updateConfig: jest.fn(),
    onImageUpdated: jest.fn(),
    onPaletteSizeChange: jest.fn(),
    onResetLibreLayout: jest.fn(),
    onLockedPress: jest.fn(),
    ...overrides,
  };
  render(<EditTabs {...props} />);
  return props;
}

const openTab = (label: string) => fireEvent.press(screen.getByText(label));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
});

describe('EditTabs — navigation', () => {
  it('shows the seven tabs and starts on Arquetipo', () => {
    setup();

    ['Recorte', 'Arquetipo', 'Colores', 'Tipografía', 'Esquinas', 'Estilo', 'Etiquetas'].forEach((tab) => {
      expect(screen.getByText(tab)).toBeOnTheScreen();
    });
    expect(screen.getByText('Franja')).toBeOnTheScreen();
  });

  it('shows only the active tab content', () => {
    setup();

    openTab('Tipografía');

    expect(screen.queryByText('Franja')).toBeNull();
    expect(screen.getByText('Clásica')).toBeOnTheScreen();
  });
});

describe('EditTabs — Arquetipo', () => {
  it('lists the six archetypes', () => {
    setup();

    ['Franja', 'Editorial', 'Cuadrícula', 'Banner', 'Lateral', 'Libre'].forEach((name) => {
      expect(screen.getByText(name)).toBeOnTheScreen();
    });
  });

  it('selecting one updates the config and records the event', () => {
    const props = setup();

    fireEvent.press(screen.getByText('Cuadrícula'));

    expect(props.updateConfig).toHaveBeenCalledWith({ archetypeId: 'grid' });
    expect(trackEvent).toHaveBeenCalledWith('archetype_selected', { archetype_id: 'grid' });
  });

  it('offers "Restablecer layout" only for Libre', () => {
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'libre' }) });

    fireEvent.press(screen.getByText('Restablecer layout'));

    expect(props.onResetLibreLayout).toHaveBeenCalledTimes(1);
  });

  it('hides "Restablecer layout" for the fixed archetypes', () => {
    setup({ config: makeLayoutConfig({ archetypeId: 'strip' }) });

    expect(screen.queryByText('Restablecer layout')).toBeNull();
  });
});

describe('EditTabs — locked (premium) archetypes', () => {
  afterEach(() => {
    delete ARCHETYPES.strip.premium;
  });

  it('sends free users to the paywall instead of selecting', () => {
    ARCHETYPES.strip.premium = true;
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'grid' }) });

    fireEvent.press(screen.getByText('Franja 🔒'));

    expect(props.onLockedPress).toHaveBeenCalledTimes(1);
    expect(props.updateConfig).not.toHaveBeenCalled();
  });

  it('lets premium users select it', () => {
    ARCHETYPES.strip.premium = true;
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'grid' }) });

    fireEvent.press(screen.getByText('Franja'));

    expect(props.updateConfig).toHaveBeenCalledWith({ archetypeId: 'strip' });
  });
});

describe('EditTabs — Recorte', () => {
  it('renders the crop tab with the palette id and size', () => {
    setup({ config: makeLayoutConfig({ paletteSize: 7 }) });

    openTab('Recorte');

    expect(screen.getByText('CropTab:p1:7')).toBeOnTheScreen();
  });
});

describe('EditTabs — Colores', () => {
  it('shows the palette size', () => {
    setup({ config: makeLayoutConfig({ paletteSize: 8 }) });

    openTab('Colores');

    expect(screen.getByText('8 colores')).toBeOnTheScreen();
  });

  it('falls back to 5 for rows saved before paletteSize existed', () => {
    setup({ config: { ...makeLayoutConfig(), paletteSize: undefined as unknown as number } });

    openTab('Colores');

    expect(screen.getByText('5 colores')).toBeOnTheScreen();
  });

  it('forwards a preset to onPaletteSizeChange', () => {
    const props = setup();
    openTab('Colores');

    fireEvent.press(screen.getByText('8'));

    expect(props.onPaletteSizeChange).toHaveBeenCalledWith(8);
  });

  it('blocks presets while a re-extraction runs', () => {
    const props = setup({ paletteSizeChanging: true });
    openTab('Colores');

    fireEvent.press(screen.getByText('8'));

    expect(props.onPaletteSizeChange).not.toHaveBeenCalled();
  });
});

describe('EditTabs — Tipografía, Esquinas, Estilo', () => {
  it('lists the five fonts and applies the chosen one', () => {
    const props = setup();
    openTab('Tipografía');

    ['Moderna', 'Clásica', 'Técnica', 'Condensada', 'Display'].forEach((f) => {
      expect(screen.getByText(f)).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByText('Clásica'));

    expect(props.updateConfig).toHaveBeenCalledWith({ fontFamily: 'serif' });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'fontFamily' });
  });

  it('applies the Píldora corner preset using the shared pill sentinel', () => {
    const props = setup();
    openTab('Esquinas');

    fireEvent.press(screen.getByText('Píldora'));

    expect(props.updateConfig).toHaveBeenCalledWith({ cornerRadius: PILL_CORNER_RADIUS });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cornerRadius' });
  });

  it('applies a card style', () => {
    const props = setup();
    openTab('Estilo');

    fireEvent.press(screen.getByText('Contorno'));

    expect(props.updateConfig).toHaveBeenCalledWith({ cardStyle: 'outlined' });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cardStyle' });
  });

  it.each([
    ['strip', false],
    ['editorial', true],
    ['grid', false],
    ['banner', true],
    ['side', false],
    ['libre', false],
  ] as Array<[ArchetypeId, boolean]>)('%s: "Difuminado" available = %s', (archetypeId, available) => {
    setup({ config: makeLayoutConfig({ archetypeId }) });
    openTab('Estilo');

    expect(screen.queryByText('Difuminado') !== null).toBe(available);
  });
});

describe('EditTabs — Etiquetas', () => {
  it('reflects the label toggles of the config', () => {
    setup({ config: makeLayoutConfig({ showHex: true, showName: false, showRGB: true }) });
    openTab('Etiquetas');

    expect(screen.UNSAFE_getAllByType(Switch).map((s) => s.props.value)).toEqual([true, false, true]);
  });

  it.each([
    [0, 'showHex'],
    [1, 'showName'],
    [2, 'showRGB'],
  ] as const)('switch %i toggles %s and records the event', (index, key) => {
    const props = setup({ config: makeLayoutConfig({ showHex: true, showName: true, showRGB: true }) });
    openTab('Etiquetas');

    fireEvent(screen.UNSAFE_getAllByType(Switch)[index], 'valueChange', false);

    expect(props.updateConfig).toHaveBeenCalledWith({ [key]: false });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: key });
  });
});
```

- [ ] **Step 2: Escribir `CropTab.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import ImageCropPicker from 'react-native-image-crop-picker';

import { trackEvent } from '@/lib/analytics/events';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { updatePaletteColors, updatePaletteImage } from '@/lib/db/palettes';
import { optimize, thumbnail } from '@/lib/utils/image';
import { makeColors } from '@test/factories';
import { CropTab } from '../CropTab';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/utils/image', () => ({ optimize: jest.fn(), thumbnail: jest.fn() }));
jest.mock('@/lib/db/palettes', () => ({ updatePaletteImage: jest.fn(), updatePaletteColors: jest.fn() }));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn(),
}));

const openCropper = ImageCropPicker.openCropper as jest.Mock;
const COLORS = makeColors(5);

function setup(overrides: Record<string, unknown> = {}) {
  const onImageUpdated = jest.fn();
  render(
    <CropTab paletteId="p1" imageUri="file:///full.jpg" paletteSize={5} onImageUpdated={onImageUpdated} {...overrides} />
  );
  return { onImageUpdated };
}

const press = (ratio: string) => fireEvent.press(screen.getByText(ratio));
const idle = () => waitFor(() => expect(screen.queryByText('...')).toBeNull());

beforeEach(() => {
  jest.clearAllMocks();
  openCropper.mockResolvedValue({ path: 'file:///crop.jpg' });
  (optimize as jest.Mock).mockResolvedValue('file:///opt.jpg');
  (thumbnail as jest.Mock).mockResolvedValue('file:///thumb.jpg');
  (updatePaletteImage as jest.Mock).mockResolvedValue({
    imageUri: 'file:///documents/new-full.jpg',
    thumbnailUri: 'file:///documents/new-thumb.jpg',
  });
  (updatePaletteColors as jest.Mock).mockResolvedValue(undefined);
  (extractColors as jest.Mock).mockResolvedValue(COLORS);
});

describe('CropTab', () => {
  it('offers the four aspect ratios', () => {
    setup();

    ['1:1', '4:5', '9:16', 'original'].forEach((r) => expect(screen.getByText(r)).toBeOnTheScreen());
  });

  it('opens the native cropper with the fixed output size and Spanish copy', async () => {
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(openCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'file:///full.jpg',
        width: 1080,
        height: 1080,
        mediaType: 'photo',
        includeExif: false,
        compressImageQuality: 1,
        cropperToolbarTitle: 'Recortar',
        cropperChooseText: 'Confirmar',
        cropperCancelText: 'Cancelar',
      })
    );
  });

  it('"original" crops freely, without a fixed size', async () => {
    const { onImageUpdated } = setup();

    press('original');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    const options = openCropper.mock.calls[0][0];
    expect(options.freeStyleCropEnabled).toBe(true);
    expect(options.width).toBeUndefined();
  });

  it('optimizes, stores the new image, re-extracts and reports the result', async () => {
    const { onImageUpdated } = setup();

    press('4:5');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(optimize).toHaveBeenCalledWith('file:///crop.jpg');
    expect(thumbnail).toHaveBeenCalledWith('file:///crop.jpg');
    expect(updatePaletteImage).toHaveBeenCalledWith('p1', 'file:///opt.jpg', 'file:///thumb.jpg');
    expect(extractColors).toHaveBeenCalledWith('file:///documents/new-thumb.jpg', 5);
    expect(updatePaletteColors).toHaveBeenCalledWith('p1', COLORS);
    expect(onImageUpdated).toHaveBeenCalledWith({
      imageUri: 'file:///documents/new-full.jpg',
      thumbnailUri: 'file:///documents/new-thumb.jpg',
      colors: COLORS,
    });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'crop_ratio' });
  });

  it('re-extracts with the palette size it was given', async () => {
    const { onImageUpdated } = setup({ paletteSize: 8 });

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(extractColors).toHaveBeenCalledWith(expect.any(String), 8);
  });

  it('shows "..." on the active ratio and ignores other presses while cropping', async () => {
    let finish!: (v: { path: string }) => void;
    openCropper.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { onImageUpdated } = setup();

    press('1:1');
    expect(screen.getByText('...')).toBeOnTheScreen();
    press('4:5');
    expect(openCropper).toHaveBeenCalledTimes(1);

    finish({ path: 'file:///crop.jpg' });
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());
    await idle();
  });
});

describe('CropTab — failures', () => {
  it.each(['User cancelled image selection', 'User did not grant library permission'])(
    'treats "%s" as a silent cancel',
    async (message) => {
      openCropper.mockRejectedValueOnce(new Error(message));
      const { onImageUpdated } = setup();

      press('1:1');
      await idle();

      expect(screen.queryByText(/No se pudo recortar/)).toBeNull();
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(onImageUpdated).not.toHaveBeenCalled();
    }
  );

  it('reports an unexpected cropper error to the user and to Sentry', async () => {
    openCropper.mockRejectedValueOnce(new Error('boom'));
    const { onImageUpdated } = setup();

    press('1:1');

    expect(await screen.findByText('No se pudo recortar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(onImageUpdated).not.toHaveBeenCalled();
  });

  it('clears the error banner on the next attempt', async () => {
    openCropper.mockRejectedValueOnce(new Error('boom'));
    const { onImageUpdated } = setup();
    press('1:1');
    await screen.findByText(/No se pudo recortar/);

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(screen.queryByText(/No se pudo recortar/)).toBeNull();
  });

  it('stops before extraction when the new image cannot be stored', async () => {
    (updatePaletteImage as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const { onImageUpdated } = setup();

    press('1:1');

    expect(await screen.findByText(/No se pudo recortar/)).toBeOnTheScreen();
    expect(extractColors).not.toHaveBeenCalled();
    expect(onImageUpdated).not.toHaveBeenCalled();
  });

  it('keeps the new photo with an empty palette when extraction fails', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new ExtractError('Skia could not decode image'));
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(updatePaletteColors).toHaveBeenCalledWith('p1', []);
    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'Skia could not decode image' });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(onImageUpdated).toHaveBeenCalledWith(expect.objectContaining({ colors: [] }));
  });

  it('reports "unknown" when extraction fails with a non-ExtractError', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new Error('weird'));
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'unknown' });
  });

  it('still reports the new photo when persisting the colors also fails', async () => {
    (updatePaletteColors as jest.Mock).mockRejectedValue(new Error('db locked'));
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(onImageUpdated).toHaveBeenCalledWith(expect.objectContaining({ colors: [] }));
  });
});
```

- [ ] **Step 3: Ejecutar**

```powershell
pnpm jest src/components/palette/__tests__/EditTabs.test.tsx src/components/palette/__tests__/CropTab.test.tsx
```

Expected: PASS. `CropTab` carga `react-native-image-crop-picker` con `require` si `process.env.EXPO_OS !== 'web'`; la rama `web` es una constante de módulo y **no se prueba** (límite documentado en `HALLAZGOS.md`).

- [ ] **Step 4: Commit**

```powershell
git add src/components/palette/__tests__/EditTabs.test.tsx src/components/palette/__tests__/CropTab.test.tsx
git commit -m "test(palette): cover edit tabs navigation/locks and the crop tab flow"
```

---

### Task 14: `PaletteCard`, `PaletteGrid` y `CameraView`

**Files:**
- Test: `src/components/palette/__tests__/PaletteCard.test.tsx`, `src/components/palette/__tests__/PaletteGrid.render.test.tsx`, `src/components/capture/__tests__/CameraView.test.tsx`

**Interfaces:**
- Consumes: `<PaletteCard palette onPress onToggleFavorite onDuplicated onDeleted onCollectionChanged />`; `<PaletteGrid onPressPalette filter query onPalettesChange />`; `<CameraView onCapture onCancel />`; `takePictureAsync`, `useCameraPermissions` de `@test/mocks/expoCamera`.

- [ ] **Step 1: Escribir `PaletteCard.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import * as Sharing from 'expo-sharing';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { trackEvent } from '@/lib/analytics/events';
import { listCollections } from '@/lib/db/collections';
import { deletePalette, duplicatePalette, setPaletteCollection, toggleFavorite } from '@/lib/db/palettes';
import { exportPalette } from '@/lib/export/exportPalette';
import { Colors } from '@/lib/tokens';
import { makeColors, makePalette } from '@test/factories';
import { PaletteCard } from '../PaletteCard';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/db/collections', () => ({ listCollections: jest.fn() }));
jest.mock('@/lib/export/exportPalette', () => ({ exportPalette: jest.fn() }));
jest.mock('@/lib/db/palettes', () => ({
  deletePalette: jest.fn(),
  duplicatePalette: jest.fn(),
  setPaletteCollection: jest.fn(),
  toggleFavorite: jest.fn(),
}));

const sharing = Sharing as jest.Mocked<typeof Sharing>;
const palette = makePalette({ id: 'p1', createdAt: Date.UTC(2026, 9, 4, 12) });

function setup(overrides = {}) {
  const props = {
    palette,
    onPress: jest.fn(),
    onToggleFavorite: jest.fn(),
    onDuplicated: jest.fn(),
    onDeleted: jest.fn(),
    onCollectionChanged: jest.fn(),
    ...overrides,
  };
  render(<PaletteCard {...props} />);
  return props;
}

const card = () => screen.UNSAFE_getAllByType(TouchableOpacity)[0];
const longPress = () => fireEvent(card(), 'longPress');
const heart = (name: string) =>
  screen.UNSAFE_root.findAll((n) => n.type === 'MaterialIcons' && n.props.name === name)[0];

beforeEach(() => {
  jest.clearAllMocks();
  (toggleFavorite as jest.Mock).mockResolvedValue(undefined);
  (duplicatePalette as jest.Mock).mockResolvedValue(makePalette({ id: 'dup' }));
  (deletePalette as jest.Mock).mockResolvedValue(undefined);
  (setPaletteCollection as jest.Mock).mockResolvedValue(undefined);
  (exportPalette as jest.Mock).mockResolvedValue('file:///cache/share.png');
  (listCollections as jest.Mock).mockResolvedValue([{ id: 'c1', name: 'Café', createdAt: 1, position: 0 }]);
  sharing.isAvailableAsync.mockResolvedValue(true);
});

describe('PaletteCard — card', () => {
  it('shows the creation date in Spanish', () => {
    setup();

    expect(screen.getByText('4 oct 2026')).toBeOnTheScreen();
  });

  it('shows at most five color chips', () => {
    const big = makePalette({ colors: makeColors(8) });
    setup({ palette: big });

    const hexes = big.colors.map((c) => c.hex);
    const chips = screen.UNSAFE_root.findAll(
      (n) => n.type === 'View' && hexes.includes(StyleSheet.flatten(n.props.style)?.backgroundColor as string)
    );

    expect(chips).toHaveLength(5);
  });

  it('renders a palette that has no colors yet (still extracting)', () => {
    setup({ palette: makePalette({ colors: [] }) });

    expect(screen.getByText('4 oct 2026')).toBeOnTheScreen();
  });

  it('opens the palette on tap', () => {
    const props = setup();

    fireEvent.press(card());

    expect(props.onPress).toHaveBeenCalledWith('p1');
  });

  it('shows a filled red heart for favorites and an outline otherwise', () => {
    setup({ palette: makePalette({ isFavorite: true }) });

    expect(heart('favorite').props.color).toBe(Colors.error);
    expect(heart('favorite-border')).toBeUndefined();
  });
});

describe('PaletteCard — favorite', () => {
  it('updates the UI first, then persists', async () => {
    const props = setup();

    fireEvent.press(heart('favorite-border'));

    expect(props.onToggleFavorite).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('p1'));
  });

  it('reverts the optimistic update and reports when persisting fails', async () => {
    (toggleFavorite as jest.Mock).mockRejectedValueOnce(new Error('db'));
    const props = setup();

    fireEvent.press(heart('favorite-border'));

    await waitFor(() => expect(props.onToggleFavorite).toHaveBeenCalledTimes(2));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('is also available from the long-press sheet with the right label', () => {
    setup();
    longPress();

    expect(screen.getByText('Marcar como favorito')).toBeOnTheScreen();
  });

  it('offers to remove a favorite', () => {
    setup({ palette: makePalette({ isFavorite: true }) });
    longPress();

    expect(screen.getByText('Quitar de favoritos')).toBeOnTheScreen();
  });
});

describe('PaletteCard — duplicate', () => {
  it('duplicates, reports the copy and closes the sheet', async () => {
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Duplicar'));

    await waitFor(() => expect(props.onDuplicated).toHaveBeenCalledWith(expect.objectContaining({ id: 'dup' })));
    expect(duplicatePalette).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen.queryByText('Duplicar')).toBeNull());
  });

  it('keeps the sheet open and reports when duplicating fails', async () => {
    (duplicatePalette as jest.Mock).mockRejectedValueOnce(new Error('no space'));
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Duplicar'));

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(props.onDuplicated).not.toHaveBeenCalled();
    expect(screen.getByText('Duplicar')).toBeOnTheScreen();
  });
});

describe('PaletteCard — share', () => {
  it('exports at 2x with the palette layout and opens the share sheet', async () => {
    setup();
    longPress();

    fireEvent.press(screen.getByText('Compartir'));

    await waitFor(() =>
      expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/share.png', { mimeType: 'image/png' })
    );
    expect(exportPalette).toHaveBeenCalledWith(palette, palette.layoutConfig, '2x');
    await waitFor(() => expect(screen.queryByText('Compartir')).toBeNull());
  });

  it('skips the share sheet when sharing is unavailable but still closes', async () => {
    sharing.isAvailableAsync.mockResolvedValueOnce(false);
    setup();
    longPress();

    fireEvent.press(screen.getByText('Compartir'));

    await waitFor(() => expect(screen.queryByText('Compartir')).toBeNull());
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('reports an export failure', async () => {
    (exportPalette as jest.Mock).mockRejectedValueOnce(new Error('skia'));
    setup();
    longPress();

    fireEvent.press(screen.getByText('Compartir'));

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('PaletteCard — move to folder', () => {
  it('lists the folders and assigns the chosen one', async () => {
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Mover a carpeta'));
    fireEvent.press(await screen.findByText('Café'));

    await waitFor(() => expect(setPaletteCollection).toHaveBeenCalledWith('p1', 'c1'));
    expect(props.onCollectionChanged).toHaveBeenCalledWith('p1', 'c1');
  });

  it('"Sin carpeta" removes the palette from its folder', async () => {
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Mover a carpeta'));
    fireEvent.press(await screen.findByText('Sin carpeta'));

    await waitFor(() => expect(setPaletteCollection).toHaveBeenCalledWith('p1', null));
    expect(props.onCollectionChanged).toHaveBeenCalledWith('p1', null);
  });

  it('keeps the main sheet open when the folders cannot be loaded', async () => {
    (listCollections as jest.Mock).mockRejectedValueOnce(new Error('db'));
    setup();
    longPress();

    fireEvent.press(screen.getByText('Mover a carpeta'));

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Duplicar')).toBeOnTheScreen();
  });
});

describe('PaletteCard — delete', () => {
  const askToDelete = () => {
    longPress();
    fireEvent.press(screen.getByText('Eliminar'));
  };

  it('asks for confirmation before deleting', () => {
    setup();

    askToDelete();

    expect(screen.getByText(/¿Eliminar esta paleta\?/)).toBeOnTheScreen();
    expect(deletePalette).not.toHaveBeenCalled();
  });

  it('deletes after confirming, records the event and reports the removal', async () => {
    const props = setup();
    askToDelete();

    fireEvent.press(screen.getByText('Eliminar'));

    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith('p1'));
    expect(deletePalette).toHaveBeenCalledWith('p1');
    expect(trackEvent).toHaveBeenCalledWith('palette_deleted', { palette_id: 'p1', source: 'grid' });
  });

  it('cancelling closes the sheet without deleting', () => {
    setup();
    askToDelete();

    fireEvent.press(screen.getByText('Cancelar'));

    expect(deletePalette).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿Eliminar esta paleta\?/)).toBeNull();
  });

  it('stays on the confirmation and can retry when deleting fails', async () => {
    (deletePalette as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    const props = setup();
    askToDelete();

    fireEvent.press(screen.getByText('Eliminar'));
    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(props.onDeleted).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Eliminar'));
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith('p1'));
  });
});
```

- [ ] **Step 2: Escribir `PaletteGrid.render.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { listPalettes } from '@/lib/db/palettes';
import { makeColor, makePalette } from '@test/factories';
import { PaletteGrid } from '../PaletteGrid';

jest.mock('@/lib/db/palettes', () => ({ listPalettes: jest.fn() }));

let mockCards: Array<Record<string, any>> = [];
jest.mock('../PaletteCard', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    PaletteCard: (props: Record<string, any>) => {
      mockCards.push(props);
      return createElement(Text, null, `card:${props.palette.id}`);
    },
  };
});

const latest = (id: string) => mockCards.filter((c) => c.palette.id === id).at(-1)!;

const A = makePalette({ id: 'a', colors: [makeColor({ name: 'Rojo' })] });
const B = makePalette({ id: 'b', colors: [makeColor({ name: 'Azul' })], isFavorite: true });

type GridProps = ComponentProps<typeof PaletteGrid>;

function setup(props: Partial<GridProps> = {}) {
  const onPalettesChange = jest.fn();
  const base: GridProps = { onPressPalette: jest.fn(), filter: 'all', query: '', onPalettesChange };
  const view = render(<PaletteGrid {...base} {...props} />);
  const rerenderWith = (next: Partial<GridProps>) => view.rerender(<PaletteGrid {...base} {...props} {...next} />);
  return { onPalettesChange, rerenderWith };
}

beforeEach(() => {
  mockCards = [];
  (listPalettes as jest.Mock).mockReset();
  (listPalettes as jest.Mock).mockResolvedValue([A, B]);
});

describe('PaletteGrid', () => {
  it('shows no cards until the palettes load, then lists them', async () => {
    setup();
    expect(screen.queryByText('card:a')).toBeNull();

    expect(await screen.findByText('card:a')).toBeOnTheScreen();
    expect(screen.getByText('card:b')).toBeOnTheScreen();
  });

  it('loads once on mount and reports the count', async () => {
    const { onPalettesChange } = setup();
    await screen.findByText('card:a');

    expect(listPalettes).toHaveBeenCalledTimes(1);
    expect(onPalettesChange).toHaveBeenCalledWith(2);
  });

  it('filters by the favorites filter', async () => {
    setup({ filter: 'favorites' });

    expect(await screen.findByText('card:b')).toBeOnTheScreen();
    expect(screen.queryByText('card:a')).toBeNull();
  });

  it('filters by the search query over color names', async () => {
    setup({ query: 'rojo' });

    expect(await screen.findByText('card:a')).toBeOnTheScreen();
    expect(screen.queryByText('card:b')).toBeNull();
  });

  it('says so when the filters hide every palette', async () => {
    setup({ query: 'zzz' });

    expect(await screen.findByText('Sin resultados para tu búsqueda')).toBeOnTheScreen();
  });

  it('shows no empty message when there are no palettes at all', async () => {
    (listPalettes as jest.Mock).mockResolvedValue([]);
    const { onPalettesChange } = setup();

    await act(async () => {});

    expect(onPalettesChange).toHaveBeenCalledWith(0);
    expect(screen.queryByText('Sin resultados para tu búsqueda')).toBeNull();
  });

  it('applies a favorite toggle coming from a card', async () => {
    const { rerenderWith } = setup();
    await screen.findByText('card:a');

    act(() => latest('a').onToggleFavorite('a'));
    rerenderWith({ filter: 'favorites' });

    expect(screen.getByText('card:a')).toBeOnTheScreen();
    expect(screen.getByText('card:b')).toBeOnTheScreen();
  });

  it('adds a duplicated palette at the top and reports the new count', async () => {
    const { onPalettesChange } = setup();
    await screen.findByText('card:a');

    act(() => latest('a').onDuplicated(makePalette({ id: 'dup' })));

    expect(await screen.findByText('card:dup')).toBeOnTheScreen();
    expect(onPalettesChange).toHaveBeenLastCalledWith(3);
  });

  it('removes a deleted palette and reports the new count', async () => {
    const { onPalettesChange } = setup();
    await screen.findByText('card:a');

    act(() => latest('a').onDeleted('a'));

    expect(screen.queryByText('card:a')).toBeNull();
    expect(onPalettesChange).toHaveBeenLastCalledWith(1);
  });

  it('moves a palette into a folder filter when its collection changes', async () => {
    const { rerenderWith } = setup();
    await screen.findByText('card:a');
    const onCollectionChanged = latest('a').onCollectionChanged;

    rerenderWith({ filter: 'c1' });
    expect(screen.queryByText('card:a')).toBeNull();

    act(() => onCollectionChanged('a', 'c1'));

    expect(screen.getByText('card:a')).toBeOnTheScreen();
  });
});
```

Nota: si TypeScript no encuentra `React.ComponentProps`, añadir `import type { ComponentProps } from 'react';` y usar `ComponentProps<typeof PaletteGrid>`.

- [ ] **Step 3: Escribir `CameraView.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { trackEvent } from '@/lib/analytics/events';
import { takePictureAsync, useCameraPermissions } from '@test/mocks/expoCamera';
import { CameraView } from '../CameraView';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));

const permissions = useCameraPermissions as jest.Mock;
const takePicture = takePictureAsync as jest.Mock;

function setup(overrides: { onCapture?: jest.Mock; onCancel?: jest.Mock } = {}) {
  const onCapture = overrides.onCapture ?? jest.fn();
  const onCancel = overrides.onCancel ?? jest.fn();
  render(<CameraView onCapture={onCapture} onCancel={onCancel} />);
  return { onCapture, onCancel };
}

const shutter = () =>
  screen.UNSAFE_getAllByType(TouchableOpacity).find((t) => StyleSheet.flatten(t.props.style)?.borderWidth === 4)!;

const cameraProps = () => screen.UNSAFE_root.findAll((n) => n.type === 'ExpoCameraView')[0].props;

beforeEach(() => {
  jest.clearAllMocks();
  permissions.mockReturnValue([{ granted: true, canAskAgain: true }, jest.fn()]);
  takePicture.mockResolvedValue({ uri: 'file:///shot.jpg' });
});

describe('CameraView — permissions', () => {
  it('renders an empty screen while the permission state is loading', () => {
    permissions.mockReturnValue([null, jest.fn()]);
    setup();

    expect(screen.queryByText('Cancelar')).toBeNull();
    expect(screen.queryByText('Permitir acceso')).toBeNull();
  });

  it('asks for access and lets the user cancel when permission is not granted yet', () => {
    const request = jest.fn();
    permissions.mockReturnValue([{ granted: false, canAskAgain: true }, request]);
    const { onCancel } = setup();

    fireEvent.press(screen.getByText('Permitir acceso'));
    fireEvent.press(screen.getByText('Cancelar'));

    expect(request).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('points to the device settings when permission was denied permanently', () => {
    permissions.mockReturnValue([{ granted: false, canAskAgain: false }, jest.fn()]);
    setup();

    expect(screen.getByText('Activa el permiso en Ajustes del dispositivo.')).toBeOnTheScreen();
    expect(screen.queryByText('Permitir acceso')).toBeNull();
  });
});

describe('CameraView — capture', () => {
  it('takes a low-quality photo without EXIF, records the funnel and hands over the uri', async () => {
    const { onCapture } = setup();

    fireEvent.press(shutter());

    await waitFor(() => expect(onCapture).toHaveBeenCalledWith('file:///shot.jpg'));
    expect(takePicture).toHaveBeenCalledWith({ quality: 0.3, exif: false });
    expect(trackEvent).toHaveBeenNthCalledWith(1, 'capture_started', { source: 'camera' });
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'capture_completed', {
      source: 'camera',
      duration_ms: expect.any(Number),
    });
  });

  it('shows an error and reports to Sentry when the camera fails', async () => {
    takePicture.mockRejectedValueOnce(new Error('camera busy'));
    const { onCapture } = setup();

    fireEvent.press(shutter());

    expect(await screen.findByText('No se pudo tomar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('shows the same error when processing the photo fails downstream', async () => {
    const onCapture = jest.fn().mockRejectedValue(new Error('processCapture'));
    setup({ onCapture });

    fireEvent.press(shutter());

    expect(await screen.findByText('No se pudo tomar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
  });

  it('clears the error on the next attempt', async () => {
    takePicture.mockRejectedValueOnce(new Error('camera busy'));
    const { onCapture } = setup();
    fireEvent.press(shutter());
    await screen.findByText(/No se pudo tomar la foto/);

    fireEvent.press(shutter());

    await waitFor(() => expect(onCapture).toHaveBeenCalled());
    expect(screen.queryByText(/No se pudo tomar la foto/)).toBeNull();
  });

  it('ignores a second tap while a capture is in flight', async () => {
    let finish!: (v: { uri: string }) => void;
    takePicture.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { onCapture } = setup();

    fireEvent.press(shutter());
    fireEvent.press(shutter());
    expect(takePicture).toHaveBeenCalledTimes(1);

    finish({ uri: 'file:///shot.jpg' });
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
  });
});

describe('CameraView — controls', () => {
  it('cycles the flash auto → on → off → auto', () => {
    setup();

    fireEvent.press(screen.getByText('A'));
    expect(cameraProps().flash).toBe('on');
    fireEvent.press(screen.getByText('On'));
    expect(cameraProps().flash).toBe('off');
    fireEvent.press(screen.getByText('Off'));
    expect(cameraProps().flash).toBe('auto');
  });

  it('toggles the rule-of-thirds grid', () => {
    setup();

    fireEvent.press(screen.getByText('Grid'));

    expect(screen.getByText('Grid On')).toBeOnTheScreen();
  });

  it('flips between the back and front cameras', () => {
    setup();
    expect(cameraProps().facing).toBe('back');

    fireEvent.press(screen.getByText('Flip'));
    expect(cameraProps().facing).toBe('front');

    fireEvent.press(screen.getByText('Flip'));
    expect(cameraProps().facing).toBe('back');
  });

  it('closes with the X button', () => {
    const { onCancel } = setup();

    fireEvent.press(screen.getByText('X'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Ejecutar**

```powershell
pnpm jest src/components/palette/__tests__/PaletteCard.test.tsx src/components/palette/__tests__/PaletteGrid.render.test.tsx src/components/capture/__tests__/CameraView.test.tsx
```

Expected: PASS. En `PaletteCard`, si `heart('favorite')` devuelve `undefined`, el *host* `MaterialIcons` no recibe `name`: imprimir `findAll((n) => n.type === 'MaterialIcons')` y ajustar solo el predicado.

- [ ] **Step 5: Commit**

```powershell
git add src/components/palette/__tests__/PaletteCard.test.tsx src/components/palette/__tests__/PaletteGrid.render.test.tsx src/components/capture/__tests__/CameraView.test.tsx
git commit -m "test(components): cover palette card actions, grid state and camera view"
```


---

## Fase D — Pantallas de `app/`

Los tests de pantallas viven en `test/__tests__/screens/` (nunca dentro de `app/`: expo-router convertiría cualquier archivo en ruta) y importan con el alias `@app/…`.

### Task 15: Captura, layouts y Ajustes

**Files:**
- Test: `test/__tests__/screens/capture.test.tsx`, `test/__tests__/screens/layouts.test.tsx`, `test/__tests__/screens/settings.test.tsx`

**Interfaces:**
- Consumes: `CaptureScreen` (`@app/(tabs)/capture`), `RootLayout` (`@app/_layout`), `TabLayout` (`@app/(tabs)/_layout`), `SettingsScreen` (`@app/(tabs)/settings`); `routerMock`, `resetRouterMocks`; en el mock global de `expo-router`, `Stack`/`Tabs` renderizan los *host elements* `Stack`, `StackScreen`, `Tabs`, `TabsScreen` con las props originales.
- Produces: hallazgo **H-02** (`app/_layout.tsx` registra `onboarding`, que no existe como ruta).

- [ ] **Step 1: Escribir `capture.test.tsx`**

```tsx
import * as Sentry from '@sentry/react-native';
import { act, render } from '@testing-library/react-native';

import { processCapture } from '@/lib/capture/processCapture';
import CaptureScreen from '@app/(tabs)/capture';
import { makePalette } from '@test/factories';
import { resetRouterMocks, routerMock } from '@test/router';

interface CameraProps {
  onCapture: (uri: string) => Promise<void>;
  onCancel: () => void;
}

let mockCamera!: CameraProps;

jest.mock('@/components/capture/CameraView', () => ({
  CameraView: (props: CameraProps) => {
    mockCamera = props;
    return null;
  },
}));
jest.mock('@/lib/capture/processCapture', () => ({ processCapture: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  render(<CaptureScreen />);
});

describe('CaptureScreen', () => {
  it('turns a captured photo into a palette and opens it in the editor', async () => {
    (processCapture as jest.Mock).mockResolvedValue(makePalette({ id: 'new-1' }));

    await act(async () => { await mockCamera.onCapture('file:///shot.jpg'); });

    expect(processCapture).toHaveBeenCalledWith('file:///shot.jpg', 'camera');
    expect(routerMock.replace).toHaveBeenCalledWith({ pathname: '/palette/[id]', params: { id: 'new-1' } });
  });

  it('goes back to the home tab with a failure flag when processing fails', async () => {
    (processCapture as jest.Mock).mockRejectedValue(new Error('disk full'));

    await act(async () => { await mockCamera.onCapture('file:///shot.jpg'); });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith({ pathname: '/(tabs)', params: { captureFailed: '1' } });
  });

  it('returns to the home tab on cancel', () => {
    mockCamera.onCancel();

    expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
```

- [ ] **Step 2: Escribir `layouts.test.tsx`**

```tsx
import * as fs from 'fs';
import * as path from 'path';

import * as Sentry from '@sentry/react-native';
import { render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import type { ReactElement } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { trackEvent } from '@/lib/analytics/events';
import { init as initRevenueCat } from '@/lib/revenuecat/client';
import { Colors } from '@/lib/tokens';
import RootLayout from '@app/_layout';
import TabLayout from '@app/(tabs)/_layout';
import { findAll } from '@test/skiaTree';

let mockPosthog: object | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));
jest.mock('posthog-react-native', () => {
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: jest.fn(),
    PostHogProvider: ({ children }: { children?: unknown }) => createElement('PostHogProvider', null, children),
  };
});
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureHandlerRootView' }));
jest.mock('@expo-google-fonts/fraunces', () => ({
  Fraunces_500Medium: 'f500', Fraunces_600SemiBold: 'f600', Fraunces_500Medium_Italic: 'f500i',
}));
jest.mock('@expo-google-fonts/jetbrains-mono', () => ({ JetBrainsMono_400Regular: 'jb400' }));
jest.mock('@expo-google-fonts/outfit', () => ({
  Outfit_400Regular: 'o400', Outfit_500Medium: 'o500', Outfit_600SemiBold: 'o600', Outfit_700Bold: 'o700',
}));
jest.mock('@/lib/revenuecat/client', () => ({ init: jest.fn() }));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/AnalyticsConsentSheet', () => {
  const { createElement } = require('react');
  return { AnalyticsConsentSheet: () => createElement('ConsentSheet') };
});

const APP_DIR = path.resolve(__dirname, '../../../app');

function routeFileExists(name: string): boolean {
  return [`${name}.tsx`, path.join(name, 'index.tsx'), path.join(name, '_layout.tsx')].some((relative) =>
    fs.existsSync(path.join(APP_DIR, relative))
  );
}

// No se limpian los mocks de módulo (`Sentry.init`, `initRevenueCat`, `preventAutoHideAsync`):
// se llaman una sola vez al importar el layout y se comprueban abajo.
beforeEach(() => {
  mockPosthog = null;
  (trackEvent as jest.Mock).mockClear();
  (SplashScreen.hideAsync as jest.Mock).mockClear();
  (useFonts as jest.Mock).mockReset();
  (useFonts as jest.Mock).mockReturnValue([true, null]);
});

describe('RootLayout — startup', () => {
  it('configures Sentry, RevenueCat and holds the splash screen when the module loads', () => {
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 0.2 }));
    expect(initRevenueCat).toHaveBeenCalledTimes(1);
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while the fonts are loading and keeps the splash screen', () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);

    const view = render(<RootLayout />);

    expect(view.toJSON()).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('hides the splash screen once the fonts load', () => {
    render(<RootLayout />);

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('still starts when a font fails to load (system font fallback)', () => {
    (useFonts as jest.Mock).mockReturnValue([false, new Error('font')]);

    const view = render(<RootLayout />);

    expect(view.toJSON()).not.toBeNull();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('records the cold start', () => {
    render(<RootLayout />);

    expect(trackEvent).toHaveBeenCalledWith('app_opened', { source: 'cold_start' });
  });

  it('loads the three font families the design tokens reference', () => {
    render(<RootLayout />);

    const families = Object.keys((useFonts as jest.Mock).mock.calls[0][0]);
    expect(families).toEqual(
      expect.arrayContaining(['Outfit', 'Fraunces', 'Fraunces-Italic', 'JetBrainsMono'])
    );
  });
});

describe('RootLayout — structure', () => {
  it('asks for analytics consent over the app and uses dark status-bar icons', () => {
    const json = render(<RootLayout />).toJSON();

    expect(findAll(json, 'ConsentSheet')).toHaveLength(1);
    expect(findAll(json, 'StatusBar')[0].props.style).toBe('dark');
  });

  it('wraps the app in PostHogProvider only when analytics is configured', () => {
    expect(findAll(render(<RootLayout />).toJSON(), 'PostHogProvider')).toHaveLength(0);

    mockPosthog = {};
    expect(findAll(render(<RootLayout />).toJSON(), 'PostHogProvider')).toHaveLength(1);
  });

  it('registers the tabs, the editor card, the paywall modal and onboarding', () => {
    const screens = findAll(render(<RootLayout />).toJSON(), 'StackScreen');

    expect(screens.map((s) => s.props.name)).toEqual(['(tabs)', 'palette/[id]', 'paywall', 'onboarding']);
    expect(Object.fromEntries(screens.map((s) => [s.props.name, (s.props.options as { presentation?: string } | undefined)?.presentation]))).toEqual({
      '(tabs)': undefined,
      'palette/[id]': 'card',
      paywall: 'modal',
      onboarding: 'fullScreenModal',
    });
  });

  // H-02: `onboarding` está registrada pero `app/onboarding.tsx` no existe. expo-router
  // avisa de la ruta inexistente y la pantalla de bienvenida prevista nunca se muestra.
  it.failing('every registered Stack.Screen has a route file (H-02: "onboarding" has none)', () => {
    const names = findAll(render(<RootLayout />).toJSON(), 'StackScreen').map((s) => String(s.props.name));

    expect(names.filter((name) => !routeFileExists(name))).toEqual([]);
  });
});

describe('TabLayout', () => {
  const tabs = () => findAll(render(<TabLayout />).toJSON(), 'TabsScreen');

  it('declares Paletas, Capturar and Ajustes in that order', () => {
    expect(tabs().map((t) => [t.props.name, (t.props.options as { title: string }).title])).toEqual([
      ['index', 'Paletas'],
      ['capture', 'Capturar'],
      ['settings', 'Ajustes'],
    ]);
  });

  it.each(['index', 'capture', 'settings'])('"%s" has a route file in app/(tabs)', (name) => {
    expect(fs.existsSync(path.join(APP_DIR, '(tabs)', `${name}.tsx`))).toBe(true);
  });

  it.each([
    ['index', 'palette'],
    ['capture', 'camera-alt'],
    ['settings', 'settings'],
  ])('"%s" tab shows the %s icon in the tint it is given', (name, icon) => {
    const tab = tabs().find((t) => t.props.name === name)!;
    const renderIcon = (tab.props.options as { tabBarIcon: (a: { color: string }) => ReactElement }).tabBarIcon;

    const props = findAll(render(renderIcon({ color: '#123456' })).toJSON(), 'MaterialIcons')[0].props;

    expect(props).toMatchObject({ name: icon, size: 22, color: '#123456' });
  });

  it('hides the header and tints the active tab with the accent color', () => {
    const tabsHost = findAll(render(<TabLayout />).toJSON(), 'Tabs')[0];

    expect(tabsHost.props.screenOptions).toMatchObject({
      headerShown: false,
      tabBarActiveTintColor: Colors.accent,
      tabBarInactiveTintColor: Colors.textTertiary,
    });
  });
});
```

- [ ] **Step 3: Escribir `settings.test.tsx`**

```tsx
import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, Linking, Switch, TouchableOpacity } from 'react-native';

import { PRIVACY_URL } from '@/lib/legal';
import { pickAvatarFromCamera, pickAvatarFromGallery, saveAvatar } from '@/lib/profile/avatar';
import { useSettingsStore } from '@/lib/store/settingsStore';
import SettingsScreen from '@app/(tabs)/settings';
import { resetRouterMocks, routerMock } from '@test/router';

let mockPosthog: {
  optIn: jest.Mock; optOut: jest.Mock; ready: jest.Mock; optedOut: boolean;
} | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));
jest.mock('@/lib/profile/avatar', () => ({
  pickAvatarFromCamera: jest.fn(),
  pickAvatarFromGallery: jest.fn(),
  saveAvatar: jest.fn(),
}));

const avatarButton = () => screen.UNSAFE_getAllByType(TouchableOpacity)[0];

function fakePosthog(optedOut: boolean) {
  return { optIn: jest.fn(), optOut: jest.fn(), ready: jest.fn(() => Promise.resolve()), optedOut };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  mockPosthog = null;
  useSettingsStore.setState({
    profileName: null, profilePhotoUri: null, subscriptionStatus: 'free', subscriptionExpiresAt: null,
  });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('SettingsScreen — subscription', () => {
  it('invites free users to upgrade and opens the paywall tagged as "settings"', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Mejorar a Pro'));

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'settings' } });
  });

  it('shows premium users their expiry date', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: Date.UTC(2027, 0, 15, 12) });
    render(<SettingsScreen />);

    expect(screen.getByText('HUED PRO')).toBeOnTheScreen();
    expect(screen.getByText('15 de enero de 2027')).toBeOnTheScreen();
    expect(screen.queryByText('Mejorar a Pro')).toBeNull();
  });

  it('shows "De por vida" for a lifetime purchase', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: null });
    render(<SettingsScreen />);

    expect(screen.getByText('De por vida')).toBeOnTheScreen();
  });
});

describe('SettingsScreen — profile name', () => {
  it('prompts for a name when there is none', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Añadir nombre')).toBeOnTheScreen();
  });

  it('shows the saved name', () => {
    useSettingsStore.setState({ profileName: 'Luz' });
    render(<SettingsScreen />);

    expect(screen.getByText('Luz')).toBeOnTheScreen();
  });

  it('saves a trimmed name', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Añadir nombre'));

    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), '  Ana  ');
    fireEvent.press(screen.getByText('Guardar'));

    expect(useSettingsStore.getState().profileName).toBe('Ana');
  });

  it('clears the name when saved empty', () => {
    useSettingsStore.setState({ profileName: 'Luz' });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Luz'));

    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), '   ');
    fireEvent.press(screen.getByText('Guardar'));

    expect(useSettingsStore.getState().profileName).toBeNull();
  });

  it('opens the editor prefilled with the current name and limits it to 40 characters', () => {
    useSettingsStore.setState({ profileName: 'Luz' });
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Luz'));

    expect(screen.getByDisplayValue('Luz')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Tu nombre').props.maxLength).toBe(40);
  });
});

describe('SettingsScreen — avatar', () => {
  it('saves a photo picked from the gallery', async () => {
    (pickAvatarFromGallery as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///picked.jpg' });
    (saveAvatar as jest.Mock).mockResolvedValue('file:///documents/profile/avatar.jpg?t=1');
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    fireEvent.press(await screen.findByText('Galería'));

    await waitFor(() =>
      expect(useSettingsStore.getState().profilePhotoUri).toBe('file:///documents/profile/avatar.jpg?t=1')
    );
    expect(saveAvatar).toHaveBeenCalledWith('file:///picked.jpg');
  });

  it('saves a photo taken with the camera', async () => {
    (pickAvatarFromCamera as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///cam.jpg' });
    (saveAvatar as jest.Mock).mockResolvedValue('file:///documents/profile/avatar.jpg?t=2');
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    fireEvent.press(await screen.findByText('Cámara'));

    await waitFor(() => expect(saveAvatar).toHaveBeenCalledWith('file:///cam.jpg'));
  });

  it.each([{ type: 'denied' }, { type: 'cancelled' }])('does not save anything when the pick is %o', async (result) => {
    (pickAvatarFromGallery as jest.Mock).mockResolvedValue(result);
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    fireEvent.press(await screen.findByText('Galería'));
    await waitFor(() => expect(pickAvatarFromGallery).toHaveBeenCalled());

    expect(saveAvatar).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().profilePhotoUri).toBeNull();
  });

  it('shows a spinner while the photo is being picked and recovers after a failure', async () => {
    let fail!: (e: Error) => void;
    (pickAvatarFromGallery as jest.Mock).mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    fireEvent.press(await screen.findByText('Galería'));
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();

    await act(async () => { fail(new Error('picker crashed')); });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });
});

describe('SettingsScreen — privacy and analytics', () => {
  it('opens the privacy policy link', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Política de privacidad'));

    expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_URL);
  });

  it('hides the analytics switch when PostHog is not configured', () => {
    render(<SettingsScreen />);

    expect(screen.queryByText('Estadísticas de uso')).toBeNull();
    expect(screen.UNSAFE_queryByType(Switch)).toBeNull();
  });

  it('shows the switch off when the user opted out', async () => {
    mockPosthog = fakePosthog(true);
    render(<SettingsScreen />);

    await waitFor(() => expect(mockPosthog!.ready).toHaveBeenCalled());

    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('shows the switch on when the user opted in', async () => {
    mockPosthog = fakePosthog(false);
    render(<SettingsScreen />);

    await waitFor(() => expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true));
  });

  it('opts in and out as the switch is toggled', async () => {
    mockPosthog = fakePosthog(true);
    render(<SettingsScreen />);
    await waitFor(() => expect(mockPosthog!.ready).toHaveBeenCalled());

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);
    expect(mockPosthog!.optIn).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', false);
    expect(mockPosthog!.optOut).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });
});
```

- [ ] **Step 4: Ejecutar**

```powershell
pnpm jest test/__tests__/screens/capture.test.tsx test/__tests__/screens/layouts.test.tsx test/__tests__/screens/settings.test.tsx
```

Expected: PASS (`it.failing` de H-02 cuenta como pasado). Si el alias `@app/(tabs)/capture` no resuelve por los paréntesis en el patrón de `moduleNameMapper`, cambiar los imports a rutas relativas (`../../../app/(tabs)/capture`) y anotarlo.

- [ ] **Step 5: Commit**

```powershell
git add test/__tests__/screens/capture.test.tsx test/__tests__/screens/layouts.test.tsx test/__tests__/screens/settings.test.tsx
git commit -m "test(screens): cover capture, root/tab layouts and settings (H-02)"
```

---

### Task 16: Inicio (`index`) y Paywall

**Files:**
- Test: `test/__tests__/screens/index.test.tsx`, `test/__tests__/screens/paywall.test.tsx`

**Interfaces:**
- Consumes: `HomeScreen` (`@app/(tabs)/index`), `PaywallScreen` (`@app/paywall`); `listPalettes`, `listCollections`, `createCollection`, `renameCollection`, `deleteCollection`, `launchGalleryPicker`, `processCapture`; `getOfferings`, `purchasePackage`, `restorePurchases`; `searchParamsMock`.
- Produces: hallazgo **H-08** (la pantalla de inicio se queda en spinner si `listPalettes` falla).

- [ ] **Step 1: Escribir `index.test.tsx`**

```tsx
import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { processCapture } from '@/lib/capture/processCapture';
import { createCollection, deleteCollection, listCollections, renameCollection } from '@/lib/db/collections';
import { listPalettes } from '@/lib/db/palettes';
import type { Collection } from '@/types/palette';
import HomeScreen from '@app/(tabs)/index';
import { makePalette } from '@test/factories';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => ({ listPalettes: jest.fn() }));
jest.mock('@/lib/db/collections', () => ({
  listCollections: jest.fn(),
  createCollection: jest.fn(),
  renameCollection: jest.fn(),
  deleteCollection: jest.fn(),
}));
jest.mock('@/components/capture/GalleryPicker', () => ({ launchGalleryPicker: jest.fn() }));
jest.mock('@/lib/capture/processCapture', () => ({ processCapture: jest.fn() }));
jest.mock('@/components/palette/PaletteGrid', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    PaletteGrid: (p: { filter: string; query: string }) => createElement(Text, null, `grid:${p.filter}:${p.query}`),
  };
});

const CAFE: Collection = { id: 'c1', name: 'Café', createdAt: 1, position: 0 };

function mount(opts: { palettes?: number; collections?: Collection[] } = {}) {
  (listPalettes as jest.Mock).mockResolvedValue(Array.from({ length: opts.palettes ?? 2 }, (_, i) => makePalette({ id: `p${i}` })));
  (listCollections as jest.Mock).mockResolvedValue(opts.collections ?? []);
  render(<HomeScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
});

describe('HomeScreen — loading', () => {
  it('shows only a spinner until the palettes load', async () => {
    mount();

    expect(screen.queryByText('Hued')).toBeNull();
    expect(await screen.findByText('Hued')).toBeOnTheScreen();
    expect(screen.getByText('Tus paletas')).toBeOnTheScreen();
  });

  it('reports a load failure to Sentry', async () => {
    (listPalettes as jest.Mock).mockRejectedValue(new Error('db'));
    (listCollections as jest.Mock).mockResolvedValue([]);

    render(<HomeScreen />);

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalled());
  });

  // H-08: si `listPalettes` falla, `hasPalettes` se queda en `null` y la pantalla es un
  // spinner para siempre (no hay estado de error ni botón de reintento).
  it.failing('leaves the spinner when the database fails (H-08)', async () => {
    (listPalettes as jest.Mock).mockRejectedValue(new Error('db'));
    (listCollections as jest.Mock).mockResolvedValue([]);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Hued')).toBeOnTheScreen(), { timeout: 300 });
  });
});

describe('HomeScreen — empty state', () => {
  it('invites the user to create the first palette', async () => {
    mount({ palettes: 0 });

    expect(await screen.findByText('Sin paletas todavía')).toBeOnTheScreen();
    expect(screen.queryByText('grid:all:')).toBeNull();
  });

  it('opens the camera tab from the "Cámara" button', async () => {
    mount({ palettes: 0 });
    fireEvent.press(await screen.findByText('Cámara'));

    expect(routerMock.push).toHaveBeenCalledWith('/(tabs)/capture');
  });

  it('turns a gallery pick into a palette and opens the editor', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///g.jpg' });
    (processCapture as jest.Mock).mockResolvedValue(makePalette({ id: 'fresh' }));
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/palette/[id]', params: { id: 'fresh' } })
    );
    expect(processCapture).toHaveBeenCalledWith('file:///g.jpg', 'gallery');
  });

  it('explains how to grant gallery access when permission is denied', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'denied' });
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));

    expect(await screen.findByText('Activa el permiso de galería en Ajustes del dispositivo.')).toBeOnTheScreen();
  });

  it('does nothing when the gallery is dismissed', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'cancelled' });
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));
    await waitFor(() => expect(launchGalleryPicker).toHaveBeenCalled());

    expect(processCapture).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('shows a retry message and reports to Sentry when the photo cannot be processed', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///g.jpg' });
    (processCapture as jest.Mock).mockRejectedValue(new Error('optimize'));
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));

    expect(await screen.findByText('No se pudo procesar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('shows "Abriendo..." and ignores a second tap while the picker is open', async () => {
    let finish!: (v: { type: 'cancelled' }) => void;
    (launchGalleryPicker as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));
    expect(await screen.findByText('Abriendo...')).toBeOnTheScreen();
    expect(screen.queryByText('Galería')).toBeNull();

    await act(async () => { finish({ type: 'cancelled' }); });
    expect(launchGalleryPicker).toHaveBeenCalledTimes(1);
  });

  it('shows the failure message after a failed capture sent the user back with ?captureFailed=1', async () => {
    searchParamsMock.mockReturnValue({ captureFailed: '1' });
    mount({ palettes: 0 });

    expect(await screen.findByText('No se pudo procesar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
  });
});

describe('HomeScreen — with palettes', () => {
  it('shows the grid, search box and the default filters', async () => {
    mount();

    expect(await screen.findByText('grid:all:')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Buscar por color...')).toBeOnTheScreen();
    expect(screen.getByText('Todas')).toBeOnTheScreen();
    expect(screen.getByText('Favoritas')).toBeOnTheScreen();
  });

  it('passes the search text to the grid', async () => {
    mount();
    await screen.findByText('grid:all:');

    fireEvent.changeText(screen.getByPlaceholderText('Buscar por color...'), 'rojo');

    expect(screen.getByText('grid:all:rojo')).toBeOnTheScreen();
  });

  it('switches the grid filter between all, favorites and a folder', async () => {
    mount({ collections: [CAFE] });
    await screen.findByText('grid:all:');

    fireEvent.press(screen.getByText('Favoritas'));
    expect(screen.getByText('grid:favorites:')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Café'));
    expect(screen.getByText('grid:c1:')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Todas'));
    expect(screen.getByText('grid:all:')).toBeOnTheScreen();
  });

  it('opens the camera tab from the floating "+" button', async () => {
    mount();
    fireEvent.press(await screen.findByText('+'));

    expect(routerMock.push).toHaveBeenCalledWith('/(tabs)/capture');
  });
});

describe('HomeScreen — folders', () => {
  const openCreate = async () => {
    mount({ collections: [CAFE] });
    fireEvent.press(await screen.findByText('+ Nueva'));
  };

  it('creates a folder with a trimmed name and adds its pill', async () => {
    (createCollection as jest.Mock).mockResolvedValue({ id: 'c2', name: 'Viajes', createdAt: 2, position: 1 });
    await openCreate();

    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la carpeta'), '  Viajes  ');
    fireEvent.press(screen.getByText('Crear'));

    expect(await screen.findByText('Viajes')).toBeOnTheScreen();
    expect(createCollection).toHaveBeenCalledWith('Viajes');
  });

  it('does not create a folder with an empty name', async () => {
    await openCreate();

    fireEvent.press(screen.getByText('Crear'));

    expect(createCollection).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and reports when creating fails', async () => {
    (createCollection as jest.Mock).mockRejectedValue(new Error('db'));
    await openCreate();

    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la carpeta'), 'Viajes');
    fireEvent.press(screen.getByText('Crear'));

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(screen.getByText('NUEVA CARPETA')).toBeOnTheScreen();
  });

  it('renames a folder from its long-press menu', async () => {
    (renameCollection as jest.Mock).mockResolvedValue(undefined);
    mount({ collections: [CAFE] });
    fireEvent(await screen.findByText('Café'), 'longPress');

    fireEvent.press(screen.getByText('Renombrar'));
    expect(screen.getByDisplayValue('Café')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByDisplayValue('Café'), 'Cafetería');
    fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Cafetería')).toBeOnTheScreen();
    expect(renameCollection).toHaveBeenCalledWith('c1', 'Cafetería');
    expect(screen.queryByText('Café')).toBeNull();
  });

  it('asks for confirmation, deletes the folder and falls back to "Todas" if it was selected', async () => {
    (deleteCollection as jest.Mock).mockResolvedValue(undefined);
    mount({ collections: [CAFE] });
    fireEvent.press(await screen.findByText('Café'));
    expect(screen.getByText('grid:c1:')).toBeOnTheScreen();

    fireEvent(screen.getByText('Café'), 'longPress');
    fireEvent.press(screen.getByText('Eliminar'));
    expect(screen.getByText(/¿Eliminar "Café"\?/)).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Eliminar'));

    await waitFor(() => expect(deleteCollection).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Café')).toBeNull());
    expect(screen.getByText('grid:all:')).toBeOnTheScreen();
  });

  it('cancelling the delete confirmation keeps the folder', async () => {
    mount({ collections: [CAFE] });
    fireEvent(await screen.findByText('Café'), 'longPress');
    fireEvent.press(screen.getByText('Eliminar'));

    fireEvent.press(screen.getByText('Cancelar'));

    expect(deleteCollection).not.toHaveBeenCalled();
    expect(screen.getByText('Café')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Escribir `paywall.test.tsx`**

```tsx
import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { trackEvent } from '@/lib/analytics/events';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat/client';
import PaywallScreen from '@app/paywall';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/revenuecat/client', () => ({
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

const pkg = (identifier: string, packageType: string, priceString: string) => ({
  identifier, packageType, product: { priceString },
});
const MONTHLY = pkg('$rc_monthly', 'MONTHLY', '2,99 €');
const ANNUAL = pkg('$rc_annual', 'ANNUAL', '19,99 €');
const LIFETIME = pkg('$rc_lifetime', 'LIFETIME', '49,99 €');

function mount(packages = [MONTHLY, ANNUAL, LIFETIME], trigger?: string) {
  searchParamsMock.mockReturnValue(trigger ? { trigger } : {});
  (getOfferings as jest.Mock).mockResolvedValue({ availablePackages: packages });
  render(<PaywallScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('PaywallScreen — plans', () => {
  it('lists every offered plan with its Spanish name and store price', async () => {
    mount();

    expect(await screen.findByText('Mensual')).toBeOnTheScreen();
    expect(screen.getByText('Anual')).toBeOnTheScreen();
    expect(screen.getByText('De por vida')).toBeOnTheScreen();
    expect(screen.getByText('2,99 €')).toBeOnTheScreen();
    expect(screen.getByText('49,99 €')).toBeOnTheScreen();
    expect(screen.getAllByText('Elegir')).toHaveLength(3);
  });

  it('falls back to the raw package type for an unknown plan', async () => {
    mount([pkg('$rc_weekly', 'WEEKLY', '0,99 €')]);

    expect(await screen.findByText('WEEKLY')).toBeOnTheScreen();
  });

  it('shows no plans (but still the restore link) when there is no current offering', async () => {
    (getOfferings as jest.Mock).mockResolvedValue(null);
    render(<PaywallScreen />);

    expect(await screen.findByText('Restaurar compras')).toBeOnTheScreen();
    expect(screen.queryByText('Elegir')).toBeNull();
  });

  it('shows a retry message and reports to Sentry when the plans cannot be loaded', async () => {
    (getOfferings as jest.Mock).mockRejectedValue(new Error('network'));
    render(<PaywallScreen />);

    expect(await screen.findByText('No se pudieron cargar los planes. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('PaywallScreen — analytics', () => {
  it('records the paywall view once with the trigger that opened it', async () => {
    mount(undefined, 'export_limit');
    await screen.findByText('Mensual');

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('paywall_shown', { trigger: 'export_limit' });
  });

  it('attributes a paywall opened without a trigger to "settings"', async () => {
    mount();
    await screen.findByText('Mensual');

    expect(trackEvent).toHaveBeenCalledWith('paywall_shown', { trigger: 'settings' });
  });

  it('records the dismissal and goes back when closed', async () => {
    mount(undefined, 'watermark_tap');
    fireEvent.press(await screen.findByText('Cerrar'));

    expect(trackEvent).toHaveBeenCalledWith('paywall_dismissed', { trigger: 'watermark_tap' });
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});

describe('PaywallScreen — purchase', () => {
  it.each([
    [MONTHLY, 0, 'monthly'],
    [ANNUAL, 1, 'annual'],
    [LIFETIME, 2, 'lifetime'],
  ] as const)('buying %o records the plan and closes the paywall', async (selected, index, plan) => {
    (purchasePackage as jest.Mock).mockResolvedValue({});
    mount(undefined, 'export_limit');

    fireEvent.press((await screen.findAllByText('Elegir'))[index]);

    await waitFor(() => expect(routerMock.back).toHaveBeenCalledTimes(1));
    expect(purchasePackage).toHaveBeenCalledWith(selected);
    expect(trackEvent).toHaveBeenCalledWith('subscription_purchased', { trigger: 'export_limit', plan });
  });

  it('stays open and silent when the user cancels the store dialog', async () => {
    (purchasePackage as jest.Mock).mockRejectedValue({ userCancelled: true });
    mount();

    fireEvent.press((await screen.findAllByText('Elegir'))[0]);

    await waitFor(() => expect(screen.getAllByText('Elegir')).toHaveLength(3));
    expect(screen.queryByText(/No se pudo completar la compra/)).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('shows an error under the plans and reports to Sentry when the purchase fails', async () => {
    (purchasePackage as jest.Mock).mockRejectedValue(new Error('billing unavailable'));
    mount();

    fireEvent.press((await screen.findAllByText('Elegir'))[0]);

    expect(await screen.findByText('No se pudo completar la compra. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(screen.getByText('Mensual')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('blocks the other plans while one purchase is in progress', async () => {
    let finish!: (v: object) => void;
    (purchasePackage as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount();
    const buttons = await screen.findAllByText('Elegir');

    fireEvent.press(buttons[0]);
    fireEvent.press(screen.getAllByText('Elegir')[0]);

    expect(purchasePackage).toHaveBeenCalledTimes(1);
    await act(async () => { finish({}); });
  });
});

describe('PaywallScreen — restore and legal', () => {
  it('restores purchases, records it and closes', async () => {
    (restorePurchases as jest.Mock).mockResolvedValue({});
    mount();

    fireEvent.press(await screen.findByText('Restaurar compras'));

    await waitFor(() => expect(routerMock.back).toHaveBeenCalledTimes(1));
    expect(trackEvent).toHaveBeenCalledWith('subscription_restored', {});
  });

  it('shows an error and reports to Sentry when restoring fails', async () => {
    (restorePurchases as jest.Mock).mockRejectedValue(new Error('no account'));
    mount();

    fireEvent.press(await screen.findByText('Restaurar compras'));

    expect(await screen.findByText('No se pudieron restaurar las compras.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('links to the terms and the privacy policy (Apple 3.1.2)', async () => {
    mount();

    fireEvent.press(await screen.findByText('Condiciones de uso'));
    fireEvent.press(screen.getByText('Política de privacidad'));

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, TERMS_URL);
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, PRIVACY_URL);
  });
});
```

- [ ] **Step 3: Ejecutar**

```powershell
pnpm jest test/__tests__/screens/index.test.tsx test/__tests__/screens/paywall.test.tsx
```

Expected: PASS (`it.failing` de H-08 cuenta como pasado; tarda ~0,3 s por el `timeout`). En `index.test.tsx`, los textos `'Eliminar'` y `'Café'` son únicos por pantalla en cada paso; si `getByText` encontrara duplicados, usar `getAllByText(...)[0]`.

- [ ] **Step 4: Commit**

```powershell
git add test/__tests__/screens/index.test.tsx test/__tests__/screens/paywall.test.tsx
git commit -m "test(screens): cover home (empty/gallery/folders) and paywall flows (H-08)"
```

---

### Task 17: Pantalla de paleta (`palette/[id]`)

**Files:**
- Test: `test/__tests__/screens/palette.test.tsx`

**Interfaces:**
- Consumes: `PaletteScreen` (`@app/palette/[id]`); `getPalette`, `updatePaletteColors`, `updatePaletteLayout`, `incrementExportCount`, `deletePalette`; `extractColors`, `ExtractError`; `exportPalette`, `RESOLUTIONS`; `generateScatterLayout`; `useSettingsStore`; `routerMock`, `searchParamsMock`.
- Produces: hallazgo **H-07** (si `getPalette` falla, la pantalla se queda en spinner). Cubre *Review Focus* 4 y la compuerta de exportación.

- [ ] **Step 1: Escribir `palette.test.tsx`**

```tsx
import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { Pressable, StyleSheet } from 'react-native';

import { generateScatterLayout } from '@/components/compose/archetypes/freeformLayout';
import { trackEvent } from '@/lib/analytics/events';
import { ExtractError, extractColors } from '@/lib/color/extract';
import {
  deletePalette, getPalette, incrementExportCount, updatePaletteColors, updatePaletteLayout,
} from '@/lib/db/palettes';
import { exportPalette } from '@/lib/export/exportPalette';
import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/db/palettes', () => ({
  getPalette: jest.fn(),
  updatePaletteColors: jest.fn(),
  updatePaletteLayout: jest.fn(),
  incrementExportCount: jest.fn(),
  deletePalette: jest.fn(),
}));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn(),
}));
jest.mock('@/lib/export/exportPalette', () => ({
  ...jest.requireActual('@/lib/export/exportPalette'),
  exportPalette: jest.fn(),
}));

const media = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const sharing = Sharing as jest.Mocked<typeof Sharing>;
const palette = makePalette({ id: 'p1', colors: makeColors(5) });
const today = () => new Date().toISOString().slice(0, 10);

async function mount(p = palette) {
  searchParamsMock.mockReturnValue({ id: p.id });
  (getPalette as jest.Mock).mockResolvedValue(p);
  const view = render(<PaletteScreen />);
  await screen.findByText('Exportar');
  return view;
}

const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
const lastWrite = () => (updatePaletteLayout as jest.Mock).mock.calls.at(-1)![1];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free', exportDailyCount: 0, exportDailyResetDate: today() });
  (updatePaletteLayout as jest.Mock).mockResolvedValue(undefined);
  (updatePaletteColors as jest.Mock).mockResolvedValue(undefined);
  (incrementExportCount as jest.Mock).mockResolvedValue(undefined);
  (deletePalette as jest.Mock).mockResolvedValue(undefined);
  (extractColors as jest.Mock).mockImplementation((_uri: string, n = 5) => Promise.resolve(makeColors(n)));
  (exportPalette as jest.Mock).mockResolvedValue('file:///cache/out.png');
  media.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  sharing.isAvailableAsync.mockResolvedValue(true);
});

afterEach(() => jest.useRealTimers());

describe('PaletteScreen — loading', () => {
  it('shows the editor once the palette loads', async () => {
    await mount();

    expect(screen.getByText('Exportar')).toBeOnTheScreen();
    expect(screen.getByText('← Volver')).toBeOnTheScreen();
  });

  it('shows "Paleta no encontrada." with a way back for an unknown id', async () => {
    searchParamsMock.mockReturnValue({ id: 'missing' });
    (getPalette as jest.Mock).mockResolvedValue(null);
    render(<PaletteScreen />);

    fireEvent.press(await screen.findByText('Volver'));

    expect(screen.getByText('Paleta no encontrada.')).toBeOnTheScreen();
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  // H-07: `getPalette(id).then(...)` no tiene `catch`/`finally`: si la base de datos falla,
  // `setLoading(false)` no llega a ejecutarse y la pantalla queda en spinner para siempre.
  // Se simula con un thenable que nunca invoca el callback (mismo efecto visible que un
  // rechazo, sin disparar un `unhandledRejection` que rompería el worker de Jest).
  it.failing('leaves the spinner when the database fails (H-07)', async () => {
    searchParamsMock.mockReturnValue({ id: 'p1' });
    (getPalette as jest.Mock).mockReturnValue({ then: () => Promise.resolve() });
    jest.useRealTimers();

    render(<PaletteScreen />);

    await waitFor(() => expect(screen.getByText('Paleta no encontrada.')).toBeOnTheScreen(), { timeout: 300 });
  });
});

describe('PaletteScreen — extraction on open', () => {
  const empty = makePalette({ id: 'p1', colors: [] });
  const swatches = (hexes: string[]) =>
    screen.UNSAFE_root.findAll(
      (n) => n.type === 'View' && hexes.includes(StyleSheet.flatten(n.props.style)?.backgroundColor as string)
    );

  it('extracts the colors of a palette that has none and shows them', async () => {
    await mount(empty);

    await waitFor(() => expect(updatePaletteColors).toHaveBeenCalledWith('p1', expect.any(Array)));
    expect(extractColors).toHaveBeenCalledWith(empty.thumbnailUri);
    await waitFor(() => expect(swatches(makeColors(5).map((c) => c.hex))).toHaveLength(5));
  });

  it('does not re-extract a palette that already has colors', async () => {
    await mount();

    expect(extractColors).not.toHaveBeenCalled();
  });

  it('offers a retry when extraction fails, and reports it', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new ExtractError('Skia could not decode image'));
    await mount(empty);

    expect(await screen.findByText('Reintentar')).toBeOnTheScreen();
    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'Skia could not decode image' });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(extractColors).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Reintentar')).toBeNull());
  });

  it('reports "unknown" for a non-ExtractError failure', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new Error('weird'));
    await mount(empty);
    await screen.findByText('Reintentar');

    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'unknown' });
  });
});

describe('PaletteScreen — saving the layout (500 ms debounce)', () => {
  const openFonts = () => fireEvent.press(screen.getByText('Tipografía'));

  it('writes the config once, 500 ms after the last change', async () => {
    await mount();
    openFonts();

    fireEvent.press(screen.getByText('Clásica'));
    await advance(499);
    expect(updatePaletteLayout).not.toHaveBeenCalled();

    await advance(1);
    expect(updatePaletteLayout).toHaveBeenCalledTimes(1);
    expect(updatePaletteLayout).toHaveBeenCalledWith('p1', expect.objectContaining({ fontFamily: 'serif' }));
  });

  it('collapses rapid changes into a single write with the last value', async () => {
    await mount();
    openFonts();

    fireEvent.press(screen.getByText('Clásica'));
    await advance(100);
    fireEvent.press(screen.getByText('Técnica'));
    await advance(500);

    expect(updatePaletteLayout).toHaveBeenCalledTimes(1);
    expect(lastWrite().fontFamily).toBe('mono');
  });

  it('flushes a pending write when the screen closes (no lost edits)', async () => {
    const view = await mount();
    openFonts();
    fireEvent.press(screen.getByText('Clásica'));

    view.unmount();

    expect(updatePaletteLayout).toHaveBeenCalledWith('p1', expect.objectContaining({ fontFamily: 'serif' }));
  });

  it('reports a failed write to Sentry', async () => {
    (updatePaletteLayout as jest.Mock).mockRejectedValue(new Error('locked'));
    await mount();
    openFonts();

    fireEvent.press(screen.getByText('Clásica'));
    await advance(500);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('PaletteScreen — Libre archetype', () => {
  it('seeds a scatter layout the first time Libre is chosen', async () => {
    await mount();

    fireEvent.press(screen.getByText('Libre'));
    await advance(500);

    expect(lastWrite()).toMatchObject({
      archetypeId: 'libre',
      freeformSwatches: generateScatterLayout(5, 360, 450),
    });
  });

  it('does not rewrite swatches that already match the colors', async () => {
    const custom = makeLayoutConfig({
      archetypeId: 'libre',
      freeformSwatches: generateScatterLayout(5, 360, 450).map((s) => ({ ...s, x: s.x + 1 })),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: custom }));

    await advance(1000);

    expect(updatePaletteLayout).not.toHaveBeenCalled();
  });

  it('"Restablecer layout" regenerates the scatter and records the event', async () => {
    const custom = makeLayoutConfig({
      archetypeId: 'libre',
      freeformSwatches: generateScatterLayout(5, 360, 450).map((s) => ({ ...s, x: s.x + 1 })),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: custom }));

    fireEvent.press(screen.getByText('Restablecer layout'));
    await advance(500);

    expect(lastWrite().freeformSwatches).toEqual(generateScatterLayout(5, 360, 450));
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'freeformSwatches_reset' });
  });
});

describe('PaletteScreen — palette size', () => {
  const setSize = (n: string) => {
    fireEvent.press(screen.getByText('Colores'));
    fireEvent.press(screen.getByText(n));
  };

  it('re-extracts at the new size and resets Libre swatches (ADR-0001)', async () => {
    await mount();

    setSize('8');

    await waitFor(() => expect(extractColors).toHaveBeenCalledWith(palette.thumbnailUri, 8));
    expect(updatePaletteColors).toHaveBeenCalledWith('p1', expect.arrayContaining([]));
    await advance(500);
    expect(lastWrite()).toMatchObject({ paletteSize: 8, freeformSwatches: [] });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'paletteSize' });
  });

  it('does nothing when the chosen size is already extracted', async () => {
    await mount();

    setSize('5');

    expect(extractColors).not.toHaveBeenCalled();
  });

  it('keeps the old palette and reports when re-extraction fails', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new ExtractError('Too few opaque pixels: 1'));
    await mount();

    setSize('8');

    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'Too few opaque pixels: 1' }));
    await advance(500);
    expect(updatePaletteLayout).not.toHaveBeenCalled();
    expect(updatePaletteColors).not.toHaveBeenCalled();
  });
});

describe('PaletteScreen — export', () => {
  const openExport = () => fireEvent.press(screen.getByText('Exportar'));
  const exportAt = async (label: string) => {
    openExport();
    fireEvent.press(await screen.findByText(label));
  };

  it('offers the three resolutions with their pixel sizes', async () => {
    await mount();
    openExport();

    expect(await screen.findByText('1080 × 1350')).toBeOnTheScreen();
    expect(screen.getByText('2160 × 2700')).toBeOnTheScreen();
    expect(screen.getByText('4320 × 5400')).toBeOnTheScreen();
  });

  it('exports, saves write-only, counts the export, shares and closes the sheet', async () => {
    await mount();

    await exportAt('2×');

    await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/out.png', { mimeType: 'image/png' }));
    expect(exportPalette).toHaveBeenCalledWith(palette, palette.layoutConfig, '2x');
    expect(media.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(media.saveToLibraryAsync).toHaveBeenCalledWith('file:///cache/out.png');
    expect(incrementExportCount).toHaveBeenCalledWith('p1');
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
    expect(trackEvent).toHaveBeenCalledWith('palette_exported', { palette_id: 'p1', resolution: '2x', archetype_id: 'strip' });
    expect(trackEvent).toHaveBeenCalledWith('palette_shared', { palette_id: 'p1' });
    await waitFor(() => expect(screen.queryByText('Exportar paleta')).toBeNull());
  });

  it('still counts the export when the share sheet is unavailable', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    await mount();

    await exportAt('1×');

    await waitFor(() => expect(useSettingsStore.getState().exportDailyCount).toBe(1));
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalledWith('palette_shared', expect.anything());
  });

  it('asks the user to enable photo permission and does not count the export when denied', async () => {
    media.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await mount();

    await exportAt('1×');

    expect(await screen.findByText('Activa el permiso de fotos en Ajustes del dispositivo.')).toBeOnTheScreen();
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(incrementExportCount).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
  });

  it('shows an error, reports to Sentry and does not count a failed export', async () => {
    (exportPalette as jest.Mock).mockRejectedValue(new Error('skia'));
    await mount();

    await exportAt('1×');

    expect(await screen.findByText('No se pudo exportar la paleta. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
  });

  it('sends a free user at the daily limit to the paywall instead of exporting', async () => {
    useSettingsStore.setState({ exportDailyCount: 3 });
    await mount();

    await exportAt('1×');

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'export_limit' } });
    expect(exportPalette).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Exportar paleta')).toBeNull());
  });

  it('lets premium users export past the daily limit', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium', exportDailyCount: 99 });
    await mount();

    await exportAt('1×');

    await waitFor(() => expect(exportPalette).toHaveBeenCalledTimes(1));
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('resets the daily counter on a new day before checking the limit', async () => {
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: '2000-01-01' });
    await mount();

    await exportAt('1×');

    await waitFor(() => expect(exportPalette).toHaveBeenCalledTimes(1));
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
  });
});

describe('PaletteScreen — delete and navigation', () => {
  const trash = () => screen.UNSAFE_root.findAll((n) => n.type === 'MaterialIcons' && n.props.name === 'delete')[0];
  const confirm = () => {
    fireEvent.press(trash());
    return screen.findByText('¿Eliminar esta paleta? Esta acción no se puede deshacer.');
  };

  it('asks for confirmation before deleting', async () => {
    await mount();

    expect(await confirm()).toBeOnTheScreen();
    expect(deletePalette).not.toHaveBeenCalled();
  });

  it('deletes, records it and returns to the home tab', async () => {
    await mount();
    await confirm();

    fireEvent.press(screen.getByText('Eliminar'));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(deletePalette).toHaveBeenCalledWith('p1');
    expect(trackEvent).toHaveBeenCalledWith('palette_deleted', { palette_id: 'p1', source: 'detail' });
  });

  it('dismisses the whole stack when it can', async () => {
    routerMock.canDismiss.mockReturnValue(true);
    await mount();
    await confirm();

    fireEvent.press(screen.getByText('Eliminar'));

    await waitFor(() => expect(routerMock.dismissAll).toHaveBeenCalledTimes(1));
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('stays on the screen and reports when deleting fails', async () => {
    (deletePalette as jest.Mock).mockRejectedValue(new Error('locked'));
    await mount();
    await confirm();

    fireEvent.press(screen.getByText('Eliminar'));

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(screen.getByText('Eliminar')).toBeOnTheScreen();
  });

  it('"Cancelar" closes the confirmation without deleting', async () => {
    await mount();
    await confirm();

    fireEvent.press(screen.getByText('Cancelar'));

    expect(deletePalette).not.toHaveBeenCalled();
  });

  it('"← Volver" goes back', async () => {
    await mount();

    fireEvent.press(screen.getByText('← Volver'));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('"Listo" returns to the home tab', async () => {
    await mount();

    fireEvent.press(screen.getByText('Listo'));

    expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('tapping the watermark opens the paywall tagged "watermark_tap" (free users)', async () => {
    await mount();
    const region = screen.UNSAFE_root.findAll((n) => n.type === 'View' && typeof n.props.onLayout === 'function')[0];
    fireEvent(region, 'layout', { nativeEvent: { layout: { width: 360, height: 450 } } });

    const overlay = screen.UNSAFE_getAllByType(Pressable).find((p) => typeof p.props.style !== 'function')!;
    fireEvent.press(overlay);

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
  });
});
```

- [ ] **Step 2: Ejecutar**

```powershell
pnpm jest test/__tests__/screens/palette.test.tsx
```

Expected: PASS. Con *fake timers*, `findByText`/`waitFor` de RNTL avanzan el reloj solos. Si un test cuelga, comprobar que no hay una promesa pendiente sin resolver (todos los mocks de `beforeEach` devuelven promesas ya resueltas).

- [ ] **Step 3: Mutation check de la compuerta de exportación**

En `app/palette/[id].tsx` (línea ~198) cambiar temporalmente `if (!canExportToday(` por `if (false && !canExportToday(` y ejecutar el archivo: deben fallar `sends a free user at the daily limit to the paywall…`. Restaurar con `git checkout "app/palette/[id].tsx"` (entre comillas por los corchetes).

- [ ] **Step 4: Commit**

```powershell
git add test/__tests__/screens/palette.test.tsx
git commit -m "test(screens): cover the palette editor: extraction, persistence, Libre, size, export gate (H-07)"
```


---

## Fase E — Integración

Estos tests usan los módulos **reales** (pantalla, `processCapture`, `exportPalette`, `ArchetypeCanvas`, stores) y solo sustituyen las fronteras de E/S: base de datos (por una en memoria que serializa a JSON como SQLite), Skia, sistema de archivos, galería y RevenueCat.

### Task 18: Flujos de punta a punta

**Files:**
- Create: `test/fakePaletteDb.ts`
- Test: `test/__tests__/integration/captureToExport.test.tsx`, `test/__tests__/integration/exportGate.test.tsx`, `test/__tests__/integration/persistence.test.tsx`, `test/__tests__/integration/consent.test.tsx`

**Interfaces:**
- Consumes: `PaletteScreen`, `SettingsScreen`, `AnalyticsConsentSheet`, `processCapture`, `useSettingsStore`.
- Produces: `@test/fakePaletteDb` con `savePalette`, `getPalette`, `listPalettes`, `updatePaletteColors`, `updatePaletteLayout`, `incrementExportCount`, `deletePalette` (todas `jest.fn` con la misma firma que `@/lib/db/palettes`), más `peekPalette(id): Palette | undefined`, `seedPalette(p: Palette): void` y `resetFakePaletteDb(): void`.

- [ ] **Step 1: Crear `test/fakePaletteDb.ts`**

```ts
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor, LayoutConfig, Palette, PaletteMeta } from '@/types/palette';

// Filas como JSON, igual que SQLite: un `Palette` que entra y sale pierde referencias
// y funciones, así que los tests detectan estado que "solo vive en memoria".
const rows = new Map<string, string>();
let counter = 0;

export function resetFakePaletteDb(): void {
  rows.clear();
  counter = 0;
}

export function peekPalette(id: string): Palette | undefined {
  const raw = rows.get(id);
  return raw ? (JSON.parse(raw) as Palette) : undefined;
}

export function seedPalette(palette: Palette): void {
  rows.set(palette.id, JSON.stringify(palette));
}

function update(id: string, change: (p: Palette) => void): void {
  const palette = peekPalette(id);
  if (!palette) return;
  change(palette);
  seedPalette(palette);
}

interface SaveParams {
  imageUri: string;
  thumbnailUri: string;
  colors: ExtractedColor[];
  layoutConfig: LayoutConfig;
  meta: PaletteMeta;
}

export const savePalette = jest.fn(async (params: SaveParams): Promise<Palette> => {
  counter += 1;
  const id = `P${String(counter).padStart(3, '0')}`;
  const now = Date.now();
  const palette: Palette = {
    id,
    imageUri: `file:///documents/palettes/${id}/full.jpg`,
    thumbnailUri: `file:///documents/palettes/${id}/thumb.jpg`,
    colors: params.colors,
    layoutConfig: params.layoutConfig,
    collectionId: null,
    meta: params.meta,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    exportCount: 0,
  };
  seedPalette(palette);
  return JSON.parse(JSON.stringify(palette)) as Palette;
});

export const getPalette = jest.fn(async (id: string): Promise<Palette | null> => {
  const palette = peekPalette(id);
  if (!palette) return null;
  return { ...palette, layoutConfig: { ...DEFAULT_LAYOUT_CONFIG, ...palette.layoutConfig } };
});

export const listPalettes = jest.fn(async (): Promise<Palette[]> =>
  [...rows.values()].map((raw) => JSON.parse(raw) as Palette)
);

export const updatePaletteColors = jest.fn(async (id: string, colors: ExtractedColor[]) => {
  update(id, (p) => { p.colors = colors; });
});

export const updatePaletteLayout = jest.fn(async (id: string, config: LayoutConfig) => {
  update(id, (p) => { p.layoutConfig = config; });
});

export const incrementExportCount = jest.fn(async (id: string) => {
  update(id, (p) => { p.exportCount += 1; });
});

export const deletePalette = jest.fn(async (id: string) => {
  rows.delete(id);
});
```

- [ ] **Step 2: Escribir `captureToExport.test.tsx`**

```tsx
import { drawAsImage, matchFont } from '@shopify/react-native-skia';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';

import { processCapture } from '@/lib/capture/processCapture';
import { trackEvent } from '@/lib/analytics/events';
import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors } from '@test/factories';
import { peekPalette, resetFakePaletteDb } from '@test/fakePaletteDb';
import { resetRouterMocks, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => require('@test/fakePaletteDb'));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/utils/image', () => ({
  optimize: jest.fn((uri: string) => Promise.resolve(uri)),
  thumbnail: jest.fn((uri: string) => Promise.resolve(uri)),
}));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn((_uri: string, n = 5) => Promise.resolve(makeColors(n))),
}));

const media = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  useSettingsStore.setState({
    subscriptionStatus: 'free', exportDailyCount: 0, exportDailyResetDate: new Date().toISOString().slice(0, 10),
  });
});

afterEach(() => jest.useRealTimers());

describe('from capture to a saved export', () => {
  it('turns a photo into a palette, edits it, persists the edit and exports it', async () => {
    // 1) captura → palette guardada sin colores y con el layout por defecto
    const captured = await processCapture('file:///tmp/photo.jpg', 'gallery');
    expect(peekPalette(captured.id)).toMatchObject({
      colors: [],
      layoutConfig: { archetypeId: 'strip' },
      meta: { source: 'gallery' },
    });

    // 2) el editor abre la paleta y extrae los colores en segundo plano
    searchParamsMock.mockReturnValue({ id: captured.id });
    render(<PaletteScreen />);
    await screen.findByText('Exportar');
    await waitFor(() => expect(peekPalette(captured.id)!.colors).toHaveLength(5));

    // 3) el usuario elige Cuadrícula; tras el debounce queda guardado
    fireEvent.press(screen.getByText('Cuadrícula'));
    await advance(500);
    expect(peekPalette(captured.id)!.layoutConfig.archetypeId).toBe('grid');

    // 4) exporta a 1×
    fireEvent.press(screen.getByText('Exportar'));
    fireEvent.press(await screen.findByText('1×'));

    await waitFor(() => expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1));
    expect(media.saveToLibraryAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/hued-export-\d+\.png$/));
    expect(peekPalette(captured.id)!.exportCount).toBe(1);
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);

    // 5) la analítica cuenta la historia completa, en orden
    const events = (trackEvent as jest.Mock).mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining(['capture_completed', 'archetype_selected', 'palette_exported', 'palette_shared'])
    );
    expect(events.indexOf('capture_completed')).toBeLessThan(events.indexOf('archetype_selected'));
    expect(events.indexOf('archetype_selected')).toBeLessThan(events.indexOf('palette_exported'));
    expect(trackEvent).toHaveBeenCalledWith('palette_exported', {
      palette_id: captured.id, resolution: '1x', archetype_id: 'grid',
    });
  });

  it('exports what is on screen even before the debounced save has reached the database', async () => {
    const captured = await processCapture('file:///tmp/photo.jpg', 'camera');
    searchParamsMock.mockReturnValue({ id: captured.id });
    render(<PaletteScreen />);
    await screen.findByText('Exportar');
    await waitFor(() => expect(peekPalette(captured.id)!.colors).toHaveLength(5));

    fireEvent.press(screen.getByText('Tipografía'));
    fireEvent.press(screen.getByText('Clásica')); // serif; todavía sin guardar (debounce de 500 ms)
    fireEvent.press(screen.getByText('Exportar'));
    fireEvent.press(await screen.findByText('1×'));
    await waitFor(() => expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1));

    // el export dibuja con la tipografía nueva…
    (matchFont as jest.Mock).mockClear();
    const exported = render((drawAsImage as jest.Mock).mock.calls.at(-1)![0]);
    expect(matchFont).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: expect.stringMatching(/^(Georgia|serif)$/) })
    );
    exported.unmount();

    // …aunque la base de datos aún no la tiene; llega después
    expect(peekPalette(captured.id)!.layoutConfig.fontFamily).toBe('sans');
    await advance(500);
    expect(peekPalette(captured.id)!.layoutConfig.fontFamily).toBe('serif');
  });
});
```

- [ ] **Step 3: Escribir `exportGate.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';

import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors, makePalette } from '@test/factories';
import { peekPalette, resetFakePaletteDb, seedPalette } from '@test/fakePaletteDb';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => require('@test/fakePaletteDb'));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));

const media = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const today = () => new Date().toISOString().slice(0, 10);

async function openEditor() {
  seedPalette(makePalette({ id: 'p1', colors: makeColors(5) }));
  searchParamsMock.mockReturnValue({ id: 'p1' });
  render(<PaletteScreen />);
  await screen.findByText('Exportar');
}

async function exportOnce() {
  fireEvent.press(screen.getByText('Exportar'));
  fireEvent.press(await screen.findByText('1×'));
}

beforeEach(() => {
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free', exportDailyCount: 0, exportDailyResetDate: today() });
});

describe('free-tier export gate across several exports', () => {
  it('allows three exports a day and sends the fourth to the paywall', async () => {
    await openEditor();

    for (let i = 1; i <= 3; i++) {
      await exportOnce();
      await waitFor(() => expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(i));
      await waitFor(() => expect(screen.queryByText('Exportar paleta')).toBeNull());
    }
    expect(peekPalette('p1')!.exportCount).toBe(3);
    expect(routerMock.push).not.toHaveBeenCalled();

    await exportOnce();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'export_limit' } })
    );
    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(3);
    expect(peekPalette('p1')!.exportCount).toBe(3);
  });

  it('lets the same user export again after upgrading to premium', async () => {
    await openEditor();
    useSettingsStore.setState({ exportDailyCount: 3 });
    await exportOnce();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledTimes(1));

    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    await exportOnce();

    await waitFor(() => expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1));
  });

  it('gives the allowance back on the next day (regression: the counter used to stay at 3 forever)', async () => {
    await openEditor();
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: '2000-01-01' });

    await exportOnce();

    await waitFor(() => expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1));
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
    expect(useSettingsStore.getState().exportDailyResetDate).toBe(today());
  });

  it('does not spend the allowance when the photo permission is denied', async () => {
    media.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await openEditor();

    await exportOnce();
    await screen.findByText('Activa el permiso de fotos en Ajustes del dispositivo.');

    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
    expect(peekPalette('p1')!.exportCount).toBe(0);
  });
});
```

- [ ] **Step 4: Escribir `persistence.test.tsx`**

```tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { generateScatterLayout } from '@/components/compose/archetypes/freeformLayout';
import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors, makePalette } from '@test/factories';
import { peekPalette, resetFakePaletteDb, seedPalette } from '@test/fakePaletteDb';
import { resetRouterMocks, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => require('@test/fakePaletteDb'));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn((_uri: string, n = 5) => Promise.resolve(makeColors(n))),
}));

const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

async function open() {
  searchParamsMock.mockReturnValue({ id: 'p1' });
  const view = render(<PaletteScreen />);
  await screen.findByText('Exportar');
  return view;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
  seedPalette(makePalette({ id: 'p1', colors: makeColors(5) }));
});

afterEach(() => jest.useRealTimers());

describe('what the editor saves is what it loads next time', () => {
  it('keeps the Libre archetype and its generated layout after closing and reopening', async () => {
    const first = await open();
    fireEvent.press(screen.getByText('Libre'));
    await advance(500);
    first.unmount();

    await open();

    expect(screen.getByText('Restablecer layout')).toBeOnTheScreen(); // Libre sigue activo
    expect(peekPalette('p1')!.layoutConfig.freeformSwatches).toEqual(generateScatterLayout(5, 360, 450));
  });

  it('saves a pending edit when the editor is closed within the debounce window', async () => {
    const first = await open();
    fireEvent.press(screen.getByText('Tipografía'));
    fireEvent.press(screen.getByText('Técnica'));

    first.unmount(); // sin esperar 500 ms

    expect(peekPalette('p1')!.layoutConfig.fontFamily).toBe('mono');
  });

  it('remembers the chosen palette size and regenerates the Libre swatches for it (ADR-0001)', async () => {
    seedPalette(
      makePalette({
        id: 'p1',
        colors: makeColors(5),
        layoutConfig: { ...makePalette().layoutConfig, archetypeId: 'libre', freeformSwatches: generateScatterLayout(5, 360, 450) },
      })
    );
    const first = await open();

    fireEvent.press(screen.getByText('Colores'));
    fireEvent.press(screen.getByText('8'));
    await waitFor(() => expect(peekPalette('p1')!.colors).toHaveLength(8));
    await advance(500);
    first.unmount();

    await open();

    const saved = peekPalette('p1')!;
    expect(saved.layoutConfig.paletteSize).toBe(8);
    expect(saved.colors).toHaveLength(8);
    expect(saved.layoutConfig.freeformSwatches).toEqual(generateScatterLayout(8, 360, 450)); // reiniciado a [] y resembrado por el efecto de Libre
    fireEvent.press(screen.getByText('Colores'));
    expect(screen.getByText('8 colores')).toBeOnTheScreen();
  });

  it('opens a palette saved before paletteSize existed with the default of 5', async () => {
    const legacy = makePalette({ id: 'p1', colors: makeColors(5) });
    const oldLayout: Record<string, unknown> = { ...legacy.layoutConfig };
    delete oldLayout.paletteSize;
    delete oldLayout.freeformSwatches;
    seedPalette({ ...legacy, layoutConfig: oldLayout as never });

    await open();
    fireEvent.press(screen.getByText('Colores'));

    expect(screen.getByText('5 colores')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 5: Escribir `consent.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Switch } from 'react-native';

import { AnalyticsConsentSheet } from '@/components/AnalyticsConsentSheet';
import { useSettingsStore } from '@/lib/store/settingsStore';
import SettingsScreen from '@app/(tabs)/settings';
import { resetRouterMocks } from '@test/router';

interface FakePosthog {
  optedOut: boolean;
  optIn: jest.Mock;
  optOut: jest.Mock;
  ready: jest.Mock;
  capture: jest.Mock;
}

let mockPosthog: FakePosthog | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));

// PostHog real: opt-in apagado hasta que se acepta; optIn/optOut cambian `optedOut`.
function makePosthog(): FakePosthog {
  const ph: FakePosthog = {
    optedOut: true,
    optIn: jest.fn(() => { ph.optedOut = false; }),
    optOut: jest.fn(() => { ph.optedOut = true; }),
    ready: jest.fn(() => Promise.resolve()),
    capture: jest.fn(),
  };
  return ph;
}

const TITLE = '¿Nos ayudas a mejorar Hued?';
const persisted = () => JSON.parse(globalThis.__HUED_MMKV__!.get('settings')!).state;

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  mockPosthog = makePosthog();
  useSettingsStore.setState({ analyticsPromptShown: false });
});

describe('analytics consent, end to end', () => {
  it('asks once, and accepting turns analytics on everywhere', async () => {
    const first = render(<AnalyticsConsentSheet />);
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(mockPosthog!.optedOut).toBe(true); // nada se captura antes de aceptar

    fireEvent.press(screen.getByText('Aceptar'));

    expect(mockPosthog!.optedOut).toBe(false);
    expect(persisted().analyticsPromptShown).toBe(true); // se restaurará en el próximo arranque
    first.unmount();

    // la pantalla de Ajustes (que se monta después) refleja la elección
    render(<SettingsScreen />);
    await waitFor(() => expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true));
  });

  it('declining keeps analytics off and the switch off', async () => {
    render(<AnalyticsConsentSheet />);

    fireEvent.press(screen.getByText('No, gracias'));

    expect(mockPosthog!.optedOut).toBe(true);
    expect(persisted().analyticsPromptShown).toBe(true);
    render(<SettingsScreen />);
    await waitFor(() => expect(mockPosthog!.ready).toHaveBeenCalled());
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('can be changed later from Settings without asking again', async () => {
    render(<AnalyticsConsentSheet />);
    fireEvent.press(screen.getByText('No, gracias'));
    render(<SettingsScreen />);
    await waitFor(() => expect(mockPosthog!.ready).toHaveBeenCalled());

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);

    expect(mockPosthog!.optedOut).toBe(false);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('never asks when analytics is not configured', () => {
    mockPosthog = null;

    render(<AnalyticsConsentSheet />);

    expect(screen.queryByText(TITLE)).toBeNull();
    expect(persisted().analyticsPromptShown).toBe(false);
  });
});
```

Nota: `persisted()` lee la clave `settings` de la memoria MMKV simulada (`createJSONStorage` guarda `{ state, version }`). Si el último test falla porque `get('settings')` es `undefined` (nada se ha escrito aún), sustituir su última línea por `expect(useSettingsStore.getState().analyticsPromptShown).toBe(false)`.

- [ ] **Step 6: Ejecutar**

```powershell
pnpm jest test/__tests__/integration
```

Expected: PASS. Si el primer test de `captureToExport` falla en el paso 4, imprimir `media.saveToLibraryAsync.mock.calls` y `(exportPalette as jest.Mock)`; con los módulos reales `exportPalette` usa el mock de Skia (`drawAsImage` devuelve `base64-png`) y escribe en `file:///cache/…`.

- [ ] **Step 7: Commit**

```powershell
git add test/fakePaletteDb.ts test/__tests__/integration
git commit -m "test(integration): cover capture→edit→export, export gate, persistence and consent flows"
```

---

## Fase F — Informe, cobertura y cierre

### Task 19: Línea base de cobertura, umbrales y `HALLAZGOS.md`

**Files:**
- Create: `docs/testing/HALLAZGOS.md`
- Modify: `package.json` (`coverageThreshold`), `CLAUDE.md` (sección Testing)

**Interfaces:**
- Consumes: la suite completa. `pnpm test:coverage` imprime una tabla por carpeta.

- [ ] **Step 1: Ejecutar la suite completa y la cobertura**

```powershell
pnpm test
pnpm test:coverage 2>&1 | Select-Object -Last 90
```

Expected: toda la suite en verde (los `it.failing` cuentan como pasados). En la tabla final, anotar `% Stmts`, `% Branch`, `% Funcs` y `% Lines` de `All files` y de las carpetas `src/lib`, `src/components` y `app`.

- [ ] **Step 2: Comprobar que ningún `it.failing` "arregla" un bug por accidente**

```powershell
pnpm jest 2>&1 | Select-String -Pattern "supposed to fail|FAIL "
```

Expected: sin salida. Si aparece "Failing test passed even though it was supposed to fail", ese hallazgo ya no existe: convertirlo en `it` normal y marcarlo como corregido en `HALLAZGOS.md`.

- [ ] **Step 3: Fijar los umbrales de cobertura**

En `package.json`, dentro de `"jest"`, añadir (los objetivos son los del spec; **si una carpeta mide menos, poner `floor(medido) - 1` en vez del objetivo** y anotar la diferencia en la sección "Cobertura" de `HALLAZGOS.md`):

```json
    "coverageThreshold": {
      "./src/lib/": { "lines": 90, "statements": 90, "functions": 85, "branches": 80 },
      "./src/components/": { "lines": 75, "statements": 75, "functions": 70, "branches": 65 },
      "./app/": { "lines": 60, "statements": 60, "functions": 55, "branches": 50 }
    }
```

Ejecutar de nuevo `pnpm test:coverage` y comprobar que termina con código 0.

- [ ] **Step 4: Escribir `docs/testing/HALLAZGOS.md`**

```markdown
# Hallazgos de la suite de tests

Fecha: 2026-10-04 · Suite: `pnpm test` / `pnpm test:ci` · Cada hallazgo está fijado con un `it.failing` que referencia su ID.
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
- **Impacto:** con 8 colores, Franja dibuja hasta x = 504 en un lienzo de 360 (muestras recortadas); con 3, el 40 % de la franja queda vacío. Se ve en pantalla y en el PNG exportado.
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
- **Evidencia:** `palette.test.tsx › leaves the spinner when the database fails`; `index.test.tsx › leaves the spinner…`.
- **Sugerencia:** `finally { setLoading(false) }` y un estado de error con botón "Reintentar".

### H-02 — Ruta `onboarding` inexistente · Media
- **Qué pasa:** `app/_layout.tsx` declara `<Stack.Screen name="onboarding" … />`; no hay `app/onboarding.tsx`.
- **Impacto:** expo-router avisa de la ruta inexistente; el onboarding previsto (y el momento natural para pedir el consentimiento) no existe.
- **Evidencia:** `layouts.test.tsx › every registered Stack.Screen has a route file`.
- **Sugerencia:** crear la pantalla o quitar el registro hasta entonces.

### H-09 — Closures obsoletos en los controles deslizantes · Media
- **Qué pasa:** `useRef(PanResponder.create({...}))` evalúa `create` en cada render pero conserva el primero; sus handlers capturan el `onChange` y el `disabled` de ese render.
- **Causa (fijada por los tests):** tras un cambio de props, el arrastre sigue llamando al `onChange` antiguo y respetando el `disabled` antiguo.
- **Impacto probable (deducido del código; los tests solo fijan la causa):** en `PaletteSizeControl`, el padre (`handlePaletteSizeChange`) depende de `palette`; tras la primera extracción, arrastrar de nuevo llama a la versión antigua, cuyo `palette.colors.length` obsoleto puede tratar como "sin cambios" un tamaño legítimo (p. ej. volver a 5 tras pasar a 3), dejando el control mostrando un valor que la paleta no tiene. `CornerControl` tiene el mismo patrón (latente hoy).
- **Evidencia:** 3 `it.failing` con ID H-09.
- **Sugerencia:** guardar `onChange`/`disabled` en refs actualizados en cada render, o crear el responder con `useMemo` dependiente de ellos.

### H-05 — Contraste insuficiente · Baja
- `Colors.textTertiary` (#8A6F5C) sobre `bgPrimary` (#FDDCA9) = 3,55:1 ("Añadir nombre" en Ajustes); `Colors.error` (#DC2626) sobre `bgPrimary` = 3,68:1 (mensajes de error). Ambos < 4,5:1.
- **Sugerencia:** oscurecer `brown500` y `error500` para texto, o usar `brown700`/un rojo más oscuro en esos casos.

### H-06 — Reinicio del contador a medianoche UTC · Baja
- `settingsStore.todayString()` usa `toISOString()`. En España (UTC+1/+2) el contador se reinicia a la 01:00–02:00 locales, no a medianoche.
- **Sugerencia:** construir la fecha local (`getFullYear/getMonth/getDate`).

### H-01 — `Button` ignora `style` · Baja
- `style` se extrae de las props y nunca se aplica; hoy ningún llamador lo pasa, pero la API lo admite (`PressableProps`).

## Observaciones sin test (para decidir)

- `ArchetypeId` se declara en tres sitios (`@/types/palette`, `settingsStore.ts`, `analytics/events.ts` con `string`).
- `EditTabs` pasa `onLockedPress` con el mismo disparador (`watermark_tap`) para opciones premium bloqueadas; hoy ninguna lo está (`premium` sin usar), pero la analítica las atribuiría mal.
- `CropTab` decide la rama web con una constante de módulo (`process.env.EXPO_OS`): no se puede probar sin recargar el módulo.

## Límites de la suite (qué NO valida)

- **Píxeles reales:** Skia está mockeado; los arquetipos se verifican por geometría y textos del árbol, no por render.
- **Cámara, permisos de Android y rendimiento** (extracción < 800 ms, export < 2 s): hacen falta dispositivo y la lista manual de `SEGURIDAD-20260918.md`.
- **Módulos nativos** (SQLite real, MMKV, RevenueCat, PostHog): se simulan; la integración con SQLite se cubre con una base en memoria que serializa a JSON.
- **Gestos reales:** se prueban llamando a los handlers de `PanResponder`, no con toques.
- **Rama web de `CropTab`** (constante de módulo).
- **E2E en dispositivo** (Maestro/Detox): fuera de alcance; siguiente paso natural.
```

- [ ] **Step 5: Documentar la suite en `CLAUDE.md`**

Antes de la sección `## Files NOT to touch unless asked`, insertar:

```markdown
## Testing

- `pnpm test` (rápido), `pnpm test:coverage` (con umbrales), `pnpm test:ci` (typecheck + cobertura).
- Jest + `jest-expo` + `@testing-library/react-native` v13. Zona horaria fija `Europe/Madrid` (`test/globalSetup.js`).
- `test/setup.ts` mockea Skia (como *host elements* `Sk*`), MMKV, SQLite, sistema de archivos, RevenueCat, PostHog, Sentry y `expo-router`. Un test puede sobrescribir cualquier mock con su propio `jest.mock`.
- Helpers en `test/`: `factories`, `skiaTree` (`findAll`, `findTexts`, `treeSignature`), `router`, `panResponder`, `fakePaletteDb`. Alias `@test/*` y `@app/*`.
- Tests junto al módulo en `__tests__/`. **Excepción:** pantallas de `app/` e integración van en `test/__tests__/` (nunca dentro de `app/`: expo-router lo trataría como ruta).
- Los bugs conocidos se fijan con `it.failing('… (H-xx)')`; el catálogo está en `docs/testing/HALLAZGOS.md`. Si un `it.failing` falla con "expected to fail but passed", el bug está corregido: pasarlo a `it`.
- Invariante: preview y export dibujan el mismo árbol (`exportPalette.parity.test.tsx`). Cualquier archetype nuevo entra en esa tabla automáticamente.
```

- [ ] **Step 6: Añadir la sección "Cobertura" con los números medidos y ejecutar la verificación final**

Insertar en `HALLAZGOS.md`, justo antes de "## Límites de la suite", una sección con la tabla medida en el Step 1 y los umbrales finales del Step 3 (formato exacto):

```markdown
## Cobertura (medida el 2026-10-04)

| Carpeta | Líneas | Funciones | Ramas | Umbral de líneas |
|---|---|---|---|---|
| src/lib | <medido> % | <medido> % | <medido> % | <umbral> % |
| src/components | <medido> % | <medido> % | <medido> % | <umbral> % |
| app | <medido> % | <medido> % | <medido> % | <umbral> % |
| Total | <medido> % | <medido> % | <medido> % | — |
```

(`<medido>` y `<umbral>` se sustituyen por los números reales; si algún umbral quedó por debajo del objetivo del spec, añadir debajo una línea con la carpeta y el motivo.) Después:

```powershell
Select-String -Path docs\testing\HALLAZGOS.md -Pattern '<medido>|<umbral>'
pnpm test:ci
```

Expected: el primer comando no devuelve nada (no quedan marcadores); `pnpm test:ci` termina con código 0 (typecheck limpio, suite en verde, umbrales cumplidos).

- [ ] **Step 7: Commit final**

```powershell
git add package.json CLAUDE.md docs/testing/HALLAZGOS.md
git commit -m "test: set coverage thresholds, document the suite and record findings H-01..H-09"
```

