import type { WeaponTuning } from '../config';

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
}
