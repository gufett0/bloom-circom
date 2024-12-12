const circomlib = require("circomlib");


function poseidonHash(items) {
    return BigInt(circomlib.poseidon(items).toString());
}

function padSiblings(siblings, depth) {
    return siblings.length < depth 
        ? siblings.concat(Array(depth - siblings.length).fill(0n))
        : siblings;
}

function bits2Num(bits) {
    return bits.reduce((acc, bit, i) => {
        // Use 2^i to match Bits2Num (little-endian)
        return acc + BigInt(bit) * (2n ** BigInt(i));
    }, 0n);
}

function toHex(number, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16)
    return '0x' + str.padStart(length * 2, '0')
 }


function toFixedHex(number, length = 32) {
    let hexString;

    if (Buffer.isBuffer(number)) {
        hexString = number.toString('hex');
    } else {
        hexString = toHex(number).replace('0x', '');
    }

    let result = '0x' + hexString.padStart(length * 2, '0');
    return result;
}

module.exports = {
    poseidonHash,
    padSiblings,
    bits2Num,
    toFixedHex
};