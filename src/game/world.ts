import { FX, PLAYER } from '../config';
import { Bullet } from '../entities/bullet';
import { Effects } from '../entities/effects';
import { Enemy, resetEnemyIds } from '../entities/enemy';
import { Player } from '../entities/player';
import { CurveAttack } from '../weapons/attack';
import { getWeapons } from '../weapons/registry';
import type { FunctionWeaponDef } from '../weapons/types';
import { Arena } from '../world/arena';
import { NavGraph } from '../world/navigation';
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
}

/**
 * 한 판의 모든 상태. 재시작하면 새 World를 만들어 적·공격·점수·타이머를 한꺼번에 초기화한다.
 */
export class World {
  readonly arena = new Arena();
  readonly nav = new NavGraph(this.arena);
  readonly weapons: readonly FunctionWeaponDef[] = getWeapons();
  readonly player: Player;
  readonly enemies: Enemy[] = [];
  readonly attacks: CurveAttack[] = [];
  readonly bullets: Bullet[] = [];
  readonly fx = new Effects();
  readonly waves: WaveState = createWaveState();
  readonly stats: RunStats = { shots: 0, hits: 0, bestMultiKill: 0 };
  score = 0;
  kills = 0;
  time = 0;
  shake = 0;
  /** 플레이어 사망 후 게임 오버 화면까지 남은 시간(음수면 비활성). */
  gameOverTimer = -1;
  banner: Banner | null = null;
  /** 테스트·디버그용 스위치. */
  readonly debug = { freezeEnemies: false, invincible: false, noSpawn: false };

  constructor() {
    resetEnemyIds();
    this.player = new Player(PLAYER.spawnX, this.arena.groundY, this.weapons.length);
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
}
