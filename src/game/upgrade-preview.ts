import { chooseUpgrade, type World, type UpgradeId } from './survivor';

/** Read the actual simulation result, including evolution and overflow conversion. */
export function upgradePreview(world: World, id: UpgradeId): string[] {
  if (world.phase !== 'upgrade' || !world.choices.includes(id)) return [];
  const next = chooseUpgrade(world, id);
  const result: string[] = [];
  const add = (label: string, before: number, after: number) => {
    const delta = Math.round((after - before) * 100) / 100;
    if (delta > 0) result.push(`${label}+${delta}`);
  };
  add('攻撃', world.damage, next.damage);
  add('連鎖', world.chainDamage, next.chainDamage);
  add('貫通', world.pierce, next.pierce);
  add('発射数', world.multishot, next.multishot);
  add('連鎖範囲', world.chainRange, next.chainRange);
  add('持続', world.aura, next.aura);
  add('回収範囲', world.magnet, next.magnet);
  add('最大HP', world.player.maxHp, next.player.maxHp);
  add('HP回復', world.player.hp, next.player.hp);
  add('BP倍率', world.multiplier, next.multiplier);
  if (next.fireInterval < world.fireInterval) result.push(`攻撃間隔-${Math.round((1 - next.fireInterval / world.fireInterval) * 100)}%`);
  if (next.speed > world.speed) result.push(`移動速度+${Math.round((next.speed / world.speed - 1) * 100)}%`);
  if (next.slow < world.slow) result.push(`敵速度-${Math.round((1 - next.slow / world.slow) * 100)}%`);
  return result;
}
