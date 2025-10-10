/**
 * Task Queue is written to use the nomenclature of the JavaScript Array.
 * This allows a standard array ([]) to be the most simple implementation queue
 * used by the Semaphore.
 */

export interface TaskQueue<T> extends Iterable<T> {
    length: number;
    at(n: number): T | undefined;
    push(item: T): void;
    shift(): T | undefined;
}