import { Platform } from 'react-native';

// Apple 3.1.2 (paywall) y 5.1.1 (Ajustes) piden enlazar a las condiciones y a la política de privacidad.
// Si PRIVACY_URL sigue con "[RELLENAR", el enlace se pinta igual: es un recordatorio.
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const PRIVACY_URL = '[RELLENAR: URL pública de legal/privacidad.md]';

export const CONTACT_EMAIL = 'xtremzmiguel@gmail.com';

// Google Play and Apple ask the app to say how to cancel a subscription and to link the store's own screen.
export const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
export const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions?package=com.migueldev.hued';
