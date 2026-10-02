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

export const PALETTE = {
  letterbox: '#03050a',
  bgTop: '#0a1020',
  bgBottom: '#060912',
  gridMinor: 'rgba(120,150,230,0.05)',
  gridMajor: 'rgba(120,150,230,0.10)',
  axis: 'rgba(150,180,255,0.20)',
  terrainTop: '#1b2438',
  terrainBottom: '#10162a',
  terrainEdge: '#7f93c4',
  player: '#e9f2ff',
  playerHurt: '#ff5b6b',
  headFill: '#0b1020',
  text: '#e8eefc',
  textDim: '#8d9abb',
  hpGood: '#5cf2a6',
  hpLow: '#ff5b6b',
  font: "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'NanumGothic', 'NanumSquareRound', system-ui, sans-serif",
  mathFont: "'Cambria Math', 'STIX Two Math', 'Latin Modern Math', 'Times New Roman', 'NanumMyeongjo', serif",
} as const;
