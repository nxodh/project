import { ENEMIES, PLAYER, WAVES } from '../config';
import { chance, random, randRange } from '../core/rng';
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

function buildQueue(wave: number): EnemyKind[] {
  const q: EnemyKind[] = [];
  for (let i = 0; i < WAVES.meleeCount(wave); i++) q.push('melee');
  for (let i = 0; i < WAVES.rangedCount(wave); i++) q.push('ranged');
  // 섞되, 첫 적은 근접형으로 두어 웨이브 시작이 갑작스럽지 않게 한다.
  for (let i = q.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(random() * i);
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

export function startWave(world: World, wave: number): void {
  const w = world.waves;
  w.wave = wave;
  w.phase = 'active';
  w.queue = buildQueue(wave);
  w.total = w.queue.length;
  w.spawnTimer = 0;
  world.showBanner(`WAVE ${wave}`, `적 ${w.total}명`, '#e8eefc', 1.8);
}

/**
 * 스폰 위치를 고른다. 지형 윗면 위, 지형과 겹치지 않고, 플레이어와 충분히 떨어져 있으며
 * 플레이어 바로 위/아래(수평 거리가 가까운 곳)는 피한다.
 */
export function findSpawnPoint(world: World, kind: EnemyKind): { x: number; y: number } {
  const p = world.player;
  const base = ENEMIES[kind];
  const surfaces = world.nav.surfaces.filter((s) => s.x2 - s.x1 >= 120);
  const totalLen = surfaces.reduce((acc, s) => acc + (s.x2 - s.x1), 0);
  for (let attempt = 0; attempt < 60; attempt++) {
    let pick = random() * totalLen;
    let s = surfaces[0];
    for (const cand of surfaces) {
      pick -= cand.x2 - cand.x1;
      if (pick <= 0) {
        s = cand;
        break;
      }
    }
    const x = randRange(s.x1 + 26, s.x2 - 26);
    const y = s.y;
    // 정예(1.15배)가 나와도 겹치지 않도록 큰 쪽 크기로 검사한다.
    const w = base.width * 1.15;
    const h = base.height * 1.15;
    const rect = { x: x - w / 2, y: y - h, w, h };
    if (world.arena.overlapsSolid(rect)) continue;
    const dx = x - p.body.x;
    const dy = y - p.body.y;
    if (Math.hypot(dx, dy) < WAVES.minSpawnDistance) continue;
    if (Math.abs(dx) < WAVES.noSpawnAboveHalfWidth) continue;
    if (world.enemies.some((e) => Math.abs(e.body.x - x) < 50 && Math.abs(e.body.y - y) < 10)) continue;
    return { x, y };
  }
  // 대체 위치: 플레이어에게서 먼 쪽 바닥 끝
  const leftX = world.arena.innerLeft + 40;
  const rightX = world.arena.innerRight - 40;
  return { x: Math.abs(p.body.x - leftX) > Math.abs(p.body.x - rightX) ? leftX : rightX, y: world.arena.groundY };
}

export function spawnEnemy(world: World, kind: EnemyKind, x?: number, y?: number, elite?: boolean): Enemy {
  const wave = Math.max(1, world.waves.wave);
  const isElite = elite ?? chance(WAVES.eliteChance(wave));
  const pos = x !== undefined && y !== undefined ? { x, y } : findSpawnPoint(world, kind);
  const e = new Enemy(kind, pos.x, pos.y, scaledStats(kind, wave, isElite), isElite);
  e.facing = world.player.body.x >= pos.x ? 1 : -1;
  world.enemies.push(e);
  return e;
}

export function updateWaves(world: World, dt: number): void {
  const w = world.waves;
  if (!world.player.alive) return;

  if (w.phase === 'intermission') {
    w.timer -= dt;
    if (w.timer <= 0) startWave(world, w.wave + 1);
    return;
  }

  const alive = world.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  w.spawnTimer -= dt;
  if (w.queue.length > 0 && w.spawnTimer <= 0 && alive < WAVES.maxAlive(w.wave) && !world.debug.noSpawn) {
    spawnEnemy(world, w.queue.shift()!);
    w.spawnTimer = WAVES.spawnInterval;
  }

  if (w.queue.length === 0 && alive === 0) {
    const p = world.player;
    const healed = Math.min(PLAYER.waveHeal, p.maxHp - p.hp);
    p.hp += healed;
    w.phase = 'intermission';
    w.timer = WAVES.intermission;
    world.showBanner(`WAVE ${w.wave} 클리어`, healed > 0 ? `체력 +${healed}` : '다음 웨이브 준비', '#9dff4a', 2.4);
  }
}

/** 남은 적 수(대기열 + 살아 있는 적). */
export function enemiesRemaining(world: World): number {
  return world.waves.queue.length + world.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
}
