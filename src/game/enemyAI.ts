import { ENEMIES, PLAYER, STEP, type CasterStats } from '../config';
import { approach, clamp, rectsOverlap, type Vec2 } from '../core/geometry';
import { randRange } from '../core/rng';
import { Bullet } from '../entities/bullet';
import type { CasterKind, Enemy, PendingCurve } from '../entities/enemy';
import { CurveAttack } from '../weapons/attack';
import { buildCurvePath, makeAimFrame, type CurvePath } from '../weapons/curve';
import { ENEMY_PATTERNS, type EnemyPatternId } from '../weapons/enemyPatterns';
import { groundOnly } from '../world/arena';
import type { LinkPlan, Surface } from '../world/navigation';
import { bodyRect, canFitHeight, moveBody } from '../world/physics';
import { updateBoss } from './bossAI';
import { damagePlayer } from './combat';
import type { World } from './world';

const CROUCH_RATIO = 0.6;

/**
 * 목표 지점(goalX, 목표 면)으로 이동한다. 같은 면이면 바로 걸어가고,
 * 다른 면이면 내비게이션 그래프의 다음 면으로 점프하거나 가장자리에서 떨어진다.
 */
export function steer(world: World, e: Enemy, goalX: number, goalSurfaceId: number, speed: number, stopDist: number): void {
  const b = e.body;
  const nav = world.nav;
  if (!b.grounded) {
    if (e.navJumpTargetX !== null) {
      const dx = e.navJumpTargetX - b.x;
      b.vx = Math.abs(dx) > 4 ? Math.sign(dx) * Math.max(speed, ENEMIES.airSpeed) : 0;
    }
    return;
  }
  e.navJumpTargetX = null;

  const cur = nav.surfaceAt(b.x, b.y, b.w / 2);
  if (cur) e.lastSurfaceId = cur.id;
  const curId = cur ? cur.id : e.lastSurfaceId;

  let moveX = goalX;
  let tolerance = stopDist;
  if (curId >= 0 && goalSurfaceId >= 0 && curId !== goalSurfaceId && curId < nav.surfaces.length) {
    // 최단 경로 후보 중 출발 지점이 가장 가까운 연결을 고른다.
    const curS = nav.surface(curId);
    let best: { plan: LinkPlan; next: Surface } | null = null;
    for (const next of nav.candidateHops(curId, goalSurfaceId)) {
      const plan = nav.planLink(curS, next, b.x, b.w / 2, goalX);
      if (!plan) continue;
      if (!best || Math.abs(plan.takeoffX - b.x) < Math.abs(best.plan.takeoffX - b.x)) best = { plan, next };
    }
    if (best) {
      const { plan, next } = best;
      tolerance = 6;
      if (plan.kind === 'jump' && Math.abs(b.x - plan.takeoffX) < 9) {
        b.vy = -ENEMIES.jumpVelocity;
        e.navJumpTargetX = Math.min(Math.max(plan.landX, next.x1 + 20), next.x2 - 20);
        b.vx = Math.sign(e.navJumpTargetX - b.x) * Math.max(speed, ENEMIES.airSpeed);
        return;
      }
      moveX = plan.walkToX;
    }
  }

  const dx = moveX - b.x;
  if (Math.abs(dx) <= tolerance) {
    b.vx = approach(b.vx, 0, 2000 * STEP);
  } else {
    b.vx = Math.sign(dx) * speed * (e.crouching ? 0.7 : 1);
  }

  // 같은 면 위에서 낮은 턱에 막혔다: 아래 틈이 있으면 숙여서 지나가고, 없으면 뛰어넘는다.
  if (b.wallDir !== 0 && Math.sign(b.vx) === b.wallDir) {
    const probe = { ...bodyRect(b, b.h * CROUCH_RATIO) };
    probe.x += b.wallDir * 6;
    if (!e.crouching && e.kind !== 'boss' && !world.arena.overlapsSolid(probe)) {
      setEnemyCrouch(e, true);
    } else if (!e.crouching) {
      b.vy = -ENEMIES.jumpVelocity;
      e.navJumpTargetX = b.x + b.wallDir * 90;
    }
  }
}

