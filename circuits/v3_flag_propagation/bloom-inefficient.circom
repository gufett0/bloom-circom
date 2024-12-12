include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

template BloomFilter(n) {
    signal input element;
    signal input bitArray[n];
    signal output notInSet;

    // Calculate hash values
    component hash1 = Poseidon(1);
    component hash2 = Poseidon(1);
    
    hash1.inputs[0] <== element;
    hash2.inputs[0] <== element + 1;
    
    // Create signals for indices
    signal idx1;
    signal idx2;
    idx1 <-- hash1.out % n;
    idx2 <-- hash2.out % n;

    log(idx1)
    log(idx2)
    
    // Ensure indices are within bounds
    component lt1 = LessThan(16);
    component lt2 = LessThan(16);
    lt1.in[0] <== idx1;
    lt1.in[1] <== n;
    lt2.in[0] <== idx2;
    lt2.in[1] <== n;
    lt1.out === 1;
    lt2.out === 1;
    
    // Create IsEqual components for each index comparison
    component eq1[n];
    component eq2[n];
    for (var i = 0; i < n; i++) {
        eq1[i] = IsEqual();
        eq2[i] = IsEqual();
        eq1[i].in[0] <== idx1;
        eq1[i].in[1] <== i;
        eq2[i].in[0] <== idx2;
        eq2[i].in[1] <== i;
    }
    
    // Calculate bit lookups
    signal bit1;
    signal bit2;
    signal sumA[n];
    signal sumB[n];
    
    // Initialize first sums
    sumA[0] <== bitArray[0] * eq1[0].out;
    sumB[0] <== bitArray[0] * eq2[0].out;
    
    // Calculate rest of sums
    for (var i = 1; i < n; i++) {
        sumA[i] <== sumA[i-1] + bitArray[i] * eq1[i].out;
        sumB[i] <== sumB[i-1] + bitArray[i] * eq2[i].out;
    }
    
    bit1 <== sumA[n-1];
    bit2 <== sumB[n-1];
    
    // Final check if element is not in set
    signal bothSet;
    bothSet <== bit1 * bit2;
    notInSet <== 1 - bothSet;
}