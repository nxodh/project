import { ENEMIES, WAVES, type HeadShape } from '../config';
import type { Rect, Vec2 } from '../core/geometry';
import type { CurvePath } from '../weapons/curve';
import type { EnemyPatternId } from '../weapons/enemyPatterns';
import { bodyRect, makeBody, type Body } from '../world/physics';

/**
 * melee: 근접형, ranged: 일차함수 사수(직선 탄환), sine: 사인 술사(사인파 곡선),
 * lobber: 포물선 투척병(목표 지점에 떨어지는 포물선), boss: 5웨이브마다 나오는 보스.
 */
export type EnemyKind = 'melee' | 'ranged' | 'sine' | 'lobber' | 'boss';
export type CasterKind = 'ranged' | 'sine' | 'lobber';

export type MeleeState = 'chase' | 'windup' | 'strike' | 'recover';
export type CasterState = 'move' | 'aim' | 'recover';
export type BossState = 'walk' | 'cast' | 'recover';

/** 웨이브 배율이 적용된 개체별 수치. */
export interface EnemyScaledStats {
  hp: number;
  speed: number;
  /** 근접 타격·직선 탄환 피해량. */
  damage: number;
  /** 함수 곡선 공격 피해 배율. */
  damageMul: number;
  score: number;
  fireInterval: number;
  knockbackTaken: number;
}

/** 예고 중인 함수 곡선. 발사 시 이 경로 그대로 나간다(예고선 = 실제 공격). */
export interface PendingCurve {
  pattern: EnemyPatternId;
  path: CurvePath;
  /** 예고가 끝난 뒤 추가로 기다렸다 발사할 시간(연발 패턴). */
  delay: number;
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
  readonly head: HeadShape;
  alive = true;
  facing: 1 | -1 = 1;
  /** 생성 예고 남은 시간. 0이 될 때까지 행동·피격 없음. */
  spawnTimer: number;
  readonly spawnDuration: number;
  state: MeleeState | CasterState | BossState;
  stateTimer = 0;
  stun = 0;
  flash = 0;
  walkPhase = 0;
  /** 원거리형: 다음 발사까지 남은 시간. */
  fireTimer: number;
  /** 조준 방향(단위 벡터)과 조준 고정 여부. */
  aim: Vec2 = { x: 1, y: 0 };
  aimLocked = false;
  /** 예고 중인 함수 곡선들. */
  pending: PendingCurve[] = [];
  /** 근접형: 이번 공격이 이미 맞혔는지. */
  strikeHit = false;
  /** 낮은 턱 아래를 지나가기 위해 숙인 상태와 최소 유지 시간. */
  crouching = false;
  crouchTimer = 0;
  readonly standHeight: number;
  /** 내비게이션 상태. */
  lastSurfaceId = -1;
  navJumpTargetX: number | null = null;
  noSightTime = 0;
  /** 데미지 숫자/체력바 표시용 최근 피격 시각. */
  lastHitAt = -10;
  /** 보스: 현재 단계(0~2), 다음 패턴 순번, 부하 소환 여부, 진행 중인 패턴 이름. */
  bossPhase = 0;
  patternCursor = 0;
  summoned = false;
  castName = '';
  contactCooldown = 0;

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
    this.body.groundOnly = kind === 'boss';
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.color = base.color;
    this.head = base.head;
    this.spawnDuration = kind === 'boss' ? ENEMIES.bossSpawnTelegraph : ENEMIES.spawnTelegraph;
    this.spawnTimer = this.spawnDuration;
    this.state = kind === 'melee' ? 'chase' : kind === 'boss' ? 'walk' : 'move';
    this.fireTimer = stats.fireInterval * 0.6;
  }

  get active(): boolean {
    return this.alive && this.spawnTimer <= 0;
  }

  /** 기본 키(92) 대비 크기. */
  get scale(): number {
    return this.standHeight / 92;
  }

  /** 피격 영역. */
  hurtbox(): Rect {
    const r = bodyRect(this.body);
    return { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 1 };
  }

  center(): Vec2 {
    return { x: this.body.x, y: this.body.y - this.body.h / 2 };
  }

  /** 어깨(조준 회전 중심). */
  shoulder(): Vec2 {
    const s = this.body.h / 92;
    return { x: this.body.x, y: this.body.y - 66 * s };
  }

  /** 총구/손 위치. */
  handPos(): Vec2 {
    const s = this.body.h / 92;
    return { x: this.body.x + this.aim.x * 34 * s, y: this.body.y - 66 * s + this.aim.y * 34 * s };
  }
}

/** 웨이브 배율·정예 여부를 반영한 능력치. 보스 체력은 웨이브가 오를수록 완만하게 오른다. */
export function scaledStats(kind: EnemyKind, wave: number, elite: boolean): EnemyScaledStats {
  const base = ENEMIES[kind];
  const eliteHp = elite ? 2.1 : 1;
  const eliteDmg = elite ? 1.3 : 1;
  const damageMul = WAVES.damageMultiplier(wave) * eliteDmg;
  const directDamage = kind === 'melee' ? ENEMIES.melee.damage : ENEMIES.ranged.damage;
  const fireBase = kind === 'ranged' || kind === 'sine' || kind === 'lobber' ? ENEMIES[kind].fireInterval : 2;
  const hp =
    kind === 'boss'
      ? base.hp * WAVES.bossHpMultiplier(Math.max(1, wave))
      : base.hp * WAVES.hpMultiplier(wave) * eliteHp;
  return {
    hp: Math.round(hp),
    speed: base.speed * (kind === 'boss' ? 1 : WAVES.speedMultiplier(wave)) * (elite ? 0.9 : 1),
    damage: Math.round(directDamage * damageMul),
    damageMul,
    score: Math.round(base.score * WAVES.scoreMultiplier(wave) * (elite ? 2 : 1)),
    fireInterval: fireBase * WAVES.fireIntervalMultiplier(wave),
    knockbackTaken: base.knockbackTaken * (elite ? 0.55 : 1),
  };
}
