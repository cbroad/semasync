/**
 * Tests if a value is a counting number, an integer greater than zero.
 * 
 * @param n value being tested
 * @returns true if n is a counting number, otherwise false
 */
export function isCountingNumber(n: number): boolean {
    return Number.isInteger(n) && n > 0;
}