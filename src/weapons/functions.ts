import { WEAPON_TUNING } from '../config';
import { registerWeapon } from './registry';

/*
 * 기본 함수 무기 5종. 정의역·함수식은 곡선 모양을, WEAPON_TUNING(config.ts)은 전투 수치를 정한다.
 * 모든 곡선은 정의역 시작점이 총구에 오도록 평행 이동된다(curve.ts 참고).
 */

// ① 일차함수 y = x
// 조준선 자체가 이미 공격 방향을 정하므로 A(amplitude)=0으로 두어 로컬 경로를 y=0(조준축)에 정렬한다.
registerWeapon({
  id: 'linear',
  name: '일차함수',
  shape: '직선',
  formula: 'y = x',
  role: '빠른 연사 · 긴 사거리 · 좁은 판정',
  color: '#3ad8ff',
  domain: [0, 1],
  fn: (x) => x,
  tuning: WEAPON_TUNING.linear,
});

// ② 이차함수 y = x²,  x∈[0, 1]
// 꼭짓점(총구)에서 조준축에 접하며 출발해 한쪽으로 점점 크게 휘어진다.
registerWeapon({
  id: 'quadratic',
  name: '이차함수',
  shape: '포물선',
  formula: 'y = x²',
  role: '느린 발사 · 높은 피해 · 넓은 높이 범위',
  color: '#9dff4a',
  domain: [0, 1],
  fn: (x) => x * x,
  tuning: WEAPON_TUNING.quadratic,
});

// ③ 사인함수 y = sin(x),  x∈[0, 4π] → 2회 진동
registerWeapon({
  id: 'sine',
  name: '사인함수',
  shape: '파동',
  formula: 'y = sin(x)',
  role: '조준축 위아래를 훑는 진동 · 여러 높이 동시 타격',
  color: '#b38bff',
  domain: [0, 4 * Math.PI],
  fn: (x) => Math.sin(x),
  tuning: WEAPON_TUNING.sine,
});

// ④ 절댓값함수 y = |x|,  x∈[−0.5, 1]
// 꼭짓점 x=0이 정의역 안(전체의 1/3 지점)에 있어 V자 꺾임이 공격 구간 안에서 보인다.
// 시작점 (−0.5, 0.5)을 총구로 옮기므로 조준축 아래로 A만큼 내려갔다가 꺾여 위로 A만큼 솟는다.
registerWeapon({
  id: 'abs',
  name: '절댓값함수',
  shape: '꺾인 궤적',
  formula: 'y = |x|',
  role: '넓고 두꺼운 V자 판정 · 강한 넉백 · 긴 대기시간',
  color: '#ffd23f',
  domain: [-0.5, 1],
  fn: (x) => Math.abs(x),
  tuning: WEAPON_TUNING.abs,
});

// ⑤ 지수함수 y = eˣ − 1,  x∈[0, 4]
// 앞쪽 절반에서는 최대 높이의 12%만 오르다가 마지막 25% 구간에서 64%를 솟아오른다.
// 값이 e⁴−1 ≈ 53.6 이상 커지지 않도록 정의역을 제한하고, A로 실제 높이(px)를 고정한다.
registerWeapon({
  id: 'exp',
  name: '지수함수',
  shape: '급상승',
  formula: 'y = eˣ − 1',
  role: '짧은 사거리 · 끝에서 급격히 솟는 고피해 일격',
  color: '#ff5ec8',
  domain: [0, 4],
  fn: (x) => Math.exp(x) - 1,
  tuning: WEAPON_TUNING.exp,
});
