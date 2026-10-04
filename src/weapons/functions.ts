import { WEAPON_TUNING } from '../config';
import { registerWeapon } from './registry';

/*
 * 플레이어 함수 무기 21종. 정의역·함수식은 곡선 모양을, WEAPON_TUNING(config.ts)은 전투 수치를 정한다.
 * 모든 곡선은 정의역 시작점이 총구에 오도록 평행 이동된다. 화면은 흑백이므로 무기는 색이 아니라 곡선의 모양으로 구분한다.
 *
 * ── 함수 진화 ──
 * 함수는 미분(d/dx)·부정적분(∫dx)·극한(lim)으로 서로 이어져 있다. `evolves`의 각 간선은 수학적으로 맞는 결과다
 * (양의 상수배와 적분 상수 C의 차이만 무시). 모양이 위로 볼록해야 바닥에 덜 걸리므로 다항함수 계보는 부호를 −로 잡았다.
 *   다항:   일차 −x ⇄ 이차 −x² ⇄ 삼차 −x³ ⇄ 사차 −x⁴   (∫는 오른쪽, d/dx는 왼쪽)
 *   삼각:   sin → cos → −sin → −cos → sin   (d/dx 방향), ∫는 반대 방향
 *   로그:   x ln x − x ⇄ ln x ⇄ 1/x
 *   탄젠트: sec²x ⇄ tan x ⇄ −ln|cos x|
 *   절댓값: sgn x ⇄ |x| ⇄ x|x|/2
 *   극한:   일차 → e⁻ˣ,  이차 → cos x,  삼차 → sin x,  사차 → ln x,  절댓값 → 우물(|x|ⁿ, n→∞)
 * 기본 함수(starter)는 처음부터 가진다(이유는 각 함수의 starterReason): 원은 함수가 아니고, eˣ는 미분·적분의 고정점이며,
 * 일차·절댓값·탄젠트는 각자 계보(다른 계보와 이어지지 않는 묶음)의 뿌리다.
 *
 * ── 수학적 약속 ──
 * · 미분·적분 간선: 결과의 도함수가 원래 함수의 양의 상수배(적분), 또는 원래 함수의 도함수가 결과의 양의 상수배(미분)다.
 *   부호는 바뀌지 않으며(−sin ≠ sin), 적분 상수 C와 y축 평행 이동은 무시한다(곡선은 항상 총구에서 시작하도록 평행 이동하므로).
 * · 극한 간선: 결과 함수의 테일러(매클로린) 급수에서 −xⁿ꼴 n차 항이 들어 있는 대표 함수를 이었다
 *   (한 항이 여러 급수에 들어 있어도 대표 하나만 연결한다). 절댓값은 수열 |x|ⁿ의 점별 극한이다.
 * · 곡선은 정의역 [x₀, x₁]을 가로 L, 세로 A로 비례 축소해 그린다(가로·세로 축척이 달라 기울기 값은 보존되지 않고 모양만 보존된다).
 */
const WHITE = '#ffffff';

const PI = Math.PI;

// ═════════ 기본 함수 ═════════

// ① 일차함수 y = −x  (직선) — 다항 계보의 뿌리
// 조준선 자체가 이미 공격 방향을 정하므로 A(amplitude)=0으로 두어 로컬 경로를 y=0(조준축)에 정렬한다.
registerWeapon({
  id: 'linear',
  name: '일차함수',
  shape: '직선',
  formula: 'y = −x',
  role: '정확한 견제용 직선 · 낮은 피해 · 좁은 판정',
  color: WHITE,
  domain: [0, 1],
  fn: (x) => -x,
  tuning: WEAPON_TUNING.linear,
  starter: true,
  starterReason: '다항 계보의 뿌리: ∫로 이차·삼차·사차가 나오고, 이차를 미분하면 일차로 돌아오는 한 묶음이라 뿌리를 따로 준다.',
  evolves: {
    int: { to: 'quadratic', math: '∫(−x) dx = −x²/2 + C' },
    lim: {
      to: 'expdecay',
      math: 'e⁻ˣ = 1 − x + x²/2 − …  (−x가 1차 항, lim (1 − x/n)ⁿ)',
      series: (x, n) => (1 - x / n) ** n,
    },
  },
});