function setEnemyCrouch(e: Enemy, on: boolean): void {
  if (e.crouching === on) return;
  e.crouching = on;
  e.crouchTimer = on ? 0.35 : 0;
  e.body.h = on ? e.standHeight * CROUCH_RATIO : e.standHeight;
}

/** 플레이어를 노리는 점: 서 있으면 가슴, 숙였으면 숙인 몸 중앙(조준 고정 후에 숙이면 피할 수 있다). */
export function playerTargetPoint(world: World): Vec2 {
  const p = world.player;
  const h = p.crouching ? PLAYER.crouchHeight * 0.5 : PLAYER.standHeight - 30;
  return { x: p.body.x, y: p.body.y - h };
}

/** 플레이어 발밑 근처(포물선이 떨어질 지점). */
export function playerFeetPoint(world: World, offsetX = 0): Vec2 {
  const p = world.player;
  return { x: p.body.x + offsetX, y: p.body.y - 14 };
}

export function aimFrom(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function rotate(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * 적의 함수 곡선 경로. 예고선(점선)과 실제 발사가 모두 이 계산을 쓴다.
 * target을 주면 포물선처럼 목표 거리에 맞춰 사거리를 정하는 패턴(fitRange)이 그 지점에 떨어진다.
 */
export function computeEnemyCurve(world: World, e: Enemy, patternId: EnemyPatternId, dir: Vec2, target?: Vec2): CurvePath {
  const pat = ENEMY_PATTERNS[patternId];
  const sh = e.shoulder();
  const reach = 34 * (e.body.h / 92);
  const muzzle = { x: sh.x + dir.x * reach, y: sh.y + dir.y * reach };
  let range: number | undefined;
  if ('fitRange' in pat && pat.fitRange && target) {
    const d = Math.hypot(target.x - muzzle.x, target.y - muzzle.y);
    range = clamp(d * (pat.fitRange.scale ?? 1) + pat.fitRange.extra, pat.fitRange.min, pat.fitRange.max);
  }
  // 보스는 발판을 통과하는 거인이라 곡선도 바닥에만 막힌다(예고선으로 충분히 보여 준다).
  const blocks = e.kind === 'boss' ? groundOnly : undefined;
  return buildCurvePath(pat, makeAimFrame(muzzle, dir), world.arena, sh, range, blocks);
}

/** 예고가 끝난 곡선을 실제 공격으로 내보낸다(웨이브 피해 배율 적용). */
export function fireEnemyCurve(world: World, e: Enemy, pending: PendingCurve): void {
  const pat = ENEMY_PATTERNS[pending.pattern];
  const damage = Math.round(pat.tuning.damage * e.stats.damageMul);
  world.enemyAttacks.push(new CurveAttack(pat, pending.path, 'enemy', { damage }));
  const x0 = pending.path.xs[0];
  const y0 = pending.path.ys[0];
  world.fx.sparks(x0, y0, e.color, 4, 160, e.aim.x, e.aim.y, 0.8);
}

function updateMelee(world: World, e: Enemy, dt: number): void {
  const cfg = ENEMIES.melee;
  const p = world.player;
  const b = e.body;
  const dx = p.body.x - b.x;
  const pr = p.hurtbox();
  const er = bodyRect(b);
  const vertOverlap = pr.y < er.y + er.h && pr.y + pr.h > er.y;
  const reach = cfg.attackRange * (e.elite ? 1.15 : 1);

  switch (e.state) {
    case 'chase': {
      if (p.alive) e.facing = dx >= 0 ? 1 : -1;
      if (p.alive && b.grounded && vertOverlap && Math.abs(dx) < reach + p.body.w / 2) {
        e.state = 'windup';
        e.stateTimer = cfg.windup;
        b.vx = 0;
        break;
      }
      if (p.alive) steer(world, e, p.body.x, p.lastSurfaceId, e.stats.speed, reach * 0.5);
      else b.vx = approach(b.vx, 0, 2000 * dt);
      break;
    }
    case 'windup':
      b.vx = approach(b.vx, 0, 2400 * dt);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = 'strike';
        e.stateTimer = cfg.strikeTime;
        e.strikeHit = false;
        b.vx = e.facing * 230;
      }
      break;
    case 'strike': {
      e.stateTimer -= dt;
      if (!e.strikeHit) {
        const h = b.h;
        const box = {
          x: e.facing > 0 ? b.x : b.x - reach - 14,
          y: b.y - h * 0.9,
          w: reach + 14,
          h: h * 0.8,
        };
        if (rectsOverlap(box, p.hurtbox())) {
          e.strikeHit = true;
          damagePlayer(world, e.stats.damage, b.x, 'melee');
        }
      }
      if (e.stateTimer <= 0) {
        e.state = 'recover';
        e.stateTimer = cfg.recover;
      }
      break;
    }
    case 'recover':
      b.vx = approach(b.vx, 0, 1800 * dt);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) e.state = 'chase';
      break;
  }
}

