import { ENEMIES } from '../config';
import { approach, rectsOverlap, type Vec2 } from '../core/geometry';
import { random, randRange } from '../core/rng';
import type { Enemy, PendingCurve } from '../entities/enemy';
import type { EnemyPatternId } from '../weapons/enemyPatterns';
import { bodyRect } from '../world/physics';
import { damagePlayer } from './combat';
import { aimFrom, computeEnemyCurve, fireEnemyCurve, playerFeetPoint, playerTargetPoint, rotate } from './enemyAI';
import type { World } from './world';

/** 보스의 공격 패턴. 모두 함수 곡선이며 시전(예고) 동안 경로가 점선으로 미리 보인다. */
export type BossMove = 'sineVolley' | 'lobBarrage' | 'roofSlam' | 'lineFan' | 'expUppercut' | 'tanSweep' | 'radialBurst';

export const BOSS_MOVE_NAMES: Record<BossMove, string> = {
  sineVolley: '사인파 삼연발',
  lobBarrage: '포물선 폭격',
  roofSlam: '절댓값 낙하',
  lineFan: '일차함수 부채꼴',
  expUppercut: '지수 올려치기',
  tanSweep: '탄젠트 쓸기',
  radialBurst: '방사형 직선',
};

/** 단계(체력 60%·30% 경계)마다 쓰는 패턴이 늘어난다. */
const PHASE_MOVES: BossMove[][] = [
  ['sineVolley', 'lobBarrage', 'roofSlam'],
  ['lineFan', 'sineVolley', 'expUppercut', 'lobBarrage', 'roofSlam'],
  ['radialBurst', 'tanSweep', 'lobBarrage', 'lineFan', 'expUppercut', 'sineVolley'],
];

export function bossPhaseOf(e: Enemy): number {
  const frac = e.hp / e.maxHp;
  const phases = ENEMIES.boss.phases;
  for (let i = 0; i < phases.length; i++) if (frac > phases[i].above) return i;
  return phases.length - 1;
}

/** 패턴 하나를 준비한다: 쏠 곡선들의 경로를 지금 계산해 예고선으로 보여 준다(발사 시 이 경로 그대로). */
export function planBossMove(world: World, e: Enemy, move: BossMove): PendingCurve[] {
  const out: PendingCurve[] = [];
  const sh = e.shoulder();
  const chest = playerTargetPoint(world);
  const toPlayer = aimFrom(sh, chest);
  const add = (pattern: EnemyPatternId, dir: Vec2, delay: number, target?: Vec2) =>
    out.push({ pattern, path: computeEnemyCurve(world, e, pattern, dir, target), delay });
  const phase = e.bossPhase;

  switch (move) {
    case 'sineVolley':
      [-0.22, 0, 0.22].forEach((a, i) => add('bossSine', rotate(toPlayer, a), i * 0.28, chest));
      break;
    case 'lobBarrage': {
      const offsets = phase >= 2 ? [-300, -150, 0, 150, 300] : [-170, 0, 170];
      offsets.forEach((dx, i) => {
        const t = playerFeetPoint(world, dx);
        add('bossLob', aimFrom(sh, t), i * 0.12, t);
      });
      break;
    }
    case 'roofSlam': {
      const offsets = phase >= 1 ? [-150, 0, 150] : [0];
      offsets.forEach((dx, i) => {
        const t = playerFeetPoint(world, dx);
        add('bossRoof', aimFrom(sh, t), i * 0.1, t);
      });
      break;
    }
    case 'lineFan': {
      const spread = phase >= 2 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.36, -0.18, 0, 0.18, 0.36];
      spread.forEach((a) => add('bossLine', rotate(toPlayer, a), 0));
      break;
    }
    case 'expUppercut': {
      // 플레이어 쪽 수평으로 쏘아 끝에서 솟구친다(발판 위로 피한 플레이어를 노림).
      const dir = { x: Math.sign(chest.x - sh.x) || 1, y: 0 };
      add('bossExp', dir, 0);
      add('bossExp', rotate(dir, -0.18 * dir.x), 0.2);
      break;
    }
    case 'tanSweep':
      add('bossTan', toPlayer, 0);
      add('bossTan', rotate(toPlayer, 0.22), 0.25);
      break;
    case 'radialBurst': {
      const base = random() * Math.PI * 2;
      for (let i = 0; i < 8; i++) add('bossLine', rotate({ x: 1, y: 0 }, base + (i * Math.PI) / 4), 0);
      break;
    }
  }
  return out;
}

