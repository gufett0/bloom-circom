const snarkjs = require("snarkjs");
const { ethers } = require("ethers");
const fs = require("fs");

const WASM_FILE = "../artifacts/circuits/non_membership.wasm";
const ZKEY_FILE = "../artifacts/circuits/non_membership.zkey";
const VERIFICATION_KEY_FILE = "../artifacts/circuits/verification_key.json";

function calculateIndices(bytes32Element, filterSize, numHashFunctions) {
    const indices = [];
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

function createBloomFilter(elements, filterSize, numHashFunctions) {
    const bitArray = new Array(Number(filterSize)).fill(0);
    
    for (const element of elements) {
        const indices = calculateIndices(element, filterSize, numHashFunctions);
        for (const index of indices) {
            bitArray[Number(index)] = 1;
        }
    }
    return bitArray;  
}

async function verifyFilesExist() {
    const files = [WASM_FILE, ZKEY_FILE, VERIFICATION_KEY_FILE];
    for (const file of files) {
        if (!fs.existsSync(file)) {
            throw new Error(`Required file not found: ${file}`);
        }
    }
}

async function generateAndVerifyProof() {
    await verifyFilesExist();

    const filterSize = 16385n;
    const numHashFunctions = 2;

    // some test data with a known non-member element
    const elements = Array(5).fill(0).map(() => ethers.hexlify(ethers.randomBytes(32)));
    const bitArray = createBloomFilter(elements, filterSize, numHashFunctions);
    
    // make element that's not in the set
    const nonMemberElement = ethers.hexlify(ethers.randomBytes(32));
    const indices = calculateIndices(nonMemberElement, filterSize, numHashFunctions);

    const input = {
        indices: indices.map(i => i.toString()),  
        bitArray: bitArray                        
    };

    try {
        console.log("Input being provided to circuit:", {
            indices: input.indices,
            bitArray: `[${input.bitArray.slice(0, 20).join(", ")}...]`
        });
        console.log("\nDetails:");
        console.log("- Generated indices:", input.indices);
        console.log("- Bit array length:", input.bitArray.length);
        console.log("- All indices < filterSize:", indices.every(i => i < filterSize));
        
        console.log("\nGenerating witness...");
        console.log("Using WASM file:", WASM_FILE);
        console.log("Using zKey file:", ZKEY_FILE);
        
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
        
        fs.writeFileSync(
            "proof.json",
            JSON.stringify({ proof, publicSignals }, null, 2)
        );

        const solidityCallData = await snarkjs.groth16.exportSolidityCallData(
            proof,
            publicSignals
        );
        fs.writeFileSync("calldata.txt", solidityCallData);

        return {
            success: verified,
            proof,
            publicSignals,
            solidityCallData
        };

    } catch (error) {
        console.error("Error generating/verifying proof:");
        console.error("- Error message:", error.message);
        console.error("- Error stack:", error.stack);
        throw error;
    }
}

generateAndVerifyProof()
    .then(result => {
        console.log("\nProof generation and verification completed!");
        console.log(`Verification status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log("\nProof details:");
        console.log("- Protocol:", result.proof.protocol);
        console.log("- Curve:", result.proof.curve);
        console.log("\nPublic signals:", result.publicSignals);
        console.log("\nFiles generated:");
        console.log("- Proof and public signals: proof.json");
        console.log("- Solidity calldata: calldata.txt");
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error("Failed:", error);
        process.exit(1);
    });