// ② 절댓값함수 y = |x|,  x∈[−1, 1] — 절댓값 계보의 뿌리
// 꼭짓점 x=0이 정확히 한가운데에 있는 좌우 대칭 V자. 조준축 아래로 내려갔다가 꺾여 같은 높이로 돌아오므로
// 끝점이 커서 위에 놓이고, 꺾임이 공격 구간 한가운데에서 보인다.
registerWeapon({
  id: 'abs',
  name: '절댓값함수',
  shape: 'V자',
  formula: 'y = |x|',
  role: '넓고 두꺼운 V자 판정 · 강한 넉백(공격 준비 끊기) · 긴 대기시간',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => Math.abs(x),
  tuning: WEAPON_TUNING.abs,
  starter: true,
  starterReason: '절댓값 계보의 뿌리: sgn x, x|x|/2와 서로 오가는 한 묶음이다.',
  evolves: {
    d: { to: 'sgn', math: '(|x|)′ = sgn x' },
    int: { to: 'xabs', math: '∫|x| dx = x|x|/2 + C' },
    lim: { to: 'well', math: 'lim |x|ⁿ = 0 (|x|<1), 1 (|x|=1)', series: (x, n) => Math.abs(x) ** n },
  },
});

// ③ 지수함수 y = eˣ − 1,  x∈[0, 4] — 미분·적분해도 자기 자신이라 다른 함수로 만들 수 없다
// 앞쪽 절반에서는 최대 높이의 12%만 오르다가 마지막 25% 구간에서 64%를 솟아오른다.
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
  starter: true,
  starterReason: '미분·적분의 고정점이다: (eˣ)′ = ∫eˣ dx = eˣ 라서 다른 함수에서 이 두 연산으로 만들 수 없다. (극한 (1+x/n)ⁿ으로는 만들 수 있지만 기울기 +1인 일차에서 시작해야 하는데, 이 게임의 일차(−x)에서는 e⁻ˣ가 나오므로 eˣ는 기본으로 준다.)',
  evolves: {
    d: { to: 'exp', math: '(eˣ)′ = eˣ  (자기 자신)' },
    int: { to: 'exp', math: '∫eˣ dx = eˣ + C  (자기 자신)' },
  },
});

// ④ 탄젠트함수 y = tan x,  x∈[−1.3, 1.3] — 탄젠트 계보의 뿌리
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
  starter: true,
  starterReason: '탄젠트 계보의 뿌리: sec²x, −ln|cos x|와 서로 오가는 한 묶음이다.',
  evolves: {
    d: { to: 'secsq', math: '(tan x)′ = sec²x' },
    int: { to: 'neglncos', math: '∫tan x dx = −ln|cos x| + C' },
  },
});

// ⑤ 원의 방정식 x² + y² = 1 (온전한 원) — 함수가 아니라서(한 x에 y가 둘) 진화 대상이 아니다
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
  trace: (t) => ({ u: (1 - Math.cos(2 * PI * t)) / 2, v: Math.sin(2 * PI * t) }),
  tuning: WEAPON_TUNING.circle,
  starter: true,
  starterReason: '함수가 아니다: x² + y² = 1은 한 x에 y가 두 개(±)라 y = f(x)가 아니므로 이 게임의 미분·적분·극한(y = f(x)에 대한 연산)을 적용할 수 없고, 어떤 함수에서도 이 연산으로 만들 수 없다.',
});

// ═════════ 다항함수 계보 (일차에서 적분으로 진화) ═════════

