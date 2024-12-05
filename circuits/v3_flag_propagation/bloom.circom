include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/gates.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// this is needed to see if a specific bit is set in the filter
template SingleBitChecker(filterSize) {
    signal input index; 
    signal input bitArray[filterSize];

    signal output bit; // we'll get the value of the bit at the specified index
    
    signal selectorBits[filterSize];    
    signal products[filterSize]; // store intermediate products for selection
    signal sums[filterSize]; // running sums for final bit selection
    
    // at each position in the filter compare current index with target index
    for (var i = 0; i < filterSize; i++) {
        component eq = IsEqual();
        // 
        eq.in[0] <== index;
        eq.in[1] <== i;
        selectorBits[i] <== eq.out; // this selector array will have 1 if indices match, 0 otherwise
    
        products[i] <== selectorBits[i] * bitArray[i]; // so we multiply it by the array bit to get desired position
    }
    
    // aggregate results
    sums[0] <== products[0];
    // add each subsequent product to running sum
    for (var i = 1; i < filterSize; i++) {
        sums[i] <== sums[i-1] + products[i];
    }
    // if we extract the final sum, this would be our selected bit
    bit <== sums[filterSize-1];
}

template BloomFilterChecker(filterSize, numHashFunctions) {
    signal input indices[numHashFunctions];
    signal input bitArray[filterSize];
    signal output notInSet;  // 1 if element is NOT in set, 0 if possibly in set

    // we add a constraint: index must be less than filterSize
    for (var i = 0; i < numHashFunctions; i++) {
        component lt = LessThan(15);
        lt.in[0] <== indices[i];
        lt.in[1] <== filterSize;
        lt.out === 1;  
    } 

    component bitCheckers[numHashFunctions];
    signal bits[numHashFunctions];
    signal isValid[numHashFunctions]; 
    
    for (var i = 0; i < numHashFunctions; i++) {
        
        bitCheckers[i] = SingleBitChecker(filterSize);
        bitCheckers[i].index <== indices[i];

        // each SingleBitChecker needs access to the entire bitArray, so:
        for (var j = 0; j < filterSize; j++) {
            bitCheckers[i].bitArray[j] <== bitArray[j];
        }
        // add another constraint: bit value must be 0 or 1
        bits[i] <== bitCheckers[i].bit;
        //bits[i] * (bits[i] - 1) === 0;
        isValid[i] <== bits[i] * (1 - bits[i]);
        isValid[i] === 0;
    }
    
    // Combine results using AND operations
    component andGates[numHashFunctions - 1];
    signal intermediate[numHashFunctions - 1];
    
    // when using multiple hash functions
    if (numHashFunctions > 1) {
        // we start with first two bits and then chain AND operations for the remaining bits

        andGates[0] = AND();
        andGates[0].a <== bits[0];
        andGates[0].b <== bits[1];
        intermediate[0] <== andGates[0].out;
        
        for (var i = 1; i < numHashFunctions - 1; i++) {
            andGates[i] = AND();
            andGates[i].a <== intermediate[i-1];
            andGates[i].b <== bits[i+1];
            intermediate[i] <== andGates[i].out;
        }
        
        notInSet <== 1 - intermediate[numHashFunctions-2];
    } else {
        notInSet <== 1 - bits[0];
    }
}