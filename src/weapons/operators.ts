import { EVOLUTION } from '../config';
import { getWeapons } from './registry';
import type { Evolution, FunctionWeaponDef, OperatorId } from './types';

export type { OperatorId } from './types';

export interface OperatorInfo {
  id: OperatorId;
  /** 버튼에 쓰는 기호. */
  symbol: string;
  name: string;
  /** 수학적 의미 한 줄. */
  math: string;
}

export const OPERATORS: readonly OperatorInfo[] = [
  { id: 'd', symbol: 'd/dx', name: '미분', math: 'f → f′ : 변화율(기울기) 함수' },
  { id: 'int', symbol: '∫dx', name: '부정적분', math: 'f → ∫f dx + C : 원시함수' },
  { id: 'lim', symbol: 'lim', name: '극한', math: 'n → ∞ : 수열·급수가 수렴하는 함수' },
];

export function operatorInfo(id: OperatorId): OperatorInfo {
  return OPERATORS.find((o) => o.id === id)!;
}

export function weaponById(id: string): FunctionWeaponDef | undefined {
  return getWeapons().find((w) => w.id === id);
}

/** 기본 함수(처음부터 보유)의 id 목록. */
export function starterIds(): string[] {
  return getWeapons().filter((w) => w.starter).map((w) => w.id);
}

export interface EvolutionOption {
  op: OperatorId;
  /** 이 연산의 결과(간선). 결과가 인벤토리에 없는 함수면 undefined. */
  edge: Evolution | undefined;
  /** 결과 함수(자기 자신이면 새 함수가 아니다). */
  result: FunctionWeaponDef | undefined;
  /** 결과가 자기 자신(예: (eˣ)′ = eˣ)이라 새 함수를 얻지 못하는가. */
  self: boolean;
  cost: number;
}

/** 함수 하나에 대해 세 연산(미분·부정적분·극한)의 결과와 비용. */
export function evolutionOptions(base: FunctionWeaponDef): EvolutionOption[] {
  return OPERATORS.map(({ id: op }) => {
    const edge = base.evolves?.[op];
    const result = edge ? weaponById(edge.to) : undefined;
    return { op, edge, result, self: !!edge && edge.to === base.id, cost: EVOLUTION.cost[op] };
  });
}
