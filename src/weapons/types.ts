import type { WeaponTuning } from '../config';

/** 진화 연산자: 미분, 부정적분, 극한. */
export type OperatorId = 'd' | 'int' | 'lim';

/**
 * 연산 결과(진화 간선). 결과 함수 `to`는 수학적으로 이 연산의 결과다(양의 상수배·덧셈 상수 C 차이는 무시).
 * `to`가 자기 자신이면 그 연산으로는 새 함수를 얻지 못한다(예: (eˣ)′ = eˣ).
 */
export interface Evolution {
  to: string;
  /** 식으로 쓴 연산 결과(예: "(−x³)′ = −3x²"). */
  math: string;
  /** 극한 연산: n번째 항(수열·급수의 부분합)의 함수. n→∞이면 결과 함수로 수렴한다. */
  series?: (x: number, n: number) => number;
}

/**
 * 함수 무기 정의. 새 무기는 이 형태의 데이터를 registerWeapon()으로 등록하면 된다.
 *
 * 곡선은 정규화 매개변수 t∈[0,1]로 만든다.
 *   x(t) = domain[0] + t·(domain[1] − domain[0])
 *   로컬 좌표: lx = L·t,  ly = A·g(t),  g(t) = (f(x(t)) − f(x(0))) / max|f − f(x(0))|
 * 즉 그래프를 시작점이 원점(총구)에 오도록 평행 이동하고, 전방 길이 L(range)과
 * 최대 수직 높이 A(amplitude)로 스케일한다. ly의 +는 수학적 '위'다.
 */
export interface FunctionWeaponDef {
  id: string;
  /** 함수 종류 이름(예: 일차함수). */
  name: string;
  /** 공격 모양 이름(예: 직선). */
  shape: string;
  /** HUD에 표시할 기본 수식. */
  formula: string;
  /** 전투 용도 한 줄 설명. */
  role: string;
  color: string;
  /** 그래프에 사용할 정의역 [x0, x1]. 유한해야 한다. */
  domain: readonly [number, number];
  fn: (x: number) => number;
  tuning: WeaponTuning;
  /**
   * 매개변수 곡선(함수 그래프로 나타낼 수 없는 도형, 예: 원). u는 전방(lx = L·u), v는 수직(ly = A·v) 비율이다.
   * 있으면 fn·domain 대신 이 곡선을 쓰고, 조준점은 총구에서 가장 먼 점이 된다.
   */
  trace?: (t: number) => { u: number; v: number };
  /**
   * 기본 함수 여부. 기본 함수는 처음부터 가지고 있다: 다른 함수에서 미분·적분·극한으로 만들 수 없거나
   * (원, eˣ) 같은 계보의 뿌리(일차·절댓값·탄젠트)이기 때문이다. 나머지는 진화로만 얻는다.
   */
  starter?: boolean;
  /** 이 함수에 연산을 적용한 결과(진화 간선). 없는 연산은 결과가 인벤토리에 없는 함수다. */
  evolves?: Partial<Record<OperatorId, Evolution>>;
}
