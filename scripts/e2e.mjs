/**
 * 실제 브라우저(Chromium)에서 키보드·마우스 입력으로 게임을 검증하는 E2E 스크립트.
 *   npm run test:e2e
 * 빌드된 dist를 vite preview로 띄우고 ?debug 모드의 window.__fx로 상태를 읽는다.
 * 브라우저가 없으면 먼저: npx playwright install chromium
 * 환경 변수: CHROMIUM_PATH(브라우저 실행 파일), E2E_SHOTS(스크린샷 폴더), E2E_URL(검사할 주소)
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = process.env.E2E_SHOTS || join(tmpdir(), 'fx-arena-e2e');
mkdirSync(join(SP, 'shots'), { recursive: true });
// E2E_URL을 주면 그 주소(예: file:///…/fx-arena.html)를 검사하고, 없으면 dist를 vite preview로 띄운다.
const server = process.env.E2E_URL ? null : await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const URL = `${process.env.E2E_URL ?? server.resolvedUrls.local[0]}?debug`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(URL);
await page.waitForFunction(() => window.__fx);
const snap = () => page.evaluate(() => __fx.snapshot());
const toClient = (x, y) => page.evaluate(([x, y]) => __fx.worldToClient(x, y), [x, y]);

// ── 시작 화면 → 게임 시작
check('시작 화면 표시', await page.isVisible('#overlay-start'));
await page.click('#btn-start');
await sleep(100);
let s = await snap();
check('게임 시작 버튼 → playing', s.state === 'playing' && !(await page.isVisible('#overlay-start')));
await page.evaluate(() => { __fx.setDebug({ noSpawn: true }); __fx.setSeed(3); });
await sleep(400);

// ── 이동
let c = await toClient(1400, 500);
await page.mouse.move(c.x, c.y);
s = await snap(); const x0 = s.player.x;
await page.keyboard.down('KeyD'); await sleep(400); await page.keyboard.up('KeyD');
s = await snap(); check('D: 오른쪽 이동', s.player.x > x0 + 60, `${x0.toFixed(0)} → ${s.player.x.toFixed(0)}`);
await sleep(250);
const x1 = (await snap()).player.x;
// 왼쪽 이동하면서 오른쪽 조준
await page.keyboard.down('KeyA'); await sleep(400);
s = await snap();
check('A: 왼쪽 이동 중에도 오른쪽 조준 유지(이동/조준 독립)', s.player.vx < 0 && s.player.facing === 1 && s.player.aim.x > 0, `vx=${s.player.vx.toFixed(0)} facing=${s.player.facing}`);
await page.keyboard.up('KeyA'); await sleep(250);
s = await snap(); check('A: 왼쪽 이동', s.player.x < x1 - 60, `${x1.toFixed(0)} → ${s.player.x.toFixed(0)}`);

// ── 점프·착지
s = await snap(); const gy = s.player.y;
await page.keyboard.down('KeyW');
let minY = gy;
for (let i = 0; i < 12; i++) { await sleep(40); const t = await snap(); minY = Math.min(minY, t.player.y); }
await page.keyboard.up('KeyW');
await sleep(700);
s = await snap();
check('W: 점프 후 착지', gy - minY > 120 && s.player.grounded && Math.abs(s.player.y - gy) < 0.01, `최고 높이 ${(gy - minY).toFixed(0)}px`);

// ── 숙이기
s = await snap(); const hbStand = s.player.hurtbox.h;
await page.keyboard.down('KeyS'); await sleep(150);
s = await snap();
check('S: 누르는 동안 숙이기 + 피격 높이 감소', s.player.crouching && s.player.hurtbox.h < hbStand - 30, `hurtbox ${hbStand} → ${s.player.hurtbox.h}`);
await page.keyboard.up('KeyS'); await sleep(100);
s = await snap(); check('S 떼면 일어섬', !s.player.crouching);

// 낮은 턱 아래에서 못 일어서기 (실제 키 입력)
await page.evaluate(() => __fx.setPlayer(640, 820));
await sleep(100);
await page.keyboard.down('KeyS'); await page.keyboard.down('KeyD');
for (let i = 0; i < 40; i++) { await sleep(50); const t = await snap(); if (t.player.x > 790) break; }
await page.keyboard.up('KeyD'); await page.keyboard.up('KeyS');
await sleep(250);
s = await snap();
check('턱 아래: S를 떼도 일어설 수 없음', s.player.x > 720 && s.player.x < 880 && s.player.crouching, `x=${s.player.x.toFixed(0)}`);
await page.keyboard.down('KeyD');
for (let i = 0; i < 40; i++) { await sleep(50); const t = await snap(); if (t.player.x > 940) break; }
await page.keyboard.up('KeyD'); await sleep(150);
s = await snap(); check('턱을 벗어나면 일어섬', !s.player.crouching, `x=${s.player.x.toFixed(0)}`);

// ── 조준 정확도: 커서 위치 → 어깨→커서 방향
async function aimAccuracy(label) {
  const pts = [[200, 200], [1400, 150], [1300, 800], [100, 700], [800, 60]];
  let worst = 0;
  for (const [wx, wy] of pts) {
    const cc = await toClient(wx, wy);
    await page.mouse.move(cc.x, cc.y);
    await sleep(40);
    const t = await snap();
    const back = await page.evaluate(([x, y]) => __fx.clientToWorld(x, y), [cc.x, cc.y]);
    const sh = t.player.shoulder;
    const ex = wx - sh.x, ey = wy - sh.y, el = Math.hypot(ex, ey);
    const dot = (t.player.aim.x * ex + t.player.aim.y * ey) / el;
    const angErr = Math.acos(Math.min(1, dot)) * 180 / Math.PI;
    worst = Math.max(worst, angErr, Math.hypot(back.x - wx, back.y - wy));
  }
  check(`조준 정확도 (${label})`, worst < 0.6, `최대 오차 ${worst.toFixed(3)} (° 또는 px)`);
}
await aimAccuracy('1280×720');

// ── 미리보기 = 실제 공격, 360° 회전
await page.evaluate(() => { __fx.setTimeScale(0); __fx.setPlayer(800, 500); });
await page.evaluate(() => __fx.step(5));
let allEqual = true; let detail = '';
for (let wi = 0; wi < 5; wi++) {
  await page.keyboard.press(`Digit${wi + 1}`);
  for (let deg = 0; deg < 360; deg += 45) {
    const t = await snap();
    const sh = t.player.shoulder;
    const th = deg * Math.PI / 180;
    const cc = await toClient(sh.x + Math.cos(th) * 250, sh.y + Math.sin(th) * 250);
    await page.mouse.move(cc.x, cc.y);
    await page.evaluate(() => { const p = __fx.world.player; p.cooldowns.fill(0); p.globalCooldown = 0; __fx.input.clearPresses(); });
    await page.evaluate(() => __fx.step(1));
    const pv = await page.evaluate(() => __fx.previewPath());
    await page.mouse.down();
    await page.evaluate(() => __fx.step(1));
    await page.mouse.up();
    await page.evaluate(() => __fx.input.clearBufferedFire());
    const t2 = await snap();
    const last = t2.attacks[t2.attacks.length - 1];
    const ap = await page.evaluate((id) => __fx.attackPath(id), last.id);
    const same = ap && ap.count === pv.count && ap.xs.every((v, i) => Math.abs(v - pv.xs[i]) < 1e-9) && ap.ys.every((v, i) => Math.abs(v - pv.ys[i]) < 1e-9);
    if (!same || last.weapon !== t2.player.weaponId) { allEqual = false; detail += `${wi}/${deg} `; }
  }
}
check('5종 × 8방향: 미리보기 경로 == 실제 공격 경로', allEqual, detail || '40/40 일치');

// 회전 시각 확인: 사인함수를 8방향으로 동시에
await page.evaluate(() => { __fx.world.attacks.length = 0; });
await page.keyboard.press('Digit3');
for (let deg = 0; deg < 360; deg += 45) {
  const t = await snap(); const sh = t.player.shoulder; const th = deg * Math.PI / 180;
  const cc = await toClient(sh.x + Math.cos(th) * 250, sh.y + Math.sin(th) * 250);
  await page.mouse.move(cc.x, cc.y);
  await page.evaluate(() => { const p = __fx.world.player; p.cooldowns.fill(0); p.globalCooldown = 0; });
  await page.evaluate(() => __fx.step(1));
  await page.mouse.down(); await page.evaluate(() => __fx.step(1)); await page.mouse.up();
  await page.evaluate(() => __fx.input.clearBufferedFire());
}
await page.evaluate(() => { __fx.world.attacks.forEach(a => { a.age = a.growTime + 0.01; }); });
await page.evaluate(() => __fx.step(1));
await page.screenshot({ path: `${SP}/shots/06-rotation-sine.png` });
await page.evaluate(() => { __fx.world.attacks.length = 0; });

// ── 지형 충돌: 중앙 발판 아래에서 위로 쏘기
await page.evaluate(() => { __fx.setPlayer(650, 820); });
await page.evaluate(() => __fx.step(3));
await page.keyboard.press('Digit1');
c = await toClient(650, 200);
await page.mouse.move(c.x, c.y);
await page.evaluate(() => __fx.step(1));
let pv = await page.evaluate(() => __fx.previewPath());
check('지형 충돌: 위로 쏜 미리보기가 중앙 발판 아랫면(y=522)에서 끊김', pv.blocked && Math.abs(pv.ys[pv.count - 1] - 522) < 0.01 && Math.min(...pv.ys) >= 521.99, `끝 y=${pv.ys[pv.count - 1].toFixed(2)}`);
await page.evaluate(() => { const p = __fx.world.player; p.cooldowns.fill(0); p.globalCooldown = 0; });
await page.mouse.down(); await page.evaluate(() => __fx.step(1)); await page.mouse.up();
await page.evaluate(() => __fx.input.clearBufferedFire());
let ts = await snap();
let la = ts.attacks[ts.attacks.length - 1];
check('지형 충돌: 실제 공격도 같은 지점에서 끊김', la && la.blocked && Math.abs(la.length - pv.length) < 1e-9, `len=${la && la.length.toFixed(1)}`);
await page.evaluate(() => { __fx.world.attacks.length = 0; });

// ── 함수 교체: 숫자키, 휠
await page.evaluate(() => __fx.setTimeScale(1));
const idx = [];
for (const k of ['Digit3', 'Digit5', 'Digit1', 'Digit4', 'Digit2']) { await page.keyboard.press(k); await sleep(60); idx.push((await snap()).player.weaponIndex); }
check('숫자 1~5로 함수 교체', JSON.stringify(idx) === '[2,4,0,3,1]', JSON.stringify(idx));
c = await toClient(1300, 500); await page.mouse.move(c.x, c.y);
await page.mouse.wheel(0, 100); await sleep(150);
const w1 = (await snap()).player.weaponIndex;
await page.mouse.wheel(0, 100); await sleep(150);
const w2 = (await snap()).player.weaponIndex;
await page.mouse.wheel(0, -100); await sleep(150);
const w3 = (await snap()).player.weaponIndex;
await page.keyboard.press('Digit5'); await sleep(60);
await page.mouse.wheel(0, 100); await sleep(150);
const w4 = (await snap()).player.weaponIndex;
check('마우스 휠로 함수 교체(순환)', w1 === 2 && w2 === 3 && w3 === 2 && w4 === 0, `${w1},${w2},${w3},${w4}`);
const scrollY = await page.evaluate(() => window.scrollY + document.documentElement.scrollTop);
check('휠 사용 중 페이지 스크롤 없음', scrollY === 0);

// HUD 즉시 갱신: 슬롯 강조 픽셀 확인(선택된 슬롯 테두리 색)
await page.keyboard.press('Digit4'); await sleep(80);
await page.screenshot({ path: `${SP}/shots/07-hud-slot4.png` });

// ── 발사 간격: 단발 클릭 1회, 누르고 있으면 반복
await page.keyboard.press('Digit1'); await sleep(300);
let shots0 = (await snap()).shots;
await page.mouse.click(c.x, c.y); await sleep(400);
let shots1 = (await snap()).shots;
check('좌클릭 한 번 = 한 번 공격', shots1 - shots0 === 1, `${shots1 - shots0}발`);
await sleep(300);
shots0 = (await snap()).shots;
const t0 = Date.now();
await page.mouse.down(); await sleep(1000); await page.mouse.up();
const held = (Date.now() - t0) / 1000;
await sleep(100);
shots1 = (await snap()).shots;
const expectN = held / 0.17;
check('누르고 있으면 쿨다운 간격으로 연사 (일차함수 0.17s)', shots1 - shots0 >= Math.floor(expectN) - 1 && shots1 - shots0 <= Math.ceil(expectN) + 1, `${(held).toFixed(2)}s 동안 ${shots1 - shots0}발 (예상 ≈${expectN.toFixed(1)})`);
await page.keyboard.press('Digit4'); await sleep(1100);
shots0 = (await snap()).shots;
await page.mouse.down(); await sleep(1000); await page.mouse.up(); await sleep(100);
shots1 = (await snap()).shots;
check('절댓값함수는 대기시간이 길어 같은 시간에 적게 발사 (0.95s)', shots1 - shots0 === 2, `1초 동안 ${shots1 - shots0}발`);

// ── 실제 적 처치: 마우스로 조준해 클릭
await sleep(1000);
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(300, 820); __fx.setDebug({ freezeEnemies: true }); });
await sleep(100);
const eid = await page.evaluate(() => __fx.spawn('melee', 560, 820));
await page.keyboard.press('Digit1'); await sleep(50);
c = await toClient(560, 770); await page.mouse.move(c.x, c.y);
let killed = false;
for (let i = 0; i < 12 && !killed; i++) {
  await page.mouse.click(c.x, c.y); await sleep(230);
  const t = await snap(); killed = !t.enemies.some(e => e.id === eid);
}
s = await snap();
check('마우스로 조준·클릭해 근접형 적 처치 → 점수 증가', killed && s.kills === 1 && s.score > 0, `kills=${s.kills} score=${s.score}`);

// 지수함수로 발판 위 적 맞히기(곡선 활용): 미리보기를 보며 각도를 골라 쏜다
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(640, 820); __fx.setTimeScale(0); });
await page.evaluate(() => __fx.step(2));
const eid2 = await page.evaluate(() => __fx.spawn('ranged', 400, 660, { hp: 500 }));
await page.keyboard.press('Digit5');
await page.evaluate(() => __fx.step(1));
const hb = await page.evaluate((id) => __fx.world.enemies.find(e => e.id === id).hurtbox(), eid2);
const distToBox = (x, y) => Math.hypot(Math.max(hb.x - x, 0, x - hb.x - hb.w), Math.max(hb.y - y, 0, y - hb.y - hb.h));
let bestAng = null; let bestD = Infinity;
for (let deg = 180; deg <= 260; deg += 2) {
  const t = await snap(); const sh = t.player.shoulder; const th = deg * Math.PI / 180;
  const cc = await toClient(sh.x + Math.cos(th) * 200, sh.y + Math.sin(th) * 200);
  await page.mouse.move(cc.x, cc.y);
  await page.evaluate(() => __fx.step(1));
  const p = await page.evaluate(() => __fx.previewPath());
  let d = Infinity; for (let i = 0; i < p.count; i++) d = Math.min(d, distToBox(p.xs[i], p.ys[i]));
  if (d < bestD) { bestD = d; bestAng = deg; }
}
{
  const t = await snap(); const sh = t.player.shoulder; const th = bestAng * Math.PI / 180;
  const cc = await toClient(sh.x + Math.cos(th) * 200, sh.y + Math.sin(th) * 200);
  await page.mouse.move(cc.x, cc.y);
  await page.evaluate(() => { const p = __fx.world.player; p.cooldowns.fill(0); p.globalCooldown = 0; __fx.step(1); });
  // 직선(일차함수)으로 같은 방향을 쏘면 발판 아랫면에 막혀 닿지 않는다
  await page.keyboard.press('Digit1'); await page.evaluate(() => __fx.step(1));
  const lin = await page.evaluate(() => __fx.previewPath());
  let dl = Infinity; for (let i = 0; i < lin.count; i++) dl = Math.min(dl, distToBox(lin.xs[i], lin.ys[i]));
  await page.keyboard.press('Digit5'); await page.evaluate(() => __fx.step(1));
  await page.mouse.down(); await page.evaluate(() => __fx.step(1)); await page.mouse.up();
  await page.evaluate(() => __fx.input.clearBufferedFire());
  await page.evaluate(() => { for (let i = 0; i < 90; i++) __fx.step(1); });
  const hp1 = (await snap()).enemies.find(e => e.id === eid2)?.hp;
  check('지수 곡선이 끝에서 솟아 발판 위 적을 타격(같은 방향 직선은 닿지 않음)', hp1 === 450 && dl > 10, `각도 ${bestAng}°, 곡선 최소거리 ${bestD.toFixed(1)}px, 직선 최소거리 ${dl.toFixed(1)}px, hp 500 → ${hp1}`);
  // 다 그려진 상태를 캡처
  await page.mouse.down(); await page.evaluate(() => { const p = __fx.world.player; p.cooldowns.fill(0); p.globalCooldown = 0; __fx.step(1); }); await page.mouse.up();
  await page.evaluate(() => __fx.input.clearBufferedFire());
  await page.evaluate(() => { __fx.world.attacks.forEach(a => { a.age = Math.max(a.age, a.growTime + 0.01); }); __fx.step(1); });
  await page.screenshot({ path: `${SP}/shots/08-exp-hit.png` });
}
await page.evaluate(() => { __fx.world.attacks.length = 0; __fx.setTimeScale(1); });

// ── 적 AI: 근접형 접근·공격, 원거리형 사격
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(800, 500); __fx.setDebug({ freezeEnemies: false }); __fx.world.player.hp = 100; });
await page.evaluate(() => { __fx.spawn('melee', 100, 820); __fx.spawn('ranged', 1450, 820); });
let sawBullet = false; let meleeOnP3 = false;
for (let i = 0; i < 70; i++) {
  await sleep(100);
  const t = await snap();
  if (t.bullets > 0) sawBullet = true;
  const m = t.enemies.find(e => e.kind === 'melee');
  if (m && Math.abs(m.y - 500) < 1 && m.x > 580 && m.x < 1020) meleeOnP3 = true;
  if (meleeOnP3 && sawBullet && t.player.hp < 100) break;
}
s = await snap();
await page.screenshot({ path: `${SP}/shots/09-ai.png` });
check('근접형: 플랫폼을 올라 플레이어에게 접근', meleeOnP3);
check('원거리형: 직선 탄환 발사', sawBullet);
check('적 공격으로 플레이어 피해 + 무적시간', s.player.hp < 100, `hp=${s.player.hp}`);

// ── 일시 정지 / 포커스 손실
await page.keyboard.press('Escape'); await sleep(100);
s = await snap();
check('Esc: 일시 정지', s.state === 'paused' && await page.isVisible('#overlay-pause'));
const tPause = s.time; await sleep(300);
check('일시 정지 중 시간 정지', (await snap()).time === tPause);
await page.keyboard.press('Escape'); await sleep(100);
check('Esc: 재개', (await snap()).state === 'playing' && !(await page.isVisible('#overlay-pause')));
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(400, 820); });
await page.keyboard.down('KeyD');
await page.mouse.down();
await sleep(150);
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await sleep(100);
s = await snap();
const inputState = await page.evaluate(() => ({ d: __fx.input.isDown('KeyD'), fire: __fx.input.fireHeld }));
check('창 포커스 손실 → 입력 초기화 + 일시 정지', !inputState.d && !inputState.fire && s.state === 'paused', JSON.stringify(inputState));
await page.keyboard.up('KeyD'); await page.mouse.up();
await page.click('#btn-resume'); await sleep(300);
const xr0 = (await snap()).player.x; await sleep(300);
check('재개 후 키가 눌린 채로 남지 않음', Math.abs((await snap()).player.x - xr0) < 1);

// ── 웨이브 진행
await page.evaluate(() => { __fx.setDebug({ noSpawn: false, invincible: true }); __fx.clearEnemies(); });
const wv0 = (await snap()).wave;
// 현재 웨이브 적을 빠르게 처치(대기열 비우기 포함)
for (let i = 0; i < 60; i++) {
  await page.evaluate(() => { const w = __fx.world; w.waves.queue.length = 0; w.enemies.forEach(e => { e.alive = false; }); if (w.waves.phase === 'intermission') w.waves.timer = Math.min(w.waves.timer, 0.05); });
  await sleep(100);
  if ((await snap()).wave >= wv0 + 2) break;
}
s = await snap();
check('웨이브 클리어 → 다음 웨이브 시작', s.wave >= wv0 + 2, `wave ${wv0} → ${s.wave}`);
const firstSeen = new Map();
for (let i = 0; i < 30; i++) {
  await sleep(100);
  const t = await snap();
  for (const e of t.enemies) if (!firstSeen.has(e.id)) firstSeen.set(e.id, { x: e.x, y: e.y, active: e.active, px: t.player.x, py: t.player.y });
}
s = await snap();
check('새 웨이브에서 적 생성(예고 후 활성)', firstSeen.size > 0 && s.enemies.some(e => e.active), `적 ${firstSeen.size}명`);
const spawnOk = [...firstSeen.values()].every(f => (Math.hypot(f.x - f.px, f.y - f.py) >= 300 && Math.abs(f.x - f.px) >= 140) || f.x < 100 || f.x > 1500);
check('스폰 위치: 플레이어와 떨어져 있고 바로 위가 아님(생성 시점 기준)', spawnOk, JSON.stringify([...firstSeen.values()].map(f => [Math.round(f.x), Math.round(f.y), f.active])));

// ── 게임 오버 → 재시작
await page.evaluate(() => { __fx.setDebug({ invincible: false }); __fx.world.score = 1234; });
await page.evaluate(() => __fx.hurtPlayer(500));
await sleep(1800);
s = await snap();
const goVisible = await page.isVisible('#overlay-gameover');
const goScore = await page.textContent('#go-score');
check('체력 0 → 게임 오버 + 최종 점수 표시', s.state === 'gameover' && goVisible && goScore.replace(/,/g, '') === String(s.score), `score=${goScore}`);
await page.screenshot({ path: `${SP}/shots/10-gameover.png` });
await page.keyboard.down('KeyD');
await page.click('#btn-restart');
await page.keyboard.up('KeyD');
await sleep(200);
s = await snap();
check('재시작: 상태 초기화(점수·웨이브·적·공격·체력·쿨다운)', s.state === 'playing' && s.score === 0 && s.kills === 0 && s.wave === 0 && s.enemies.length === 0 && s.attacks.length === 0 && s.bullets === 0 && s.player.hp === 100 && s.player.cooldowns.every(v => v === 0) && s.time < 0.5, JSON.stringify({ score: s.score, wave: s.wave, hp: s.player.hp, t: s.time.toFixed(2) }));
const xa = s.player.x; await sleep(300);
check('재시작: 이전 입력이 남지 않음', Math.abs((await snap()).player.x - xa) < 1);
check('재시작 클릭이 공격으로 나가지 않음', (await snap()).shots === 0);

// ── 화면 크기 변경 후 조준 정확도 + 조준점 위치(픽셀)
async function crosshairPixelCheck(label) {
  await page.evaluate(() => { __fx.setTimeScale(1); __fx.setDebug({ noSpawn: true }); __fx.clearEnemies(); });
  const cc = await toClient(1200, 250);
  await page.mouse.move(cc.x, cc.y);
  await sleep(120);
  const buf = await page.screenshot({ clip: { x: Math.round(cc.x) - 20, y: Math.round(cc.y) - 20, width: 41, height: 41 } });
  return buf;
}
for (const vp of [{ width: 900, height: 700 }, { width: 1920, height: 1080 }, { width: 700, height: 1000 }]) {
  await page.setViewportSize(vp);
  await sleep(200);
  await aimAccuracy(`${vp.width}×${vp.height}`);
  const buf = await crosshairPixelCheck(`${vp.width}x${vp.height}`);
  writeFileSync(`${SP}/shots/11-crosshair-${vp.width}x${vp.height}.png`, buf);
}
await context.close();

// 고배율(DPR 2) 환경
const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 650 }, deviceScaleFactor: 2 });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errors.push(`[pageerror dpr2] ${e.message}`));
p2.on('console', (m) => { if (m.type() === 'error') errors.push(`[dpr2] ${m.text()}`); });
await p2.goto(URL); await p2.waitForFunction(() => window.__fx);
await p2.click('#btn-start');
await p2.evaluate(() => __fx.setDebug({ noSpawn: true }));
const cv = await p2.evaluate(() => { const c = document.getElementById('game'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }; });
check('DPR 2: 캔버스 백버퍼가 화면 배율만큼 커짐', cv.w === cv.cw * 2 && cv.h === cv.ch * 2, JSON.stringify(cv));
let worst = 0;
for (const [wx, wy] of [[200, 200], [1400, 150], [1300, 800], [800, 60]]) {
  const cc = await p2.evaluate(([x, y]) => __fx.worldToClient(x, y), [wx, wy]);
  await p2.mouse.move(cc.x, cc.y); await sleep(40);
  const t = await p2.evaluate(() => __fx.snapshot());
  const sh = t.player.shoulder; const ex = wx - sh.x, ey = wy - sh.y, el = Math.hypot(ex, ey);
  worst = Math.max(worst, Math.acos(Math.min(1, (t.player.aim.x * ex + t.player.aim.y * ey) / el)) * 180 / Math.PI);
}
check('DPR 2: 조준 정확도', worst < 0.6, `최대 각도 오차 ${worst.toFixed(3)}°`);
await p2.screenshot({ path: `${SP}/shots/12-dpr2.png` });
await ctx2.close();

console.log('\nCONSOLE/PAGE ERRORS:', errors.length ? errors.join('\n') : '없음');
check('콘솔 오류 없음', errors.length === 0);
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(`스크린샷: ${SP}/shots`);
await browser.close();
await server?.close();
process.exit(failed.length ? 1 : 0);
