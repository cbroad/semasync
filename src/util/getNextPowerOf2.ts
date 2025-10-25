/**
 * Gets the next power of two (2^n) larger than the provided number.
 * This version works for 32 bit integers.
 * @param {number} n a number, numbers <=1 will return in 2^0, or 1.
 * @returns {number} the next power of two larger than n
 */
export function getNextPowerOf2(n: number): number {
    if (n <= 1) {
        return 1;
    }
    n--;
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    n |= n >> 32;
    n |= n >> 64;
    return n + 1;
}
/**
 * Gets the next power of two (2^n) larger than the provided number.
 * This version works for 64 bit integers.
 * @param {number | bigint} n a number, numbers <=1 will return in 2^0, or 1.
 * @returns {bigint} the next power of two larger than n
 */
export function getNextPowerOf2n(n: number): bigint;
export function getNextPowerOf2n(n: bigint): bigint;
export function getNextPowerOf2n(n: bigint | number): bigint {
    let N = BigInt(n);
    if (N <= 1) {
        return 1n;
    }
    N -= 1n;
    N |= N >> 1n;
    N |= N >> 2n;
    N |= N >> 4n;
    N |= N >> 8n;
    N |= N >> 16n;
    N |= N >> 32n;
    N |= N >> 64n;
    return N + 1n;

}