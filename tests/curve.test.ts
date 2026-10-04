import { describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { COMBAT, REACH_MIN_SCALE } from '../src/config';
import { getWeapons } from '../src/weapons/registry';
import { buildCurvePath, getLocalCurve, makeAimFrame, makeEndAlignedFrame, reachScale, type CurvePath } from '../src/weapons/curve';
import { Arena, type Solid } from '../src/world/arena';
import type { FunctionWeaponDef } from '../src/weapons/types';

const byId = (id: string): FunctionWeaponDef => {
  const w = getWeapons().find((x) => x.id === id);
  if (!w) throw new Error(id);
  return w;
};

/** 지형이 없는 빈 아레나(곡선 형태만 확인). */
const empty = Arena.fixed([]);

function slopes(ly: Float64Array, lx: Float64Array): number[] {
  const out: number[] = [];
  for (let i = 1; i < lx.length; i++) out.push((ly[i] - ly[i - 1]) / (lx[i] - lx[i - 1]));
  return out;
}

describe('함수 무기 등록', () => {
  it('21종이 카탈로그 순서대로 등록되어 있고 기본 함수가 앞에 온다', () => {
    expect(getWeapons().map((w) => w.id)).toEqual([
      'linear', 'abs', 'exp', 'tan', 'circle',
      'quadratic', 'cubic', 'quartic', 'expdecay', 'cosine', 'sine', 'log', 'well',
      'negsine', 'negcosine', 'reciprocal', 'xlnx', 'secsq', 'neglncos', 'sgn', 'xabs',
    ]);
  });

  it('모든 곡선은 유한한 정의역에서 원점(총구)에서 시작하고 촘촘하게 나뉜다', () => {
    for (const w of getWeapons()) {
      const c = getLocalCurve(w);
      expect(c.lx[0]).toBe(0);
      expect(c.ly[0]).toBe(0);
      expect(Number.isFinite(w.domain[0]) && Number.isFinite(w.domain[1])).toBe(true);
      for (let i = 1; i < c.n; i++) {
        const seg = Math.hypot(c.lx[i] - c.lx[i - 1], c.ly[i] - c.ly[i - 1]);
        expect(seg).toBeLessThanOrEqual(COMBAT.sampleSpacing + 1e-6);
        expect(Number.isFinite(c.ly[i])).toBe(true);
      }
      // 전방 길이 L = range(닫힌 도형은 가장 먼 점이 L), 최대 수직 거리 A = amplitude
      expect(w.trace ? Math.max(...Array.from(c.lx)) : c.lx[c.n - 1]).toBeCloseTo(w.tuning.range, 0);
      const maxAbs = Math.max(...Array.from(c.ly, Math.abs));
      expect(maxAbs).toBeCloseTo(w.tuning.amplitude, 0);
    }
  });
});

describe('곡선 형태', () => {
  it('일차함수: 조준축 위의 직선', () => {
    const c = getLocalCurve(byId('linear'));
    expect(Math.max(...Array.from(c.ly, Math.abs))).toBe(0);
  });

  it('이차함수: 꼭짓점이 한가운데인 좌우 대칭 포물선 (y = −x²)', () => {
    const w = byId('quadratic');
    const c = getLocalCurve(w);
    const L = w.tuning.range;
    const A = w.tuning.amplitude;
    for (let i = 0; i < c.n; i += 7) {
      const t = c.lx[i] / L;
      expect(c.ly[i]).toBeCloseTo(A * (1 - (2 * t - 1) ** 2), 0);
    }
    // 시작과 끝이 같은 높이, 정점은 정확히 가운데
    expect(Math.abs(c.ly[c.n - 1])).toBeLessThan(0.5);
    let top = 0;
    for (let i = 1; i < c.n; i++) if (c.ly[i] > c.ly[top]) top = i;
    expect(c.lx[top] / L).toBeCloseTo(0.5, 1);
    expect(c.ly[top]).toBeCloseTo(A, 0);
    // 곡률 일정(위로 볼록): 기울기가 단조 감소
    const s = slopes(c.ly, c.lx);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThanOrEqual(s[i - 1] + 1e-6);
    expect(s[0]).toBeGreaterThan(0);
    expect(s[s.length - 1]).toBeLessThan(0);
  });

  it('사인함수: 조준축을 중심으로 2회 진동 (내부 영점 3개, 극값 ±A)', () => {
    const w = byId('sine');
    const c = getLocalCurve(w);
    let crossings = 0;
    for (let i = 2; i < c.n - 1; i++) if (Math.sign(c.ly[i]) !== Math.sign(c.ly[i - 1]) && c.ly[i] !== 0) crossings++;
    expect(crossings).toBe(3);
    expect(Math.max(...c.ly)).toBeCloseTo(w.tuning.amplitude, 0);
    expect(Math.min(...c.ly)).toBeCloseTo(-w.tuning.amplitude, 0);
    // 처음에는 위(+)로 올라간다
    expect(c.ly[5]).toBeGreaterThan(0);
  });

  it('절댓값함수: 한가운데에 꼭짓점이 있는 좌우 대칭의 날카로운 V (두 직선)', () => {
    const w = byId('abs');
    const c = getLocalCurve(w);
    let vi = 0;
    for (let i = 1; i < c.n; i++) if (c.ly[i] < c.ly[vi]) vi = i;
    const L = w.tuning.range;
    expect(c.lx[vi] / L).toBeCloseTo(1 / 2, 1);
    expect(Math.abs(c.ly[c.n - 1])).toBeLessThan(0.5); // 끝이 조준축 위로 돌아온다
    const s = slopes(c.ly, c.lx);
    const left = s.slice(1, vi - 2);
    const right = s.slice(vi + 2, s.length - 1);
    // 양쪽 모두 기울기가 일정(직선)이고 부호가 반대(꺾임)
    for (const v of left) expect(v).toBeCloseTo(left[0], 4);
    for (const v of right) expect(v).toBeCloseTo(right[0], 4);
    expect(left[0]).toBeLessThan(0);
    expect(right[0]).toBeCloseTo(-left[0], 4);
  });

  it('지수함수: 처음엔 완만하다가 뒤로 갈수록 급격히 상승', () => {
    const w = byId('exp');
    const c = getLocalCurve(w);
    const A = w.tuning.amplitude;
    const L = w.tuning.range;
    const at = (t: number) => {
      let i = 0;
      while (i < c.n - 1 && c.lx[i] < t * L) i++;
      return c.ly[i];
    };
    expect(at(0.5)).toBeLessThan(0.15 * A);
    expect(at(1)).toBeCloseTo(A, 0);
    const s = slopes(c.ly, c.lx);
    expect(s[0]).toBeLessThan(0.15);
    expect(s[s.length - 1]).toBeGreaterThan(2.5);
    // 이차함수의 가장 가파른 곳보다 끝부분이 훨씬 가파르다
    const q = getLocalCurve(byId('quadratic'));
    const qs = slopes(q.ly, q.lx);
    expect(s[s.length - 1]).toBeGreaterThan(2 * Math.max(...qs.map(Math.abs)));
  });
});

describe('추가 함수 곡선 형태', () => {
  const at = (id: string, t: number) => {
    const w = byId(id);
    const c = getLocalCurve(w);
    let i = 0;
    while (i < c.n - 1 && c.lx[i] < t * w.tuning.range) i++;
    return c.ly[i] / w.tuning.amplitude;
  };

  it('로그함수: 총구 앞에서 급히 솟은 뒤 수평에 가깝게 뻗는다', () => {
    expect(at('log', 0.1)).toBeGreaterThan(0.4);
    expect(at('log', 1)).toBeCloseTo(1, 1);
    const late = at('log', 1) - at('log', 0.7);
    expect(late).toBeLessThan(0.12);
  });

  it('원: 총구에서 출발해 한 바퀴 돌아 총구로 돌아오는 닫힌 원(지름 = 사거리)', () => {
    const w = byId('circle');
    const c = getLocalCurve(w);
    const D = w.tuning.range;
    // 중심 (D/2, 0), 반지름 D/2인 진짜 원
    for (let i = 0; i < c.n; i += 5) expect(Math.hypot(c.lx[i] - D / 2, c.ly[i])).toBeCloseTo(D / 2, 0);
    expect(Math.hypot(c.lx[c.n - 1], c.ly[c.n - 1])).toBeLessThan(3); // 닫힘
    expect(c.length).toBeCloseTo(Math.PI * D, -1); // 둘레 πD
    // 위쪽 반과 아래쪽 반을 모두 지난다
    expect(Math.max(...Array.from(c.ly))).toBeCloseTo(D / 2, 0);
    expect(Math.min(...Array.from(c.ly))).toBeCloseTo(-D / 2, 0);
    // 조준점은 총구에서 가장 먼 점 (D, 0)
    expect(c.aimX).toBeCloseTo(D, 0);
    expect(Math.abs(c.aimY)).toBeLessThan(2);
  });

  it('탄젠트: 시작과 끝은 가파르고 가운데는 완만한 Z자', () => {
    const startRise = at('tan', 0.1) - at('tan', 0);
    const midRise = at('tan', 0.55) - at('tan', 0.45);
    const endRise = at('tan', 1) - at('tan', 0.9);
    expect(startRise).toBeGreaterThan(3 * midRise);
    expect(endRise).toBeGreaterThan(3 * midRise);
    expect(at('tan', 0.5)).toBeCloseTo(0.5, 1);
  });
});

describe('조준 좌표계와 회전', () => {
  it('오른쪽 조준: 로컬 +y(수학적 위)는 화면 위쪽(−y)', () => {
    const f = makeAimFrame({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(f.nx).toBeCloseTo(0);
    expect(f.ny).toBeCloseTo(-1);
  });

  it('왼쪽 조준: 반전 옵션이 켜져 있으면 여전히 화면 위쪽, 끄면 순수 회전(아래쪽)', () => {
    const m = makeAimFrame({ x: 0, y: 0 }, { x: -1, y: 0 }, true);
    expect(m.ny).toBeCloseTo(-1);
    const r = makeAimFrame({ x: 0, y: 0 }, { x: -1, y: 0 }, false);
    expect(r.ny).toBeCloseTo(1);
  });

  it('360° 모든 방향에서 곡선이 총구에서 시작해 조준 방향으로 회전된다', () => {
    const origin = { x: 800, y: 450 };
    for (const w of getWeapons()) {
      const local = getLocalCurve(w);
      for (let deg = 0; deg < 360; deg += 15) {
        const th = (deg * Math.PI) / 180;
        const dir = { x: Math.cos(th), y: Math.sin(th) };
        const frame = makeAimFrame(origin, dir);
        const path = buildCurvePath(w, frame, empty);
        expect(path.xs[0]).toBe(origin.x);
        expect(path.ys[0]).toBe(origin.y);
        // 화면 경계 밖으로 나가는 긴 곡선은 경계에서 멈출 수 있다(무한히 뻗지 않음).
        expect(path.count).toBeLessThanOrEqual(local.n);
        expect(path.count).toBeGreaterThan(local.n * 0.5);
        for (let i = 0; i < path.count; i += 11) {
          const dx = path.xs[i] - origin.x;
          const dy = path.ys[i] - origin.y;
          // 조준 방향 성분 = lx, 수직 성분 = ly (회전 + 이동만, 길이 보존)
          expect(dx * dir.x + dy * dir.y).toBeCloseTo(local.lx[i], 6);
          expect(dx * frame.nx + dy * frame.ny).toBeCloseTo(local.ly[i], 6);
          expect(Math.hypot(dx, dy)).toBeCloseTo(Math.hypot(local.lx[i], local.ly[i]), 6);
        }
      }
    }
  });

  it('아래로 조준해도(오른쪽을 볼 때) 곡선의 + 방향은 앞쪽(오른쪽)이다', () => {
    const f = makeAimFrame({ x: 0, y: 0 }, { x: 0.0001, y: 1 });
    expect(f.nx).toBeCloseTo(1);
  });
});

describe('지형 충돌로 곡선 자르기', () => {
  const wall: Solid = { kind: 'platform', walkable: false, x: 500, y: 0, w: 40, h: 900 };
  const arena = Arena.fixed([wall]);

  it('곡선이 지형과 처음 만나는 지점에서 끊긴다', () => {
    const path = buildCurvePath(byId('linear'), makeAimFrame({ x: 100, y: 400 }, { x: 1, y: 0 }), arena);
    expect(path.blocked).toBe(true);
    expect(path.xs[path.count - 1]).toBeCloseTo(500, 6);
    for (let i = 0; i < path.count; i++) expect(path.xs[i]).toBeLessThanOrEqual(500 + 1e-9);
    expect(path.length).toBeCloseTo(400, 6);
  });

  it('사인 곡선도 벽 앞에서 끊기고 그 뒤로는 점이 없다', () => {
    const path = buildCurvePath(byId('sine'), makeAimFrame({ x: 200, y: 400 }, { x: 1, y: 0 }), arena);
    expect(path.blocked).toBe(true);
    expect(Math.max(...Array.from(path.xs.subarray(0, path.count)))).toBeLessThanOrEqual(500 + 1e-9);
  });

  it('어깨→총구 사이가 벽에 막히면 길이 0인 공격이 된다', () => {
    const path = buildCurvePath(
      byId('exp'),
      makeAimFrame({ x: 520, y: 400 }, { x: 1, y: 0 }),
      arena,
      { x: 480, y: 400 },
    );
    expect(path.blocked).toBe(true);
    expect(path.count).toBe(1);
    expect(path.length).toBe(0);
  });

  it('지형이 없으면 막히지 않고 전체 길이가 나온다', () => {
    const p: CurvePath = buildCurvePath(byId('abs'), makeAimFrame({ x: 600, y: 300 }, { x: 1, y: 0 }), empty);
    expect(p.blocked).toBe(false);
    expect(p.length).toBeCloseTo(p.fullLength, 6);
  });
});

describe('끝점 정렬 조준', () => {
  it('끝이 축에서 벗어나는 함수도 곡선의 끝점이 커서 방향 위에 놓인다(좌우·위아래 모두)', () => {
    const empty = Arena.fixed([]);
    const origin = { x: 600, y: 400 };
    for (const id of ['exp', 'log', 'tan']) {
      const w = byId(id);
      for (const deg of [0, 30, -45, 90, 150, 180, -135]) {
        const rad = (deg * Math.PI) / 180;
        const dir = { x: Math.cos(rad), y: Math.sin(rad) };
        if (Math.abs(dir.x) < 1e-6) continue; // 정확히 수직은 거울 반전 경계
        const path = buildCurvePath(w, makeEndAlignedFrame(w, origin, dir), empty);
        const ex = path.xs[path.count - 1] - origin.x;
        const ey = path.ys[path.count - 1] - origin.y;
        const diff = Math.atan2(ey, ex) - rad;
        expect(Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff)))).toBeLessThan(0.01);
      }
    }
  });

  it('끝이 축 위이거나 거의 그런 함수(직선·사인·이차·원·절댓값)는 정렬해도 그대로다', () => {
    const origin = { x: 100, y: 100 };
    const dir = { x: 0.8, y: -0.6 };
    for (const id of ['linear', 'sine', 'quadratic', 'circle', 'abs']) {
      const w = byId(id);
      expect(makeEndAlignedFrame(w, origin, dir)).toEqual(makeAimFrame(origin, dir));
    }
  });
});

