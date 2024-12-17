const { expect } = require("chai");
const path = require("path");
const { ethers } = require("ethers");
const { SMT } = require("@zk-kit/smt");
const { wasm } = require("circom_tester");
const { createPoseidonHasher } = require("./utils");

function convertNodeToBigInt(node) {
    if (typeof node === 'bigint') {
        return node;
    }
    if (typeof node === 'string') {
        return BigInt(node);
    }
    return BigInt(node.toString());
}

function convertSiblingsToArray(siblings) {
    const result = [];
    const keys = Object.keys(siblings).sort((a, b) => Number(a) - Number(b));
    
    for (const key of keys) {
        const node = siblings[Number(key)];
        result.push(convertNodeToBigInt(node));
    }
    
    return result;
}

async function setupSMTree(bitArray) {
    const hasher = await createPoseidonHasher();
    const smt = new SMT(hasher, true);
    const key = BigInt(ethers.hexlify(ethers.randomBytes(32)));
    
    // avoid overflow? maybe not needed
    const chunkSize = 50; 
    let value = 0n;
    for (let i = 0; i < bitArray.length; i += chunkSize) {
        const chunk = bitArray.slice(i, i + chunkSize);
        const chunkValue = BigInt(parseInt(chunk.join(''), 2));
        value = (value << BigInt(chunk.length)) | chunkValue;
    }
    
    await smt.add(key, value);
    const rawProof = smt.createProof(key);
    
    const convertedProof = {
        siblings: convertSiblingsToArray(rawProof.siblings)
    };
    
    return {
        smt,
        key,
        proof: convertedProof,
        root: convertNodeToBigInt(smt.root),
        value
    };
}

async function computeBloomIndices(key, filterSize) {
    const hasher = await createPoseidonHasher();
    const hash1 = hasher([key]);
    const hash2 = hasher([hash1]);
    
    const index1 = Number(hash1 % BigInt(filterSize));
    const index2 = Number(hash2 % BigInt(filterSize));
    
    return [index1, index2];
}

function createBitArray(size, indices) {
    const arr = new Array(size).fill(0);
    indices.forEach(idx => arr[idx] = 1);
    return arr;
}

