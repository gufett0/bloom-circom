const { buildPoseidon } = require("circomlibjs");

let poseidonInstance = null;

async function initializePoseidon() {
    if (!poseidonInstance) {
        poseidonInstance = await buildPoseidon();
    }
    return poseidonInstance;
}

async function createPoseidonHasher() {
    const poseidon = await initializePoseidon();
    
    return (inputs) => {
        return BigInt(poseidon(inputs)[0].toString());
    };
}

function padSiblings(siblings, depth) {
    return siblings.length < depth 
        ? siblings.concat(Array(depth - siblings.length).fill(0n))
        : siblings;
}

function bits2Num(bits) {
    return bits.reduce((acc, bit, i) => {
        return acc + BigInt(bit) * (2n ** BigInt(i));
    }, 0n);
}

function toHex(number, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16);
    return '0x' + str.padStart(length * 2, '0');
}

function toFixedHex(number, length = 32) {
    let hexString;
    if (Buffer.isBuffer(number)) {
        hexString = number.toString('hex');
    } else {
        hexString = toHex(number).replace('0x', '');
    }
    return '0x' + hexString.padStart(length * 2, '0');
}

module.exports = {
    createPoseidonHasher,
    padSiblings,
    bits2Num,
    toFixedHex
};