/**
 * 거리를 두고 싸우는 적(일차함수 사수, 사인 술사, 포물선 투척병).
 * move(거리 유지·시야 확보) → aim(예고: 조준선/곡선 미리보기, 마지막 순간 조준 고정) → 발사 → recover.
 */
function updateCaster(world: World, e: Enemy, dt: number): void {
  const kind = e.kind as CasterKind;
  const cfg: CasterStats = ENEMIES[kind];
  const p = world.player;
  const b = e.body;
  const lob = kind === 'lobber';
  const target = lob ? playerFeetPoint(world) : playerTargetPoint(world);
  const sh = e.shoulder();
  const dx = target.x - b.x;
  const dist = Math.hypot(target.x - sh.x, target.y - sh.y);
  // 포물선은 엄폐물 너머로 떨어지므로 직선 시야 대신 거리만 본다.
  const sight =
    p.alive &&
    (lob ? Math.abs(dx) <= cfg.maxFireDistance && Math.abs(target.y - b.y) < 420 : !world.arena.blocked(sh.x, sh.y, target.x, target.y));
  if (p.alive) e.facing = dx >= 0 ? 1 : -1;

  const updatePending = () => {
    e.aim = aimFrom(sh, target);
    if (kind === 'ranged') return;
    const pattern: EnemyPatternId = lob ? 'lobArc' : 'sineWave';
    e.pending = [{ pattern, path: computeEnemyCurve(world, e, pattern, e.aim, target), delay: 0 }];
  };

  switch (e.state) {
    case 'move': {
      e.fireTimer -= dt;
      e.noSightTime = sight ? 0 : e.noSightTime + dt;
      if (p.alive) e.aim = aimFrom(sh, target);
      if (!p.alive) {
        b.vx = approach(b.vx, 0, 2000 * dt);
        break;
      }
      const cur = world.nav.surfaceAt(b.x, b.y, b.w / 2);
      const outOfRange = dist > cfg.maxFireDistance * 0.9;
      if (e.noSightTime > 0.9 || outOfRange || !cur) {
        // 시야가 막혔거나 사거리 밖: 플레이어가 있는 면 쪽으로 이동(현재 면에 갇혀 대치하지 않게)
        steer(world, e, p.body.x - Math.sign(dx || 1) * cfg.preferredDistance * 0.5, p.lastSurfaceId, e.stats.speed, 40);
      } else {
        // 거리 유지: 너무 가까우면 물러나고, 멀면 다가간다(현재 면 안에서).
        const side = dx >= 0 ? -1 : 1;
        let desired = b.x;
        const adx = Math.abs(dx);
        if (adx < cfg.minDistance || adx > cfg.preferredDistance + 160) desired = p.body.x + side * cfg.preferredDistance;
        desired = Math.min(Math.max(desired, cur.x1 + b.w), cur.x2 - b.w);
        steer(world, e, desired, cur.id, e.stats.speed, 24);
      }
      if (sight && e.fireTimer <= 0 && dist < cfg.maxFireDistance && b.grounded) {
        e.state = 'aim';
        e.stateTimer = cfg.telegraph;
        e.aimLocked = false;
        updatePending();
      }
      break;
    }
    case 'aim': {
      b.vx = approach(b.vx, 0, 2400 * dt);
      e.stateTimer -= dt;
      if (!e.aimLocked) {
        updatePending();
        if (e.stateTimer <= cfg.aimLockTime) e.aimLocked = true;
      }
      if (e.stateTimer <= 0) {
        if (kind === 'ranged') {
          const rcfg = ENEMIES.ranged;
          const muzzle = e.handPos();
          world.bullets.push(
            new Bullet(muzzle.x, muzzle.y, e.aim.x * rcfg.bulletSpeed, e.aim.y * rcfg.bulletSpeed, rcfg.bulletRadius, e.stats.damage, e.color),
          );
          world.fx.sparks(muzzle.x, muzzle.y, e.color, 4, 160, e.aim.x, e.aim.y, 0.8);
        } else {
          for (const pc of e.pending) fireEnemyCurve(world, e, pc);
        }
        e.pending = [];
        e.state = 'recover';
        e.stateTimer = 0.35;
        e.fireTimer = e.stats.fireInterval * randRange(0.85, 1.2);
      }
      break;
    }
    case 'recover':
      b.vx = approach(b.vx, 0, 2000 * dt);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) e.state = 'move';
      break;
  }
}

