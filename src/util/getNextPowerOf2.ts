// Fill in all non-leading bits and add 1, then watch them roll over.

/**
 * Gets the next power of two (2^n) larger than the provided number.
 * This version works for 32 bit integers.
 * @param {number} n a number, numbers <=1 will return in 2^0, or 1.
 * @returns {number} the next power of two larger than n
 */
export function getNextPowerOf2(n: number): number {
    return (n > 1)
        ? 1 << (32 - Math.clz32(n - 1))
        : 1;
}

/**
 * Gets the next power of two (2^n) larger than the provided number.
 * This version works for 64 bit integers.
 * @param {number | bigint} n a number, numbers <=1 will return in 2^0, or 1.
 * @returns {bigint} the next power of two larger than n
 */
export function getNextPowerOf2_64(n: number): bigint;
export function getNextPowerOf2_64(n: bigint): bigint;
export function getNextPowerOf2_64(n: bigint | number): bigint {
    let N = BigInt(n);
    if (N <= 1n) {
        return 1n;
    }
    N--;
    N |= N >> 1n;
    N |= N >> 2n;
    N |= N >> 4n;
    N |= N >> 8n;
    N |= N >> 16n;
    N |= N >> 32n;
    return ++N;

}

/**
 * Gets the next power of two (2^n) larger than the provided number.
 * This version works for any number.
 * @param {number | bigint} n a number, numbers <=1 will return in 2^0, or 1.
 * @returns {bigint} the next power of two larger than n
 */
export function getNextPowerOf2n(n: number): bigint;
export function getNextPowerOf2n(n: bigint): bigint;
export function getNextPowerOf2n(n: bigint | number): bigint {
    const N = BigInt(n);
    if (N <= 1n) {
        return 1n;
    }
    let p = 1n;
    while (p < N) p <<= 1n;
    return p;
}
