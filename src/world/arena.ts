import { COMBAT, TERRAIN } from '../config';
import { rectsOverlap, segmentRectEntry, type Rect } from '../core/geometry';

export type SolidKind = 'ground' | 'platform' | 'ledge';

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

const W = TERRAIN.chunkWidth;
const GROUND_Y = TERRAIN.groundY;
/** 숙여서 지나가는 낮은 턱의 윗면 y (바닥과의 틈 66px: 숙인 키 56 < 66 < 선 키 92). */
const LEDGE_Y = 732;

type PlatformSpec = [x: number, y: number, w: number];

/**
 * 청크 배치 틀(청크 왼쪽 끝 기준 x, 절대 y, 너비). 두께는 발판 22px.
 * 모든 발판은 바닥이나 다른 발판에서 점프(높이 ≤170, 수평 틈 ≤130)로 닿을 수 있게 배치한다.
 * y=732인 것은 숙여서 지나가는 낮은 턱이다.
 */
const ORIGIN_CHUNK: PlatformSpec[] = [
  [170, 660, 310],
  [1120, 660, 310],
  [580, 500, 440],
  [300, 350, 180],
  [1120, 350, 180],
  [700, LEDGE_Y, 200],
];

const TEMPLATES: PlatformSpec[][] = [
  // 계단: 오른쪽으로 올라가다 내려온다
  [
    [140, 680, 280],
    [500, 540, 260],
    [840, 400, 260],
    [1180, 660, 280],
  ],
  // 피라미드
  [
    [200, 660, 320],
    [1080, 660, 320],
    [560, 520, 480],
    [700, 380, 200],
  ],
  // 턱 지대: 낮은 턱 두 개와 그 위로 오르는 발판
  [
    [250, LEDGE_Y, 200],
    [1050, LEDGE_Y, 200],
    [540, 600, 380],
    [1180, 600, 240],
  ],
  // 넓은 평지와 떠 있는 섬
  [
    [260, 660, 400],
    [940, 660, 400],
    [620, 500, 360],
    [380, 370, 180],
    [1040, 370, 180],
  ],
  // 엇갈린 발판
  [
    [120, 660, 240],
    [440, 540, 220],
    [760, 660, 240],
    [1080, 540, 220],
    [1330, 680, 200],
  ],
];

/** 청크 번호와 시드로 정해지는 결정적 난수(같은 시드면 같은 지형). */
function chunkRandom(seed: number, k: number): () => number {
  let s = (Math.imul(seed ^ 0x9e3779b9, 73856093) ^ Math.imul(k, 19349663)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toSolids(specs: PlatformSpec[], x0: number): Solid[] {
  return specs.map(([x, y, w]) => ({
    kind: y === LEDGE_Y ? ('ledge' as const) : ('platform' as const),
    walkable: true,
    x: x0 + x,
    y,
    w,
    h: 22,
  }));
}

/** 청크 k의 지형(바닥 포함). */
export function generateChunk(seed: number, k: number): Solid[] {
  const x0 = k * W;
  const ground: Solid = { kind: 'ground', walkable: true, x: x0, y: GROUND_Y, w: W, h: 300 };
  if (k === 0) return [ground, ...toSolids(ORIGIN_CHUNK, x0)];
  const rnd = chunkRandom(seed, k);
  const template = TEMPLATES[Math.floor(rnd() * TEMPLATES.length)];
  const mirror = rnd() < 0.5;
  const shift = Math.round((rnd() - 0.5) * 80);
  const specs = template.map(([x, y, w]): PlatformSpec => [(mirror ? W - x - w : x) + shift, y, w]);
  return [ground, ...toSolids(specs, x0)];
}

/**
 * 좌우로 무한히 이어지는 지형. 필요한 청크만 그때그때 만들고, 충돌·광선 검사는 해당 x 범위의 청크만 본다.
 * 테스트용으로 고정된 지형 목록을 넣으면(Arena.fixed) 청크를 만들지 않는다.
 */
/** 바닥만 막는 필터(보스: 발판을 통과하는 거인). */
export const groundOnly = (s: Solid): boolean => s.kind === 'ground';

export class Arena {
  readonly groundY = GROUND_Y;
  /** 새 청크가 생길 때마다 증가(내비게이션 재구성 판단용). */
  version = 0;
  private readonly chunks = new Map<number, Solid[]>();
  private readonly fixedSolids: Solid[] | null;

  constructor(
    readonly seed: number = 1,
    fixedSolids: Solid[] | null = null,
  ) {
    this.fixedSolids = fixedSolids;
  }

  /** 고정 지형으로 만든다(테스트용). */
  static fixed(solids: Solid[]): Arena {
    return new Arena(0, solids);
  }

  chunk(k: number): Solid[] {
    let c = this.chunks.get(k);
    if (!c) {
      c = generateChunk(this.seed, k);
      this.chunks.set(k, c);
      this.version++;
    }
    return c;
  }

  /** x 구간 [x1, x2]와 겹칠 수 있는 지형 목록. */
  solidsIn(x1: number, x2: number): Solid[] {
    if (this.fixedSolids) return this.fixedSolids;
    const k1 = Math.floor(Math.min(x1, x2) / W);
    const k2 = Math.floor(Math.max(x1, x2) / W);
    if (k1 === k2) return this.chunk(k1);
    const out: Solid[] = [];
    for (let k = k1; k <= k2; k++) out.push(...this.chunk(k));
    return out;
  }

  overlapsSolid(r: Rect): boolean {
    for (const s of this.solidsIn(r.x, r.x + r.w)) if (rectsOverlap(r, s)) return true;
    return false;
  }

  /** 선분 A→B가 처음 지형에 닿는 지점. 없으면 null. filter로 막는 지형 종류를 고를 수 있다. */
  raycast(ax: number, ay: number, bx: number, by: number, filter?: (s: Solid) => boolean): RayHit | null {
    let best: RayHit | null = null;
    for (const s of this.solidsIn(ax, bx)) {
      if (filter && !filter(s)) continue;
      const t = segmentRectEntry(ax, ay, bx, by, s);
      if (t !== null && (best === null || t < best.t)) {
        best = { t, x: ax + (bx - ax) * t, y: ay + (by - ay) * t, solid: s };
      }
    }
    return best;
  }

  /** 두 점 사이 시야가 지형에 막히는지. */
  blocked(ax: number, ay: number, bx: number, by: number): boolean {
    for (const s of this.solidsIn(ax, bx)) if (segmentRectEntry(ax, ay, bx, by, s) !== null) return true;
    return false;
  }

  /** 공격 곡선이 위·아래로 끝없이 나가지 않도록 하는 경계(좌우는 곡선의 유한한 정의역이 제한). */
  inAttackBounds(_x: number, y: number): boolean {
    return y > COMBAT.minY && y < COMBAT.maxY;
  }
}
