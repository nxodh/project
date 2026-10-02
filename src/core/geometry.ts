export interface Vec2 {
  x: number;
  y: number;
}

/** 축 정렬 사각형. (x, y)는 왼쪽 위 모서리, 화면 좌표계(y 아래로 증가). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

export function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * 선분 A→B가 사각형에 처음 들어가는 매개변수 t(0~1)를 구한다(Liang–Barsky).
 * 시작점이 이미 사각형 안이면 0, 만나지 않으면 null.
 */
export function segmentRectEntry(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: Rect,
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x, r.x + r.w - ax, ay - r.y, r.y + r.h - ay];
  for (let i = 0; i < 4; i++) {
    const pi = p[i];
    const qi = q[i];
    if (pi === 0) {
      if (qi < 0) return null;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0;
}

function pointSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

function pointRectDistSq(px: number, py: number, r: Rect): number {
  const cx = clamp(px, r.x, r.x + r.w);
  const cy = clamp(py, r.y, r.y + r.h);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

/**
 * 선분과 사각형 사이의 정확한 최단 거리. 교차하면 0.
 * 곡선 두께(반경)와 비교해 캡슐-사각형 충돌을 판정할 때 쓴다.
 */
export function segmentRectDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: Rect,
): number {
  if (segmentRectEntry(ax, ay, bx, by, r) !== null) return 0;
  let best = Math.min(pointRectDistSq(ax, ay, r), pointRectDistSq(bx, by, r));
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  best = Math.min(
    best,
    pointSegmentDistSq(r.x, r.y, ax, ay, bx, by),
    pointSegmentDistSq(x2, r.y, ax, ay, bx, by),
    pointSegmentDistSq(r.x, y2, ax, ay, bx, by),
    pointSegmentDistSq(x2, y2, ax, ay, bx, by),
  );
  return Math.sqrt(best);
}

export function segmentCircleHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  return pointSegmentDistSq(cx, cy, ax, ay, bx, by) <= radius * radius;
}

/** 선분 위에서 점 P에 가장 가까운 점. */
export function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Vec2 {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1) : 0;
  return { x: ax + dx * t, y: ay + dy * t };
}

export function circleRectOverlap(cx: number, cy: number, radius: number, r: Rect): boolean {
  return pointRectDistSq(cx, cy, r) <= radius * radius;
}
