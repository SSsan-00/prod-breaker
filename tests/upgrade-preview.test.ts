import { expect, it } from 'vitest';
import { createWorld, upgrades, type UpgradeId } from '../src/game/survivor';
import { upgradePreview } from '../src/game/upgrade-preview';

function choice(id: UpgradeId) {
  const w = createWorld(42, 180);
  w.phase = 'upgrade'; w.choices = [id];
  return w;
}
it('shows real gains without consuming choices or changing the run', () => {
  const w = choice('where'), before = structuredClone(w);
  expect(upgradePreview(w, 'where')).toEqual(['攻撃+6', '貫通+1']);
  expect(w).toEqual(before);
  expect(upgradePreview(w, 'retry')).toEqual([]);
});
it('explains growth at a cap instead of promising impossible piercing', () => {
  const w = choice('where'); w.pierce = 8;
  const preview = upgradePreview(w, 'where');
  expect(preview.some(line => line.startsWith('貫通'))).toBe(false);
  expect(Number(preview[0].split('+')[1])).toBeGreaterThan(6);
});
it('every skill offers a visible numerical reward', () => {
  for (const card of upgrades) expect(upgradePreview(choice(card.id), card.id).length, card.id).toBeGreaterThan(0);
});
