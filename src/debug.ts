import { LOADOUT } from './config';
import { setSeed } from './core/rng';
import type { Input } from './core/input';
import type { View } from './core/view';
import type { EnemyKind } from './entities/enemy';
import { damagePlayer } from './game/combat';
import type { Game } from './game/game';
import { computeAttackPath, equipWeapon, evolveWeapon } from './game/weaponSystem';
import type { OperatorId } from './weapons/types';
import { Arena } from './world/arena';
import { spawnEnemy, startWave } from './game/waves';
import type { CurvePath } from './weapons/curve';

function serializePath(p: CurvePath) {
  return {
    xs: Array.from(p.xs.subarray(0, p.count)),
    ys: Array.from(p.ys.subarray(0, p.count)),
    length: p.length,
    blocked: p.blocked,
    count: p.count,
  };
}

/**
 * ?debug 쿼리로 열었을 때만 window.__fx에 노출되는 검사용 API.
 * 자동 브라우저 테스트에서 상태를 읽고 상황(적 위치 등)을 만드는 데 쓴다.
 */
export function installDebugApi(game: Game, view: View, input: Input): void {
  const api = {
    game,
    input,
    get world() {
      return game.world;
    },
    setSeed,
    snapshot() {
      const w = game.world;
      const p = w.player;
      return {
        state: game.state,
        steps: game.totalSteps,
        time: w.time,
        wave: w.waves.wave,
        wavePhase: w.waves.phase,
        waveTimer: w.waves.timer,
        queue: w.waves.queue.length,
        score: w.score,
        kills: w.kills,
        shots: w.stats.shots,
        hits: w.stats.hits,
        player: {
          x: p.body.x,
          y: p.body.y,
          vx: p.body.vx,
          vy: p.body.vy,
          h: p.body.h,
          hp: p.hp,
          alive: p.alive,
          grounded: p.body.grounded,
          crouching: p.crouching,
          facing: p.facing,
          aim: { ...p.aim },
          muzzle: p.muzzle(),
          shoulder: p.shoulder(),
          hurtbox: p.hurtbox(),
          weaponIndex: p.weaponIndex,
          weaponId: w.currentWeapon.id,
          cooldowns: [...p.cooldowns],
          invuln: p.invuln,
        },
        enemies: w.enemies.map((e) => ({
          id: e.id,
          kind: e.kind,
          x: e.body.x,
          y: e.body.y,
          h: e.body.h,
          hp: e.hp,
          maxHp: e.maxHp,
          state: e.state,
          active: e.active,
          pending: e.pending.length,
          grounded: e.body.grounded,
          surface: e.lastSurfaceId,
        })),
        attacks: w.attacks.map((a) => ({
          id: a.id,
          weapon: a.def.id,
          phase: a.phase,
          head: a.headLength,
          tail: a.tailLength,
          length: a.path.length,
          blocked: a.path.blocked,
          hitIds: [...a.hitIds],
        })),
        bullets: w.bullets.length,
        camera: { ...w.camera },
        seed: w.seed,
        enemyAttacks: w.enemyAttacks.map((a) => ({
          id: a.id,
          pattern: a.def.id,
          phase: a.phase,
          length: a.path.length,
          blocked: a.path.blocked,
          hitPlayer: a.hitIds.has(0),
        })),
        boss: w.boss
          ? { hp: w.boss.hp, maxHp: w.boss.maxHp, phase: w.boss.bossPhase, state: w.boss.state, cast: w.boss.castName, active: w.boss.active }
          : null,
        bossesDefeated: w.stats.bossesDefeated,
      };
    },
    /** 월드 좌표 → 브라우저 client 좌표(카메라 반영). */
    worldToClient: (x: number, y: number) => view.viewToClient(x - game.world.camera.x, y - game.world.camera.y),
    clientToWorld: (x: number, y: number) => game.world.viewToWorld(view.clientToView(x, y)),
    /** 논리 화면 좌표 → 브라우저 client 좌표. */
    viewToClient: (x: number, y: number) => view.viewToClient(x, y),
    /** 카메라를 플레이어 위치로 즉시 맞춘다. */
    snapCamera() {
      game.world.updateTerrain();
      game.world.updateCamera(0, true);
    },
    /** 다음 판부터 쓸 지형 시드(null이면 무작위). */
    setTerrainSeed(seed: number | null) {
      game.seed = seed;
    },
    equip: (slot: number, weaponId: string) => equipWeapon(game.world, slot, weaponId),
    evolve: (id: string, op: OperatorId) => evolveWeapon(game.world, id, op),
    addEvoPoints(n: number) {
      game.world.evoPoints += n;
    },
    /** 모든 함수를 보유 상태로 만든다(조준·충돌 시험용). */
    unlockAll() {
      for (const w of game.world.weapons) game.world.owned.add(w.id);
    },
    /** 기본 함수만 가진 상태와 기본 장비로 되돌린다. */
    resetOwned() {
      const w = game.world;
      w.owned.clear();
      for (const d of w.weapons) if (d.starter) w.owned.add(d.id);
      LOADOUT.initial.forEach((id, i) => {
        w.loadout[i].weaponId = id;
      });
    },
    owned: () => [...game.world.owned],
    evoPoints: () => game.world.evoPoints,
    loadout: () => game.world.loadout.map((s, i) => ({ ...s, formula: game.world.slotWeapon(i).formula })),
    previewPath: (weaponIndex?: number) => serializePath(computeAttackPath(game.world, weaponIndex)),
    attackPath: (id: number) => {
      const a = game.world.attacks.find((x) => x.id === id);
      return a ? serializePath(a.path) : null;
    },
    setPlayer(x: number, y: number) {
      const b = game.world.player.body;
      b.x = x;
      b.y = y;
      b.vx = 0;
      b.vy = 0;
      game.world.updateTerrain();
      game.world.updateCamera(0, true);
    },
    setDebug(flags: Partial<{ freezeEnemies: boolean; invincible: boolean; noSpawn: boolean }>) {
      Object.assign(game.world.debug, flags);
    },
    spawn(kind: EnemyKind, x: number, y: number, opts: { active?: boolean; hp?: number; elite?: boolean } = {}) {
      const e = spawnEnemy(game.world, kind, x, y, opts.elite ?? false);
      if (opts.active !== false) e.spawnTimer = 0;
      if (opts.hp !== undefined) e.hp = opts.hp;
      return e.id;
    },
    /** 바닥만 아주 아래에 있는 평지로 지형을 바꾼다(곡선이 지형에 걸리지 않는 조준 시험용). */
    useFlatArena(groundY = 3000) {
      const w = game.world as unknown as { arena: Arena; nav: { arena: Arena } };
      const arena = Arena.fixed([{ kind: 'ground', walkable: true, x: -1e6, y: groundY, w: 2e6, h: 300 }]);
      w.arena = arena;
      w.nav.arena = arena;
    },
    /** 새 판을 시작한다(지형·상태 초기화). */
    newRun() {
      game.startNewRun();
    },
    clearEnemies() {
      game.world.enemies.length = 0;
      game.world.bullets.length = 0;
      game.world.enemyAttacks.length = 0;
    },
    startWave: (n: number) => startWave(game.world, n),
    skipIntermission() {
      game.world.waves.timer = 0;
    },
    setTimeScale(scale: number) {
      game.timeScale = scale;
    },
    step(n: number) {
      game.stepManually(n);
    },
    hurtPlayer(amount: number) {
      game.world.player.invuln = 0;
      damagePlayer(game.world, amount, game.world.player.body.x - 10);
    },
  };
  (window as unknown as { __fx: typeof api }).__fx = api;
}
