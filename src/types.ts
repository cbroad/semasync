/**
 * Reject function for a promise.
 * @callback RejectFunction
 * @param {any} [reason] - The reason for the rejection.
 */
export type RejectFunction = (reason?: any) => void;

/**
 * Resolve function for a promise.
 * @callback ResolveFunction
 * @param {T | PromiseLike<T>} value - The value to resolve the promise with.
 * @template T
 */
export type ResolveFunction<T> = (value: T | PromiseLike<T>) => void;

/**
 * A task function to be executed within a semaphore.
 * @callback SemaphoreTask
 * @returns {T | PromiseLike<T>} - The result of the task, which can be void or a promise.
 * @template T
 */
export type SemaphoreTask<T> = () => T | PromiseLike<T>;

/**
 * Entry for items queued waiting on the semaphore.  These will be the resolve and reject functions of
 * promises generated in #acquire()
 * 
 * @typedef {Object} QueueEntry
 * @property {number} acquired
 * @property {number} count
 * @property {RejectFunction} reject
 * @property {number} requested
 * @property {ResolveFunction<()=>void>} resolve
 */
export interface QueueEntry {
    acquired: number;
    reject: RejectFunction;
    rejected: boolean;
    requested: number;
    resolve: ResolveFunction<() => void>;
};