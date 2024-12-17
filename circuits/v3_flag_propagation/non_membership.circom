pragma circom 2.1.9;

include "./bloom.circom"; 


component main {public [root, key, isExclusion]} = BloomFilter(256, 2, 20); //(2^14);