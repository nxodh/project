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
// 화면 오른쪽 위(논리 화면 좌표)를 조준해 둔다(카메라가 움직여도 커서는 화면에 고정).
let c = await page.evaluate(() => __fx.viewToClient(1450, 300));
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
await page.keyboard.down('Space');
let minY = gy;
for (let i = 0; i < 12; i++) { await sleep(40); const t = await snap(); minY = Math.min(minY, t.player.y); }
await page.keyboard.up('Space');
await sleep(700);
s = await snap();
check('Space: 점프 후 착지', gy - minY > 120 && s.player.grounded && Math.abs(s.player.y - gy) < 0.01, `최고 높이 ${(gy - minY).toFixed(0)}px`);

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
  // 화면 안 여러 지점(논리 화면 좌표)을 조준하고, 측정 시점의 카메라로 기대 월드 좌표를 계산한다.
  const viewPts = [[200, 200], [1400, 150], [1300, 780], [100, 700], [800, 60]];
  let worst = 0;
  for (const [vx, vy] of viewPts) {
    const cc = await page.evaluate(([x, y]) => __fx.viewToClient(x, y), [vx, vy]);
    await page.mouse.move(cc.x, cc.y);
    await sleep(40);
    const t = await snap();
    const wx = vx + t.camera.x;
    const wy = vy + t.camera.y;
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
// 카탈로그의 모든 무기를 1번 슬롯에 꽂아 가며(연산자 없음) 시험한다
const catalog = await page.evaluate(() => __fx.world.weapons.map(w => w.id));
const NW = catalog.length;
await page.keyboard.press('Digit1');
for (let wi = 0; wi < NW; wi++) {
  await page.evaluate((id) => { __fx.equip(0, id); }, catalog[wi]);
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
check(`${NW}종(1번 슬롯에 차례로 장착) × 8방향: 미리보기 경로 == 실제 공격 경로`, allEqual, detail || `${NW * 8}/${NW * 8} 일치`);
await page.evaluate(() => { ['linear', 'quadratic', 'sine', 'abs', 'exp'].forEach((id, i) => __fx.equip(i, id)); });

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
check('숫자 1~5로 슬롯 교체', JSON.stringify(idx) === '[2,4,0,3,1]', JSON.stringify(idx));
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

// ── 인벤토리(E): 열면 게임이 멈추고, 카드 선택·클릭/드래그로 무기와 연산자를 갈아 끼운다
await page.evaluate(() => { __fx.clearEnemies(); __fx.setDebug({ noSpawn: true }); __fx.setTimeScale(1); });
await page.keyboard.press('KeyE'); await sleep(250);
let st0 = await snap();
check('E: 인벤토리 열림 + 게임 정지', st0.state === 'inventory' && await page.isVisible('#overlay-inventory'));
const tInv = st0.time; await sleep(400);
check('인벤토리 열려 있는 동안 시간 정지', Math.abs((await snap()).time - tInv) < 0.001);
await page.screenshot({ path: `${SP}/shots/13-inventory.png` });
await page.click('[data-card="weapon:tan"]'); await page.click('[data-slot="0"]');
let lo = await page.evaluate(() => __fx.loadout());
check('인벤토리: 카드를 고르고 슬롯을 눌러 무기 교체', lo[0].weaponId === 'tan', JSON.stringify(lo.map(l => l.weaponId)));
await page.click('[data-card="op:d"]'); await page.click('[data-socket="0"]');
lo = await page.evaluate(() => __fx.loadout());
check('인벤토리: 연산자 카드(미분)를 슬롯에 장착 → 수식이 도함수로', lo[0].op === 'd' && lo[0].formula === 'y′ = sec²x', JSON.stringify(lo[0]));
// 드롭 처리: 합성 DragEvent로 시험한다(헤드리스에서는 실제 마우스 드래그의 dragenter/dragover가 오지 않아 검증하지 못함)
await page.evaluate(() => {
  const dt = new DataTransfer(); dt.setData('text/plain', 'weapon:log');
  const slot = document.querySelector('[data-slot="1"]');
  slot.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  slot.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
});
lo = await page.evaluate(() => __fx.loadout());
check('인벤토리: 슬롯에 카드 드롭(drop 이벤트 처리)', lo[1].weaponId === 'log', JSON.stringify(lo.map(l => l.weaponId)));
await page.click('[data-card="weapon:circle"]'); await page.click('[data-slot="2"]');
await page.click('[data-card="op:int"]'); await page.click('[data-socket="2"]');
lo = await page.evaluate(() => __fx.loadout());
check('인벤토리: 원에는 연산자를 붙일 수 없다', lo[2].weaponId === 'circle' && lo[2].op === null, JSON.stringify(lo[2]));
await page.click('[data-socket="0"]');
lo = await page.evaluate(() => __fx.loadout());
check('인벤토리: 연산자 칸을 다시 누르면 떼어진다', lo[0].op === null);
await page.screenshot({ path: `${SP}/shots/13b-inventory-equipped.png` });
await page.keyboard.press('KeyE'); await sleep(250);
check('E: 인벤토리 닫힘 → 게임 재개', (await snap()).state === 'playing' && !(await page.isVisible('#overlay-inventory')));
await page.keyboard.press('KeyE'); await sleep(150); await page.keyboard.press('Escape'); await sleep(150);
check('인벤토리에서 Esc: 닫고 재개', (await snap()).state === 'playing');
// 이후 시험이 기본 장비를 기대하므로 되돌린다
await page.evaluate(() => { ['linear', 'quadratic', 'sine', 'abs', 'exp'].forEach((id, i) => __fx.equip(i, id)); [0, 1, 2, 3, 4].forEach(i => __fx.setOperator(i, null)); });

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
const linCd = await page.evaluate(() => __fx.world.weapons[0].tuning.cooldown);
const expectN = held / linCd;
check(`누르고 있으면 쿨다운 간격으로 연사 (일차함수 ${linCd}s)`, shots1 - shots0 >= Math.floor(expectN) - 1 && shots1 - shots0 <= Math.ceil(expectN) + 1, `${(held).toFixed(2)}s 동안 ${shots1 - shots0}발 (예상 ≈${expectN.toFixed(1)})`);
await page.keyboard.press('Digit4'); await sleep(1100);
shots0 = (await snap()).shots;
await page.mouse.down(); await sleep(1000); await page.mouse.up(); await sleep(100);
shots1 = (await snap()).shots;
check('절댓값함수는 대기시간이 길어 같은 시간에 적게 발사 (0.8s)', shots1 - shots0 === 2, `1초 동안 ${shots1 - shots0}발`);

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

// ── 적의 함수 곡선: 사인 술사가 예고선을 보인 뒤 사인파를 쏜다
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(1000, 820); __fx.setDebug({ invincible: true }); });
await page.evaluate(() => __fx.spawn('sine', 1450, 820));
let sawPreview = false; let sawEnemyCurve = false;
for (let i = 0; i < 60 && !sawEnemyCurve; i++) {
  await sleep(100);
  const t = await snap();
  if (t.enemies.some(e => e.kind === 'sine' && e.pending > 0)) {
    sawPreview = true;
    if (!sawEnemyCurve) await page.screenshot({ path: `${SP}/shots/09b-enemy-preview.png` });
  }
  if (t.enemyAttacks.some(a => a.pattern === 'e-sine')) sawEnemyCurve = true;
}
check('사인 술사: 예고선(점선) 표시 후 사인파 곡선 발사', sawPreview && sawEnemyCurve);

