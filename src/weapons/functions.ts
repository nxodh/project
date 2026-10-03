import { WEAPON_TUNING } from '../config';
import { registerWeapon } from './registry';

/*
 * 플레이어 함수 무기 8종(인벤토리 카탈로그 순서). 정의역·함수식은 곡선 모양을,
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
  derivative: { fn: () => 1, formula: 'y′ = 1' },
  integral: { fn: (x) => (x * x) / 2, formula: 'y = x²/2 + C' },
  limitDomain: [0, 2],
  tuning: WEAPON_TUNING.linear,
});

// ② 이차함수 y = −x²,  x∈[−1, 1]
// 꼭짓점이 한가운데 있는 좌우 대칭 포물선(아치). 총구에서 솟아 정점을 찍고 조준선 위의 같은 높이로 내려온다.
// 한쪽 가지만 쓰면 그냥 휜 선처럼 보여, 양쪽 가지와 꼭짓점이 모두 보이도록 정의역을 대칭으로 잡았다.
// 반원(⑧)과 구분되도록 길고 낮게(폭 600 · 높이 150) 잡은 완만한 포물선 로브다.
registerWeapon({
  id: 'quadratic',
  name: '이차함수',
  shape: '포물선',
  formula: 'y = −x²',
  role: '느린 발사 · 높은 피해 · 위로 솟았다 내리꽂는 대칭 포물선',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => -(x * x),
  derivative: { fn: (x) => -2 * x, formula: 'y′ = −2x' },
  integral: { fn: (x) => -(x * x * x) / 3, formula: 'y = −x³/3 + C' },
  limitDomain: [-1.6, 1.6],
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
  derivative: { fn: (x) => Math.cos(x), formula: 'y′ = cos x' },
  integral: { fn: (x) => -Math.cos(x), formula: 'y = −cos x + C' },
  limitDomain: [0, 6 * Math.PI],
  tuning: WEAPON_TUNING.sine,
});

// ④ 절댓값함수 y = |x|,  x∈[−1, 1]
// 꼭짓점 x=0이 정확히 한가운데에 있는 좌우 대칭 V자. 조준축 아래로 내려갔다가 꺾여 같은 높이로 돌아오므로
// 끝점이 커서 위에 놓이고, 꺾임이 공격 구간 한가운데에서 보인다.
registerWeapon({
  id: 'abs',
  name: '절댓값함수',
  shape: '꺾인 궤적',
  formula: 'y = |x|',
  role: '넓고 두꺼운 V자 판정 · 강한 넉백(공격 준비 끊기) · 긴 대기시간',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => Math.abs(x),
  derivative: { fn: (x) => Math.sign(x), formula: 'y′ = sgn x' },
  integral: { fn: (x) => (x * Math.abs(x)) / 2, formula: 'y = x|x|/2 + C' },
  limitDomain: [-0.5, 2],
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
  derivative: { fn: (x) => Math.exp(x), formula: 'y′ = eˣ' },
  integral: { fn: (x) => Math.exp(x) - x, formula: 'y = eˣ − x + C' },
  limitDomain: [0, 6],
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
  derivative: { fn: (x) => 1 / x, formula: 'y′ = 1/x' },
  integral: { fn: (x) => x * Math.log(x) - x, formula: 'y = x ln x − x + C' },
  limitDomain: [0.002, 3],
  tuning: WEAPON_TUNING.log,
});

// ⑦ 원의 방정식 x² + y² = 1 (온전한 원)
// 총구와 커서를 지름의 양 끝으로 하는 원을 한 바퀴 그린다. 커서가 가까우면 작은 원, 멀면 큰 원(최대 지름 = 사거리).
// 함수 그래프로는 나타낼 수 없으므로 매개변수 곡선(trace)으로 정의하고, fn은 위쪽 반원(HUD 아이콘·정의역 검사용)이다.
// 원은 가운데가 비어 있어 안쪽 적은 맞지 않고 테두리가 지나가는 적만 맞는다. 둘러싸인 적을 한꺼번에 친다.
registerWeapon({
  id: 'circle',
  name: '원',
  shape: '온전한 원',
  formula: 'x² + y² = 1',
  role: '총구~커서를 지름으로 한 바퀴 · 테두리가 지나는 모든 적 타격 · 두꺼운 판정',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => Math.sqrt(Math.max(0, 1 - x * x)),
  trace: (t) => ({ u: (1 - Math.cos(2 * Math.PI * t)) / 2, v: Math.sin(2 * Math.PI * t) }),
  tuning: WEAPON_TUNING.circle,
});

// ⑧ 탄젠트함수 y = tan x,  x∈[−1.3, 1.3]
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
  derivative: { fn: (x) => 1 / Math.cos(x) ** 2, formula: 'y′ = sec²x' },
  integral: { fn: (x) => -Math.log(Math.abs(Math.cos(x))), formula: 'y = −ln|cos x| + C' },
  limitDomain: [-1.5, 1.5],
  tuning: WEAPON_TUNING.tan,
});
