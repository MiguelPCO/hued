import { isOptionLocked } from '../optionLock';

describe('isOptionLocked', () => {
  it('is unlocked when the option is not premium, regardless of subscription', () => {
    expect(isOptionLocked(undefined, 'free')).toBe(false);
    expect(isOptionLocked(false, 'free')).toBe(false);
    expect(isOptionLocked(undefined, 'premium')).toBe(false);
  });

  it('is locked for a premium option on a free subscription', () => {
    expect(isOptionLocked(true, 'free')).toBe(true);
  });

  it('is unlocked for a premium option on a premium subscription', () => {
    expect(isOptionLocked(true, 'premium')).toBe(false);
  });
});