// 이차함수 y = −x²,  x∈[−1, 1] — 꼭짓점이 한가운데 있는 좌우 대칭 포물선(아치)
registerWeapon({
  id: 'quadratic',
  name: '이차함수',
  shape: '포물선',
  formula: 'y = −x²',
  role: '느린 발사 · 높은 피해 · 위로 솟았다 내리꽂는 대칭 포물선',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => -(x * x),
  tuning: WEAPON_TUNING.quadratic,
  evolves: {
    d: { to: 'linear', math: '(−x²)′ = −2x' },
    int: { to: 'cubic', math: '∫(−x²) dx = −x³/3 + C' },
    lim: {
      to: 'cosine',
      math: 'cos x = 1 − x²/2 + x⁴/24 − …  (−x²이 2차 항)',
      series: (x, n) => cosPartial(x, n),
    },
  },
});

// 삼차함수 y = −x³,  x∈[−1, 1] — 가운데가 완만한 S자
registerWeapon({
  id: 'cubic',
  name: '삼차함수',
  shape: 'S자',
  formula: 'y = −x³',
  role: '완만하게 휘다 양 끝에서 가팔라지는 S자 · 중간 피해',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => -(x * x * x),
  tuning: WEAPON_TUNING.cubic,
  evolves: {
    d: { to: 'quadratic', math: '(−x³)′ = −3x²' },
    int: { to: 'quartic', math: '∫(−x³) dx = −x⁴/4 + C' },
    lim: {
      to: 'sine',
      math: 'sin x = x − x³/6 + x⁵/120 − …  (−x³이 3차 항)',
      series: (x, n) => sinPartial(x, n),
    },
  },
});

// 사차함수 y = −x⁴,  x∈[−1, 1] — 이차보다 윗면이 평평하고 옆이 가파른 네모진 아치
registerWeapon({
  id: 'quartic',
  name: '사차함수',
  shape: '네모진 아치',
  formula: 'y = −x⁴',
  role: '평평한 윗면과 가파른 옆면 · 두꺼운 아치 · 높은 피해',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => -(x ** 4),
  tuning: WEAPON_TUNING.quartic,
  evolves: {
    d: { to: 'cubic', math: '(−x⁴)′ = −4x³' },
    lim: {
      to: 'log',
      math: 'ln(1+u) = u − u²/2 + u³/3 − u⁴/4 + …  (u = x−1, −u⁴이 4차 항)',
      series: (x, n) => lnPartial(x, n),
    },
  },
});

// ═════════ 극한으로 만든 함수 ═════════

// 감쇠함수 y = e⁻ˣ,  x∈[0, 4] — (1 − x/n)ⁿ의 극한. 급히 내려간 뒤 점근선(−1)으로 수렴한다.
registerWeapon({
  id: 'expdecay',
  name: '감쇠함수',
  shape: '점근선으로 수렴',
  formula: 'y = e⁻ˣ',
  role: '처음에 급히 내려갔다 수평으로 수렴 · 낮은 곳을 길게 훑음',
  color: WHITE,
  domain: [0, 4],
  fn: (x) => Math.exp(-x),
  tuning: WEAPON_TUNING.expdecay,
});

// 코사인 y = cos x,  x∈[0, 4π] — 시작점이 마루라서 조준축에 매달린 파동
registerWeapon({
  id: 'cosine',
  name: '코사인함수',
  shape: '매달린 파동',
  formula: 'y = cos x',
  role: '조준축 아래로 늘어진 빠른 파동 · 낮은 곳을 훑음',
  color: WHITE,
  domain: [0, 4 * PI],
  fn: (x) => Math.cos(x),
  tuning: WEAPON_TUNING.cosine,
  evolves: {
    d: { to: 'negsine', math: '(cos x)′ = −sin x' },
    int: { to: 'sine', math: '∫cos x dx = sin x + C' },
  },
});

