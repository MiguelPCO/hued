# Seguridad y legal — 18-09-2026

## Bloque 🟠 — 18-09-2026

**Qué estaba mal → qué se hizo**
- **Permisos Android.** `app.json` pedía micrófono, vídeo, audio y almacenamiento sin necesitarlos. Ahora `android.permissions` solo lleva `CAMERA`, y `blockedPermissions` quita `RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO` y `READ_MEDIA_VISUAL_USER_SELECTED` aunque una librería los vuelva a meter.
  - expo-camera: `recordAudioAndroid: false` y `microphonePermission: false`. expo-image-picker también añadía `RECORD_AUDIO`: `microphonePermission: false`. iOS ya no pide micrófono.
  - `READ_MEDIA_IMAGES` fuera. La galería se abre con expo-image-picker, que usa el selector de fotos del sistema y en Android 13+ no pide nada. image-crop-picker solo recorta (`openCropper`) y no lee la galería. El único que lo pedía era el guardado del export (`MediaLibrary.requestPermissionsAsync()`), que ahora es `requestPermissionsAsync(true)` (solo escritura) en `app/palette/[id].tsx`. En iOS eso pide «solo añadir fotos», no acceso a toda la fototeca. Por eso `granularPermissions: []` en expo-media-library, en vez de `["photo"]`.
  - `READ/WRITE_EXTERNAL_STORAGE` **no** se bloquean: en Android 12 o menor `saveToLibraryAsync` exige `WRITE_EXTERNAL_STORAGE` concedido, y image-crop-picker lo pide en Android 10 o menor. Bloquearlos rompía el export en esos móviles. `plugins/withLegacyStorageMaxSdk.js` les pone `maxSdkVersion="32"`, como ya hacen las propias librerías: en Android 13+ no existen.
- **`ios.bundleIdentifier`**: `com.migueldev.hued`, igual que `android.package`.
- **Consentimiento de PostHog.** `defaultOptIn: false`: no captura nada hasta que el usuario activa «Estadísticas de uso» en Ajustes. `optIn()`/`optOut()` guardan la elección. Además `preloadFeatureFlags: false`, `disableRemoteConfig: true` y `disableSurveys: true`: `optOut` no frena esas peticiones y la de flags manda el id del dispositivo. La app no usa ninguna de las tres. `legal/privacidad.md` dice ya que viene desactivada y dónde se cambia. Sentry sigue igual (sin PII ni replay) y ya estaba en la política.
- **Ajustes**: interruptor «Estadísticas de uso» (solo si hay clave de PostHog) y enlace «Política de privacidad» (Apple 5.1.1). `TERMS_URL` y `PRIVACY_URL` pasan de `app/paywall.tsx` a `src/lib/legal.ts`.
- **`pnpm audit`**: de 51 (1 crítica, 40 altas, 9 moderadas, 1 baja) a 16 (0 críticas, 12 altas, 3 moderadas, 1 baja). `npx expo install --fix` subió 18 paquetes de Expo de parche (57.0.x, ningún major) y añadió `expo-font` y `expo-sharing` a `plugins` (sin opciones no hacen nada). Por sí solo no bajó el recuento. Lo bajan los `pnpm.overrides` de `shell-quote`, `@xmldom/xmldom`, `ws` y `js-yaml`, todos dentro de su mismo major y todos de herramientas de desarrollo/build.
- **Token de Sentry**: bien. `android/sentry.properties` (ignorado por git) lee `SENTRY_AUTH_TOKEN` del entorno. No está en `eas.json`, ni en `app.json`, ni en el historial, y nada usa `EXPO_PUBLIC_SENTRY_AUTH_TOKEN`.

**Permisos resultantes** (`npx expo config --type introspect`, manifest antes del merge de Gradle): `CAMERA`, `INTERNET`, `VIBRATE`, `SYSTEM_ALERT_WINDOW` (plantilla de Expo), `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE` con `maxSdkVersion="32"`, y los cinco bloqueados con `tools:node="remove"`. Las librerías añaden al compilar sus permisos normales (red, facturación).

**Qué probar** (hace falta un build nuevo: cambian el manifest y los módulos nativos)
1. `npx expo prebuild --clean -p android` y un build de desarrollo nuevo. Mirar `android/app/build/intermediates/merged_manifest/*/AndroidManifest.xml`: sin `RECORD_AUDIO` ni `READ_MEDIA_*`.
2. Exportar una paleta en Android 13+ (no debe salir ningún diálogo de permiso) y, si puedes, en Android 12 o menor (sale «fotos y multimedia» una vez).
3. Elegir foto de la galería y recortar: sin diálogo en Android 13+.
4. Ajustes → «Estadísticas de uso» apagado de serie; al activarlo llegan eventos a PostHog; tras cerrar y abrir la app sigue igual.
5. iOS: exportar pide «añadir fotos», no acceso completo.

