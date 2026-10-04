import { describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { EVOLUTION, LOADOUT } from '../src/config';
import { equipWeapon, evolveWeapon, selectWeapon, updateWeapons } from '../src/game/weaponSystem';
import { World } from '../src/game/world';
import { FakeInput } from './helpers';

describe('인벤토리(보유 함수와 핫바 장비)', () => {
  it('기본 함수 5종만 가지고 시작하고, 시작 장비는 설정대로이며 진화 포인트가 있다', () => {
    const w = new World(1);
    expect([...w.owned].sort()).toEqual(['abs', 'circle', 'exp', 'linear', 'tan']);
    expect(w.loadout.map((s) => s.weaponId)).toEqual([...LOADOUT.initial]);
    expect(LOADOUT.initial.every((id) => w.owned.has(id))).toBe(true);
    expect(w.evoPoints).toBe(EVOLUTION.startPoints);
    expect(w.player.cooldowns.length).toBe(LOADOUT.slots);
    expect(w.currentWeapon.id).toBe('linear');
  });

  it('보유하지 않은 함수는 장착할 수 없고, 보유한 함수는 슬롯에 꽂거나 맞바꿀 수 있다', () => {
    const w = new World(1);
    expect(equipWeapon(w, 0, 'sine')).toBe(false); // 아직 만들지 못한 함수
    expect(w.loadout[0].weaponId).toBe('linear');
    expect(equipWeapon(w, 0, 'tan')).toBe(true);
    expect(w.loadout[0].weaponId).toBe('tan');
    expect(w.loadout[3].weaponId).toBe('linear'); // 슬롯 3의 탄젠트와 맞바뀜
    expect(equipWeapon(w, 0, 'tan')).toBe(false);
    const ids = w.loadout.map((s) => s.weaponId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('교체하면 재사용 대기가 새 무기 기준으로 다시 시작해 교체로 대기를 건너뛸 수 없다', () => {
    const w = new World(1);
    expect(w.player.cooldowns[0]).toBe(0);
    equipWeapon(w, 0, 'tan');
    expect(w.player.cooldowns[0]).toBeCloseTo(w.slotWeapon(0).tuning.cooldown, 6);
  });

  it('진화하면 결과 함수를 얻고(원래 함수는 남음) 포인트가 줄며, 얻은 함수는 장착할 수 있다', () => {
    const w = new World(1);
    const ep = w.evoPoints;
    const r = evolveWeapon(w, 'linear', 'int'); // ∫(−x) dx = −x²/2 → 이차함수
    expect(r).toEqual({ ok: true, unlocked: 'quadratic' });
    expect(w.owned.has('quadratic') && w.owned.has('linear')).toBe(true);
    expect(w.evoPoints).toBe(ep - EVOLUTION.cost.int);
    expect(equipWeapon(w, 1, 'quadratic')).toBe(true);
    expect(w.currentWeapon.id).toBe('linear');
    selectWeapon(w, 1);
    expect(w.currentWeapon.id).toBe('quadratic');
  });

  it('진화는 규칙을 지킨다: 미보유·결과 없음·자기 자신·이미 보유·포인트 부족은 실패하고 포인트는 그대로', () => {
    const w = new World(1);
    const ep = w.evoPoints;
    expect(evolveWeapon(w, 'sine', 'd')).toEqual({ ok: false, reason: 'not-owned' });
    expect(evolveWeapon(w, 'linear', 'd')).toEqual({ ok: false, reason: 'no-result' }); // (−x)′ = 상수
    expect(evolveWeapon(w, 'exp', 'd')).toEqual({ ok: false, reason: 'self' }); // (eˣ)′ = eˣ
    expect(evolveWeapon(w, 'exp', 'int')).toEqual({ ok: false, reason: 'self' });
    expect(evolveWeapon(w, 'circle', 'lim')).toEqual({ ok: false, reason: 'no-result' });
    expect(w.evoPoints).toBe(ep);
    expect(evolveWeapon(w, 'linear', 'int').ok).toBe(true);
    w.owned.add('expdecay');
    expect(evolveWeapon(w, 'linear', 'lim')).toEqual({ ok: false, reason: 'already-owned' });
    w.evoPoints = 0;
    expect(evolveWeapon(w, 'abs', 'd')).toEqual({ ok: false, reason: 'no-points' });
    expect(w.owned.has('sgn')).toBe(false);
  });

  it('극한은 미분·적분보다 비싸다', () => {
    const w = new World(1);
    w.evoPoints = EVOLUTION.cost.lim - 1;
    expect(evolveWeapon(w, 'abs', 'lim')).toEqual({ ok: false, reason: 'no-points' });
    w.evoPoints = EVOLUTION.cost.lim;
    expect(evolveWeapon(w, 'abs', 'lim')).toEqual({ ok: true, unlocked: 'well' });
    expect(w.evoPoints).toBe(0);
  });

  it('숫자 키와 휠은 핫바 슬롯 안에서만 돈다', () => {
    const w = new World(1);
    const input = new FakeInput();
    input.press('Digit4');
    updateWeapons(w, input.asInput(), 0.01);
    expect(w.player.weaponIndex).toBe(3);
    selectWeapon(w, 5);
    expect(w.player.weaponIndex).toBe(0);
    selectWeapon(w, -1);
    expect(w.player.weaponIndex).toBe(LOADOUT.slots - 1);
    const before = w.player.weaponIndex;
    input.press('Digit9');
    updateWeapons(w, input.asInput(), 0.01);
    expect(w.player.weaponIndex).toBe(before);
  });
});
