# Research: ¿onboarding en Hued y qué falta en Ajustes?

Fecha: 2026-10-09 · Rama: `feat/sample-palettes` (HEAD `17509ca`) · Solo lectura: no se tocó código.
Ubicación: `docs/superpowers/research/` ya existía (convención `YYYY-MM-DD-tema.md`, como `2026-09-09-libre-archetype-drag-resize.md`); no se creó carpeta nueva.

## Resumen

1. **Onboarding de carrusel: no.** Las fuentes de Apple y Material piden "rápido y opcional" y aprender usando la app; Hued tiene un solo gesto principal y ya tiene estado vacío con dos botones (Cámara / Galería).
2. **Sí, una versión mínima:** mejorar el estado vacío del inicio con 3 líneas "cómo funciona" (1 archivo, ~20 líneas). El sheet de consentimiento de analítica se queda donde está.
3. **Si más adelante hace falta algo más:** una sola pantalla de bienvenida omitible (opción B). El carrusel de 3 slides del PRD (opción C) queda el último.
4. **Ajustes, lo que sí falta:** URL real de privacidad (H-03, bloqueante de tienda), "Gestionar suscripción" para planes no vitalicios, y "Contacto". Versión y "Restaurar compras" son baratos y útiles.
5. **No añadir:** borrado de cuenta (no hay cuentas), tema/idioma, tamaño de exportación o fuente por defecto, "Valorar" hasta que haya ficha en la tienda.

---

## 1. Estado actual del repo (hechos)

### 1.1 Ajustes hoy (`app/(tabs)/settings.tsx`)
Todo lo que renderiza, en orden:
- Cabecera "Ajustes" con `StripeBar`.
- **Perfil**: avatar (cámara/galería vía `Sheet`) y nombre editable (`Sheet` + `TextInput`, 40 car.). Se guarda en `settingsStore` (`profileName`, `profilePhotoUri`). **Solo `settings.tsx` los lee**: no aparecen en exportaciones ni en otra pantalla.
- **Suscripción**: si `premium`, tarjeta "HUED PRO" con fecha de caducidad (o "De por vida"); si no, botón "Mejorar a Pro" → `/paywall?trigger=settings`.
- **Estadísticas de uso**: `Switch` de PostHog (opt-in/opt-out), solo si hay `EXPO_PUBLIC_POSTHOG_KEY`.
- **Política de privacidad**: fila con `Linking.openURL(PRIVACY_URL)`.
- Nada más: sin versión, sin contacto, sin condiciones de uso, sin restaurar compras, sin gestionar suscripción.

### 1.2 Primer arranque hoy
- `app/_layout.tsx`: carga fuentes (+ typefaces Skia), oculta splash, `trackEvent('app_opened')`, monta `Stack` con `(tabs)`, `palette/[id]` (card) y `paywall` (modal). **No hay ruta `onboarding`** (se quitó por H-02 en `docs/testing/HALLAZGOS.md`; allí se indica registrarla y añadirla a `layouts.test.tsx` cuando exista).
- `<AnalyticsConsentSheet />` va en el layout raíz, fuera del `Stack`: `visible = !!posthog && !analyticsPromptShown`. "Aceptar" → `optIn()`, "No, gracias" o cerrar → `optOut()`; ambos marcan `analyticsPromptShown`. PostHog arranca con `defaultOptIn: false`, así que no se envía nada antes de elegir. Sin clave de PostHog el sheet no sale.
- Commit `a1f7f7b` quitó las paletas de ejemplo: una instalación nueva abre ahora el inicio **vacío**. La rama vacía de `app/(tabs)/index.tsx` ya existe: "Sin paletas todavía" + texto "Captura una foto o elige de tu galería…" + botones Cámara / Galería (y mensajes de galería denegada / captura fallida).
- Permisos en contexto: la cámara se pide en `CameraView` (con rama `canAskAgain`); fotos al exportar (`MediaLibrary.requestPermissionsAsync(true)`, solo escritura); la galería usa el picker. Ninguno se pide al arrancar.

