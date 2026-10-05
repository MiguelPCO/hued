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

  // H-06 (corregido): `todayString()` usaba `toISOString()` (UTC), así que un usuario en España
  // que exportó a las 23:30 locales tardaba hasta las 02:00 (verano) en recuperar sus 3 exportaciones.
  it('resets at local midnight, not at UTC midnight (H-06)', () => {
    // 21:30Z = 23:30 locales del 4-oct → 22:30Z = 00:30 locales del 5-oct
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T22:30:00Z'));
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: '2026-10-04' });

    useSettingsStore.getState().resetExportCountIfNewDay();

    const state = useSettingsStore.getState();
    expect(state.exportDailyCount).toBe(0);
    expect(state.exportDailyResetDate).toBe('2026-10-05');
  });

  it('does not reset after UTC midnight while the local day is unchanged', () => {
    // 22:30Z del 4-oct ya es el 5-oct local; un contador del 5-oct no debe reiniciarse
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T22:30:00Z'));
    useSettingsStore.setState({ exportDailyCount: 2, exportDailyResetDate: '2026-10-05' });

    useSettingsStore.getState().resetExportCountIfNewDay();

    expect(useSettingsStore.getState().exportDailyCount).toBe(2);
  });
});
