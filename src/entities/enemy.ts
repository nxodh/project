import { ENEMIES, WAVES } from '../config';
import type { Rect, Vec2 } from '../core/geometry';
import { bodyRect, makeBody, type Body } from '../world/physics';

export type EnemyKind = 'melee' | 'ranged';

export type MeleeState = 'chase' | 'windup' | 'strike' | 'recover';
export type RangedState = 'move' | 'aim' | 'recover';

/** 웨이브 배율이 적용된 개체별 수치. */
export interface EnemyScaledStats {
  hp: number;
  speed: number;
  damage: number;
  score: number;
  fireInterval: number;
  knockbackTaken: number;
}

let nextEnemyId = 1;

export function resetEnemyIds(): void {
  nextEnemyId = 1;
}

export class Enemy {
  readonly id = nextEnemyId++;
  readonly body: Body;
  hp: number;
  readonly maxHp: number;
  readonly color: string;
  alive = true;
  facing: 1 | -1 = 1;
  /** 생성 예고 남은 시간. 0이 될 때까지 행동·피격 없음. */
  spawnTimer: number = ENEMIES.spawnTelegraph;
  state: MeleeState | RangedState;
  stateTimer = 0;
  stun = 0;
  flash = 0;
  walkPhase = 0;
  /** 원거리형: 다음 발사까지 남은 시간. */
  fireTimer: number;
  /** 원거리형: 조준 방향(단위 벡터)과 조준 고정 여부. */
  aim: Vec2 = { x: 1, y: 0 };
  aimLocked = false;
  /** 근접형: 이번 공격이 이미 맞혔는지. */
  strikeHit = false;
  /** 낮은 턱 아래를 지나가기 위해 숙인 상태와 최소 유지 시간. */
  crouching = false;
  crouchTimer = 0;
  readonly standHeight: number;
  /** 내비게이션 상태. */
  lastSurfaceId = -1;
  navJumpTargetX: number | null = null;
  stuckTime = 0;
  noSightTime = 0;
  /** 데미지 숫자/체력바 표시용 최근 피격 시각. */
  lastHitAt = -10;

  constructor(
    readonly kind: EnemyKind,
    x: number,
    y: number,
    readonly stats: EnemyScaledStats,
    readonly elite: boolean,
  ) {
    const base = ENEMIES[kind];
    const size = elite ? 1.15 : 1;
    this.standHeight = base.height * size;
    this.body = makeBody(x, y, base.width * size, this.standHeight);
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.color = base.color;
    this.state = kind === 'melee' ? 'chase' : 'move';
    this.fireTimer = stats.fireInterval * 0.6;
  }

  get active(): boolean {
    return this.alive && this.spawnTimer <= 0;
  }

  /** 피격 영역. */
  hurtbox(): Rect {
    const r = bodyRect(this.body);
    return { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 1 };
  }

  center(): Vec2 {
    return { x: this.body.x, y: this.body.y - this.body.h / 2 };
  }

  /** 원거리형 총구/근접형 손 위치. */
  handPos(): Vec2 {
    const s = this.body.h / 92;
    return { x: this.body.x + this.aim.x * 34 * s, y: this.body.y - 66 * s + this.aim.y * 34 * s };
  }
}

export function scaledStats(kind: EnemyKind, wave: number, elite: boolean): EnemyScaledStats {
  const base = ENEMIES[kind];
  const eliteHp = elite ? 2.1 : 1;
  const eliteDmg = elite ? 1.3 : 1;
  const damage = kind === 'melee' ? ENEMIES.melee.damage : ENEMIES.ranged.damage;
  return {
    hp: Math.round(base.hp * WAVES.hpMultiplier(wave) * eliteHp),
    speed: base.speed * WAVES.speedMultiplier(wave) * (elite ? 0.9 : 1),
    damage: Math.round(damage * WAVES.damageMultiplier(wave) * eliteDmg),
    score: Math.round(base.score * WAVES.scoreMultiplier(wave) * (elite ? 2 : 1)),
    fireInterval: ENEMIES.ranged.fireInterval * WAVES.fireIntervalMultiplier(wave),
    knockbackTaken: base.knockbackTaken * (elite ? 0.55 : 1),
  };
}