/**
 * 보스: 바닥을 걸으며 플레이어와 거리를 유지하고, 단계별 패턴을 돌아가며 시전한다.
 * walk → cast(예고선 표시) → 연발 지연에 맞춰 곡선 발사 → recover → walk
 */
export function updateBoss(world: World, e: Enemy, dt: number): void {
  const cfg = ENEMIES.boss;
  const p = world.player;
  const b = e.body;
  const dx = p.body.x - b.x;
  if (p.alive) e.facing = dx >= 0 ? 1 : -1;
  e.contactCooldown = Math.max(0, e.contactCooldown - dt);

  // 몸에 닿으면 피해(보스에게 붙어서 버티지 못하게)
  if (p.alive && e.contactCooldown <= 0 && rectsOverlap(bodyRect(b), p.hurtbox())) {
    if (damagePlayer(world, Math.round(cfg.contactDamage * e.stats.damageMul), b.x, 'boss-contact')) e.contactCooldown = 0.8;
  }

  // 단계 전환: 체력이 줄면 쓰는 패턴이 늘어난다.
  const phase = bossPhaseOf(e);
  if (phase !== e.bossPhase) {
    e.bossPhase = phase;
    e.patternCursor = 0;
    world.addShake(5);
    world.showBanner(phase === 1 ? '보스 2단계' : '보스 최종 단계', phase === 1 ? '새 패턴: 부채꼴 · 지수' : '새 패턴: 방사형 · 탄젠트', '#ffffff', 1.8);
  }
  const phaseCfg = cfg.phases[e.bossPhase];

  switch (e.state) {
    case 'walk': {
      e.fireTimer -= dt;
      if (!p.alive) {
        b.vx = approach(b.vx, 0, 1500 * dt);
        break;
      }
      // 바닥 위에서 플레이어와 preferredDistance를 유지한다(발판 위로 피해도 곡선 패턴이 높이를 커버).
      const side = dx >= 0 ? -1 : 1;
      const desired = p.body.x + side * cfg.preferredDistance;
      const ddx = desired - b.x;
      if (b.grounded) b.vx = Math.abs(ddx) < 30 ? approach(b.vx, 0, 1500 * dt) : Math.sign(ddx) * e.stats.speed;
      if (b.grounded && b.wallDir !== 0 && Math.sign(b.vx) === b.wallDir) b.vy = -ENEMIES.jumpVelocity;
      if (e.fireTimer <= 0 && b.grounded) {
        const moves = PHASE_MOVES[e.bossPhase];
        const move = moves[e.patternCursor % moves.length];
        e.patternCursor++;
        e.castName = BOSS_MOVE_NAMES[move];
        e.pending = planBossMove(world, e, move);
        e.aim = aimFrom(e.shoulder(), playerTargetPoint(world));
        e.state = 'cast';
        e.stateTimer = phaseCfg.telegraph;
      }
      break;
    }
    case 'cast': {
      b.vx = approach(b.vx, 0, 2000 * dt);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        // 예고가 끝나면 지연 시간이 지난 곡선부터 차례로 발사한다.
        const elapsed = -e.stateTimer;
        const remaining: PendingCurve[] = [];
        for (const pc of e.pending) {
          if (pc.delay <= elapsed) fireEnemyCurve(world, e, pc);
          else remaining.push(pc);
        }
        e.pending = remaining;
        if (remaining.length === 0) {
          e.state = 'recover';
          e.stateTimer = 0.45;
          e.fireTimer = phaseCfg.interval * randRange(0.9, 1.1);
        }
      }
      break;
    }
    case 'recover':
      b.vx = approach(b.vx, 0, 1500 * dt);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = 'walk';
        e.castName = '';
      }
      break;
  }
}
