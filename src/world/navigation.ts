import { ENEMIES, PHYSICS } from '../config';
import type { Arena } from './arena';

/** 밟고 설 수 있는 지형 윗면. */
export interface Surface {
  id: number;
  x1: number;
  x2: number;
  y: number;
}

export type LinkKind = 'jump' | 'drop';

export interface NavLink {
  to: number;
  kind: LinkKind;
}

export interface LinkPlan {
  kind: LinkKind;
  /** 점프할 위치 또는 떨어질 가장자리. */
  takeoffX: number;
  /** 이 x까지 걸어간다. */
  walkToX: number;
  /** 공중에서 향할 착지 x. */
  landX: number;
}

/** 적이 점프로 오를 수 있는 최대 높이(여유분 제외). */
const MAX_RISE = (ENEMIES.jumpVelocity * ENEMIES.jumpVelocity) / (2 * PHYSICS.gravity) - 14;
/** 위로 점프할 때 건널 수 있는 수평 틈. */
const MAX_UP_GAP = 130;
/** 같은 높이 이하로 점프할 때 건널 수 있는 수평 틈. */
const MAX_ACROSS_GAP = 170;
/** 가장자리에서 떨어질 때 착지 가능한 수평 범위. */
const DROP_REACH = 70;

/**
 * 지형 윗면들을 노드로, 점프/낙하 가능 여부를 간선으로 하는 간단한 내비게이션 그래프.
 * 아레나는 고정이므로 모든 쌍의 다음 경유지를 미리 BFS로 계산해 둔다.
 */
export class NavGraph {
  readonly surfaces: Surface[] = [];
  readonly links: NavLink[][] = [];
  private dist: number[][] = [];

  constructor(private readonly arena: Arena) {
    for (const s of arena.solids) {
      if (!s.walkable) continue;
      const x1 = Math.max(s.x, arena.innerLeft);
      const x2 = Math.min(s.x + s.w, arena.innerRight);
      if (x2 - x1 < 40) continue;
      this.surfaces.push({ id: this.surfaces.length, x1, x2, y: s.y });
    }
    for (const a of this.surfaces) {
      const out: NavLink[] = [];
      for (const b of this.surfaces) {
        if (a === b) continue;
        const kind = this.linkKind(a, b);
        if (kind) out.push({ to: b.id, kind });
      }
      this.links.push(out);
    }
    this.buildNextTable();
  }

  private linkKind(a: Surface, b: Surface): LinkKind | null {
    const gap = Math.max(0, b.x1 - a.x2, a.x1 - b.x2);
    const rise = a.y - b.y; // 양수면 b가 더 높다
    if (rise > 4) {
      if (rise <= MAX_RISE && gap <= MAX_UP_GAP) return 'jump';
      return null;
    }
    // b가 같거나 낮음: 가장자리에서 떨어져 닿을 수 있으면 낙하, 아니면 건너뛰기 점프
    const dropLeft = b.x1 < a.x1 && b.x2 > a.x1 - DROP_REACH;
    const dropRight = b.x2 > a.x2 && b.x1 < a.x2 + DROP_REACH;
    if (rise < -4 && (dropLeft || dropRight)) return 'drop';
    if (gap > 0 && gap <= MAX_ACROSS_GAP) return 'jump';
    return null;
  }

  /** 모든 쌍의 최소 이동 횟수(BFS). 도달 불가하면 -1. */
  private buildNextTable(): void {
    const n = this.surfaces.length;
    this.dist = [];
    for (let src = 0; src < n; src++) {
      const d = new Array<number>(n).fill(-1);
      d[src] = 0;
      const queue = [src];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const l of this.links[cur]) {
          if (d[l.to] >= 0) continue;
          d[l.to] = d[cur] + 1;
          queue.push(l.to);
        }
      }
      this.dist.push(d);
    }
  }

  /** from에서 to로 가는 최단 경로 위에 있는 다음 면 후보들(여러 개일 수 있음). */
  candidateHops(from: number, to: number): Surface[] {
    const d = this.dist[from]?.[to] ?? -1;
    if (d <= 0) return [];
    return this.links[from].filter((l) => this.dist[l.to][to] === d - 1).map((l) => this.surfaces[l.to]);
  }

  /** 발밑 좌표 (x, feetY)가 서 있는 면. */
  surfaceAt(x: number, feetY: number, halfWidth = 0): Surface | null {
    let best: Surface | null = null;
    for (const s of this.surfaces) {
      if (Math.abs(feetY - s.y) > 3) continue;
      if (x + halfWidth < s.x1 || x - halfWidth > s.x2) continue;
      if (!best || s.y < best.y) best = s;
    }
    return best;
  }

  /** from에서 to로 가기 위한 다음 면(후보 중 첫 번째). 같은 면이면 자신, 도달 불가하면 null. */
  nextHop(from: number, to: number): Surface | null {
    if (from === to) return this.surfaces[from] ?? null;
    return this.candidateHops(from, to)[0] ?? null;
  }

  /**
   * cur 면에서 next 면으로 옮겨 가는 방법. 몸 중심 x와 반폭으로 출발 지점을 정한다.
   * - drop: walkToX까지 걸어가면 가장자리에서 떨어진다.
   * - jump: takeoffX에서 뛰어 landX를 향해 공중 이동한다.
   */
  planLink(cur: Surface, next: Surface, bodyX: number, halfW: number, preferX: number): LinkPlan | null {
    const link = this.linkBetween(cur.id, next.id);
    if (!link) return null;
    if (link.kind === 'drop') {
      const leftOK = next.x1 < cur.x1 - 8;
      const rightOK = next.x2 > cur.x2 + 8;
      let dir: -1 | 1;
      if (leftOK && rightOK) dir = Math.abs(preferX - cur.x1) < Math.abs(preferX - cur.x2) ? -1 : 1;
      else dir = leftOK ? -1 : 1;
      const edge = dir < 0 ? cur.x1 : cur.x2;
      return { kind: 'drop', takeoffX: edge, walkToX: edge + dir * halfW * 2, landX: edge + dir * halfW * 3 };
    }
    const overlap = next.x1 < cur.x2 && next.x2 > cur.x1;
    if (overlap) {
      // 다음 면이 머리 위에 있으면 그 면 바깥쪽에서 뛰어야 머리를 박지 않는다.
      const leftT = next.x1 - halfW - 26;
      const rightT = next.x2 + halfW + 26;
      const leftOK = leftT >= cur.x1 + 2;
      const rightOK = rightT <= cur.x2 - 2;
      if (!leftOK && !rightOK) return null;
      const useLeft = leftOK && (!rightOK || Math.abs(bodyX - leftT) <= Math.abs(bodyX - rightT));
      const takeoffX = useLeft ? leftT : rightT;
      return { kind: 'jump', takeoffX, walkToX: takeoffX, landX: useLeft ? next.x1 + 46 : next.x2 - 46 };
    }
    if (next.x1 >= cur.x2) {
      const takeoffX = cur.x2 - halfW - 2;
      return { kind: 'jump', takeoffX, walkToX: takeoffX, landX: next.x1 + 50 };
    }
    const takeoffX = cur.x1 + halfW + 2;
    return { kind: 'jump', takeoffX, walkToX: takeoffX, landX: next.x2 - 50 };
  }

  linkBetween(from: number, to: number): NavLink | null {
    return this.links[from]?.find((l) => l.to === to) ?? null;
  }

  surface(id: number): Surface {
    return this.surfaces[id];
  }

  get arenaRef(): Arena {
    return this.arena;
  }
}
