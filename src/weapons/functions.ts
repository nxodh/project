import { WEAPON_TUNING } from '../config';
import { registerWeapon } from './registry';

/*
 * 플레이어 함수 무기 9종(등록 순서 = 숫자 키 1~9). 정의역·함수식은 곡선 모양을,
 * WEAPON_TUNING(config.ts)은 전투 수치를 정한다. 모든 곡선은 정의역 시작점이 총구에 오도록 평행 이동된다.
 * 화면은 흑백이므로 무기는 색이 아니라 곡선의 모양으로 구분한다.
 */
const WHITE = '#ffffff';

// ① 일차함수 y = x
// 조준선 자체가 이미 공격 방향을 정하므로 A(amplitude)=0으로 두어 로컬 경로를 y=0(조준축)에 정렬한다.
registerWeapon({
  id: 'linear',
  name: '일차함수',
  shape: '직선',
  formula: 'y = x',
  role: '정확한 견제용 직선 · 낮은 피해 · 좁은 판정',
  color: WHITE,
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
  color: WHITE,
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
  color: WHITE,
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
  role: '넓고 두꺼운 V자 판정 · 강한 넉백(공격 준비 끊기) · 긴 대기시간',
  color: WHITE,
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
  color: WHITE,
  domain: [0, 4],
  fn: (x) => Math.exp(x) - 1,
  tuning: WEAPON_TUNING.exp,
});

// ⑥ 로그함수 y = ln x,  x∈[0.05, 3]
// 지수함수와 반대: 총구 바로 앞에서 거의 수직으로 솟은 뒤(처음 10% 구간에서 절반 높이) 수평으로 뻗는다.
registerWeapon({
  id: 'log',
  name: '로그함수',
  shape: '솟은 뒤 수평',
  formula: 'y = ln x',
  role: '머리 위 적을 바로 찍고 그 높이로 전진 · 대공',
  color: WHITE,
  domain: [0.05, 3],
  fn: (x) => Math.log(x),
  tuning: WEAPON_TUNING.log,
});

// ⑦ 유리함수(반비례) y = 1/x,  x∈[0.25, 3]
// 로그함수의 거울상: 총구 바로 앞에서 아래로 내리꽂은 뒤 낮게 깔려 전진한다.
registerWeapon({
  id: 'reciprocal',
  name: '유리함수',
  shape: '내리꽂기',
  formula: 'y = 1/x',
  role: '발판·점프 중 아래 적을 찍고 낮게 전진',
  color: WHITE,
  domain: [0.25, 3],
  fn: (x) => 1 / x,
  tuning: WEAPON_TUNING.reciprocal,
});

// ⑧ 원의 방정식(윗반원) y = √(1 − x²),  x∈[−1, 1]
// 양 끝에서 수직으로 솟았다 내려오는 아치. 짧은 거리를 두껍게 덮고 낮은 장애물 너머를 친다.
registerWeapon({
  id: 'circle',
  name: '원(반원)',
  shape: '아치',
  formula: 'y = √(1 − x²)',
  role: '근거리 아치 · 두꺼운 판정 · 엄폐물 너머 타격',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => Math.sqrt(Math.max(0, 1 - x * x)),
  tuning: WEAPON_TUNING.circle,
});

// ⑨ 탄젠트함수 y = tan x,  x∈[−1.3, 1.3]
// 점근선 근처인 양 끝에서 수직에 가깝게 솟고 가운데는 완만한 Z자. 위아래 넓은 범위를 한 번에 쓴다.
registerWeapon({
  id: 'tan',
  name: '탄젠트함수',
  shape: 'Z자 쓸기',
  formula: 'y = tan x',
  role: '시작과 끝에서 수직으로 솟는 넓은 쓸기 · 고피해 · 긴 대기시간',
  color: WHITE,
  domain: [-1.3, 1.3],
  fn: (x) => Math.tan(x),
  tuning: WEAPON_TUNING.tan,
});
