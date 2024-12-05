/*const { wasm: wasm_tester } = require("circom_tester");
const { ethers } = require("ethers");
const { expect } = require('chai');
require('mocha');
const path = require("path");


interface Circuit {
    calculateWitness: (input: {
        indices: string[],
        bitArray: number[]
    }) => Promise<bigint[]>;
    checkConstraints: (witness: bigint[]) => Promise<void>;
}

function calculateIndices(
    bytes32Element: string, 
    filterSize: bigint, 
    numHashFunctions: number
): bigint[] {
    const indices: bigint[] = [];
    
    const elementBuffer = Buffer.from(bytes32Element.slice(2), 'hex');
    
    for (let i = 0; i < numHashFunctions; i++) {
        const counterBuffer = Buffer.from(i.toString(16).padStart(2, '0'), 'hex');
        const combinedBuffer = Buffer.concat([elementBuffer, counterBuffer]);
        const hash = ethers.keccak256(combinedBuffer);
        const index = BigInt('0x' + hash.slice(-4)) % filterSize;
        indices.push(index);
    }
    
    return indices;
}

function createBloomFilter(
    elements: string[], 
    filterSize: bigint, 
    numHashFunctions: number
): number[] {
    const bitArray = new Array(Number(filterSize)).fill(0);
    
    for (const element of elements) {
        const indices = calculateIndices(element, filterSize, numHashFunctions);
        for (const index of indices) {
            bitArray[Number(index)] = 1;
        }
    }
    return bitArray;
}

describe("BloomFilter Circuit Tests", () => {
    let circuit: Circuit;
    const filterSize = 16385n; 
    const numHashFunctions = 2;

    before(async () => {
        circuit = await wasm_tester(path.join(__dirname, "non_membership.circom")) as Circuit;
    });

    it("should reject element when no bits are set", async () => {
        const emptyFilter = new Array(Number(filterSize)).fill(0);
        const testElement = ethers.hexlify(ethers.randomBytes(32));
        const indices = calculateIndices(testElement, filterSize, numHashFunctions);
        
        const witness = await circuit.calculateWitness({
            indices: indices.map(i => i.toString()),
            bitArray: emptyFilter
        });
        
        expect(witness[1]).to.equal(1n, "Empty filter should indicate non-membership");
    });

    it("should indicate possible membership when all required bits are set", async () => {
        const elements = [
            ethers.hexlify(ethers.randomBytes(32)),
            ethers.hexlify(ethers.randomBytes(32))
        ];
        const testElement = elements[0]; // pick the first element for testing
        
        const bitArray = createBloomFilter(elements, filterSize, numHashFunctions);
        const indices = calculateIndices(testElement, filterSize, numHashFunctions);
        
        const witness = await circuit.calculateWitness({
            indices: indices.map(i => i.toString()),
            bitArray: bitArray
        });
        
        expect(witness[1]).to.equal(0n, "Should indicate possible membership");
    });

    it("should handle edge cases with index at filter boundaries", async () => {
        const bitArray = new Array(Number(filterSize)).fill(0);
        // this is a element that generates index near filterSize
        const testElement = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const indices = calculateIndices(testElement, filterSize, numHashFunctions);
        
        // set the bits at calculated indices
        for (const index of indices) {
            bitArray[Number(index)] = 1;
        }
        
        const witness = await circuit.calculateWitness({
            indices: indices.map(i => i.toString()),
            bitArray: bitArray
        });
        
        expect(witness[1]).to.equal(0n, "Should handle boundary indices correctly");
    });

    it("should reject invalid indices that exceed filter size", async () => {
        const bitArray = new Array(Number(filterSize)).fill(0);
        const invalidIndices = [filterSize, filterSize + 1n];
        
        try {
            await circuit.calculateWitness({
                indices: invalidIndices.map(i => i.toString()),
                bitArray: bitArray
            });
            expect.fail("Should have rejected invalid indices");
        } catch (error) {
            expect(error).to.exist;
        }
    });

    it("should maintain consistency with multiple elements", async () => {
        // populate the filter with rnd elemtns
        const elements = Array(50).fill(0).map(() => ethers.hexlify(ethers.randomBytes(32)));
        const bitArray = createBloomFilter(elements, filterSize, numHashFunctions);
        
        // test each added element
        for (const element of elements) {
            const indices = calculateIndices(element, filterSize, numHashFunctions);
            const witness = await circuit.calculateWitness({
                indices: indices.map(i => i.toString()),
                bitArray: bitArray
            });
            expect(witness[1]).to.equal(0n, `Should find element ${element}`);
        }
        
        // test a non-added element
        const nonMember = ethers.hexlify(ethers.randomBytes(32));
        const indices = calculateIndices(nonMember, filterSize, numHashFunctions);
        const witness = await circuit.calculateWitness({
            indices: indices.map(i => i.toString()),
            bitArray: bitArray
        });
        
        console.log("Non-member test result:", witness[1].toString());
    });
}); */