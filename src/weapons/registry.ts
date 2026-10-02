import type { FunctionWeaponDef } from './types';

const weapons: FunctionWeaponDef[] = [];

/** 함수 무기를 등록한다. 등록 순서가 슬롯 순서(숫자 키 1, 2, 3 …)가 된다. */
export function registerWeapon(def: FunctionWeaponDef): void {
  if (weapons.some((w) => w.id === def.id)) throw new Error(`중복된 무기 id: ${def.id}`);
  const [x0, x1] = def.domain;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) {
    throw new Error(`${def.id}: 정의역은 유한한 구간 [x0, x1] (x0 < x1)이어야 합니다.`);
  }
  weapons.push(def);
}

export function getWeapons(): readonly FunctionWeaponDef[] {
  return weapons;
}
