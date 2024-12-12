const { SMT } = require("@zk-kit/smt");
const { ethers } = require("ethers");
const snarkjs = require("snarkjs");
const fs = require("fs");
const {toFixedHex, bits2Num, poseidonHash, padSiblings} = require("./utils")

const WASM_FILE = "../artifacts/circuits/non_membership.wasm";
const ZKEY_FILE = "../artifacts/circuits/non_membership.zkey";
const VERIFICATION_KEY_FILE = "../artifacts/circuits/verification_key.json";
const BLOOM_FILTER_SIZE = 16384;
const SMT_DEPTH = 20;


function createTestBitArrays(n) {
    const bitArray1 = new Array(n).fill(0);
    [5, 7, 9, 11].forEach(index => bitArray1[index] = 1); // pretending a chainstate filter with two elements

    const bitArray2 = new Array(n).fill(0);
    [6, 9].forEach(index => bitArray2[index] = 1); // an element (at 6, 9) that is not in the chainstate filter
    return { bitArray1, bitArray2 };
}


async function setupSMTree(bitArray2) {
    
    const smt = new SMT(poseidonHash, true);

    // this random key for testing would be the masked commitment
    const testKey = ethers.hexlify(ethers.randomBytes(32));
    const keyBigInt = BigInt(testKey);
    
    // bits2Num expects an array of bits in reverse order (lsb first)
    const value = bits2Num(bitArray2);
    console.log("bitarray2: ", bitArray2);
    console.log("turned to value: ", value);
    
    smt.add(keyBigInt, value);
    
    // generate inclusion proof
    const proof = smt.createProof(keyBigInt);
    const paddedSiblings = padSiblings(proof.siblings, SMT_DEPTH);
    
    return {
        smt,
        testKey: keyBigInt,
        proof: { ...proof, siblings: paddedSiblings },
        root: smt.root,
        value
    };
}

async function generateCircuitInput(bitArray1, bitArray2, smtData) {
    return {
        bitArray: bitArray1,
        bitArray2: bitArray2,
        root: smtData.root.toString(),
        siblings: smtData.proof.siblings.map(s => s.toString()),
        key: smtData.testKey.toString(),
        value: smtData.value.toString(),
        auxKey: "0",
        auxValue: "0",
        auxIsEmpty: "0", 
        isExclusion: "0" // changed to 0 for inclusion proof
    };
}

async function main() {
    try {
        console.log("Creating bit arrays...");
        const { bitArray1, bitArray2 } = createTestBitArrays(BLOOM_FILTER_SIZE);
        
        console.log("Setting up SMT...");
        const smtData = await setupSMTree(bitArray2);
        
        console.log("Generating circuit input...");
        const input = await generateCircuitInput(bitArray1, bitArray2, smtData);

        console.log("Generating proof...");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            WASM_FILE,
            ZKEY_FILE
        );

        console.log("Verifying proof...");
        const vKey = JSON.parse(fs.readFileSync(VERIFICATION_KEY_FILE));
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        console.log("Verification result:", verified);
        console.log("Public signals:", publicSignals);

        const argsSMT = {
            proofs: [proof],
            root: toFixedHex(smtData.root) 
        };

        console.log("SMT Arguments:", argsSMT);

        fs.writeFileSync(
            "../artifacts/circuits/proof.json",
            JSON.stringify({ proof, publicSignals }, null, 2)
        );

        const solidityCallData = await snarkjs.groth16.exportSolidityCallData(
            proof,
            publicSignals
        );
        fs.writeFileSync("../artifacts/circuits/calldata.txt", solidityCallData);

        return verified;
    } catch (error) {
        console.error("Error:", error);
        console.error("Stack:", error.stack);
        return false;
    }
}

main()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });