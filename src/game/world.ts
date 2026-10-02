import { CAMERA, FX, PLAYER, VIEW } from '../config';
import type { Vec2 } from '../core/geometry';
import { Bullet } from '../entities/bullet';
import { Effects } from '../entities/effects';
import { Enemy, resetEnemyIds } from '../entities/enemy';
import { Player } from '../entities/player';
import { CurveAttack } from '../weapons/attack';
import { getWeapons } from '../weapons/registry';
import type { FunctionWeaponDef } from '../weapons/types';
import { Arena } from '../world/arena';
import { NavGraph } from '../world/navigation';
import type { Body } from '../world/physics';
import { createWaveState, type WaveState } from './waves';

export interface Banner {
  title: string;
  subtitle: string;
  color: string;
  age: number;
  duration: number;
}

export interface RunStats {
  shots: number;
  /** 적을 하나 이상 맞힌 발사 수. */
  hits: number;
  bestMultiKill: number;
  bossesDefeated: number;
  /** 공격 종류별로 플레이어가 받은 피해(밸런스 점검용). */
  damageTaken: Record<string, number>;
}

/**
 * 한 판의 모든 상태. 재시작하면 새 World를 만들어 적·공격·점수·타이머·지형을 한꺼번에 초기화한다.
 */
export class World {
  readonly arena: Arena;
  readonly nav: NavGraph;
  readonly weapons: readonly FunctionWeaponDef[] = getWeapons();
  readonly player: Player;
  readonly enemies: Enemy[] = [];
  /** 플레이어가 쏜 함수 곡선. */
  readonly attacks: CurveAttack[] = [];
  /** 적이 쏜 함수 곡선. */
  readonly enemyAttacks: CurveAttack[] = [];
  readonly bullets: Bullet[] = [];
  readonly fx = new Effects();
  readonly waves: WaveState = createWaveState();
  readonly stats: RunStats = { shots: 0, hits: 0, bestMultiKill: 0, bossesDefeated: 0, damageTaken: {} };
  /** 화면 왼쪽 위에 오는 월드 좌표. 플레이어를 따라 좌우로 움직인다. */
  readonly camera: Vec2 = { x: 0, y: 0 };
  score = 0;
  kills = 0;
  time = 0;
  shake = 0;
  /** 플레이어 사망 후 게임 오버 화면까지 남은 시간(음수면 비활성). */
  gameOverTimer = -1;
  banner: Banner | null = null;
  /** 테스트·디버그용 스위치. */
  readonly debug = { freezeEnemies: false, invincible: false, noSpawn: false };

  constructor(readonly seed: number = Math.floor(Math.random() * 2 ** 31)) {
    resetEnemyIds();
    this.arena = new Arena(seed);
    this.nav = new NavGraph(this.arena);
    this.player = new Player(PLAYER.spawnX, this.arena.groundY, this.weapons.length);
    this.camera.x = this.player.body.x - VIEW.width / 2;
    this.updateTerrain();
  }

  /**
   * 플레이어 주변 청크와 내비게이션 그래프를 준비한다.
   * 그래프가 다시 만들어지면 면 id가 바뀌므로 저장해 둔 id를 위치로 다시 계산한다.
   */
  updateTerrain(): void {
    if (!this.nav.ensureAround(this.player.body.x)) return;
    const surfaceOf = (b: Body) => (this.nav.surfaceAt(b.x, b.y, b.w / 2) ?? this.nav.surfaceBelow(b.x, b.y))?.id ?? -1;
    this.player.lastSurfaceId = surfaceOf(this.player.body);
    for (const e of this.enemies) e.lastSurfaceId = surfaceOf(e.body);
  }

  /**
   * 카메라가 플레이어를 부드럽게 따라가고, 달리는 방향으로 화면을 조금 더 보여 준다.
   * (조준 방향을 기준으로 하면 커서 → 조준 → 카메라 → 커서가 가리키는 월드 점이 서로 물려 흔들리므로 속도를 쓴다.)
   */
  updateCamera(dt: number, snap = false): void {
    const p = this.player;
    const lead = Math.max(-1, Math.min(1, p.body.vx / PLAYER.moveSpeed)) * CAMERA.lookAhead;
    const targetX = p.body.x + lead - VIEW.width / 2;
    if (snap) {
      this.camera.x = targetX;
      return;
    }
    const k = 1 - Math.exp(-CAMERA.followSharpness * dt);
    this.camera.x += (targetX - this.camera.x) * k;
  }

  /** 논리 화면 좌표 → 월드 좌표. */
  viewToWorld(v: Vec2): Vec2 {
    return { x: v.x + this.camera.x, y: v.y + this.camera.y };
  }

  addShake(amount: number): void {
    this.shake = Math.min(FX.shakeMax, this.shake + amount);
  }

  showBanner(title: string, subtitle: string, color: string, duration = 2.2): void {
    this.banner = { title, subtitle, color, age: 0, duration };
  }

  get currentWeapon(): FunctionWeaponDef {
    return this.weapons[this.player.weaponIndex];
  }

  /** 살아 있는 보스(없으면 null). */
  get boss(): Enemy | null {
    return this.enemies.find((e) => e.kind === 'boss' && e.alive) ?? null;
  }
}