// 사인 y = sin x,  x∈[0, 4π] → 2회 진동
registerWeapon({
  id: 'sine',
  name: '사인함수',
  shape: '파동',
  formula: 'y = sin x',
  role: '조준축 위아래를 훑는 진동 · 여러 높이 동시 타격',
  color: WHITE,
  domain: [0, 4 * PI],
  fn: (x) => Math.sin(x),
  tuning: WEAPON_TUNING.sine,
  evolves: {
    d: { to: 'cosine', math: '(sin x)′ = cos x' },
    int: { to: 'negcosine', math: '∫sin x dx = −cos x + C' },
  },
});

// 로그함수 y = ln x,  x∈[0.05, 2] — 총구 앞에서 급히 솟은 뒤(처음 10% 구간에서 약 43% 높이) 완만해진다
// 정의역 끝을 2로 둔 것은 ln x의 테일러 급수(u = x−1)가 |u| ≤ 1, 즉 x ≤ 2에서 수렴하기 때문이다.
registerWeapon({
  id: 'log',
  name: '로그함수',
  shape: '솟은 뒤 수평',
  formula: 'y = ln x',
  role: '머리 위 적을 바로 찍고 그 높이로 전진 · 대공',
  color: WHITE,
  domain: [0.05, 2],
  fn: (x) => Math.log(x),
  tuning: WEAPON_TUNING.log,
  evolves: {
    d: { to: 'reciprocal', math: '(ln x)′ = 1/x' },
    int: { to: 'xlnx', math: '∫ln x dx = x ln x − x + C' },
  },
});

// 우물 y = lim |x|ⁿ,  x∈[−1, 1] — |x|<1이면 0, |x|=1이면 1: 직사각형 우물
registerWeapon({
  id: 'well',
  name: '극한 우물',
  shape: '직사각형 우물',
  formula: 'y = lim |x|ⁿ',
  role: '곧장 내려갔다 수평으로 가다 곧장 올라오는 우물 · 두꺼운 판정 · 강한 넉백',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => (Math.abs(x) >= 1 - 1e-12 ? 1 : 0),
  tuning: WEAPON_TUNING.well,
});

// ═════════ 미분·적분으로 만든 함수 ═════════

// −sin x
registerWeapon({
  id: 'negsine',
  name: '마이너스 사인',
  shape: '아래로 시작하는 파동',
  formula: 'y = −sin x',
  role: '사인의 반대 위상 · 처음엔 아래부터 훑음',
  color: WHITE,
  domain: [0, 4 * PI],
  fn: (x) => -Math.sin(x),
  tuning: WEAPON_TUNING.negsine,
  evolves: {
    d: { to: 'negcosine', math: '(−sin x)′ = −cos x' },
    int: { to: 'cosine', math: '∫(−sin x) dx = cos x + C' },
  },
});

// −cos x : 조준축 위로 솟은 봉우리 파동
registerWeapon({
  id: 'negcosine',
  name: '마이너스 코사인',
  shape: '솟은 봉우리 파동',
  formula: 'y = −cos x',
  role: '조준축 위로 솟은 파동 · 높은 곳을 훑음',
  color: WHITE,
  domain: [0, 4 * PI],
  fn: (x) => -Math.cos(x),
  tuning: WEAPON_TUNING.negcosine,
  evolves: {
    d: { to: 'sine', math: '(−cos x)′ = sin x' },
    int: { to: 'negsine', math: '∫(−cos x) dx = −sin x + C' },
  },
});

// 반비례 y = 1/x,  x∈[0.25, 3] — 총구 앞에서 아래로 내리꽂은 뒤 낮게 깔린다
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
  evolves: {
    int: { to: 'log', math: '∫(1/x) dx = ln|x| + C' },
  },
});

