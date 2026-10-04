import { describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { getWeapons } from '../src/weapons/registry';
import { evolutionOptions, weaponById } from '../src/weapons/operators';
import type { FunctionWeaponDef, OperatorId } from '../src/weapons/types';

const all = () => getWeapons();
const byId = (id: string): FunctionWeaponDef => {
  const w = weaponById(id);
  if (!w) throw new Error(id);
  return w;
};

/** 중앙 차분 미분. */
function numDeriv(f: (x: number) => number, x: number, h = 1e-5): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** ys ≈ c·xs + k 로 회귀했을 때의 기울기 c와 상관계수 r. */
function regress(xs: number[], ys: number[]): { c: number; r: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return { c: sxy / sxx, r: sxy / Math.sqrt(sxx * syy) };
}

/** 정의역 안쪽의 시험 점(끝점과 불연속점 근처는 피한다). */
function samples(def: FunctionWeaponDef, n = 40): number[] {
  const [x0, x1] = def.domain;
  const out: number[] = [];
  for (let k = 1; k < n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    if (Math.abs(x) > 1e-3 || !['abs', 'sgn', 'xabs'].includes(def.id)) out.push(x);
  }
  return out;
}

describe('함수 진화 그래프의 수학적 정합성', () => {
  const edges: { from: FunctionWeaponDef; op: OperatorId; to: FunctionWeaponDef }[] = [];
  for (const w of all()) {
    for (const op of ['d', 'int', 'lim'] as const) {
      const e = w.evolves?.[op];
      if (e) edges.push({ from: w, op, to: byId(e.to) });
    }
  }

  it('모든 간선의 결과 함수가 실제로 존재한다', () => {
    expect(edges.length).toBeGreaterThanOrEqual(30);
    for (const e of edges) expect(weaponById(e.to.id)).toBeDefined();
  });

  it('미분 간선: f′ 가 결과 함수의 양의 상수배(+상수)다', () => {
    const ds = edges.filter((e) => e.op === 'd' && e.to.id !== e.from.id);
    expect(ds.length).toBeGreaterThanOrEqual(10);
    for (const { from, to } of ds) {
      const xs = samples(from);
      const dv = xs.map((x) => numDeriv(from.fn, x));
      const gv = xs.map((x) => to.fn(x));
      const { c, r } = regress(gv, dv); // f′ ≈ c·g + k
      expect(c, `${from.id}′ = ${to.id}`).toBeGreaterThan(0);
      expect(r, `${from.id}′ ~ ${to.id}`).toBeGreaterThan(0.9999);
    }
  });

  it('부정적분 간선: 결과 함수를 미분하면 원래 함수의 양의 상수배다', () => {
    const is = edges.filter((e) => e.op === 'int' && e.to.id !== e.from.id);
    expect(is.length).toBeGreaterThanOrEqual(10);
    for (const { from, to } of is) {
      const xs = samples(to);
      const dv = xs.map((x) => numDeriv(to.fn, x));
      const fv = xs.map((x) => from.fn(x));
      const { c, r } = regress(fv, dv); // g′ ≈ c·f + k
      expect(c, `∫${from.id} = ${to.id}`).toBeGreaterThan(0);
      expect(r, `(${to.id})′ ~ ${from.id}`).toBeGreaterThan(0.9999);
    }
  });

  it('자기 자신으로 가는 간선은 (eˣ)′ = eˣ 뿐이다', () => {
    const selfs = edges.filter((e) => e.to.id === e.from.id);
    expect(selfs.map((e) => `${e.from.id}:${e.op}`).sort()).toEqual(['exp:d', 'exp:int']);
    const e = byId('exp');
    for (const x of samples(e)) expect(numDeriv(e.fn, x)).toBeCloseTo(e.fn(x) + 1, 3); // (eˣ−1)′ = eˣ = fn+1
  });

  it('극한 간선: n→∞로 갈수록 부분합이 결과 함수에 수렴한다', () => {
    const lims = edges.filter((e) => e.op === 'lim');
    expect(lims.map((e) => `${e.from.id}→${e.to.id}`).sort()).toEqual([
      'abs→well', 'cubic→sine', 'linear→expdecay', 'quadratic→cosine', 'quartic→log',
    ]);
    const probe: Record<string, number[]> = {
      expdecay: [0.5, 1, 2, 3.5],
      cosine: [0.5, 2, 5, 9],
      sine: [0.5, 2, 5, 9],
      log: [0.4, 0.8, 1.3, 1.7],
      well: [-0.95, -0.5, 0, 0.5, 0.95],
    };
    for (const { from, to } of lims) {
      const series = from.evolves!.lim!.series!;
      expect(series).toBeDefined();
      for (const x of probe[to.id]) {
        const exact = to.fn(x);
        const err = (n: number) => Math.abs(series(x, n) - exact);
        const big = to.id === 'log' ? 4000 : to.id === 'well' ? 400 : to.id === 'expdecay' ? 5000 : 60;
        expect(err(big), `${from.id}→${to.id} @${x}`).toBeLessThan(to.id === 'log' ? 0.02 : 1e-3);
        // 항을 늘릴수록 오차가 줄어든다(처음 몇 항보다 훨씬 작다)
        expect(err(big)).toBeLessThan(err(2) + 1e-12);
      }
    }
  });

  it('연산의 결과가 수학적으로 맞는 대표 예', () => {
    const q = byId('quadratic');
    expect(q.evolves!.d!.to).toBe('linear'); // (−x²)′ = −2x
    expect(q.evolves!.int!.to).toBe('cubic'); // ∫ = −x³/3
    expect(byId('sine').evolves!.d!.to).toBe('cosine');
    expect(byId('cosine').evolves!.d!.to).toBe('negsine'); // (cos x)′ = −sin x
    expect(byId('sine').evolves!.int!.to).toBe('negcosine'); // ∫sin = −cos
    expect(byId('log').evolves!.d!.to).toBe('reciprocal');
    expect(byId('tan').evolves!.d!.to).toBe('secsq');
    expect(byId('abs').evolves!.d!.to).toBe('sgn');
  });
});

describe('기본 함수와 도달 가능성', () => {
  const starters = all().filter((w) => w.starter).map((w) => w.id);

  it('기본 함수 5종: 일차·절댓값·지수·탄젠트·원', () => {
    expect([...starters].sort()).toEqual(['abs', 'circle', 'exp', 'linear', 'tan']);
  });

  it('기본 함수만으로 진화를 반복하면 나머지 모든 함수에 도달한다', () => {
    const seen = new Set(starters);
    const queue = [...starters];
    while (queue.length) {
      const id = queue.pop()!;
      for (const o of evolutionOptions(byId(id))) {
        if (o.result && !seen.has(o.result.id)) {
          seen.add(o.result.id);
          queue.push(o.result.id);
        }
      }
    }
    expect([...seen].sort()).toEqual(all().map((w) => w.id).sort());
  });

  it('기본 함수는 서로 다른 기본 함수로부터 만들 수 없다(계보의 뿌리·독립 함수)', () => {
    // 기본 함수 하나에서 출발해 도달 가능한 함수 집합에 다른 기본 함수가 들어 있으면 안 된다.
    for (const s of starters) {
      const seen = new Set([s]);
      const queue = [s];
      while (queue.length) {
        const id = queue.pop()!;
        for (const o of evolutionOptions(byId(id))) {
          if (o.result && !seen.has(o.result.id)) {
            seen.add(o.result.id);
            queue.push(o.result.id);
          }
        }
      }
      for (const other of starters) if (other !== s) expect(seen.has(other), `${s} → ${other}`).toBe(false);
    }
  });

  it('기본 함수에는 기본인 이유가 적혀 있고, 기본이 아닌 함수에는 없다', () => {
    for (const w of all()) {
      if (w.starter) expect((w.starterReason ?? '').length, w.id).toBeGreaterThan(20);
      else expect(w.starterReason, w.id).toBeUndefined();
    }
  });

  it('원은 미분·적분·극한 어느 쪽으로도 이어지지 않는다(독립 도형)', () => {
    expect(byId('circle').evolves).toBeUndefined();
    for (const w of all()) for (const e of Object.values(w.evolves ?? {})) expect(e.to).not.toBe('circle');
  });
});
