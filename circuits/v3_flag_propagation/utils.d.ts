// utils.d.ts
export function toFixedHex(number: string | number | bigint, length?: number): string;
export function bits2Num(bits: number[]): bigint;
export function poseidonHash(inputs: any[]): bigint;
export function padSiblings(siblings: bigint[], depth: number): bigint[];