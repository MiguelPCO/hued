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
