import { beforeEach, describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { STEP, WAVES } from '../src/config';
import { random, setSeed } from '../src/core/rng';
import { rectsOverlap } from '../src/core/geometry';
import { updateBullets } from '../src/game/combat';
import { updateEnemies } from '../src/game/enemyAI';
import { buildQueue, findSpawnPoint, isBossWave, spawnEnemy, updateWaves } from '../src/game/waves';
import { World } from '../src/game/world';

beforeEach(() => setSeed(42));

function surfaceIdAt(world: World, x: number, y: number): number {
  const s = world.nav.surfaceAt(x, y);
  if (!s) throw new Error(`no surface at ${x},${y}`);
  return s.id;
}

function placePlayer(world: World, x: number, y: number): void {
  world.player.body.x = x;
  world.player.body.y = y;
  world.player.lastSurfaceId = surfaceIdAt(world, x, y);
}

describe('내비게이션 그래프', () => {
  it('시작 구역의 모든 지형 윗면이 서로 오갈 수 있다', () => {
    const world = new World(1);
    const n = world.nav.surfaces.length;
    expect(n).toBeGreaterThanOrEqual(7);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) expect(world.nav.nextHop(a, b)).not.toBeNull();
  });

  it('무작위로 생성되는 모든 청크(여러 시드 × 좌우 20청크)도 서로 오갈 수 있다', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const world = new World(seed);
      for (let k = -20; k <= 20; k += 1) {
        world.nav.ensureAround(k * 1600 + 800);
        const n = world.nav.surfaces.length;
        for (let a = 0; a < n; a++) {
          for (let b = 0; b < n; b++) {
            if (world.nav.nextHop(a, b) === null) {
              throw new Error(`seed ${seed} chunk ${k}: ${JSON.stringify(world.nav.surfaces[a])} → ${JSON.stringify(world.nav.surfaces[b])}`);
            }
          }
        }
      }
    }
  });

  it('이어진 바닥 조각은 하나의 면으로 합쳐진다', () => {
    const world = new World(3);
    const ground = world.nav.surfaces.filter((s) => s.y === world.arena.groundY);
    expect(ground.length).toBe(1);
    expect(ground[0].x2 - ground[0].x1).toBe(1600 * 5);
  });
});

describe('근접형 AI', () => {
  const cases: Array<[string, number, number]> = [
    ['중앙 발판', 800, 500],
    ['왼쪽 높은 발판', 390, 350],
    ['오른쪽 낮은 발판', 1300, 660],
    ['낮은 턱 위', 800, 732],
  ];
  for (const [name, px, py] of cases) {
    it(`바닥에서 출발해 ${name} 위의 플레이어에게 도달한다`, () => {
      const world = new World(1);
      world.debug.invincible = true;
      placePlayer(world, px, py);
      const target = world.player.lastSurfaceId;
      const e = spawnEnemy(world, 'melee', 60, 820, false);
      e.spawnTimer = 0;
      let reached = false;
      for (let i = 0; i < 20 / STEP && !reached; i++) {
        updateEnemies(world, STEP);
        if (e.body.grounded && e.lastSurfaceId === target && Math.abs(e.body.x - px) < 80) reached = true;
      }
      expect(reached).toBe(true);
    });
  }

  it('가까운 쪽 발판을 경유한다(오른쪽 끝에서 중앙 발판까지 6초 이내)', () => {
    const world = new World(1);
    world.debug.invincible = true;
    placePlayer(world, 900, 500);
    const target = world.player.lastSurfaceId;
    const e = spawnEnemy(world, 'melee', 1530, 820, false);
    e.spawnTimer = 0;
    let minX = Infinity;
    let reachedAt = -1;
    for (let i = 0; i < 6 / STEP && reachedAt < 0; i++) {
      updateEnemies(world, STEP);
      minX = Math.min(minX, e.body.x);
      if (e.body.grounded && e.lastSurfaceId === target) reachedAt = i * STEP;
    }
    expect(reachedAt).toBeGreaterThan(0);
    expect(minX).toBeGreaterThan(1000); // 왼쪽으로 돌아가지 않음
  });

  it('턱 아래에 숙인 플레이어에게 숙여서 다가가 공격한다', () => {
    const world = new World(1);
    placePlayer(world, 800, 820);
    world.player.crouching = true;
    world.player.body.h = 56;
    const e = spawnEnemy(world, 'melee', 300, 820, false);
    e.spawnTimer = 0;
    for (let i = 0; i < 8 / STEP && world.player.hp === world.player.maxHp; i++) {
      updateEnemies(world, STEP);
      world.player.invuln = 0;
    }
    expect(world.player.hp).toBeLessThan(world.player.maxHp);
  });
});

