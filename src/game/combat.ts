import { COMBAT, ENEMIES, FX, MULTI_KILL_BONUS, PLAYER } from '../config';
import {
  closestPointOnSegment,
  segmentCircleHit,
  segmentRectDistance,
  type Rect,
} from '../core/geometry';
import type { Enemy } from '../entities/enemy';
import type { CurveAttack } from '../weapons/attack';
import { forEachSegmentInRange, pointAtLength } from '../weapons/curve';
import type { World } from './world';

/** 곡선 경로의 경계 상자가 사각형(반경만큼 확장)과 닿을 수 있는지(빠른 사전 검사). */
function pathMayTouch(a: CurveAttack, r: Rect, radius: number): boolean {
  const p = a.path;
  return !(
    r.x > p.maxX + radius ||
    r.x + r.w < p.minX - radius ||
    r.y > p.maxY + radius ||
    r.y + r.h < p.minY - radius
  );
}

export interface CurveHit {
  x: number;
  y: number;
  /** 맞은 지점의 곡선 진행 방향(단위 벡터). */
  tx: number;
  ty: number;
}

/**
 * 공격의 '현재 보이는 구간' [꼬리, 머리] 전체를 선분 단위로 검사해 사각형과의 거리가
 * 곡선 두께(판정 반경) 이하인 첫 지점을 찾는다. 머리가 한 스텝에 많이 나아가도
 * 새로 드러난 구간을 포함해 전부 검사하므로 빠르게 지나가는 적을 놓치지 않는다.
 */
export function findCurveHit(attack: CurveAttack, rect: Rect): CurveHit | null {
  const radius = attack.tuning.hitRadius;
  if (!pathMayTouch(attack, rect, radius)) return null;
  const head = attack.headLength;
  const tail = attack.tailLength;
  if (head <= tail) return null;
  let hit: CurveHit | null = null;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  forEachSegmentInRange(attack.path, tail, head, (ax, ay, bx, by) => {
    if (segmentRectDistance(ax, ay, bx, by, rect) > radius) return false;
    const c = closestPointOnSegment(cx, cy, ax, ay, bx, by);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    hit = { x: c.x, y: c.y, tx: (bx - ax) / len, ty: (by - ay) / len };
    return true;
  });
  return hit;
}

/** 지형에 막힌 곡선의 끝에 작은 충돌 효과를 한 번 낸다. */
function showImpact(world: World, a: CurveAttack): void {
  if (!a.path.blocked || a.impactShown || a.headLength < a.path.length) return;
  a.impactShown = true;
  const end = pointAtLength(a.path, a.path.length);
  world.fx.sparks(end.x, end.y, a.def.color, 7, 180);
  world.fx.ring(end.x, end.y, a.def.color, 10, 0.22);
}

/** 플레이어 곡선 → 적·적 탄환, 적 곡선 → 플레이어 판정. 끝난 곡선은 목록에서 뺀다. */
export function updateAttacks(world: World, dt: number): void {
  for (const a of world.attacks) {
    a.update(dt);
    showImpact(world, a);
    if (!a.damaging) continue;

    for (const e of world.enemies) {
      if (!e.active || a.hitIds.has(e.id)) continue;
      const hit = findCurveHit(a, e.hurtbox());
      if (!hit) continue;
      a.hitIds.add(e.id);
      damageEnemy(world, e, a, hit);
    }

    if (COMBAT.curvesBlockBullets) {
      const r = a.tuning.hitRadius;
      for (const b of world.bullets) {
        if (!b.alive) continue;
        const box = { x: b.x - b.radius, y: b.y - b.radius, w: b.radius * 2, h: b.radius * 2 };
        if (!pathMayTouch(a, box, r)) continue;
        forEachSegmentInRange(a.path, a.tailLength, a.headLength, (ax, ay, bx, by) => {
          if (!segmentCircleHit(ax, ay, bx, by, b.x, b.y, r + b.radius)) return false;
          b.alive = false;
          world.fx.sparks(b.x, b.y, a.def.color, 5, 140);
          return true;
        });
      }
    }
  }

  const p = world.player;
  for (const a of world.enemyAttacks) {
    a.update(dt);
    showImpact(world, a);
    if (a.phase === 'grow') cutByPlayerCurves(world, a);
    // 한 곡선은 플레이어를 한 번만 맞힌다(무적 시간 중에 지나간 부분은 맞은 것으로 치지 않음).
    if (!a.damaging || a.hitIds.has(0) || !p.alive || p.invuln > 0) continue;
    const hit = findCurveHit(a, p.hurtbox());
    if (hit && damagePlayer(world, a.tuning.damage, hit.x - hit.tx * 20, a.def.id)) a.hitIds.add(0);
  }

  for (const list of [world.attacks, world.enemyAttacks]) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].done) list.splice(i, 1);
  }
}

