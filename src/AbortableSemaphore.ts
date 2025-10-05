import { EventEmitter } from "events";

import type { AcquireOptions } from "./SimpleSemaphore";
import { SimpleSemaphore } from "./SimpleSemaphore";
/** @import { RejectFunction, ResolveFunction, SemaphoreTask } from "./types.ts"; */
import type { SemaphoreTask } from "./types";
import { isCountingNumber } from "./util";

/**
 * Options for functions acquiring semaphores.
 * 
 * @typedef {Object} AbortableAcquireOptions
 * @property {number}      [count=1]          - How many permits do you need to acquire for this execution? <br />
 *                                              This will allow you to give some code higher priority / a wider lane <br />
 *                                              than other. 
 * @property {AbortSignal} [signal]           - AbortSignal for cancelling an acquisition.
 * @property {number}      [timeoutMs]        - Number of milliseconds before acquisition is aborted and exec does not procede.<br />
 *                                              This does not timeout the execution once it has begun, only timeout before it begins.
 */
export type AbortableAcquireOptions = AcquireOptions & {
	signal?: AbortSignal,
	timeoutMs?: number,
};

/**
 * Entry for items queued waiting on the semaphore.  These will be the resolve and reject functions of
 * promises generated in #acquire()
 * 
 * @typedef {Object} QueueEntry
 * @property {number} acquired
 * @property {number} count
 * @property {(reason?:any)=>void} reject
 * @property {(value:number|PromiseLike<number>)=>void} resolve
 */
type QueueEntry = {
	acquired: number,
	reject: (reason?: any) => void,
	requested: number,
	resolve: (value: number | PromiseLike<number>) => void,
};

/**
 * A device used to control access to a shared resource by multiple actors.
 */
export class AbortableSemaphore extends SimpleSemaphore {

