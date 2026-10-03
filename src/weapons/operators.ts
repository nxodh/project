import { OPERATOR_TUNING, type WeaponTuning } from '../config';
import type { FunctionWeaponDef } from './types';

/** 인벤토리 연산자: 슬롯의 무기 함수에 적용되는 수학 연산. */
export type OperatorId = 'd' | 'int' | 'lim';

export interface OperatorInfo {
  id: OperatorId;
  /** 카드에 크게 쓰는 기호. */
  symbol: string;
  name: string;
  /** 수학적 의미 한 줄. */
  math: string;
  /** 전투 효과 한 줄. */
  effect: string;
}

export const OPERATORS: readonly OperatorInfo[] = [
  { id: 'd', symbol: 'd/dx', name: '미분', math: 'f(x) → f′(x): 함수를 도함수로 바꾼다', effect: '빠르고 날카롭다 · 피해 −20% · 대기 −25% · 속도 +50%' },
  { id: 'int', symbol: '∫dx', name: '부정적분', math: 'f(x) → ∫f dx + C: 함수를 원시함수로 바꾼다', effect: '두껍고 묵직하다 · 피해 +30% · 대기 +30% · 두께 +50%' },
  { id: 'lim', symbol: 'lim', name: '극한', math: 'x → ∞ (또는 점근선): 정의역을 끝까지 넓힌다', effect: '더 멀리, 끝이 극단적으로 · 사거리 +35% · 피해 −5% · 대기 +15%' },
];

export function operatorInfo(id: OperatorId): OperatorInfo {
  return OPERATORS.find((o) => o.id === id)!;
}

/** 이 무기에 연산자를 장착할 수 있는가(매개변수 곡선인 원은 해석적 도함수가 없어 불가). */
export function canOperate(def: FunctionWeaponDef): boolean {
  return !def.trace && !!def.derivative && !!def.integral;
}

function scaledTuning(t: WeaponTuning, op: OperatorId): WeaponTuning {
  const m = OPERATOR_TUNING[op];
  return {
    ...t,
    damage: Math.max(1, Math.round(t.damage * m.damage)),
    cooldown: +(t.cooldown * m.cooldown).toFixed(3),
    range: Math.round(t.range * m.range),
    speed: Math.round(t.speed * m.speed),
    hitRadius: +(t.hitRadius * m.hitRadius).toFixed(2),
  };
}

const cache = new WeakMap<FunctionWeaponDef, Map<OperatorId, FunctionWeaponDef>>();

/**
 * 기본 무기에 연산자를 적용한 무기 정의. 같은 조합은 같은 객체를 돌려준다(곡선 캐시가 정의 객체 기준이므로).
 * 연산자가 없거나 장착할 수 없는 무기면 기본 무기를 그대로 돌려준다.
 */
export function resolveWeapon(base: FunctionWeaponDef, op: OperatorId | null): FunctionWeaponDef {
  if (!op || !canOperate(base)) return base;
  const key = `${base.id}:${op}`;
  let perBase = cache.get(base);
  if (!perBase) cache.set(base, (perBase = new Map()));
  const hit = perBase.get(op);
  if (hit) return hit;
  const tuning = scaledTuning(base.tuning, op);
  let def: FunctionWeaponDef;
  if (op === 'd') {
    def = {
      ...base,
      id: key,
      name: `${base.name} 미분`,
      shape: `${base.shape}의 도함수`,
      formula: base.derivative!.formula,
      fn: base.derivative!.fn,
      tuning,
    };
  } else if (op === 'int') {
    def = {
      ...base,
      id: key,
      name: `${base.name} 적분`,
      shape: `${base.shape}의 원시함수`,
      formula: base.integral!.formula,
      fn: base.integral!.fn,
      tuning,
    };
  } else {
    def = {
      ...base,
      id: key,
      name: `${base.name} 극한`,
      shape: `${base.shape} (x→∞)`,
      formula: `lim ${base.formula}`,
      domain: base.limitDomain ?? base.domain,
      tuning,
    };
  }
  perBase.set(op, def);
  return def;
}
