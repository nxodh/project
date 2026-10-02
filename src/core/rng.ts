/**
 * 게임 로직용 시드 가능 난수(mulberry32). 스폰 위치·AI 판단에 사용해
 * 테스트에서 같은 상황을 재현할 수 있게 한다. 순수 장식(파티클)은 Math.random을 써도 된다.
 */
let state = (Date.now() ^ 0x9e3779b9) >>> 0;

export function setSeed(seed: number): void {
  state = seed >>> 0;
}

export function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(lo: number, hi: number): number {
  return lo + (hi - lo) * random();
}

export function chance(p: number): boolean {
  return random() < p;
}