describe('커서에 맞춘 크기 (조준점 = 커서)', () => {
  it('커서가 사거리 안이면 곡선의 조준점이 정확히 커서에 닿는다(모든 방향)', () => {
    const empty = Arena.fixed([]);
    const origin = { x: 600, y: 400 };
    for (const w of getWeapons()) {
      for (const deg of [0, 40, -70, 130, 180, -150]) {
        const rad = (deg * Math.PI) / 180;
        const dir = { x: Math.cos(rad), y: Math.sin(rad) };
        const reach = 240;
        const frame = makeEndAlignedFrame(w, origin, dir);
        const path = buildCurvePath(w, frame, empty, undefined, undefined, undefined, reachScale(w, reach));
        // 경로 위에서 총구에서 가장 먼 점이 커서 위치
        let far = 0;
        let fx = 0;
        let fy = 0;
        for (let i = 0; i < path.count; i++) {
          const d = Math.hypot(path.xs[i] - origin.x, path.ys[i] - origin.y);
          if (d > far - 1e-9 && (w.trace || i === path.count - 1)) {
            far = d;
            fx = path.xs[i];
            fy = path.ys[i];
          }
        }
        expect(Math.hypot(fx - (origin.x + dir.x * reach), fy - (origin.y + dir.y * reach))).toBeLessThan(4);
      }
    }
  });

  it('커서가 멀면 사거리까지만(축소 없음), 너무 가까워도 최소 비율 밑으로는 줄지 않는다', () => {
    const w = byId('exp');
    expect(reachScale(w, 99999)).toBe(1);
    expect(reachScale(w, 1)).toBe(REACH_MIN_SCALE);
  });
});