describe("Bloom Filter Circuit Tests", function() {
    this.timeout(10000);
    
    let circuit;
    const FILTER_SIZE = 256;
    
    before(async () => {
        circuit = await wasm(path.join(__dirname, "non_membership.circom"));
    });

    it("should correctly identify membership", async () => {
        const key = BigInt(ethers.hexlify(ethers.randomBytes(32)));
        const indices = await computeBloomIndices(key, FILTER_SIZE);
        
        const chainstateBitArray = createBitArray(FILTER_SIZE, indices);
        const testBitArray = createBitArray(FILTER_SIZE, indices);

        const smtData = await setupSMTree(testBitArray);

        const input = {
            bitArray: chainstateBitArray,
            bitArray2: testBitArray,
            root: smtData.root,
            siblings: smtData.proof.siblings,
            key: smtData.key,
            value: smtData.value,
            auxKey: 0,
            auxValue: 0,
            auxIsEmpty: 0,
            isExclusion: 0
        };

        const witness = await circuit.calculateWitness(input);
        await circuit.checkConstraints(witness);
        
        expect(witness[1]).to.equal(0n);
    });

    it("should correctly identify non-membership", async () => {
        const chainstateKey = BigInt(ethers.hexlify(ethers.randomBytes(32)));
        const chainstateIndices = await computeBloomIndices(chainstateKey, FILTER_SIZE);
        const chainstateBitArray = createBitArray(FILTER_SIZE, chainstateIndices);

        const testKey = BigInt(ethers.hexlify(ethers.randomBytes(32)));
        const testIndices = await computeBloomIndices(testKey, FILTER_SIZE);
        const testBitArray = createBitArray(FILTER_SIZE, testIndices);

        const smtData = await setupSMTree(testBitArray);

        const input = {
            bitArray: chainstateBitArray,
            bitArray2: testBitArray,
            root: smtData.root,
            siblings: smtData.proof.siblings,
            key: smtData.key,
            value: smtData.value,
            auxKey: 0,
            auxValue: 0,
            auxIsEmpty: 0,
            isExclusion: 0
        };

        const witness = await circuit.calculateWitness(input);
        await circuit.checkConstraints(witness);
        
        expect(witness[1]).to.equal(1n);
    });

    it("should detect false positives with high saturation", async () => {
        const numElements = FILTER_SIZE / 4;
        const chainstateBitArray = new Array(FILTER_SIZE).fill(0);
        
        for(let i = 0; i < numElements; i++) {
            const key = BigInt(ethers.hexlify(ethers.randomBytes(32)));
            const indices = await computeBloomIndices(key, FILTER_SIZE);
            indices.forEach(idx => chainstateBitArray[idx] = 1);
        }

        let falsePositives = 0;
        const numTests = 100;

        for(let i = 0; i < numTests; i++) {
            const testKey = BigInt(ethers.hexlify(ethers.randomBytes(32)));
            const testIndices = await computeBloomIndices(testKey, FILTER_SIZE);
            const testBitArray = createBitArray(FILTER_SIZE, testIndices);

            const smtData = await setupSMTree(testBitArray);

            const input = {
                bitArray: chainstateBitArray,
                bitArray2: testBitArray,
                root: smtData.root,
                siblings: smtData.proof.siblings,
                key: smtData.key,
                value: smtData.value,
                auxKey: 0,
                auxValue: 0,
                auxIsEmpty: 0,
                isExclusion: 0
            };

            const witness = await circuit.calculateWitness(input);
            if(witness[1] === 0n) falsePositives++;
        }

        console.log(`False positive rate: ${(falsePositives/numTests)*100}%`);
        expect(falsePositives/numTests).to.be.below(0.3);
    });

    it("should fail when bitArray contains invalid values", async () => {
        const testKey = BigInt(ethers.hexlify(ethers.randomBytes(32)));
        const testIndices = await computeBloomIndices(testKey, FILTER_SIZE);
        const testBitArray = createBitArray(FILTER_SIZE, testIndices);

        const smtData = await setupSMTree(testBitArray);

        const invalidBitArray = new Array(FILTER_SIZE).fill(0);
        invalidBitArray[0] = 2;

        const input = {
            bitArray: invalidBitArray,
            bitArray2: testBitArray,
            root: smtData.root,
            siblings: smtData.proof.siblings,
            key: smtData.key,
            value: smtData.value,
            auxKey: 0,
            auxValue: 0,
            auxIsEmpty: 0,
            isExclusion: 0
        };

        try {
            await circuit.calculateWitness(input);
            expect.fail("Should have thrown an error");
        } catch (err) {
            expect(err.toString()).to.include("Constraint doesn't match");
        }
    });

    it("should fail when using bitArray2 not in SMT", async () => {
        const chainstateKey = BigInt(ethers.hexlify(ethers.randomBytes(32)));
        const chainstateIndices = await computeBloomIndices(chainstateKey, FILTER_SIZE);
        const chainstateBitArray = await createBitArray(FILTER_SIZE, chainstateIndices);

        const testKey = BigInt(ethers.hexlify(ethers.randomBytes(32)));
        const testIndices = await computeBloomIndices(testKey, FILTER_SIZE);
        const testBitArray = createBitArray(FILTER_SIZE, testIndices);

        const differentBitArray = createBitArray(FILTER_SIZE, [0, 1]);
        const smtData = await setupSMTree(differentBitArray);

        const input = {
            bitArray: chainstateBitArray,
            bitArray2: testBitArray,
            root: smtData.root,
            siblings: smtData.proof.siblings,
            key: smtData.key,
            value: smtData.value,
            auxKey: 0,
            auxValue: 0,
            auxIsEmpty: 0,
            isExclusion: 0
        };

        try {
            await circuit.calculateWitness(input);
            expect.fail("Should have thrown an error");
        } catch (err) {
            expect(err.toString()).to.include("Constraint doesn't match");
        }
    });
});