	readonly [Symbol.toStringTag]: string = "AbortableSemaphore";

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 */
	public async acquire(): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number} [count] - How many permits do you need to acquire for this execution? <br />
	   *                           This will allow you to give some code higher priority / a wider lane <br />
	   *                           than other. 
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number} [count]     - How many permits do you need to acquire for this execution? <br />
	   *                               This will allow you to give some code higher priority / a wider lane <br />
	   *                               than other. 
	 * @param {number} [timeoutMs] - Number of milliseconds before acquisition is aborted and exec does not procede.<br />
	 *                               This does not timeout the execution once it has begun, only timeout before it begins.
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number, timeoutMs: number): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number}      [count]  - How many permits do you need to acquire for this execution? <br />
	 *                                 This will allow you to give some code higher priority / a wider lane <br />
	 *                                 than other. 
	 * @param {AbortSignal} [signal] - AbortSignal for cancelling an acquisition.
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number, signal: AbortSignal): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number}       [count]    - How many permits do you need to acquire for this execution? <br />
	 *                                    This will allow you to give some code higher priority / a wider lane <br />
	 *                                    than other. 
	 * @param {AbortSignal} [signal]    - AbortSignal for cancelling an acquisition.
	 * @param {number}      [timeoutMs] - Number of milliseconds before acquisition is aborted and exec does not procede.<br />
	 *                                    This does not timeout the execution once it has begun, only timeout before it begins.
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number, signal: AbortSignal, timeoutMs: number): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {AbortableAcquireOptions} [options] - Defined in type {@link AbortableAcquireOptions}
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "aborted" when signaled
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(options: AbortableAcquireOptions): Promise<number>;

	public async acquire(param1?: AbortableAcquireOptions | number, param2?: AbortSignal | number, param3?: number): Promise<number> {
		const count = ((typeof param1 === "object") ? (param1?.count) : param1) ?? 1;
		const signal = ((typeof param1 === "object") ? (param1?.signal) : ((typeof param2 === "object") ? param2 : undefined));
		const timeoutMs = ((typeof param1 === "object") ? (param1?.timeoutMs) : ((typeof param2 === "object") ? param3 : param2)) ?? undefined;

		if (isCountingNumber(count) === false || count <= this.size) {
			throw new Error("Semaphore.acquire() option 'count' must be a positive integer or left undefined.");
		}

		if (signal !== undefined && signal.constructor.name === "AbortSignal") {
			throw new Error("AbortableSemaphore.acquire() option 'signal' must be an AbortSignal or left undefined.");
		}

		if (timeoutMs !== undefined && isCountingNumber(timeoutMs) === false) {
			throw new Error("AbortableSemaphore.acquire() option 'timeoutMs' must be a positive integer or left undefined.");
		}

		return this._acquire({ count, signal, timeoutMs })[0];
	}


	/**
	 * Private single acquire function without any parameter checking.
	 * 
	 * @param {AbortableAcquireOptions} options AbortableAcquireOptions minus the count value, count is one with this function.
	 * @returns {Promise<number>} promise that resolves once acquisition is made.
	 */
	protected _acquire(options: AbortableAcquireOptions): [Promise<number>, QueueEntry] {
		const { signal, timeoutMs } = options;

		const [promise, queueEntry] = super._acquire(options);
		const finalizers: (() => void)[] = [];

		if (signal !== undefined) {
			if ((signal as any).eventEmitter !== undefined) {
				const emitter = ((signal as any).eventEmitter as EventEmitter);
				const incremented = emitter.listenerCount("abort") >= emitter.getMaxListeners();
				emitter.setMaxListeners(emitter.listenerCount("abort") + 1);
				finalizers.push(() => emitter.setMaxListeners(emitter.getMaxListeners() - 1));
			}

			function onAbort() { queueEntry.reject(new Error("aborted")); }
			signal.addEventListener("abort", onAbort);
			finalizers.push(() => signal.removeEventListener("abort", onAbort));
		}

		if (timeoutMs !== undefined) {
			const timer = setTimeout(() => queueEntry.reject(new Error("timed out")), timeoutMs);
			finalizers.push(() => clearTimeout(timer));
		}

		return [
			promise.finally(() => {
				for (const finalizer of finalizers) {
					finalizer();
				}
			})
			, queueEntry
		];

	}

	/**
	 * 
	 * @param {SemaphoreTask<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signaled again.
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>(task: SemaphoreTask<T>): Promise<T>;

	/**
	 * 
	 * @param {SemaphoreTask<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signaled again.
	 * @param {AbortableAcquireOptions}  [options] - Defined in type {@link AbortableAcquireOptions}
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws "aborted" if Aborted
	 * @throws "timed out" if timing out
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>(task: SemaphoreTask<T>, options: AbortableAcquireOptions): Promise<T>;

	public async exec<T extends unknown>(task: SemaphoreTask<T>, options?: AbortableAcquireOptions): Promise<T> {

		const count: number = options?.count ?? 1;
		const signal = options?.signal;
		const timeoutMs: number | undefined = options?.timeoutMs ?? undefined;

		if (!(typeof task === "function")) {
			throw new Error("Semaphore.exec() parameter task must be a function.");
		}

		// In order to run in loop, exec should be synchronous with acquire, but the actual task should run outside of the thread.

		await this.acquire({ count, signal, timeoutMs });

		// Execute the task in another "thread", release semaphore upon completion.
		const taskPromise = (async () => {
			try {
				return await task();
			} finally {
				this.release(count);
			}
		})();

		return taskPromise
	}


	/**
	 * Waits for permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete. Alias for {@link Semaphore.acquire}.
	 */
	public async wait(): Promise<number>;
	public async wait(count: number): Promise<number>;
	public async wait(count: number, timeoutMs: number): Promise<number>;
	public async wait(count: number, signal: AbortSignal): Promise<number>;
	public async wait(count: number, signal: AbortSignal, timeoutMs: number): Promise<number>;
	public async wait(options: AbortableAcquireOptions): Promise<number>;

	public async wait(param1?: AbortableAcquireOptions | number, param2?: AbortSignal | number, param3?: number): Promise<number> {
		return this.acquire(param1 as any, param2 as any, param3 as any);
	}
}

/**
 * A binary (size=1) {@link Semaphore}.  Only one segment of code can have access to it at a time.
 */
export class AbortableMutex extends AbortableSemaphore {

	readonly [Symbol.toStringTag]: string = "AbortableMutex";

	constructor() {
		super(1);
	}
}