**Pendiente**
- Pedir el consentimiento también en el primer arranque (onboarding). Con solo el interruptor, casi nadie activará la analítica.
- `pnpm audit`: quedan `brace-expansion` (9), `browserslist` (2), `form-data`, `@babel/core` y `baseline-browser-mapping`, de desarrollo y con parche dentro del mismo major (otro override si quieres). `uuid` 7→11 y `decode-uri-component` 0.2→0.5 cambian de major; el segundo sí va en el bundle (expo-router → query-string); hay que esperar a que expo-router lo suba.
- `SYSTEM_ALERT_WINDOW` sale de la plantilla de Expo (el menú de desarrollo). Si Play pregunta, se puede bloquear en release.

**Qué tienes que hacer a mano**
- Guardar `SENTRY_AUTH_TOKEN` como secreto de EAS (`eas env:create --visibility secret`), nunca con prefijo `EXPO_PUBLIC_`. Revisa que tu `.env.local` no lo tenga con ese prefijo.
- Registrar `com.migueldev.hued` en Apple Developer / App Store Connect antes del primer build de iOS.
- En Google Play (Data Safety) y App Store (App Privacy): analítica opcional con consentimiento; sin acceso a fotos (solo escribir) ni micrófono.

## Legal y CAPTCHA

**Qué se hizo**
- `legal/privacidad.md` y `legal/aviso-legal.md`. Proveedores: RevenueCat, PostHog (UE), Sentry, y Apple/Google como tiendas. Sin cuentas ni servidor: fotos, paletas y perfil solo en el dispositivo.
- `app/paywall.tsx`: dos enlaces bajo «Restaurar compras». «Condiciones de uso» abre la EULA estándar de Apple y «Política de privacidad» abre `PRIVACY_URL` (Apple 3.1.2). `TERMS_URL` y `PRIVACY_URL` viven ahora en `src/lib/legal.ts` (Bloque 🟠).
- CAPTCHA: no aplica. No hay cuentas ni formularios de login.

**Qué tienes que hacer a mano**
1. Rellenar los `[RELLENAR]` de `legal/*.md`: apellidos, NIF, domicilio y región del proyecto de Sentry (mírala en la DSN o en Settings del proyecto).
2. Publicar `legal/privacidad.md` en una URL pública (por ejemplo, GitHub Pages) y ponerla en `PRIVACY_URL`. Mientras siga el `[RELLENAR`, el enlace se ve pero no abre nada.
3. Poner esa misma URL en App Store Connect (App Privacy) y en Google Play (Data Safety), y rellenar los dos formularios con lo que dice la política.
4. Si usas EULA propia en vez de la de Apple, cambia `TERMS_URL` y súbela también en App Store Connect.

**Pendiente**
- **Consentimiento de PostHog** (hecho en el Bloque 🟠). Se inicia sin preguntar (`src/lib/analytics/posthog.ts`), guarda un identificador del dispositivo entre sesiones (`persistence: 'file'`, el valor por defecto) y captura pantallas y eventos de ciclo de vida (valores por defecto de `PostHogProvider`). En la UE eso necesita consentimiento previo (art. 22.2 LSSI). No hay grabación de sesión (`enableSessionReplay` está en `false` por defecto) ni captura de toques. La política ya dice que la base es el consentimiento, pero falta pedirlo. Opciones: un opt-in en el primer arranque y en Ajustes con `posthog.optIn()`/`optOut()` y `defaultOptIn: false`, o `persistence: 'memory'` para que no quede identificador (pierdes usuarios únicos entre sesiones).
- **Enlace a la política en Ajustes** (hecho en el Bloque 🟠). Apple 5.1.1(i) pide que la política sea fácil de encontrar dentro de la app, no solo en el paywall. Añadir el mismo enlace en `app/(tabs)/settings.tsx`.
- **Sentry**: `tracesSampleRate: 0.2`, sin replay y sin `sendDefaultPii`. Está bien así; no lo actives sin actualizar la política.
- Borrado de cuenta: no aplica, la app no tiene cuentas.

## Permisos Android (revisión previa; resuelto en el Bloque 🟠)

`app.json` sigue pidiendo los permisos que marcó la auditoría (`seguridad/auditoria-proyectos.md`, sección hued):

- Sobran: `RECORD_AUDIO`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`.
- Revisar: `READ_MEDIA_IMAGES`. El photo picker no lo necesita; comprobar si `react-native-image-crop-picker` sí.
- Siguen igual: expo-camera sin `recordAudioAndroid: false` ni `microphonePermission: false` (iOS pedirá micrófono), expo-media-library sin `granularPermissions: ["photo"]`, sin `blockedPermissions` y sin `ios.bundleIdentifier`.

Google Play rechaza permisos que no se justifican en la ficha, y cada uno añade trabajo al formulario de Data Safety.

## Comprobaciones

- `pnpm typecheck`: OK.
- `pnpm test`: 19 suites, 140 tests OK.
- `pnpm lint`: falla con 19 errores de `react-hooks/*`, todos en archivos que no se han tocado (`Sheet.tsx`, `CornerControl.tsx`, `PaletteSizeControl.tsx`, `LibreEditOverlay.tsx`, `app/(tabs)/index.tsx`). Ya estaban antes. `eslint app/paywall.tsx` pasa limpio.