// ── 무한 지형: 오른쪽으로 계속 달리면 카메라가 따라가고 새 지형이 나온다
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(1000, 820); __fx.setDebug({ noSpawn: true }); });
const xStart = (await snap()).player.x;
const camStart = (await snap()).camera.x;
await page.keyboard.down('KeyD');
for (let i = 0; i < 16; i++) { await page.keyboard.down('Space'); await sleep(140); await page.keyboard.up('Space'); await sleep(260); }
await page.keyboard.up('KeyD');
await sleep(500);
s = await snap();
check('무한 지형: 계속 달리면 카메라가 따라오고 다음 청크로 넘어감', s.player.x > xStart + 1200 && s.camera.x > camStart + 1000 && s.player.alive, `x ${xStart.toFixed(0)} → ${s.player.x.toFixed(0)}, 카메라 ${camStart.toFixed(0)} → ${s.camera.x.toFixed(0)}`);
await aimAccuracy(`카메라 이동 후 x=${s.player.x.toFixed(0)}`);
await page.evaluate(() => __fx.setPlayer(-6400, 820));
await sleep(300);
s = await snap();
check('왼쪽(음수 좌표)으로도 지형이 이어진다', s.player.grounded && Math.abs(s.player.y - 820) < 0.01, `x=${s.player.x.toFixed(0)}`);
await page.screenshot({ path: `${SP}/shots/09c-far-left.png` });

