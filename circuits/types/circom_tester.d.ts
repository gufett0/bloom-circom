// circuits/types/circom_tester.d.ts

import { Circuit } from './index';

declare module 'circom_tester' {
    export const wasm: {
        (path: string): Promise<Circuit>;
    };
}