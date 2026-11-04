import { expect, it } from 'vitest';
import { ar } from '../../apps/web/src/i18n/ar';
import { en } from '../../apps/web/src/i18n/en';
it('keeps every foundation label available in Arabic and English',()=>{
  expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  for(const value of [...Object.values(ar),...Object.values(en)]) expect(value.trim().length).toBeGreaterThan(0);
});
