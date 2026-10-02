import { PHYSICS } from '../config';
import type { Rect } from '../core/geometry';
import type { Arena } from './arena';

/**
 * 직사각형 몸체. (x, y)는 발밑 중앙이다. 높이를 바꾸면(숙이기) 발 위치는 그대로 두고 머리 쪽이 줄어든다.
 */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  /** 이번 스텝에 옆 벽에 막혔으면 막힌 방향(-1 왼쪽, 1 오른쪽). */
  wallDir: -1 | 0 | 1;
  hitCeiling: boolean;
}

export function makeBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, vx: 0, vy: 0, w, h, grounded: false, wallDir: 0, hitCeiling: false };
}

export function bodyRect(b: Body, h: number = b.h): Rect {
  return { x: b.x - b.w / 2, y: b.y - h, w: b.w, h };
}

/** 주어진 높이로 바꿔도 지형과 겹치지 않는지(숙인 상태에서 일어설 수 있는지). */
export function canFitHeight(b: Body, h: number, arena: Arena): boolean {
  return !arena.overlapsSolid(bodyRect(b, h));
}

const EPS = 0.001;

/**
 * 중력 적용 후 X축, Y축을 따로 이동·해소한다. 고정 스텝(1/120s)에서 최대 낙하 속도로도
 * 한 스텝 이동량(≈11px)이 가장 얇은 발판(22px)보다 작아 관통이 생기지 않는다.
 */
export function moveBody(b: Body, arena: Arena, dt: number, gravityScale = 1): void {
  b.vy = Math.min(b.vy + PHYSICS.gravity * gravityScale * dt, PHYSICS.maxFallSpeed);
  b.wallDir = 0;
  b.hitCeiling = false;

  // X축: 수평으로 움직였을 때만 그 반대 방향으로 밀어낸다(정지 상태의 겹침은 Y축에서 처리).
  if (b.vx !== 0) {
    b.x += b.vx * dt;
    for (const s of arena.solids) {
      const r = bodyRect(b);
      if (r.x < s.x + s.w && r.x + r.w > s.x && r.y < s.y + s.h && r.y + r.h > s.y) {
        if (b.vx > 0) {
          b.x = s.x - b.w / 2 - EPS;
          b.wallDir = 1;
        } else {
          b.x = s.x + s.w + b.w / 2 + EPS;
          b.wallDir = -1;
        }
        b.vx = 0;
        break;
      }
    }
  }

  // Y축
  b.grounded = false;
  b.y += b.vy * dt;
  for (const s of arena.solids) {
    const r = bodyRect(b);
    if (r.x < s.x + s.w && r.x + r.w > s.x && r.y < s.y + s.h && r.y + r.h > s.y) {
      if (b.vy >= 0) {
        b.y = s.y;
        b.grounded = true;
      } else {
        b.y = s.y + s.h + b.h + EPS;
        b.hitCeiling = true;
      }
      b.vy = 0;
    }
  }
}