describe('원거리형 AI', () => {
  it('거리를 두고 플레이어를 향해 직선 탄환을 쏜다', () => {
    const world = new World(1);
    placePlayer(world, 1000, 820);
    const e = spawnEnemy(world, 'ranged', 1450, 820, false);
    e.spawnTimer = 0;
    let fired = 0;
    let minDist = Infinity;
    for (let i = 0; i < 8 / STEP; i++) {
      const before = world.bullets.length;
      updateEnemies(world, STEP);
      if (world.bullets.length > before) {
        fired++;
        const b = world.bullets[world.bullets.length - 1];
        expect(b.vx).toBeLessThan(0); // 플레이어 쪽(왼쪽)으로
      }
      updateBullets(world, STEP);
      world.player.invuln = 0;
      minDist = Math.min(minDist, Math.abs(e.body.x - world.player.body.x));
    }
    expect(fired).toBeGreaterThanOrEqual(2);
    expect(world.player.hp).toBeLessThan(world.player.maxHp);
    expect(minDist).toBeGreaterThan(250);
  });

  it('시야가 막히면 이동해 시야를 확보한 뒤 사격한다(발판 위 플레이어)', () => {
    const world = new World(1);
    world.debug.invincible = true;
    placePlayer(world, 800, 500);
    const e = spawnEnemy(world, 'ranged', 1450, 820, false);
    e.spawnTimer = 0;
    let firedAt = -1;
    for (let i = 0; i < 8 / STEP && firedAt < 0; i++) {
      updateEnemies(world, STEP);
      if (world.bullets.length > 0) firedAt = i * STEP;
    }
    expect(firedAt).toBeGreaterThan(0);
  });

  it('사거리 밖(먼 발판)에 있으면 다가와서 사격한다(대치 상태로 멈추지 않음)', () => {
    const world = new World(1);
    world.debug.invincible = true;
    placePlayer(world, 40, 820);
    const e = spawnEnemy(world, 'ranged', 1170, 660, false);
    e.spawnTimer = 0;
    let firedAt = -1;
    for (let i = 0; i < 10 / STEP && firedAt < 0; i++) {
      updateEnemies(world, STEP);
      if (world.bullets.length > 0) firedAt = i * STEP;
    }
    expect(firedAt).toBeGreaterThan(0);
  });

  it('숙인 플레이어는 조준이 고정된 뒤 숙이면 서 있는 높이로 날아오는 탄환을 피한다', () => {
    const world = new World(1);
    placePlayer(world, 1000, 820);
    world.debug.freezeEnemies = false;
    const e = spawnEnemy(world, 'ranged', 1450, 820, false);
    e.spawnTimer = 0;
    e.fireTimer = 0;
    // 조준 고정까지 서 있다가, 고정 직후 숙인다
    let crouched = false;
    for (let i = 0; i < 3 / STEP; i++) {
      updateEnemies(world, STEP);
      if (e.aimLocked && !crouched) {
        world.player.crouching = true;
        world.player.body.h = 56;
        crouched = true;
      }
      updateBullets(world, STEP);
      if (world.bullets.length === 0 && crouched && e.state === 'move') break;
    }
    expect(crouched).toBe(true);
    expect(world.player.hp).toBe(world.player.maxHp);
  });
});