// ── 보스 웨이브
await page.evaluate(() => { __fx.clearEnemies(); __fx.setPlayer(520, 820); __fx.setDebug({ noSpawn: false, invincible: true }); __fx.startWave(5); });
let bossSeen = null; let bossCast = new Set(); let bossCurves = 0;
for (let i = 0; i < 90; i++) {
  await sleep(100);
  const t = await snap();
  if (t.boss) { bossSeen = t.boss; if (t.boss.cast) bossCast.add(t.boss.cast); }
  bossCurves = Math.max(bossCurves, t.enemyAttacks.filter(a => a.pattern.startsWith('b-')).length);
  if (i === 45) await page.screenshot({ path: `${SP}/shots/09d-boss.png` });
}
check('웨이브 시작: 보스 등장 + HUD 보스 체력바', bossSeen !== null && bossSeen.maxHp > 0);
check('보스가 여러 함수 패턴을 예고 후 시전', bossCast.size >= 2 && bossCurves >= 1, `패턴 ${[...bossCast].join(', ')} · 동시 곡선 최대 ${bossCurves}`);
// 보스 처치: 탁 트인 바닥에서 보스를 조준해 마무리한다(체력 1로 낮춰 둠)
await page.evaluate(() => {
  __fx.world.enemyAttacks.length = 0;
  __fx.setPlayer(1050, 820);
  const b = __fx.world.boss;
  if (b) { b.hp = 1; b.body.x = 1500; b.body.y = 820; b.pending = []; }
  __fx.setDebug({ freezeEnemies: true });
});
c = await toClient((await snap()).enemies.find(e => e.kind === 'boss').x, 700);
await page.keyboard.press('Digit1');
for (let i = 0; i < 20 && (await snap()).bossesDefeated < 1; i++) {
  const bx = (await snap()).enemies.find(e => e.kind === 'boss');
  if (!bx) { await sleep(200); continue; }
  const cc = await toClient(bx.x, 820 - bx.h * 0.6);
  await page.mouse.move(cc.x, cc.y);
  await page.mouse.click(cc.x, cc.y); await sleep(260);
}
s = await snap();
check('보스 처치 → 보스 처치 수 증가', s.bossesDefeated >= 1, `bossesDefeated=${s.bossesDefeated} boss=${JSON.stringify(s.boss)} wave=${s.wave}`);
await page.evaluate(() => { __fx.clearEnemies(); __fx.setDebug({ invincible: false, noSpawn: true, freezeEnemies: false }); __fx.world.waves.queue.length = 0; });

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
check('보스 처치 → 다음 웨이브(다음 보스) 시작', s.wave >= wv0 + 2, `wave ${wv0} → ${s.wave}`);
const firstSeen = new Map();
for (let i = 0; i < 30; i++) {
  await sleep(100);
  const t = await snap();
  for (const e of t.enemies) if (!firstSeen.has(e.id)) firstSeen.set(e.id, { x: e.x, y: e.y, active: e.active, px: t.player.x, py: t.player.y });
}
s = await snap();
check('새 웨이브에서 보스 생성(예고 후 활성)', firstSeen.size > 0 && s.enemies.some(e => e.active && e.kind === 'boss') && s.enemies.every(e => e.kind === 'boss'), `적 ${firstSeen.size}명`);
const spawnOk = [...firstSeen.values()].every(f => Math.abs(f.x - f.px) >= 560 && Math.abs(f.y - 820) < 1);
check('스폰 위치: 보스는 플레이어에게서 떨어진 바닥 위에서 나온다(생성 시점 기준)', spawnOk, JSON.stringify([...firstSeen.values()].map(f => [Math.round(f.x), Math.round(f.y), f.active])));

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