/**
 * 함수 상쇄: 뻗어 오는 적 곡선의 머리가 플레이어 곡선(보이는 구간)에 닿으면 그 자리에서 끊긴다.
 * 적 탄환을 지우는 것과 같은 맞대응 수단이다.
 */
function cutByPlayerCurves(world: World, enemyAttack: CurveAttack): void {
  const head = pointAtLength(enemyAttack.path, enemyAttack.headLength);
  for (const pa of world.attacks) {
    if (!pa.damaging) continue;
    const reach = pa.tuning.hitRadius + enemyAttack.tuning.hitRadius;
    const box = { x: head.x - reach, y: head.y - reach, w: reach * 2, h: reach * 2 };
    if (!pathMayTouch(pa, box, 0)) continue;
    let touched = false;
    forEachSegmentInRange(pa.path, pa.tailLength, pa.headLength, (ax, ay, bx, by) => {
      touched = segmentCircleHit(ax, ay, bx, by, head.x, head.y, reach);
      return touched;
    });
    if (touched) {
      enemyAttack.cut();
      world.fx.sparks(head.x, head.y, '#ffffff', 9, 220);
      world.fx.ring(head.x, head.y, '#ffffff', 12, 0.25);
      return;
    }
  }
}

export function damageEnemy(world: World, e: Enemy, a: CurveAttack, hit: CurveHit): void {
  const dmg = a.tuning.damage;
  e.hp -= dmg;
  e.flash = 0.12;
  e.lastHitAt = world.time;
  // 명중률은 '적을 하나 이상 맞힌 발사' 기준(관통으로 여러 명을 맞혀도 1회)
  if (a.hitIds.size === 1) world.stats.hits++;

  // 곡선 진행 방향으로 밀어낸다(살짝 띄워서 맞은 느낌을 준다). 보스는 거의 밀리지 않고 경직도 없다.
  const kb = a.tuning.knockback * e.stats.knockbackTaken;
  if (e.kind !== 'boss') {
    e.stun = ENEMIES.hitStun;
    e.body.vx = hit.tx * kb;
    e.body.vy = Math.min(e.body.vy, hit.ty * kb * 0.5 - 90 - kb * 0.25);
  }
  // 강한 넉백(절댓값·지수 등)은 근접형의 공격 준비를 끊는다.
  if (kb >= 300 && e.kind === 'melee' && e.state === 'windup') {
    e.state = 'recover';
    e.stateTimer = 0.3;
  }

  world.fx.sparks(hit.x, hit.y, a.def.color, 7, 240, hit.tx, hit.ty, 1.8);
  world.fx.text(e.body.x + (Math.random() - 0.5) * 12, e.body.y - e.body.h - 14, `${dmg}`, '#ffffff', 15);
  world.addShake(FX.shakeHit);

  if (e.hp <= 0) killEnemy(world, e, a, hit);
}

