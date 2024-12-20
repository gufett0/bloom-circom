pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template SimpleHash() {
    signal input a;
    signal input b;

    signal output out;

    component h = Poseidon(2);
    h.inputs[0] <== a;
    h.inputs[1] <== b;

    out <== h.out;
    
    log(out);
}

component main = SimpleHash();