const { SMT } = require("@zk-kit/smt");
const { ethers } = require("ethers");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const { createPoseidonHasher, bits2Num, toFixedHex, padSiblings } = require("./utils");

const ARTIFACTS_DIR = "../artifacts/circuits";
const WASM_FILE = path.join(ARTIFACTS_DIR, "non_membership_js/non_membership.wasm");
const WITNESS_FILE = path.join(ARTIFACTS_DIR, "witness.wtns");
const ZKEY_FILE = path.join(ARTIFACTS_DIR, "non_membership.zkey");
const VERIFICATION_KEY_FILE = path.join(ARTIFACTS_DIR, "verification_key.json");
const BLOOM_FILTER_SIZE = 256;
const SMT_DEPTH = 20;


function createTestBitArrays(n) {
    const bitArray1 = new Array(n).fill(0);
    [5, 7, 9, 11].forEach(index => bitArray1[index] = 1); // pretending a chainstate filter with two elements

    const bitArray2 = new Array(n).fill(0);
    [6, 9].forEach(index => bitArray2[index] = 1); // an element (at 6, 9) that is not in the chainstate filter
    return { bitArray1, bitArray2 };
}


async function setupSMTree(bitArray2) {
    
    const hasher = await createPoseidonHasher();
    const smt = new SMT(hasher, true);

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

async function generateProof(input, wasmFile, zkeyFile) {
    try {
        if (!fs.existsSync(wasmFile)) {
            throw new Error(`WASM file not found at path: ${wasmFile}`);
        }

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmFile,
            zkeyFile
        );

        return { proof, publicSignals };
    } catch (error) {
        console.error("Error in generateProof:");
        console.error("Input:", JSON.stringify(input, null, 2));
        console.error("WASM path:", wasmFile);
        console.error("ZKEY path:", zkeyFile);
        throw error;
    }
}


async function main() {
    try {
        console.log("Creating bit arrays...");
        const { bitArray1, bitArray2 } = createTestBitArrays(BLOOM_FILTER_SIZE);
        
        console.log("Setting up SMT...");
        const smtData = await setupSMTree(bitArray2);
        
        console.log("Generating circuit input...");
        const input = await generateCircuitInput(bitArray1, bitArray2, smtData);

        console.log("Circuit input:", JSON.stringify(input, null, 2));
        
        console.log("Generating proof...");
        const { proof, publicSignals } = await generateProof(input, WASM_FILE, ZKEY_FILE);

        console.log("Verifying proof...");
        const vKey = JSON.parse(fs.readFileSync(VERIFICATION_KEY_FILE));
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        console.log("Verification result:", verified);
        console.log("Public signals:", publicSignals);

        const argsSMT = {
            proofs: [proof],
            root: toFixedHex(smtData.root) 
        };

        // Save proof and public signals
        fs.writeFileSync(
            path.join(ARTIFACTS_DIR, "proof.json"),
            JSON.stringify({ proof, publicSignals }, null, 2)
        );

        const solidityCallData = await snarkjs.groth16.exportSolidityCallData(
            proof,
            publicSignals
        );
        fs.writeFileSync(path.join(ARTIFACTS_DIR, "calldata.txt"), solidityCallData);

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