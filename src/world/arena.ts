import { WORLD } from '../config';
import { rectsOverlap, segmentRectEntry, type Rect } from '../core/geometry';

export type SolidKind = 'ground' | 'platform' | 'wall';

export interface Solid extends Rect {
  kind: SolidKind;
  /** 위쪽 면을 밟고 설 수 있는지(내비게이션·스폰용). */
  walkable: boolean;
}

export interface RayHit {
  t: number;
  x: number;
  y: number;
  solid: Solid;
}

const WALL = 24;
const GROUND_Y = 820;

/**
 * 아레나 배치. 모든 지형은 단단한 블록이라 위·아래·옆 모두 막히고, 함수 공격도 막는다.
 * 중앙 아래의 낮은 턱(overhang)은 서 있으면 지나갈 수 없고 숙여야 통과할 수 있다.
 */
export const ARENA_LAYOUT: Solid[] = [
  { kind: 'wall', walkable: false, x: -200, y: -2000, w: 200 + WALL, h: 3100 },
  { kind: 'wall', walkable: false, x: WORLD.width - WALL, y: -2000, w: 200 + WALL, h: 3100 },
  { kind: 'ground', walkable: true, x: -200, y: GROUND_Y, w: WORLD.width + 400, h: 300 },
  // 좌우 낮은 발판
  { kind: 'platform', walkable: true, x: 170, y: 660, w: 310, h: 22 },
  { kind: 'platform', walkable: true, x: 1120, y: 660, w: 310, h: 22 },
  // 중앙 발판
  { kind: 'platform', walkable: true, x: 580, y: 500, w: 440, h: 22 },
  // 높은 발판
  { kind: 'platform', walkable: true, x: 300, y: 350, w: 180, h: 22 },
  { kind: 'platform', walkable: true, x: 1120, y: 350, w: 180, h: 22 },
  // 숙여서 지나가는 낮은 턱 (바닥과의 틈 66px: 숙인 키 56 < 66 < 선 키 92)
  { kind: 'platform', walkable: true, x: 700, y: 732, w: 200, h: 22 },
];

export class Arena {
  readonly width = WORLD.width;
  readonly height = WORLD.height;
  readonly innerLeft = WALL;
  readonly innerRight = WORLD.width - WALL;
  readonly groundY = GROUND_Y;

  constructor(readonly solids: Solid[] = ARENA_LAYOUT) {}

  overlapsSolid(r: Rect): boolean {
    for (const s of this.solids) if (rectsOverlap(r, s)) return true;
    return false;
  }

  /** 선분 A→B가 처음 지형에 닿는 지점. 없으면 null. */
  raycast(ax: number, ay: number, bx: number, by: number): RayHit | null {
    let best: RayHit | null = null;
    for (const s of this.solids) {
      const t = segmentRectEntry(ax, ay, bx, by, s);
      if (t !== null && (best === null || t < best.t)) {
        best = { t, x: ax + (bx - ax) * t, y: ay + (by - ay) * t, solid: s };
      }
    }
    return best;
  }

  /** 두 점 사이 시야가 지형에 막히는지. */
  blocked(ax: number, ay: number, bx: number, by: number): boolean {
    for (const s of this.solids) if (segmentRectEntry(ax, ay, bx, by, s) !== null) return true;
    return false;
  }

  /** 공격 곡선이 화면 밖으로 끝없이 나가지 않도록 하는 경계. */
  inAttackBounds(x: number, y: number): boolean {
    return x > -60 && x < this.width + 60 && y > -400 && y < this.height + 60;
  }
}
