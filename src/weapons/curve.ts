import { COMBAT } from '../config';
import type { Vec2 } from '../core/geometry';
import type { Arena } from '../world/arena';
import type { FunctionWeaponDef } from './types';

/** 로컬 좌표계의 곡선 샘플. lx는 조준 방향(전방), ly는 수학적 위쪽(+). 단위는 px. */
export interface LocalCurve {
  lx: Float64Array;
  ly: Float64Array;
  n: number;
  /** 곡선 전체 길이(px). */
  length: number;
}

const FINE_SAMPLES = 2048;
const cache = new Map<FunctionWeaponDef, { key: string; curve: LocalCurve }>();

/**
 * 함수 정의를 로컬 곡선으로 변환한다: lx = L·t, ly = A·g(t).
 * 촘촘하게 샘플링한 뒤 곡선 길이 기준으로 일정 간격(sampleSpacing)으로 다시 나눠
 * 급하게 휘는 구간(지수함수 끝부분 등)도 선분이 길어지지 않게 한다.
 */
export function computeLocalCurve(def: FunctionWeaponDef, spacing: number = COMBAT.sampleSpacing): LocalCurve {
  const [x0, x1] = def.domain;
  const f0 = def.fn(x0);
  const { range: L, amplitude: A } = def.tuning;

  const fineY = new Float64Array(FINE_SAMPLES + 1);
  let yRef = 0;
  for (let i = 0; i <= FINE_SAMPLES; i++) {
    const t = i / FINE_SAMPLES;
    const v = def.fn(x0 + t * (x1 - x0)) - f0;
    fineY[i] = v;
    if (Math.abs(v) > yRef) yRef = Math.abs(v);
  }
  const yScale = yRef > 1e-12 ? A / yRef : 0;

  const fx = new Float64Array(FINE_SAMPLES + 1);
  const fy = new Float64Array(FINE_SAMPLES + 1);
  const fcum = new Float64Array(FINE_SAMPLES + 1);
  for (let i = 0; i <= FINE_SAMPLES; i++) {
    fx[i] = (L * i) / FINE_SAMPLES;
    fy[i] = fineY[i] * yScale;
    if (i > 0) fcum[i] = fcum[i - 1] + Math.hypot(fx[i] - fx[i - 1], fy[i] - fy[i - 1]);
  }
  const total = fcum[FINE_SAMPLES];
  const n = Math.max(2, Math.ceil(total / spacing) + 1);
  const lx = new Float64Array(n);
  const ly = new Float64Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (total * k) / (n - 1);
    while (j < FINE_SAMPLES - 1 && fcum[j + 1] < s) j++;
    const segLen = fcum[j + 1] - fcum[j];
    const u = segLen > 0 ? (s - fcum[j]) / segLen : 0;
    lx[k] = fx[j] + (fx[j + 1] - fx[j]) * u;
    ly[k] = fy[j] + (fy[j + 1] - fy[j]) * u;
  }
  lx[0] = 0;
  ly[0] = 0;
  let length = 0;
  for (let k = 1; k < n; k++) length += Math.hypot(lx[k] - lx[k - 1], ly[k] - ly[k - 1]);
  return { lx, ly, n, length };
}

/** 무기별 로컬 곡선(수치가 바뀌면 다시 계산). */
export function getLocalCurve(def: FunctionWeaponDef): LocalCurve {
  const t = def.tuning;
  const key = `${def.domain[0]}|${def.domain[1]}|${t.range}|${t.amplitude}|${COMBAT.sampleSpacing}`;
  const hit = cache.get(def);
  if (hit && hit.key === key) return hit.curve;
  const curve = computeLocalCurve(def);
  cache.set(def, { key, curve });
  return curve;
}

/**
 * 조준 좌표계. 원점은 총구, f는 총구→커서 단위 벡터(로컬 x축), n은 로컬 +y(수학적 위쪽)의 화면 방향.
 * 화면 좌표는 y가 아래로 증가하므로, 오른쪽을 볼 때 수학적 위쪽은 f를 화면에서 반시계로 90° 돌린 (f.y, −f.x)이다.
 */
export interface AimFrame {
  ox: number;
  oy: number;
  fx: number;
  fy: number;
  nx: number;
  ny: number;
}