### 1.3 Qué se persiste (`src/lib/store/settingsStore.ts`, zustand + MMKV, clave `settings`)
`onboardingCompleted` (+ `completeOnboarding()`), `analyticsPromptShown`, `lastArchetype`, `defaultFont`, `subscriptionStatus`, `subscriptionExpiresAt`, `installDate`, `exportDailyCount`, `exportDailyResetDate`, `profileName`, `profilePhotoUri`.
- **`onboardingCompleted`/`completeOnboarding` ya existen y nadie los usa**; `events.ts` ya declara `onboarding_completed: { duration_ms }`. Heredado de `SPRINTS.md` ("Sprint 5, Day 3") y `PRD.md` ("Onboarding · 3-slide value prop · P0").
- `lastArchetype` y `defaultFont` no los lee ninguna pantalla (solo el store).
- MMKV es síncrono, así que el flag está disponible en el primer render (el `persist` de zustand hidrata sin esperar cuando el storage es síncrono; verificado en la fuente instalada `node_modules/zustand/esm/middleware.mjs`, `toThenable`; no encontré la frase en la doc de zustand, ver §2.5).

### 1.4 Funciones existentes
Suscripción RevenueCat (mensual / anual / vitalicio, entitlement `hued_pro`, sync al arrancar), paywall con "Restaurar compras", "Condiciones de uso" (`TERMS_URL` = EULA estándar de Apple) y privacidad. Free: 3 exportaciones/día (`exportGate.ts`) y marca de agua forzada. Export PNG 1x/2x/4x, guardar en galería + compartir. Cámara y galería, colecciones y favoritas en el inicio, 5 arquetipos con Libre, 24 layouts base, Sentry, PostHog opt-in. La app es Android-first (`CLAUDE.md`), pero `app.json` ya define `ios.bundleIdentifier`.
- `src/lib/legal.ts`: `PRIVACY_URL = '[RELLENAR: URL pública de legal/privacidad.md]'` → **H-03 abierto** (Ajustes y paywall abren un marcador). `legal/privacidad.md` además conserva `[RELLENAR]` (apellidos, NIF, domicilio, región de Sentry).

### 1.5 Lo ya decidido en docs
- `docs/PRD.md` §5.2: "Onboarding · 3-slide value prop · P0"; §5.4 IA: "Empty state (onboarding CTA)"; Ajustes = Perfil (anónimo), Suscripción, About, Privacy/Terms.
- `docs/SPRINTS.md` Day 3: 3 slides + "Reset onboarding" en Ajustes para pruebas.
- Spec Sprint 6 (`2026-09-07-sprint6-monetization-gating-design.md`): onboarding **fuera de alcance, diferido**. `CLAUDE.md`: "remaining scope (onboarding, Play Store assets, production submission) deferred".
- No hay ADR ni decisión cerrada sobre el *diseño* del onboarding. El P0 del PRD es anterior a los cambios posteriores (estado vacío con CTAs, consentimiento, sin cuentas).

---

## 2. Fuentes primarias

Cada afirmación lleva su URL. "No verificado" = no pude contrastarlo en la fuente primaria.

