/** '#rrggbb' → 'rgba(r,g,b,a)'. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/** 두 '#rrggbb' 색을 t 비율로 섞는다. */
export function mix(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const k = Math.max(0, Math.min(1, t));
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** 흑백 테마. 검은 바탕의 모눈종이(좌표평면)에 흰 선으로 그린다. */
export const PALETTE = {
  letterbox: '#000000',
  bg: '#040404',
  gridMinor: 'rgba(255,255,255,0.05)',
  gridMajor: 'rgba(255,255,255,0.12)',
  axis: 'rgba(255,255,255,0.55)',
  axisLabel: 'rgba(255,255,255,0.6)',
  tickLabel: 'rgba(255,255,255,0.34)',
  terrainTop: '#161616',
  terrainBottom: '#0a0a0a',
  terrainEdge: '#ffffff',
  terrainHatch: 'rgba(255,255,255,0.07)',
  player: '#ffffff',
  playerHurt: '#6e6e6e',
  headFill: '#000000',
  text: '#ffffff',
  textDim: '#8f8f8f',
  panel: 'rgba(0,0,0,0.82)',
  panelLine: 'rgba(255,255,255,0.22)',
  enemyCurve: '#e0e0e0',
  enemyPreview: '#bdbdbd',
  font: "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'NanumGothic', 'NanumSquareRound', system-ui, sans-serif",
  mathFont: "'Cambria Math', 'STIX Two Math', 'Latin Modern Math', 'Times New Roman', 'NanumMyeongjo', serif",
} as const;
