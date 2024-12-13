// circuits/types/index.d.ts

import { SMT } from "@zk-kit/smt";

export interface Circuit {
    calculateWitness(input: any): Promise<bigint[]>;
    checkConstraints(witness: bigint[]): Promise<void>;
}

export interface Node {
    toString(): string;
}

export interface SMTData {
    smt: SMT;
    key: bigint;
    proof: {
        siblings: bigint[];
    };
    root: bigint;
    value: bigint;
}

export interface CircuitInput {
    bitArray: number[];
    bitArray2: number[];
    root: bigint;
    siblings: bigint[];
    key: bigint;
    value: bigint;
    auxKey: number;
    auxValue: number;
    auxIsEmpty: number;
    isExclusion: number;
}

declare global {
    interface BigInt {
        toJSON(): string;
    }
}