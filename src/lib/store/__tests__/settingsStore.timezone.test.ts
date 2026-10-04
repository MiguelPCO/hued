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