function killEnemy(world: World, e: Enemy, a: CurveAttack, hit: CurveHit): void {
  e.alive = false;
  e.hp = 0;
  e.pending = [];
  world.kills++;
  a.kills++;
  let gained = e.stats.score;
  if (a.kills >= 2) {
    const bonus = MULTI_KILL_BONUS * (a.kills - 1);
    gained += bonus;
    world.fx.text(e.body.x, e.body.y - e.body.h - 40, `관통 ×${a.kills}  +${bonus}`, '#ffffff', 17, 1.1);
  }
  world.stats.bestMultiKill = Math.max(world.stats.bestMultiKill, a.kills);
  world.score += gained;
  world.fx.text(e.body.x, e.body.y - e.body.h - 30, `+${gained}`, '#d8d8d8', 13, 0.9);
  world.fx.stickDebris(e.body.x, e.body.y, e.body.h, e.color, hit.tx * 320, hit.ty * 320);
  world.fx.sparks(e.body.x, e.body.y - e.body.h / 2, e.color, 14, 320);
  world.fx.sparks(hit.x, hit.y, a.def.color, 10, 360, hit.tx, hit.ty, 1.2);
  world.fx.ring(e.body.x, e.body.y - e.body.h / 2, a.def.color, 30, 0.35);
  world.addShake(FX.shakeKill);

  if (e.kind === 'boss') {
    const p = world.player;
    const healed = Math.min(ENEMIES.boss.heal, p.maxHp - p.hp);
    p.hp += healed;
    world.stats.bossesDefeated++;
    // 보스가 남긴 곡선은 함께 사라진다.
    world.enemyAttacks.length = 0;
    for (let i = 0; i < 4; i++) world.fx.ring(e.body.x, e.body.y - e.body.h / 2, '#ffffff', 40 + i * 30, 0.5 + i * 0.15);
    world.fx.sparks(e.body.x, e.body.y - e.body.h / 2, '#ffffff', 40, 520);
    world.addShake(FX.shakeBoss);
    world.showBanner('보스 격파!', `+${gained}점 · 체력 +${healed}`, '#ffffff', 2.6);
  }
}

/** 플레이어 피격. 무적 시간 중이면 무시한다. source는 통계(어떤 공격에 얼마나 맞았는지)용. */
export function damagePlayer(world: World, amount: number, fromX: number, source = 'other'): boolean {
  const p = world.player;
  if (!p.alive || p.invuln > 0) return false;
  world.stats.damageTaken[source] = (world.stats.damageTaken[source] ?? 0) + amount;
  p.invuln = PLAYER.invulnTime;
  p.hurtFlash = PLAYER.hurtFlashTime;
  if (!world.debug.invincible) p.hp = Math.max(0, p.hp - amount);
  const dir = Math.sign(p.body.x - fromX) || -p.facing;
  p.body.vx = dir * PLAYER.knockbackX;
  if (!p.crouching) p.body.vy = Math.min(p.body.vy, -PLAYER.knockbackY);
  const c = p.center();
  world.fx.sparks(c.x, c.y, '#ffffff', 10, 260);
  world.fx.text(c.x, p.body.y - p.body.h - 16, `-${amount}`, '#ffffff', 18);
  world.addShake(FX.shakeHurt);
  if (p.hp <= 0) {
    p.alive = false;
    world.gameOverTimer = 1.3;
    world.fx.stickDebris(p.body.x, p.body.y, p.body.h, '#ffffff', dir * 300, -200);
    world.fx.sparks(c.x, c.y, '#ffffff', 24, 360);
  }
  return true;
}

export function updateBullets(world: World, dt: number): void {
  const p = world.player;
  for (const b of world.bullets) {
    if (!b.alive) continue;
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || !world.arena.inAttackBounds(b.x, b.y)) {
      b.alive = false;
      continue;
    }
    // 이동 구간 전체로 검사해 빠른 탄환도 지형·플레이어를 통과하지 않는다.
    const wall = world.arena.raycast(b.px, b.py, b.x, b.y);
    if (wall) {
      b.alive = false;
      world.fx.sparks(wall.x, wall.y, b.color, 5, 120);
      continue;
    }
    if (p.alive && p.invuln <= 0 && segmentRectDistance(b.px, b.py, b.x, b.y, p.hurtbox()) <= b.radius) {
      b.alive = false;
      damagePlayer(world, b.damage, b.x - b.vx, 'bullet');
    }
  }
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    if (!world.bullets[i].alive) world.bullets.splice(i, 1);
  }
}
