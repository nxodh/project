import { describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { LOADOUT } from '../src/config';
import { equipWeapon, selectWeapon, setSlotOperator, updateWeapons } from '../src/game/weaponSystem';
import { World } from '../src/game/world';
import { FakeInput } from './helpers';

describe('인벤토리(핫바 장비)', () => {
  it('시작 장비는 설정대로이고 슬롯 수만큼 쿨다운이 있다', () => {
    const w = new World(1);
    expect(w.loadout.map((s) => s.weaponId)).toEqual([...LOADOUT.initial]);
    expect(w.loadout.every((s) => s.op === null)).toBe(true);
    expect(w.player.cooldowns.length).toBe(LOADOUT.slots);
    expect(w.currentWeapon.id).toBe('linear');
  });

  it('슬롯에 무기를 꽂으면 바뀌고, 이미 다른 슬롯에 있던 무기면 서로 맞바꾼다', () => {
    const w = new World(1);
    expect(equipWeapon(w, 0, 'tan')).toBe(true);
    expect(w.loadout[0].weaponId).toBe('tan');
    expect(w.currentWeapon.id).toBe('tan');
    // 슬롯 1(이차)에 슬롯 2의 사인을 꽂으면 두 슬롯이 맞바뀐다
    expect(equipWeapon(w, 1, 'sine')).toBe(true);
    expect(w.loadout[1].weaponId).toBe('sine');
    expect(w.loadout[2].weaponId).toBe('quadratic');
    // 같은 무기를 같은 슬롯에 또 꽂으면 아무 일도 없다
    expect(equipWeapon(w, 1, 'sine')).toBe(false);
    // 같은 무기가 두 슬롯에 있는 일은 없다
    const ids = w.loadout.map((s) => s.weaponId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('연산자를 붙이면 그 슬롯의 무기가 바뀌고 떼면 돌아온다', () => {
    const w = new World(1);
    selectWeapon(w, 2); // 사인
    const base = w.currentWeapon;
    expect(setSlotOperator(w, 2, 'd')).toBe(true);
    expect(w.currentWeapon.formula).toBe('y′ = cos x');
    expect(w.currentWeapon.tuning.cooldown).toBeLessThan(base.tuning.cooldown);
    expect(setSlotOperator(w, 2, 'd')).toBe(false); // 같은 연산자
    expect(setSlotOperator(w, 2, null)).toBe(true);
    expect(w.currentWeapon).toBe(base);
  });

  it('원에는 연산자를 붙일 수 없고, 연산자가 붙은 슬롯에 원을 꽂으면 연산자가 떨어진다', () => {
    const w = new World(1);
    equipWeapon(w, 4, 'circle');
    expect(setSlotOperator(w, 4, 'int')).toBe(false);
    setSlotOperator(w, 0, 'lim');
    expect(w.loadout[0].op).toBe('lim');
    equipWeapon(w, 0, 'circle'); // 슬롯 4의 원과 맞바뀐다 → 슬롯 0은 원, 슬롯 4는 선
    expect(w.loadout[0].weaponId).toBe('circle');
    expect(w.loadout[0].op).toBeNull();
    expect(w.loadout[4].weaponId).toBe('linear');
  });

  it('무기를 갈아 끼우면 재사용 대기가 새 무기 기준으로 다시 시작해 교체로 대기를 건너뛸 수 없다', () => {
    const w = new World(1);
    expect(w.player.cooldowns[0]).toBe(0);
    equipWeapon(w, 0, 'tan');
    expect(w.player.cooldowns[0]).toBeCloseTo(w.slotWeapon(0).tuning.cooldown, 6);
    w.player.cooldowns[3] = 0.5;
    setSlotOperator(w, 3, 'd');
    expect(w.player.cooldowns[3]).toBeGreaterThanOrEqual(0.5);
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
    // 슬롯 수를 넘는 숫자 키는 무시된다
    const before = w.player.weaponIndex;
    input.press('Digit9');
    updateWeapons(w, input.asInput(), 0.01);
    expect(w.player.weaponIndex).toBe(before);
  });
});
