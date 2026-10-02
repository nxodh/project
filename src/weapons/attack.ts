import { COMBAT, type WeaponTuning } from '../config';
import { smoothstep } from '../core/geometry';
import type { CurvePath } from './curve';
import type { FunctionWeaponDef } from './types';

let nextAttackId = 1;

export type AttackPhase = 'grow' | 'hold' | 'fade' | 'ghost' | 'done';

/**
 * 발사된 함수 공격 하나. 발사 순간 계산한 월드 경로를 그대로 보관하므로
 * 이후 플레이어나 마우스가 움직여도 곡선은 따라 움직이지 않는다.
 *
 * 타임라인: grow(앞부분부터 뻗어 나감) → hold(잠시 유지) → fade(꼬리부터 걷히며 사라짐) → ghost(판정 없는 잔상)
 */
export class CurveAttack {
  readonly id = nextAttackId++;
  readonly tuning: WeaponTuning;
  readonly growTime: number;
  age = 0;
  /** 이 공격에 이미 맞은 적 id. 같은 발사로 같은 적을 두 번 때리지 않는다. */
  readonly hitIds = new Set<number>();
  kills = 0;
  impactShown = false;

  constructor(
    readonly def: FunctionWeaponDef,
    readonly path: CurvePath,
  ) {
    // 발사 시점의 수치를 고정한다.
    this.tuning = { ...def.tuning };
    this.growTime = path.length / this.tuning.speed;
  }

  update(dt: number): void {
    this.age += dt;
  }

  get phase(): AttackPhase {
    const t = this.age;
    const { hold, fade } = this.tuning;
    if (t < this.growTime) return 'grow';
    if (t < this.growTime + hold) return 'hold';
    if (t < this.growTime + hold + fade) return 'fade';
    if (t < this.growTime + hold + fade + COMBAT.ghostTime) return 'ghost';
    return 'done';
  }

  /** 사라지는 단계 진행도 0~1. */
  get fadeProgress(): number {
    const { hold, fade } = this.tuning;
    return Math.min(1, Math.max(0, (this.age - this.growTime - hold) / fade));
  }

  /** 곡선 머리(현재까지 그려진 끝)의 경로상 길이. */
  get headLength(): number {
    return Math.min(this.path.length, this.age * this.tuning.speed);
  }

  /** 곡선 꼬리의 경로상 길이. 사라지는 단계에서 앞으로 걷혀 올라간다. */
  get tailLength(): number {
    const p = this.phase;
    if (p === 'grow' || p === 'hold') return 0;
    if (p === 'fade') return this.path.length * smoothstep(this.fadeProgress);
    return this.path.length;
  }

  /** 보이는 곡선의 밝기(0~1). */
  get alpha(): number {
    const p = this.phase;
    if (p === 'grow' || p === 'hold') return 1;
    if (p === 'fade') return 1 - 0.55 * this.fadeProgress;
    return 0;
  }

  /** 잔상 밝기(0~1). */
  get ghostAlpha(): number {
    const { hold, fade } = this.tuning;
    const start = this.growTime + hold;
    const end = start + fade + COMBAT.ghostTime;
    if (this.age < start || this.age >= end) return 0;
    return 1 - (this.age - start) / (end - start);
  }

  /** 실제로 화면에 보이는 구간에서만 판정이 있다. */
  get damaging(): boolean {
    const p = this.phase;
    if (p === 'grow' || p === 'hold') return this.headLength > 0;
    if (p === 'fade') return this.fadeProgress < COMBAT.damageActiveFadeFraction;
    return false;
  }

  get done(): boolean {
    return this.phase === 'done';
  }
}