describe('웨이브와 스폰', () => {
  it('스폰 위치는 지형과 겹치지 않고, 플레이어와 떨어져 있으며, 바로 위가 아니다', () => {
    const world = new World(1);
    for (let i = 0; i < 300; i++) {
      const s = world.nav.surfaces[Math.floor(random() * world.nav.surfaces.length)];
      placePlayer(world, s.x1 + 20 + random() * (s.x2 - s.x1 - 40), s.y);
      const pt = findSpawnPoint(world, i % 2 ? 'melee' : 'ranged');
      const rect = { x: pt.x - 15, y: pt.y - 106, w: 30, h: 106 };
      expect(world.arena.overlapsSolid(rect)).toBe(false);
      const dx = pt.x - world.player.body.x;
      const isFallback = pt.y === world.arena.groundY && Math.abs(dx) >= 900;
      if (!isFallback) {
        expect(Math.hypot(dx, pt.y - world.player.body.y)).toBeGreaterThanOrEqual(WAVES.minSpawnDistance);
        expect(Math.abs(dx)).toBeGreaterThanOrEqual(WAVES.noSpawnAboveHalfWidth);
        expect(Math.abs(dx)).toBeLessThanOrEqual(WAVES.maxSpawnDistanceX);
      }
      // 스폰 지점은 실제로 밟을 수 있는 면 위
      expect(world.nav.surfaceAt(pt.x, pt.y)).not.toBeNull();
      expect(rectsOverlap(rect, world.player.hurtbox())).toBe(false);
    }
  });

  it('적을 모두 처치하면 준비 시간 뒤 더 많은 적으로 다음 웨이브가 시작된다', () => {
    const world = new World(1);
    world.player.hp = 50;
    const counts: number[] = [];
    let lastWave = 0;
    for (let i = 0; i < 60 / STEP && world.waves.wave < 4; i++) {
      updateWaves(world, STEP);
      if (world.waves.wave !== lastWave) {
        lastWave = world.waves.wave;
        counts.push(world.waves.total);
      }
      // 나타난 적은 즉시 처치
      for (const e of world.enemies) e.alive = false;
      world.enemies.length = 0;
    }
    expect(counts.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    expect(world.player.hp).toBeGreaterThan(50); // 웨이브 클리어 회복
  });

  it('5웨이브마다 보스전: 보스가 먼저 나오고 부하가 뒤따른다', () => {
    expect(buildQueue(5)[0]).toBe('boss');
    expect(buildQueue(10)[0]).toBe('boss');
    expect(buildQueue(10).filter((k) => k === 'boss').length).toBe(1);
    for (const w of [1, 2, 3, 4, 6, 7, 9, 11]) expect(buildQueue(w)).not.toContain('boss');
    expect(isBossWave(5) && isBossWave(15) && !isBossWave(4)).toBe(true);
  });

  it('웨이브가 진행되면 함수 곡선을 쓰는 적(사인 술사·포물선 투척병)이 섞인다', () => {
    expect(buildQueue(2)).not.toContain('sine');
    expect(buildQueue(3)).toContain('sine');
    expect(buildQueue(3)).not.toContain('lobber');
    expect(buildQueue(4)).toContain('lobber');
  });

  it('두 번째 보스는 첫 보스보다 체력이 많다', () => {
    const world = new World(1);
    world.waves.wave = 5;
    const b1 = spawnEnemy(world, 'boss', 1200, 820);
    world.waves.wave = 10;
    const b2 = spawnEnemy(world, 'boss', 1300, 820);
    expect(b2.maxHp).toBeGreaterThan(b1.maxHp);
  });

  it('플레이어에게서 너무 멀어진 적은 대기열로 돌아가 근처에서 다시 나온다', () => {
    const world = new World(1);
    world.waves.wave = 1;
    world.waves.phase = 'active';
    world.waves.queue = [];
    const e = spawnEnemy(world, 'melee', 520 + 3000, 820, false);
    e.spawnTimer = 0;
    updateWaves(world, STEP);
    expect(e.alive).toBe(false);
    // 대기열로 돌아간 적이 곧바로 플레이어 근처에 다시 나온다.
    const respawned = world.enemies.filter((x) => x.alive && x.kind === 'melee');
    expect(respawned.length).toBe(1);
    expect(Math.abs(respawned[0].body.x - world.player.body.x)).toBeLessThan(2400);
  });

  it('웨이브가 높을수록 적의 체력과 속도가 증가한다', () => {
    const world = new World(1);
    world.waves.wave = 1;
    const a = spawnEnemy(world, 'melee', 100, 820, false);
    world.waves.wave = 6;
    const b = spawnEnemy(world, 'melee', 1500, 820, false);
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    expect(b.stats.speed).toBeGreaterThan(a.stats.speed);
  });

  it('새 World는 적·공격·점수·타이머가 모두 초기 상태다(재시작)', () => {
    const w1 = new World(1);
    w1.score = 999;
    spawnEnemy(w1, 'melee', 100, 820, false);
    const w2 = new World(1);
    expect(w2.score).toBe(0);
    expect(w2.kills).toBe(0);
    expect(w2.enemies.length).toBe(0);
    expect(w2.attacks.length).toBe(0);
    expect(w2.bullets.length).toBe(0);
    expect(w2.waves.wave).toBe(0);
    expect(w2.waves.timer).toBe(WAVES.firstDelay);
    expect(w2.player.hp).toBe(w2.player.maxHp);
    expect(w2.player.cooldowns.every((c) => c === 0)).toBe(true);
    expect(w2.enemyAttacks.length).toBe(0);
    expect(w2.enemies.length === 0 && w2.time === 0).toBe(true);
  });
});
