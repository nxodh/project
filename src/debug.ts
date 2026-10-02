import { setSeed } from './core/rng';
import type { Input } from './core/input';
import type { View } from './core/view';
import type { EnemyKind } from './entities/enemy';
import { damagePlayer } from './game/combat';
import type { Game } from './game/game';
import { computeAttackPath } from './game/weaponSystem';
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
      };
    },
    worldToClient: (x: number, y: number) => view.worldToClient(x, y),
    clientToWorld: (x: number, y: number) => view.clientToWorld(x, y),
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
    clearEnemies() {
      game.world.enemies.length = 0;
      game.world.bullets.length = 0;
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