### 2.1 Onboarding: Apple y Android
- **Apple HIG, Onboarding** (https://developer.apple.com/design/human-interface-guidelines/onboarding): lo ideal es que la gente entienda la app usándola; cuando haga falta, que sea "fast, fun, and optional". Enseñar con interactividad; preferir consejos en contexto a un flujo único; si es obligatorio, breve; un tutorial aparte debe ser opcional y, si se salta, no volver a mostrarlo pero dejarlo fácil de encontrar (ayuda/ajustes); "postpone nonessential setup" con valores por defecto; permisos en contexto salvo que la app los necesite para funcionar; pedir valoraciones/compras más tarde. *Nota de fiabilidad:* la página HTML renderiza por JS y la herramienta de lectura devolvió solo el título; el contenido sale del JSON público de developer.apple.com (`/tutorials/data/design/human-interface-guidelines/onboarding.json`), **resumido por la herramienta, no literal**.
- **Apple HIG, Launching** (https://developer.apple.com/design/human-interface-guidelines/launching): onboarding va después del lanzamiento; restaurar el estado anterior al reiniciar (mismo JSON, mismo aviso).
- **Apple HIG, Privacy → Requesting permission** (https://developer.apple.com/design/human-interface-guidelines/privacy): "Avoid requesting permission at launch unless the data or resource is required for your app to function"; una pantalla previa debe tener un único botón tipo "Continuar", nunca "Permitir". Una pantalla de consentimiento antes o después del alert de ATT está permitida "to comply with local privacy laws". No trata el consentimiento de analítica por separado (mismo aviso del JSON).
- **Material 1 (archivo), Onboarding** (https://m1.material.io/growth-communications/onboarding.html): "Quickstart": el usuario aterriza directo en la UI, "offer education" solo si parece perdido y no "force education upfront"; "Top user benefits": máximo tres ilustraciones, botón "Get Started" siempre visible; "Show onboarding to first-time users. Don't show it to returning users." *Limitación:* es Material 1; no encontré una página equivalente en Material 3, así que no la cito. La lectura de la página fue parcial (la herramienta marcó listas "jumbled").
- **Android, runtime permissions** (https://developer.android.com/training/permissions/requesting): "Ask for a permission in context, when the user starts to interact with the feature that requires it"; cualquier UI educativa debe poder cancelarse; degradar con elegancia si se deniega.
- **Datos de primera mano sobre onboarding omitible vs obligatorio:** **no encontré ninguno** en Apple ni Google (solo principios cualitativos). Cualquier cifra de abandono o conversión sería de terceros; no se cita.

### 2.2 Apple App Store Review Guidelines (https://developer.apple.com/app-store/review/guidelines/)
- **5.1.1(i)**: enlace a la política de privacidad en App Store Connect **y dentro de la app "in an easily accessible manner"**; debe explicar qué datos se recogen, retención/borrado y cómo revocar el consentimiento. → Ajustes lo cumple en estructura, pero el enlace es el marcador de H-03.
- **5.1.1(ii)**: las apps que recogen datos de uso deben obtener consentimiento "even if such data is considered to be anonymous", y dar "an easily accessible and understandable way to withdraw consent". → sheet + switch de Ajustes cumplen. "Paid functionality must not be dependent on" ese acceso: se cumple (rechazar no bloquea nada).
- **5.1.1(v)**: "If your app supports account creation, you must also offer account deletion within the app". → **No aplica**: Hued no tiene cuentas. El perfil (nombre/foto) es local. Si no hay cuentas, "let people use it without a login" ya se cumple.
- **3.1.1**: "you should make sure you have a restore mechanism for any restorable in-app purchases". → ya está en el paywall.
- **3.1.2**: no tiene un subapartado de "restore"; 3.1.2(c) pide describir qué obtiene el usuario por el precio.
- **1.5**: "Make sure your app and its Support URL include an easy way to contact you". → **hoy no hay contacto en la app** (solo en la política). Aplica si se publica en iOS.
- Suscripciones, página de Apple (https://developer.apple.com/app-store/subscriptions/): la app y los metadatos "must include links to your Terms of Use and Privacy Policy"; la pantalla de alta debe mostrar nombre y duración, precio de renovación completo y "A way for current subscribers to sign in or restore purchases"; facilitar "the system-provided management UI where they can cancel" (`showManageSubscriptions(in:)`, API nativa de StoreKit). No pude verificar en esa página la URL `apps.apple.com/account/subscriptions`.
- No verificado: que el EULA estándar de Apple (`TERMS_URL`) sea aceptable como Terms of Use; no leí esa página.

### 2.3 Google Play
- **User Data policy** (https://support.google.com/googleplay/android-developer/answer/10144311): política de privacidad en Play Console y "a privacy policy link or text within the app itself"; divulgación destacada dentro de la app antes del consentimiento; el consentimiento exige acción afirmativa y no vale "navigating away". Data safety debe ser exacta y coherente con la política. *Matiz:* el sheet de Hued trata cerrar sin elegir como rechazo (correcto) y no recoge nada antes.
- **Data safety** (https://support.google.com/googleplay/android-developer/answer/10787469): hay que declarar también lo que recogen SDKs de terceros (RevenueCat, PostHog, Sentry); la pregunta de mecanismo de borrado se cumple con "contact forms, or a dedicated email alias" o con borrado automático en 90 días; la página no exige un borrado in-app a apps sin cuentas.
- **Account deletion** (https://support.google.com/googleplay/android-developer/answer/13327111): aplica a apps que "allow users to create an account". → **No aplica** a Hued.
- **Subscriptions policy** (https://support.google.com/googleplay/android-developer/answer/9900533): antes de comprar hay que declarar con claridad condiciones, coste, frecuencia y renovación automática, sin pasos extra; y "must ensure that your app(s) clearly disclose how a user can manage or cancel their subscription", con "an easy-to-use, online method to cancel" en los ajustes de cuenta o equivalente; vale un enlace al Subscription Center de Play. La política no trata "restore".
- **Play Billing, suscripciones** (https://developer.android.com/google/play/billing/subscriptions): "Your app should include a link on a settings or preferences screen that allows users to manage their subscriptions"; deep link `https://play.google.com/store/account/subscriptions?sku=<productId>&package=<package>` (o sin `sku` para el centro general).
- **Payments policy** (https://support.google.com/googleplay/android-developer/answer/9858738): informar con claridad de términos y precio; el texto de suscripciones está en la política de arriba.
- No verificado: si Play exige un contacto *dentro de la app* (solo vi la exigencia en la ficha, que no leí en la política de Developer Information).

### 2.4 RevenueCat (SDK ya integrado)
- `CustomerInfo.managementURL` = "URL to manage the active subscription of the user"; es `null` sin suscripción activa (https://www.revenuecat.com/docs/customers/customer-info). Recomiendan que toda app tenga alguna vía para `restorePurchases`.

### 2.5 Expo / React Native (docs v57 salvo indicación)
- **Redirect en primer arranque**: `<Redirect href="…" />` devuelto desde un layout anidado, con estado de carga mientras se resuelve (https://docs.expo.dev/router/advanced/authentication-rewrites/). Aviso de la doc: el layout raíz debe montar `Slot`/`Stack` antes de navegar; la lógica condicional va en un layout anidado (aquí `app/(tabs)/_layout.tsx`). Con SDK 57, `Stack.Protected` (https://docs.expo.dev/router/advanced/protected/, página "latest") solo bloquea rutas; la prop `redirectTo` es SDK 58+, así que con SDK 57 se usa `Redirect`.
- **Flag persistido**: ya existe `onboardingCompleted` en el store. Doc de `persist` de zustand (https://zustand.docs.pmnd.rs/reference/middlewares/persist): no encontré en la doc el comportamiento síncrono/asíncrono de hidratación (404 en la ruta alternativa de GitHub); lo confirmé leyendo el código instalado (§1.3).
- **Versión**: `expo-application` → `Application.nativeApplicationVersion` y `nativeBuildVersion` (`string`, `null` en web) (https://docs.expo.dev/versions/v57.0.0/sdk/application/). **Ya está en `package.json`**.
- **Enlaces externos**: `Linking.openURL(url)` (ya se usa) y `Linking.openSettings()` ("Open the operating system settings app and displays the app's custom settings") (https://docs.expo.dev/versions/v57.0.0/sdk/linking/). Un `mailto:` también sirve con `openURL` (la doc cita `tel:` como ejemplo; `mailto:` no lo vi literal).
- **Valoración**: `expo-store-review` (`requestReview`, `isAvailableAsync`, `hasAction`, `storeUrl`) (https://docs.expo.dev/versions/v57.0.0/sdk/storereview/). La doc dice: "Don't call it from a button press", dispararlo tras una acción significativa y limitar la frecuencia. **No está instalado** → dependencia nativa nueva = nuevo build del dev-client.
- **Idioma**: `expo-localization` (`getLocales()`) ya está instalado y en `plugins`. La página v57 **no documenta** idioma por app (Android 13 / iOS), así que no puedo apoyar un selector de idioma en fuente primaria.

---

## 3. Recomendación

### 3.1 Onboarding

**Respuesta: no al carrusel; sí a una versión mínima dentro del estado vacío.**

Por qué (fuentes + hechos):
- Apple: "fast, fun, and optional", aprender usando, pedir cosas más tarde. Material: "Quickstart" sin educación forzada. Hued tiene **un solo flujo** (foto → paleta → exportar) y el estado vacío ya ofrece las dos entradas.
- Los permisos (cámara, fotos) ya se piden en contexto; no hay nada que justifique una pantalla previa (Apple Privacy; Android permissions).
- El carrusel cuesta ilustraciones y mantenimiento, añade un toque en cada primer arranque y retrasa el primer valor.
- El único hueco real es que el inicio vacío no explica qué hace la app más allá de "captura una foto", que es justo lo que se perdió al quitar las paletas de ejemplo.

| # | Opción | Qué es | Esfuerzo (estimación mía) | Pros | Contras |
|---|---|---|---|---|---|
| **A (recomendada)** | Estado vacío mejorado | En la rama vacía de `app/(tabs)/index.tsx`: 3 líneas numeradas ("1 Elige una foto · 2 Hued saca de 3 a 8 colores · 3 Colócalos sobre la foto y exporta en PNG") sobre los botones actuales. Sin ruta nueva, sin flag, sin redirección | 1 archivo + actualizar su test; ~20 líneas | Cero fricción; desaparece solo al crear la primera paleta; encaja con la IA del PRD ("Empty state (onboarding CTA)") | No es un "onboarding" literal; el P0 del PRD queda reinterpretado. Sin imagen de ejemplo (hace falta un asset propio si se quiere) |
| **B** | Bienvenida de 1 pantalla, omitible | `app/onboarding.tsx` (`fullScreenModal`): titular, las mismas 3 líneas, botón "Empezar" y "Saltar"; ambos llaman a `completeOnboarding()` y emiten `onboarding_completed`. Redirección con `<Redirect>` en `app/(tabs)/_layout.tsx` si `!onboardingCompleted` | Ruta nueva + `Redirect` (3 líneas) + registrar `Stack.Screen` + condicionar el sheet de consentimiento a `onboardingCompleted` (2 líneas) + `layouts.test` + test propio (cobertura `app/` ≥ 94 %); ~4 archivos, ~120 líneas | Marca clara "primer arranque"; reutiliza `onboardingCompleted` y el evento ya declarados; deja sitio para el consentimiento | Un toque extra siempre; el sheet de consentimiento taparía la bienvenida si no se condiciona; más superficie de test |
| **C** | Carrusel de 3 slides (PRD / SPRINTS Day 3) | B + 3 ilustraciones, paginador con swipe y puntos, back de Android, animación | B + assets de diseño; ~250 líneas | Cumple el P0 literal | Mayor coste y mantenimiento, choca con "optional/Quickstart", retrasa el primer valor |

**Recomendación única: A.** Reabrir B solo si, con datos reales (los de usuarios que acepten analítica: `capture_started` frente a `app_opened`), se ve que mucha gente no llega a la primera captura. C no compensa.

Qué hacer con lo demás:
- **Sheet de consentimiento**: se queda tal cual en el layout raíz (con A no choca con nada). Cumple Apple 5.1.1(ii) y Play User Data; no recoge nada hasta aceptar. *Retoque opcional, no necesario:* Apple recomienda posponer el "setup" no esencial; se podría mostrar tras crear la primera paleta, a costa de perder los eventos previos de embudo. No lo recomiendo ahora.
- **Inicio vacío**: con A, esa pantalla es el onboarding. No hace falta volver a sembrar paletas de ejemplo (se quitaron a propósito).
- **PRD/SPRINTS**: actualizar la fila "Onboarding · 3-slide · P0" cuando se decida, y borrar `onboardingCompleted`/`onboarding_completed` si se queda en A (hoy son código muerto; decisión del dueño, no lo toco).
- No incluir en Ajustes "Reset onboarding" (lo planeaba SPRINTS.md solo "para pruebas"): con A no hay nada que reiniciar.

### 3.2 Ajustes

Leyenda: **[T]** obligatorio por tienda · **[R]** muy recomendable · **[N]** nice-to-have. Esfuerzos estimados por mí.

**Lo que existe**

| Elemento | Estado | Nota |
|---|---|---|
| Perfil (nombre + foto) | OK | Solo vive en Ajustes; no se usa en ninguna otra parte. Decisión de producto: darle uso o aceptar que es decorativo. Sin riesgo de tienda: es local y no es una "cuenta" |
| Suscripción (Pro / Mejorar a Pro) | OK, incompleta | Falta gestión/cancelación (ver abajo) |
| Estadísticas de uso (switch) | OK | Cumple retirada de consentimiento (Apple 5.1.1(ii)). Solo aparece con clave de PostHog |
| Política de privacidad | **Roto (H-03)** | El enlace abre un marcador |

**Lo que falta o conviene añadir**

| Candidato | Etiqueta | Esfuerzo | Fuente | Detalle |
|---|---|---|---|---|
| Publicar la política y poner la URL real en `PRIVACY_URL` (y rellenar los `[RELLENAR]` de `legal/privacidad.md`) | **[T]** | Sin código: publicar el MD (p. ej. GitHub Pages) + 1 línea | Apple 5.1.1(i); Play User Data | Bloqueante para publicar. Cierra H-03 (`it.failing` → `it`) |
| "Gestionar suscripción" (solo si `premium` con caducidad, es decir mensual/anual; no vitalicio) | **[T]** en Play para apps con suscripción; **[R]** en iOS | ~10 líneas + test; URL de `managementURL` (RevenueCat) o deep link de Play con `sku` + `package=com.migueldev.hued` | Play Subscriptions policy; Play Billing doc; Apple subscriptions | Hoy el usuario solo ve la fecha de renovación; la política pide decir cómo cancelar y la doc de Billing sugiere el enlace en Ajustes |
| "Contacto / soporte" (`mailto:`) | **[R]** (Android) / **[T]** si hay iOS | ~6 líneas | Apple 1.5 | El correo ya está en la política. Para Play no verifiqué una exigencia dentro de la app |
| Versión de la app (`vX.Y.Z (build)` al pie) | **[N]** | ~4 líneas, `expo-application` ya instalado | Expo `application` v57 | Útil para soporte y para cruzar con Sentry; no lo pide ninguna tienda |
| "Restaurar compras" en Ajustes | **[N]** | ~8 líneas | Apple 3.1.1; RevenueCat | Ya existe en el paywall, que un usuario gratis alcanza desde Ajustes; el requisito está cubierto. Útil sobre todo si se quiere restaurar sin abrir el paywall |
| "Condiciones de uso" en Ajustes | **[N]** | ~6 líneas | Apple subscriptions | Ya está en el paywall (donde se exige). `legal/aviso-legal.md` existe sin enlace desde la app; no verifiqué que sea obligatorio |
| "Valorar Hued" | **[N]**, después de publicar | Dependencia nativa nueva → nuevo build | Expo `store-review` | La doc desaconseja llamar `requestReview` desde un botón; mejor tras una exportación (p. ej. la 3.ª) y cuando exista ficha. Apple: "ask for ratings later" |
| Enlace "Cómo funciona" | Solo con opción B/C | ~6 líneas | Apple HIG Onboarding (tutorial omitido debe ser fácil de encontrar) | Con la opción A no hace falta |

**Hallazgo adyacente (no es Ajustes):** `app/paywall.tsx` muestra "Mensual / Anual / De por vida" + `priceString`, pero **no** el texto de renovación automática ni cómo cancelar. Apple (3.1.2(c) y página de suscripciones: precio de renovación completo, duración) y la política de Play (renovación y condiciones antes de comprar) lo piden. Conviene resolverlo junto a "Gestionar suscripción". Es probablemente más importante para la revisión que cualquier novedad de Ajustes.

**No merece la pena en una app pequeña de un solo desarrollador**
- **Eliminar cuenta / borrar datos in-app:** no hay cuentas (Apple 5.1.1(v), Play 13327111 aplican a apps que permiten crear cuenta). La pregunta de borrado de Data safety se responde con el correo de la política.
- **Tema claro/oscuro:** `userInterfaceStyle: "light"` es una decisión de marca; HIG pide pocos ajustes y no duplicar los del sistema (https://developer.apple.com/design/human-interface-guidelines/settings, vía JSON, resumido por la herramienta).
- **Selector de idioma:** la app es solo español; la doc v57 de `expo-localization` no documenta idioma por app.
- **Tamaño de exportación por defecto, marca de agua, fuente por defecto:** HIG recomienda que las opciones de una tarea vivan en la pantalla de esa tarea; la exportación ya elige 1x/2x/4x en su hoja. `defaultFont` choca con los layouts base (`docs/CONTEXT.md`: cada layout trae su fuente).
- **"Reset onboarding", notificaciones, háptica, copia de seguridad en la nube, "Compartir la app".**

### 3.3 Orden sugerido (todo pequeño)
1. Publicar la política y cerrar H-03 (sin código, bloqueante).
2. Texto de renovación/cancelación en el paywall + "Gestionar suscripción" en Ajustes.
3. "Contacto" y "Versión" (≈10 líneas entre las dos).
4. Estado vacío mejorado (opción A).
5. Después de publicar: "Valorar" disparado tras la 3.ª exportación.

---

## Limitaciones de esta investigación
- Las páginas HIG renderizan por JS: leí el JSON oficial de developer.apple.com y la herramienta devolvió **resúmenes, no texto literal**; las comillas cortas ("fast, fun, and optional") proceden de ese resumen.
- Material 1 es documentación archivada; no localicé guía de onboarding vigente de Material 3.
- Sin datos oficiales de Apple/Google que comparen onboarding omitible y obligatorio.
- Sin verificar: URL `apps.apple.com/account/subscriptions`, validez del EULA estándar de Apple como Terms of Use, contacto in-app como exigencia de Play, idioma por app en `expo-localization`, hidratación síncrona de zustand en su documentación (sí en el código instalado), `mailto:` en `Linking.openURL` en la doc de Expo.
- Los esfuerzos (líneas, archivos) son estimaciones propias, no medidas.
