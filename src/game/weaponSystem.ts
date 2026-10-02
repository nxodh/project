import { COMBAT } from '../config';
import type { Input } from '../core/input';
import { CurveAttack } from '../weapons/attack';
import { buildCurvePath, makeEndAlignedFrame, type CurvePath } from '../weapons/curve';
import type { World } from './world';

/**
 * 현재 플레이어 위치·조준에서 weaponIndex 무기를 쐈을 때의 경로.
 * 조준 미리보기와 실제 발사가 모두 이 함수를 호출하므로 두 경로는 항상 같다.
 */
export function computeAttackPath(world: World, weaponIndex = world.player.weaponIndex): CurvePath {
  const p = world.player;
  const def = world.weapons[weaponIndex];
  const frame = makeEndAlignedFrame(def, p.muzzle(), p.aim);
  return buildCurvePath(def, frame, world.arena, p.shoulder());
}

export function selectWeapon(world: World, index: number): void {
  const n = world.weapons.length;
  world.player.weaponIndex = ((index % n) + n) % n;
}

export function canFire(world: World): boolean {
  const p = world.player;
  return p.alive && p.globalCooldown <= 0 && p.cooldowns[p.weaponIndex] <= 0;
}

export function fireWeapon(world: World): CurveAttack {
  const p = world.player;
  const def = world.currentWeapon;
  const path = computeAttackPath(world);
  const attack = new CurveAttack(def, path);
  world.attacks.push(attack);
  p.cooldowns[p.weaponIndex] = def.tuning.cooldown;
  p.globalCooldown = COMBAT.globalFireInterval;
  p.recoil = 1;
  world.stats.shots++;
  const m = p.muzzle();
  world.fx.sparks(m.x, m.y, def.color, 5, 200, p.aim.x, p.aim.y, 0.9);
  return attack;
}

export function updateWeapons(world: World, input: Input, dt: number): void {
  const p = world.player;
  for (let i = 0; i < p.cooldowns.length; i++) p.cooldowns[i] = Math.max(0, p.cooldowns[i] - dt);
  p.globalCooldown = Math.max(0, p.globalCooldown - dt);
  if (!p.alive) return;

  const n = world.weapons.length;
  for (let i = 0; i < Math.min(9, n); i++) {
    if (input.consumePress(`Digit${i + 1}`)) selectWeapon(world, i);
  }
  const wheel = input.consumeWheelSteps();
  if (wheel !== 0) selectWeapon(world, p.weaponIndex + wheel);

  // 한 번 클릭 = 한 발(쿨다운 중 짧은 클릭은 잠깐 버퍼링), 누르고 있으면 쿨다운마다 연사.
  const wantsFire = input.fireHeld || input.hasBufferedFire(COMBAT.fireBufferMs);
  if (wantsFire && canFire(world)) {
    fireWeapon(world);
    input.clearBufferedFire();
  }
}
