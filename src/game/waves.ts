import { ENEMIES, PLAYER, WAVES } from '../config';
import { random, randRange } from '../core/rng';
import { Enemy, scaledStats, type EnemyKind } from '../entities/enemy';
import type { World } from './world';

export interface WaveState {
  /** 현재(또는 마지막으로 시작한) 웨이브 번호. 0이면 아직 시작 전. */
  wave: number;
  phase: 'intermission' | 'active';
  /** 다음 웨이브까지 남은 준비 시간. */
  timer: number;
  queue: EnemyKind[];
  spawnTimer: number;
  total: number;
}

export function createWaveState(): WaveState {
  return { wave: 0, phase: 'intermission', timer: WAVES.firstDelay, queue: [], spawnTimer: 0, total: 0 };
}

/** 모든 웨이브가 보스전이다. */
export function isBossWave(wave: number): boolean {
  return wave > 0;
}

/** 웨이브 구성: 보스 한 마리. (잡몹 웨이브는 없다.) */
export function buildQueue(_wave: number): EnemyKind[] {
  return ['boss'];
}

export function startWave(world: World, wave: number): void {
  const w = world.waves;
  w.wave = wave;
  w.phase = 'active';
  w.queue = buildQueue(wave);
  w.total = w.queue.length;
  w.spawnTimer = 0;
  world.showBanner(`BOSS · WAVE ${wave}`, '함수의 군주가 나타났다', '#ffffff', 2.6);
}

function fitsAt(world: World, kind: EnemyKind, x: number, y: number): boolean {
  // 보스는 발판을 통과하므로 바닥 위이기만 하면 된다.
  if (kind === 'boss') return y === world.arena.groundY;
  const base = ENEMIES[kind];
  // 정예(1.15배)가 나와도 겹치지 않도록 큰 쪽 크기로 검사한다.
  const w = base.width * 1.15;
  const h = base.height * 1.15;
  return !world.arena.overlapsSolid({ x: x - w / 2, y: y - h, w, h });
}

/**
 * 스폰 위치를 고른다. 플레이어 주변(좌우 maxSpawnDistanceX 이내) 지형 윗면 위,
 * 지형과 겹치지 않고, 플레이어와 충분히 떨어져 있으며, 플레이어 바로 위/아래는 피한다.
 * 보스는 바닥 위, 플레이어에게서 약 700px 떨어진 곳에 나온다.
 */
export function findSpawnPoint(world: World, kind: EnemyKind): { x: number; y: number } {
  const p = world.player;
  const ground = world.arena.groundY;
  if (kind === 'boss') {
    for (let attempt = 0; attempt < 20; attempt++) {
      const side = random() < 0.5 ? -1 : 1;
      const x = p.body.x + side * randRange(620, 820);
      if (fitsAt(world, kind, x, ground)) return { x, y: ground };
    }
  } else {
    const surfaces = world.nav.surfaces
      .map((s) => ({
        s,
        x1: Math.max(s.x1, p.body.x - WAVES.maxSpawnDistanceX),
        x2: Math.min(s.x2, p.body.x + WAVES.maxSpawnDistanceX),
      }))
      .filter((c) => c.x2 - c.x1 >= 120);
    const totalLen = surfaces.reduce((acc, c) => acc + (c.x2 - c.x1), 0);
    for (let attempt = 0; attempt < 60 && totalLen > 0; attempt++) {
      let pick = random() * totalLen;
      let c = surfaces[0];
      for (const cand of surfaces) {
        pick -= cand.x2 - cand.x1;
        if (pick <= 0) {
          c = cand;
          break;
        }
      }
      const x = randRange(c.x1 + 26, c.x2 - 26);
      const y = c.s.y;
      if (!fitsAt(world, kind, x, y)) continue;
      const dx = x - p.body.x;
      const dy = y - p.body.y;
      if (Math.hypot(dx, dy) < WAVES.minSpawnDistance) continue;
      if (Math.abs(dx) < WAVES.noSpawnAboveHalfWidth) continue;
      if (world.enemies.some((e) => Math.abs(e.body.x - x) < 50 && Math.abs(e.body.y - y) < 10)) continue;
      return { x, y };
    }
  }
  // 대체 위치: 플레이어 좌우 바닥 중 지형과 겹치지 않는 곳
  for (let d = 900; d < 2400; d += 60) {
    for (const side of [1, -1]) {
      const x = p.body.x + side * d;
      if (fitsAt(world, kind, x, ground)) return { x, y: ground };
    }
  }
  return { x: p.body.x + 900, y: ground };
}

export function spawnEnemy(world: World, kind: EnemyKind, x?: number, y?: number, elite?: boolean): Enemy {
  const wave = Math.max(1, world.waves.wave);
  const isElite = kind === 'boss' ? false : (elite ?? false);
  const pos = x !== undefined && y !== undefined ? { x, y } : findSpawnPoint(world, kind);
  const e = new Enemy(kind, pos.x, pos.y, scaledStats(kind, wave, isElite), isElite);
  e.facing = world.player.body.x >= pos.x ? 1 : -1;
  e.lastSurfaceId = world.nav.surfaceAt(pos.x, pos.y)?.id ?? -1;
  world.enemies.push(e);
  return e;
}

/**
 * 플레이어가 멀리 달아나 너무 멀어진 적은 없애고 대기열 앞에 되돌려 근처에서 다시 나오게 한다.
 * 보스는 체력을 유지한 채 플레이어 근처로 옮긴다.
 */
function recallStragglers(world: World): void {
  const p = world.player;
  for (const e of world.enemies) {
    if (!e.alive || Math.abs(e.body.x - p.body.x) < ENEMIES.despawnDistance) continue;
    if (e.kind === 'boss') {
      const pos = findSpawnPoint(world, 'boss');
      e.body.x = pos.x;
      e.body.y = pos.y;
      e.body.vx = 0;
      e.body.vy = 0;
      e.spawnTimer = 0.6;
      e.pending = [];
      e.state = 'walk';
      e.lastSurfaceId = world.nav.surfaceAt(pos.x, pos.y)?.id ?? -1;
    } else {
      e.alive = false;
      world.waves.queue.unshift(e.kind);
    }
  }
}

export function updateWaves(world: World, dt: number): void {
  const w = world.waves;
  if (!world.player.alive) return;

  if (w.phase === 'intermission') {
    w.timer -= dt;
    if (w.timer <= 0) startWave(world, w.wave + 1);
    return;
  }

  recallStragglers(world);
  if (w.queue.length > 0 && !world.debug.noSpawn) spawnEnemy(world, w.queue.shift()!);
  // 생성한 뒤에 센다: 센 다음에 보스가 나오면 같은 틱에 '적 0명·대기열 비음'으로 보여 웨이브가 곧바로 클리어된다.
  const alive = world.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);

  if (w.queue.length === 0 && alive === 0) {
    const p = world.player;
    const healed = Math.min(PLAYER.waveHeal, p.maxHp - p.hp);
    p.hp += healed;
    w.phase = 'intermission';
    w.timer = WAVES.intermission;
    world.showBanner(`WAVE ${w.wave} 클리어`, healed > 0 ? `체력 +${healed}` : '다음 웨이브 준비', '#ffffff', 2.4);
  }
}

/** 남은 적 수(대기열 + 살아 있는 적). */
export function enemiesRemaining(world: World): number {
  return world.waves.queue.length + world.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
}
