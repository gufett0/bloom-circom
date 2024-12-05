include "./bloom.circom";

// using 2^14 = 16385 as the filter size and 
// 2 as the num of different hash functions used to check bits in the bloom filter
component main = BloomFilterChecker(16385, 2);