// ── 커서를 적 위에 올리고 클릭하면 맞는다: 8종 × 연산자(없음·미분·적분·극한) × 거리 (곡선의 끝점이 커서에 닿는다)
await page.evaluate(() => { __fx.setTimeScale(0); __fx.setDebug({ noSpawn: true, freezeEnemies: true, invincible: true }); __fx.clearEnemies(); __fx.useFlatArena(); __fx.setPlayer(400, 600); });
{
  const ids = await page.evaluate(() => __fx.world.weapons.map(w => w.id));
  const misses = []; let combos = 0;
  for (const id of ids) {
    for (const op of [null, 'd', 'int', 'lim']) {
      const ok = await page.evaluate(([id, op]) => { __fx.equip(0, id); __fx.setOperator(0, null); return op ? __fx.setOperator(0, op) : true; }, [id, op]);
      if (!ok) continue; // 원은 연산자를 붙일 수 없다
      for (const dist of [260, 340]) {
        const eid = await page.evaluate((d) => {
          const w = __fx.world; w.enemies.length = 0; w.attacks.length = 0;
          const p = w.player; p.body.x = 400; p.body.y = 600; p.body.vx = 0; p.body.vy = 0;
          p.cooldowns.fill(0); p.globalCooldown = 0; p.weaponIndex = 0;
          return __fx.spawn('melee', 400 + d, 600, { hp: 100000 });
        }, dist);
        const cc = await toClient(400 + dist, 600 - 46);
        await page.mouse.move(cc.x, cc.y);
        await page.evaluate(() => __fx.step(1));
        await page.mouse.down(); await page.evaluate(() => __fx.step(1)); await page.mouse.up();
        await page.evaluate(() => __fx.input.clearBufferedFire());
        const hp = await page.evaluate(([eid, d]) => {
          const e = __fx.world.enemies.find(x => x.id === eid);
          for (let i = 0; i < 240; i++) { e.body.x = 400 + d; e.body.y = 600; e.body.vx = 0; e.body.vy = 0; __fx.world.player.body.y = 600; __fx.world.player.body.vy = 0; __fx.step(1); }
          return e.hp;
        }, [eid, dist]);
        combos++;
        if (hp >= 100000) misses.push(`${id}/${op ?? '-'}@${dist}`);
        if (id === 'circle' && dist === 260) { /* 아래에서 캡처 */ }
      }
    }
  }
  check('커서를 적 위에 올리고 클릭하면 맞는다(전 무기·연산자·거리)', misses.length === 0 && combos >= 50, `${combos}조합 · 실패 [${misses.join(', ')}]`);
  // 원 공격 장면 캡처
  await page.evaluate(() => {
    __fx.equip(0, 'circle'); __fx.setOperator(0, null);
    const w = __fx.world; w.enemies.length = 0; w.attacks.length = 0;
    const p = w.player; p.body.x = 400; p.body.y = 600; p.cooldowns.fill(0); p.globalCooldown = 0; p.weaponIndex = 0;
    __fx.spawn('melee', 700, 600, { hp: 100000 });
  });
  const cc = await toClient(700, 600 - 46);
  await page.mouse.move(cc.x, cc.y); await page.evaluate(() => __fx.step(1));
  await page.mouse.down(); await page.evaluate(() => __fx.step(1)); await page.mouse.up();
  await page.evaluate(() => { __fx.input.clearBufferedFire(); __fx.world.attacks.forEach(a => { a.age = a.growTime + 0.01; }); __fx.step(1); });
  await page.screenshot({ path: `${SP}/shots/14-circle.png` });
  await page.evaluate(() => { ['linear', 'quadratic', 'sine', 'abs', 'exp'].forEach((id, i) => __fx.equip(i, id)); __fx.world.enemies.length = 0; __fx.world.attacks.length = 0; __fx.setTimeScale(1); __fx.newRun(); });
}

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
for (const [vx, vy] of [[200, 200], [1400, 150], [1300, 780], [800, 60]]) {
  const cc = await p2.evaluate(([x, y]) => __fx.viewToClient(x, y), [vx, vy]);
  await p2.mouse.move(cc.x, cc.y); await sleep(40);
  const t = await p2.evaluate(() => __fx.snapshot());
  const wx = vx + t.camera.x, wy = vy + t.camera.y;
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