// x ln x − x,  x∈[0.05, 3] — 한 번 처졌다 올라오는 비대칭 우물
registerWeapon({
  id: 'xlnx',
  name: 'x ln x − x',
  shape: '비대칭 우물',
  formula: 'y = x ln x − x',
  role: '아래로 처졌다 올라오는 완만한 우물 · 낮은 적에서 높은 적으로',
  color: WHITE,
  domain: [0.05, 3],
  fn: (x) => x * Math.log(x) - x,
  tuning: WEAPON_TUNING.xlnx,
  evolves: {
    d: { to: 'log', math: '(x ln x − x)′ = ln x' },
  },
});

// sec²x,  x∈[−1.3, 1.3] — 양 끝이 점근선인 깊은 우물
registerWeapon({
  id: 'secsq',
  name: '시컨트 제곱',
  shape: '깊은 우물',
  formula: 'y = sec²x',
  role: '가파른 벽의 깊은 U자 · 아래를 크게 훑고 올라옴',
  color: WHITE,
  domain: [-1.3, 1.3],
  fn: (x) => 1 / Math.cos(x) ** 2,
  tuning: WEAPON_TUNING.secsq,
  evolves: {
    int: { to: 'tan', math: '∫sec²x dx = tan x + C' },
  },
});

// −ln|cos x|,  x∈[−1.3, 1.3] — 매끈한 U자
registerWeapon({
  id: 'neglncos',
  name: '−ln|cos x|',
  shape: '매끈한 U자',
  formula: 'y = −ln|cos x|',
  role: '매끈한 U자 · 아래를 넓게 훑고 올라옴',
  color: WHITE,
  domain: [-1.3, 1.3],
  fn: (x) => -Math.log(Math.abs(Math.cos(x))),
  tuning: WEAPON_TUNING.neglncos,
  evolves: {
    d: { to: 'tan', math: '(−ln|cos x|)′ = tan x' },
  },
});

// 부호함수 y = sgn x,  x∈[−1, 1] — 한가운데에서 한 칸 올라가는 계단
registerWeapon({
  id: 'sgn',
  name: '부호함수',
  shape: '한 칸 계단',
  formula: 'y = sgn x',
  role: '수평으로 가다 한가운데서 수직으로 한 칸 오르는 계단',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => Math.sign(x),
  tuning: WEAPON_TUNING.sgn,
  evolves: {
    int: { to: 'abs', math: '∫sgn x dx = |x| + C' },
  },
});

// x|x|/2,  x∈[−1, 1] — 가운데가 눕고 양 끝이 가팔라지는 S자(제곱 부호 유지)
registerWeapon({
  id: 'xabs',
  name: 'x|x|/2',
  shape: '넓은 S자',
  formula: 'y = x|x|/2',
  role: '가운데가 평평한 S자 · 위아래 넓은 범위',
  color: WHITE,
  domain: [-1, 1],
  fn: (x) => (x * Math.abs(x)) / 2,
  tuning: WEAPON_TUNING.xabs,
  evolves: {
    d: { to: 'abs', math: '(x|x|/2)′ = |x|' },
  },
});

// ═════════ 급수 부분합(극한 간선의 n번째 항) ═════════
function cosPartial(x: number, n: number): number {
  let sum = 0;
  let term = 1;
  for (let k = 0; k < n; k++) {
    sum += term;
    term *= -(x * x) / ((2 * k + 1) * (2 * k + 2));
  }
  return sum;
}

function sinPartial(x: number, n: number): number {
  let sum = 0;
  let term = x;
  for (let k = 0; k < n; k++) {
    sum += term;
    term *= -(x * x) / ((2 * k + 2) * (2 * k + 3));
  }
  return sum;
}

/** ln x = Σ (−1)^{k+1} u^k / k,  u = x − 1 (|u| ≤ 1에서 수렴). */
function lnPartial(x: number, n: number): number {
  const u = x - 1;
  let sum = 0;
  let pow = 1;
  for (let k = 1; k <= n; k++) {
    pow *= u;
    sum += ((k % 2 === 1 ? 1 : -1) * pow) / k;
  }
  return sum;
}
