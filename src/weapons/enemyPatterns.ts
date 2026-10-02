import { ENEMY_PATTERN_TUNING as T } from '../config';
import type { FunctionWeaponDef } from './types';

/**
 * 적이 쓰는 함수 공격. 플레이어 무기와 같은 곡선 생성기(curve.ts)를 쓰므로
 * 예고선(미리보기)과 실제 공격 경로가 같고, 지형에 막히며, 같은 두께 판정을 갖는다.
 */
export interface EnemyPattern extends FunctionWeaponDef {
  /**
   * 사거리를 목표까지의 거리 d에 맞춘다: L = d·scale + extra (min~max로 제한).
   * 포물선은 scale 1로 목표 지점에 떨어지고, 사인파는 진동의 마디(조준축과 만나는 점)가 목표에 오도록 한다.
   */
  fitRange?: { min: number; max: number; extra: number; scale?: number };
}

const GRAY = '#d0d0d0';
const pattern = (p: EnemyPattern): EnemyPattern => p;

export const ENEMY_PATTERNS = {
  /** 사인 술사: 조준축을 따라 2회 진동. */
  sineWave: pattern({
    id: 'e-sine',
    name: '사인파',
    shape: '파동',
    formula: 'y = sin(x)',
    role: '',
    color: GRAY,
    domain: [0, 4 * Math.PI],
    fn: (x) => Math.sin(x),
    tuning: T.sineWave,
    // 4π 중 3π 마디가 목표에 오도록 L = d × 4/3
    fitRange: { min: 300, max: 1000, extra: 0, scale: 4 / 3 },
  }),
  /** 포물선 투척병: y = x − x² (위로 볼록한 포물선)으로 목표 지점에 떨어진다. */
  lobArc: pattern({
    id: 'e-lob',
    name: '포물선 투척',
    shape: '포물선',
    formula: 'y = x − x²',
    role: '',
    color: GRAY,
    domain: [0, 1],
    fn: (x) => x - x * x,
    tuning: T.lobArc,
    fitRange: { min: 200, max: 820, extra: 0 },
  }),
  bossSine: pattern({
    id: 'b-sine',
    name: '삼중 사인파',
    shape: '파동',
    formula: 'y = sin(x)',
    role: '',
    color: GRAY,
    domain: [0, 6 * Math.PI],
    fn: (x) => Math.sin(x),
    tuning: T.bossSine,
    // 6π 중 5π 마디가 목표에 오도록 L = d × 6/5
    fitRange: { min: 400, max: 1300, extra: 0, scale: 6 / 5 },
  }),
  bossLob: pattern({
    id: 'b-lob',
    name: '포물선 폭격',
    shape: '포물선',
    formula: 'y = x − x²',
    role: '',
    color: GRAY,
    domain: [0, 1],
    fn: (x) => x - x * x,
    tuning: T.bossLob,
    fitRange: { min: 200, max: 950, extra: 0 },
  }),
  /** 지붕 모양 Λ: y = −|x|. 위로 솟았다가 목표 지점에 내리꽂힌다. */
  bossRoof: pattern({
    id: 'b-roof',
    name: '절댓값 낙하',
    shape: 'Λ',
    formula: 'y = −|x|',
    role: '',
    color: GRAY,
    domain: [-1, 1],
    fn: (x) => -Math.abs(x),
    tuning: T.bossRoof,
    fitRange: { min: 260, max: 900, extra: 40 },
  }),
  bossExp: pattern({
    id: 'b-exp',
    name: '지수 올려치기',
    shape: '급상승',
    formula: 'y = eˣ − 1',
    role: '',
    color: GRAY,
    domain: [0, 4],
    fn: (x) => Math.exp(x) - 1,
    tuning: T.bossExp,
  }),
  bossLine: pattern({
    id: 'b-line',
    name: '일차함수 부채꼴',
    shape: '직선',
    formula: 'y = x',
    role: '',
    color: GRAY,
    domain: [0, 1],
    fn: (x) => x,
    tuning: T.bossLine,
  }),
  bossTan: pattern({
    id: 'b-tan',
    name: '탄젠트 쓸기',
    shape: 'Z',
    formula: 'y = tan x',
    role: '',
    color: GRAY,
    domain: [-1.3, 1.3],
    fn: (x) => Math.tan(x),
    tuning: T.bossTan,
  }),
} satisfies Record<string, EnemyPattern>;

export type EnemyPatternId = keyof typeof ENEMY_PATTERNS;