export function makeAimFrame(
  origin: Vec2,
  dir: Vec2,
  mirrorWhenLeft: boolean = COMBAT.mirrorWhenAimingLeft,
): AimFrame {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const fx = dir.x / len;
  const fy = dir.y / len;
  let nx = fy;
  let ny = -fx;
  if (mirrorWhenLeft && fx < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { ox: origin.x, oy: origin.y, fx, fy, nx, ny };
}

export function localToWorld(frame: AimFrame, lx: number, ly: number): Vec2 {
  return {
    x: frame.ox + frame.fx * lx + frame.nx * ly,
    y: frame.oy + frame.fy * lx + frame.ny * ly,
  };
}

/** 월드에 배치된 곡선 경로(지형에서 잘린 뒤). 미리보기와 실제 공격이 같은 구조를 공유한다. */
export interface CurvePath {
  xs: Float64Array;
  ys: Float64Array;
  /** 시작점부터 각 점까지의 누적 길이. */
  cum: Float64Array;
  count: number;
  length: number;
  /** 지형에 막혀 잘렸는지. */
  blocked: boolean;
  /** 잘리기 전 곡선 전체 길이. */
  fullLength: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 함수 곡선을 조준 좌표계로 회전·이동해 월드 경로를 만들고, 지형과 처음 만나는 지점에서 자른다.
 * guard(어깨 위치)를 주면 어깨→총구 사이가 벽에 막혔는지도 확인한다(벽에 붙어 벽 쪽으로 쏘는 경우).
 * 미리보기와 실제 발사가 모두 이 함수를 사용한다.
 */
export function buildCurvePath(
  def: FunctionWeaponDef,
  frame: AimFrame,
  arena: Arena,
  guard?: Vec2,
): CurvePath {
  const local = getLocalCurve(def);
  const xs = new Float64Array(local.n);
  const ys = new Float64Array(local.n);
  const cum = new Float64Array(local.n);
  let count = 0;
  let blocked = false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const push = (x: number, y: number) => {
    if (count > 0) cum[count] = cum[count - 1] + Math.hypot(x - xs[count - 1], y - ys[count - 1]);
    xs[count] = x;
    ys[count] = y;
    count++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const guardHit = guard ? arena.raycast(guard.x, guard.y, frame.ox, frame.oy) : null;
  if (guardHit) {
    push(guardHit.x, guardHit.y);
    blocked = true;
  } else {
    push(frame.ox, frame.oy);
    for (let i = 1; i < local.n; i++) {
      const wx = frame.ox + frame.fx * local.lx[i] + frame.nx * local.ly[i];
      const wy = frame.oy + frame.fy * local.lx[i] + frame.ny * local.ly[i];
      const px = xs[count - 1];
      const py = ys[count - 1];
      const hit = arena.raycast(px, py, wx, wy);
      if (hit) {
        if (hit.t > 0) push(hit.x, hit.y);
        blocked = true;
        break;
      }
      push(wx, wy);
      if (!arena.inAttackBounds(wx, wy)) break;
    }
  }

  return {
    xs,
    ys,
    cum,
    count,
    length: cum[count - 1],
    blocked,
    fullLength: local.length,
    minX,
    minY,
    maxX,
    maxY,
  };
}

export interface PathPoint {
  x: number;
  y: number;
  /** 이 점이 속한 선분의 시작 인덱스. */
  index: number;
}

/** 경로 시작점에서 길이 s만큼 떨어진 점. */
export function pointAtLength(path: CurvePath, s: number): PathPoint {
  const { cum, xs, ys, count } = path;
  if (count === 1 || s <= 0) return { x: xs[0], y: ys[0], index: 0 };
  if (s >= path.length) return { x: xs[count - 1], y: ys[count - 1], index: Math.max(0, count - 2) };
  let lo = 0;
  let hi = count - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  const u = seg > 0 ? (s - cum[lo]) / seg : 0;
  return { x: xs[lo] + (xs[hi] - xs[lo]) * u, y: ys[lo] + (ys[hi] - ys[lo]) * u, index: lo };
}

/**
 * 경로의 [from, to] 길이 구간을 선분 단위로 순회한다. 양 끝은 보간된 점이다.
 * 콜백이 true를 돌려주면 중단한다.
 */
export function forEachSegmentInRange(
  path: CurvePath,
  from: number,
  to: number,
  cb: (ax: number, ay: number, bx: number, by: number) => boolean | void,
): void {
  if (path.count < 2 || to <= from) return;
  const a = pointAtLength(path, from);
  const b = pointAtLength(path, to);
  let px = a.x;
  let py = a.y;
  for (let i = a.index + 1; i <= b.index; i++) {
    if (cb(px, py, path.xs[i], path.ys[i])) return;
    px = path.xs[i];
    py = path.ys[i];
  }
  cb(px, py, b.x, b.y);
}
