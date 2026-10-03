import { COMBAT, EVOLUTION, PLAYER } from '../config';
import type { Input } from '../core/input';
import { CurveAttack } from '../weapons/attack';
import { buildCurvePath, makeEndAlignedFrame, reachScale, type CurvePath } from '../weapons/curve';
import { evolutionOptions, weaponById, type OperatorId } from '../weapons/operators';
import type { World } from './world';

/**
 * 현재 플레이어 위치·조준에서 slot번 슬롯 무기를 쐈을 때의 경로.
 * 곡선의 끝점(원은 먼 점)이 커서에 닿도록 방향을 맞추고 크기를 줄인다(사거리가 허락하는 만큼).
 * 조준 미리보기와 실제 발사가 모두 이 함수를 호출하므로 두 경로는 항상 같다.
 */
export function computeAttackPath(world: World, slot = world.player.weaponIndex): CurvePath {
  const p = world.player;
  const def = world.slotWeapon(slot);
  const frame = makeEndAlignedFrame(def, p.muzzle(), p.aim);
  const scale = reachScale(def, p.aimDist - PLAYER.muzzleDistance);
  return buildCurvePath(def, frame, world.arena, p.shoulder(), undefined, undefined, scale);
}

export function selectWeapon(world: World, index: number): void {
  const n = world.loadout.length;
  world.player.weaponIndex = ((index % n) + n) % n;
}

/**
 * 인벤토리: slot번 슬롯에 보유한 무기를 꽂는다. 이미 다른 슬롯에 있는 무기면 두 슬롯의 무기를 맞바꾼다.
 * 슬롯이 바뀌면 재사용 대기를 새 무기 기준으로 다시 시작해 교체로 대기시간을 건너뛰지 못하게 한다.
 */
export function equipWeapon(world: World, slot: number, weaponId: string): boolean {
  const base = world.weapons.find((w) => w.id === weaponId);
  const target = world.loadout[slot];
  if (!base || !target || target.weaponId === weaponId || !world.owned.has(weaponId)) return false;
  const other = world.loadout.findIndex((s) => s.weaponId === weaponId);
  if (other >= 0) {
    world.loadout[other].weaponId = target.weaponId;
    resetSlotCooldown(world, other);
  }
  target.weaponId = weaponId;
  resetSlotCooldown(world, slot);
  return true;
}

export type EvolveResult =
  | { ok: true; unlocked: string }
  | { ok: false; reason: 'not-owned' | 'no-result' | 'self' | 'already-owned' | 'no-points' };

/**
 * 함수 진화: 보유한 함수 `fromId`에 연산(미분·부정적분·극한)을 적용해 그 결과 함수를 얻는다(원래 함수는 그대로 남는다).
 * 진화 포인트를 쓰며, 결과가 없거나 자기 자신이거나 이미 가진 함수면 실패한다.
 */
export function evolveWeapon(world: World, fromId: string, op: OperatorId): EvolveResult {
  const base = weaponById(fromId);
  if (!base || !world.owned.has(fromId)) return { ok: false, reason: 'not-owned' };
  const opt = evolutionOptions(base).find((o) => o.op === op)!;
  if (!opt.edge || !opt.result) return { ok: false, reason: 'no-result' };
  if (opt.self) return { ok: false, reason: 'self' };
  if (world.owned.has(opt.result.id)) return { ok: false, reason: 'already-owned' };
  const cost = EVOLUTION.cost[op];
  if (world.evoPoints < cost) return { ok: false, reason: 'no-points' };
  world.evoPoints -= cost;
  world.owned.add(opt.result.id);
  return { ok: true, unlocked: opt.result.id };
}

function resetSlotCooldown(world: World, slot: number): void {
  world.player.cooldowns[slot] = Math.max(world.player.cooldowns[slot], world.slotWeapon(slot).tuning.cooldown);
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

  const n = world.loadout.length;
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
