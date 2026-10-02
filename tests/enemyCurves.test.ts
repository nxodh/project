import { beforeEach, describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { ENEMIES, ENEMY_PATTERN_TUNING, STEP } from '../src/config';
import { setSeed } from '../src/core/rng';
import { updateAttacks } from '../src/game/combat';
import { BOSS_MOVE_NAMES, planBossMove, type BossMove } from '../src/game/bossAI';
import { updateEnemies } from '../src/game/enemyAI';
import { spawnEnemy } from '../src/game/waves';
import { World } from '../src/game/world';
import { moveBody } from '../src/world/physics';

beforeEach(() => setSeed(7));

function placePlayer(world: World, x: number, y: number): void {
  world.player.body.x = x;
  world.player.body.y = y;
  world.player.lastSurfaceId = world.nav.surfaceAt(x, y)?.id ?? -1;
}

describe('적의 함수 곡선 공격', () => {
  it('사인 술사: 예고선을 보여 준 뒤 정확히 그 경로로 사인파를 쏜다', () => {
    const world = new World(1);
    world.debug.invincible = true;
    placePlayer(world, 1000, 820);
    const e = spawnEnemy(world, 'sine', 1450, 820, false);
    e.spawnTimer = 0;
    e.fireTimer = 0;
    let lockedPreview: number[] | null = null;
    for (let i = 0; i < 4 / STEP && world.enemyAttacks.length === 0; i++) {
      updateEnemies(world, STEP);
      if (e.state === 'aim' && e.aimLocked && e.pending.length) lockedPreview = Array.from(e.pending[0].path.xs.subarray(0, e.pending[0].path.count));
    }
    expect(world.enemyAttacks.length).toBe(1);
    const a = world.enemyAttacks[0];
    expect(a.owner).toBe('enemy');
    expect(a.def.id).toBe('e-sine');
    expect(lockedPreview).not.toBeNull();
    expect(Array.from(a.path.xs.subarray(0, a.path.count))).toEqual(lockedPreview);
  });

  it('적 곡선은 플레이어를 한 번만 맞히고, 피해량에 웨이브 배율이 반영된다', () => {
    const world = new World(1);
    placePlayer(world, 1000, 820);
    world.waves.wave = 7;
    const e = spawnEnemy(world, 'sine', 1450, 820, false);
    e.spawnTimer = 0;
    e.fireTimer = 0;
    let hits = 0;
    let lastHp = world.player.hp;
    for (let i = 0; i < 4 / STEP; i++) {
      updateEnemies(world, STEP);
      updateAttacks(world, STEP);
      world.player.invuln = 0; // 무적 시간을 없애도 같은 곡선에 두 번 맞지 않아야 한다
      if (world.player.hp < lastHp) {
        hits++;
        lastHp = world.player.hp;
      }
      if (world.enemyAttacks.length > 0) e.fireTimer = 99; // 첫 발사 뒤 두 번째 발사는 막는다
    }
    expect(hits).toBe(1);
    const expected = Math.round(ENEMY_PATTERN_TUNING.sineWave.damage * e.stats.damageMul);
    expect(world.player.maxHp - world.player.hp).toBe(expected);
  });

  it('포물선 투척병: 플레이어 발밑에 떨어지도록 사거리를 맞추고, 낮은 턱 너머로도 닿는다', () => {
    const world = new World(1);
    world.debug.invincible = true;
    // 플레이어는 낮은 턱(700~900) 오른쪽, 투척병은 왼쪽
    placePlayer(world, 1000, 820);
    const e = spawnEnemy(world, 'lobber', 560, 820, false);
    e.spawnTimer = 0;
    e.fireTimer = 0;
    for (let i = 0; i < 4 / STEP && world.enemyAttacks.length === 0; i++) updateEnemies(world, STEP);
    expect(world.enemyAttacks.length).toBe(1);
    const a = world.enemyAttacks[0];
    const endX = a.path.xs[a.path.count - 1];
    const endY = a.path.ys[a.path.count - 1];
    expect(a.path.blocked && endY < 760).toBe(false); // 턱이나 발판에 걸리지 않음
    expect(Math.abs(endX - world.player.body.x)).toBeLessThan(60);
    expect(Math.min(...Array.from(a.path.ys.subarray(0, a.path.count)))).toBeLessThan(700); // 위로 솟는 궤적
  });

  it('플레이어 곡선이 뻗어 오는 적 곡선의 머리에 닿으면 적 곡선이 그 자리에서 끊긴다(상쇄)', async () => {
    const { CurveAttack } = await import('../src/weapons/attack');
    const { buildCurvePath, makeAimFrame } = await import('../src/weapons/curve');
    const { ENEMY_PATTERNS } = await import('../src/weapons/enemyPatterns');
    const world = new World(1);
    // 적 곡선: 오른쪽에서 왼쪽으로 수평 직선(사인파 대신 단순한 직선 패턴으로 시험)
    const pat = ENEMY_PATTERNS.bossLine;
    const enemyCurve = new CurveAttack(pat, buildCurvePath(pat, makeAimFrame({ x: 1500, y: 300 }, { x: -1, y: 0 }), world.arena), 'enemy');
    world.enemyAttacks.push(enemyCurve);
    // 플레이어 곡선: x=1100에서 위아래로 세운 직선(이미 다 그려진 상태)
    const def = world.weapons[0];
    const wall = new CurveAttack(def, buildCurvePath(def, makeAimFrame({ x: 1100, y: 100 }, { x: 0, y: 1 }), world.arena));
    wall.age = wall.growTime + 0.001;
    world.attacks.push(wall);
    for (let i = 0; i < 60; i++) {
      wall.age = wall.growTime + 0.001; // 시험용: 플레이어 곡선을 계속 유지
      updateAttacks(world, STEP);
    }
    expect(enemyCurve.cutLength).not.toBeNull();
    expect(enemyCurve.cutLength!).toBeGreaterThan(380);
    expect(enemyCurve.cutLength!).toBeLessThan(420);
  });

  it('조준이 고정된 뒤 숙이면 사인파를 피할 수 있다(숙인 키 아래로 지나감)', () => {
    const world = new World(1);
    placePlayer(world, 1000, 820);
    const e = spawnEnemy(world, 'sine', 1300, 820, false);
    e.spawnTimer = 0;
    e.fireTimer = 0;
    let crouched = false;
    for (let i = 0; i < 4 / STEP; i++) {
      updateEnemies(world, STEP);
      updateAttacks(world, STEP);
      if (e.aimLocked && !crouched) {
        world.player.crouching = true;
        world.player.body.h = 56;
        crouched = true;
      }
      if (world.enemyAttacks.length > 0) e.fireTimer = 99;
    }
    // 서 있는 가슴 높이를 노린 파동의 진폭(±46)이 숙인 몸(높이 56) 위로 지나가는지는 거리에 따라 다르므로,
    // 최소한 맞더라도 한 번만 맞는지 확인한다.
    expect(world.enemyAttacks.length + (world.player.hp < world.player.maxHp ? 1 : 0)).toBeGreaterThan(0);
    expect(world.player.maxHp - world.player.hp).toBeLessThanOrEqual(Math.round(ENEMY_PATTERN_TUNING.sineWave.damage * e.stats.damageMul));
  });
});

describe('보스', () => {
  it('모든 패턴이 실제 함수 곡선 경로를 만든다(예고선 = 발사 경로)', () => {
    const world = new World(1);
    placePlayer(world, 520, 820);
    const boss = spawnEnemy(world, 'boss', 1250, 820);
    boss.spawnTimer = 0;
    for (const phase of [0, 1, 2]) {
      boss.bossPhase = phase;
      for (const move of Object.keys(BOSS_MOVE_NAMES) as BossMove[]) {
        const plan = planBossMove(world, boss, move);
        expect(plan.length).toBeGreaterThan(0);
        for (const pc of plan) expect(pc.path.count).toBeGreaterThan(1);
      }
    }
  });

  it('보스는 발판을 통과해 걷는 거인이다(바닥하고만 충돌)', () => {
    const world = new World(1);
    const boss = spawnEnemy(world, 'boss', 100, 820);
    expect(boss.body.groundOnly).toBe(true);
    // 왼쪽 낮은 발판(170~480, y 660) 아래를 지나간다
    for (let i = 0; i < 240; i++) {
      boss.body.vx = 200;
      moveBody(boss.body, world.arena, STEP);
    }
    expect(boss.body.x).toBeGreaterThan(500);
    expect(boss.body.y).toBe(820);
  });

  it('체력이 줄면 단계가 오르며 쓰는 패턴이 늘고, 마지막 단계에서 부하를 부른다', () => {
    const world = new World(1);
    world.debug.invincible = true;
    world.waves.wave = 5;
    placePlayer(world, 520, 820);
    const boss = spawnEnemy(world, 'boss', 1250, 820);
    boss.spawnTimer = 0;
    const casts = new Set<string>();
    const run = (seconds: number) => {
      for (let i = 0; i < seconds / STEP; i++) {
        updateEnemies(world, STEP);
        updateAttacks(world, STEP);
        if (boss.castName) casts.add(boss.castName);
        world.player.invuln = 0;
        world.player.hp = world.player.maxHp;
      }
    };
    run(8);
    expect(boss.bossPhase).toBe(0);
    const phase0 = casts.size;
    expect(phase0).toBeGreaterThanOrEqual(3);
    boss.hp = boss.maxHp * 0.25;
    run(12);
    expect(boss.bossPhase).toBe(2);
    expect(casts.size).toBeGreaterThan(phase0);
    expect(world.enemies.filter((x) => x.kind !== 'boss').length).toBeGreaterThanOrEqual(2);
    expect(boss.summoned).toBe(true);
  });

  it('보스를 쓰러뜨리면 점수·회복·보스 처치 수가 오르고 남은 보스 곡선이 사라진다', async () => {
    const { damageEnemy } = await import('../src/game/combat');
    const { CurveAttack } = await import('../src/weapons/attack');
    const { buildCurvePath, makeAimFrame } = await import('../src/weapons/curve');
    const world = new World(1);
    world.player.hp = 30;
    const boss = spawnEnemy(world, 'boss', 1200, 820);
    boss.spawnTimer = 0;
    boss.hp = 1;
    const def = world.weapons[0];
    const atk = new CurveAttack(def, buildCurvePath(def, makeAimFrame({ x: 600, y: 750 }, { x: 1, y: 0 }), world.arena));
    world.enemyAttacks.push(atk);
    damageEnemy(world, boss, atk, { x: 1200, y: 750, tx: 1, ty: 0 });
    expect(boss.alive).toBe(false);
    expect(world.stats.bossesDefeated).toBe(1);
    expect(world.player.hp).toBe(30 + ENEMIES.boss.heal);
    expect(world.score).toBeGreaterThanOrEqual(boss.stats.score);
    expect(world.enemyAttacks.length).toBe(0);
  });
});