export function updateEnemies(world: World, dt: number): void {
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (e.spawnTimer > 0) {
      e.spawnTimer -= dt;
      if (Math.random() < (e.kind === 'boss' ? 1 : 0.5)) world.fx.portal(e.body.x, e.body.y - e.body.h / 2, e.color);
      continue;
    }
    e.flash = Math.max(0, e.flash - dt);
    const b = e.body;

    if (e.crouching) {
      // 턱 아래로 들어갈 시간을 준 뒤, 머리 위가 비면 다시 일어선다.
      e.crouchTimer -= dt;
      if (e.crouchTimer <= 0 && canFitHeight(b, e.standHeight, world.arena)) setEnemyCrouch(e, false);
    }

    if (world.debug.freezeEnemies) {
      b.vx = 0;
    } else if (e.stun > 0) {
      e.stun -= dt;
      e.pending = [];
      if (e.state === 'aim') e.state = 'recover';
      b.vx = approach(b.vx, 0, (b.grounded ? 1400 : 300) * dt);
    } else if (e.kind === 'melee') {
      updateMelee(world, e, dt);
    } else if (e.kind === 'boss') {
      updateBoss(world, e, dt);
    } else {
      updateCaster(world, e, dt);
    }
    moveBody(b, world.arena, dt);
    if (b.grounded) {
      const s = world.nav.surfaceAt(b.x, b.y, b.w / 2);
      if (s) e.lastSurfaceId = s.id;
      e.walkPhase += b.vx * dt * 0.05 / Math.max(1, e.scale);
    }
    // 화면 아래로 떨어지는 것을 막는 안전장치
    if (b.y > world.arena.groundY + 400) e.alive = false;
  }

  // 겹친 적끼리 살짝 밀어내 겹쳐 보이지 않게 한다.
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.active || a.kind === 'boss') continue;
    for (let j = i + 1; j < list.length; j++) {
      const c = list[j];
      if (!c.active || c.kind === 'boss') continue;
      const dx = c.body.x - a.body.x;
      const minDist = (a.body.w + c.body.w) * 0.45;
      if (Math.abs(dx) >= minDist || Math.abs(c.body.y - a.body.y) > 30) continue;
      const push = Math.min(40 * dt, (minDist - Math.abs(dx)) / 2);
      const dir = dx === 0 ? (a.id < c.id ? 1 : -1) : Math.sign(dx);
      const aMoved = { ...bodyRect(a.body), x: bodyRect(a.body).x - dir * push };
      const cMoved = { ...bodyRect(c.body), x: bodyRect(c.body).x + dir * push };
      if (!world.arena.overlapsSolid(aMoved)) a.body.x -= dir * push;
      if (!world.arena.overlapsSolid(cMoved)) c.body.x += dir * push;
    }
  }

  for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) list.splice(i, 1);
}
