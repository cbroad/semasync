/** @import { SemaphoreTask } from "./types.ts"; */

import { type AcquireOptions, SimpleSemaphore } from "@/SimpleSemaphore";
import type { QueueEntry, RejectFunction, SemaphoreTask } from "@/types";
import { EmptyReject, EmptyResolve, isCountingNumber } from "@/util";

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
	incrementMaxListeners?: boolean;
	signal?: AbortSignal;
	timeoutMs?: number;
};

/**
 * A device used to control access to a shared resource by multiple actors.
 */
export class AbortableSemaphore extends SimpleSemaphore {

	readonly [Symbol.toStringTag]: string = "AbortableSemaphore";

	#abortMap: Map<AbortSignal, [() => void, Set<RejectFunction>]> = new Map();

	#getAbortRecord(signal: AbortSignal): [() => void, Set<RejectFunction>] {
		let record = this.#abortMap.get(signal);
		if (record) {
			return record;
		}
		const set: Set<RejectFunction> = new Set();
		const handleAbort = () => {
			const err = new Error("aborted");
			set.forEach(reject => reject(err));
		};
		record = [handleAbort, set];
		signal.addEventListener("abort", handleAbort);
		this.#abortMap.set(signal, record);
		return record;
	}

	#addAbortListener(signal: AbortSignal, reject: RejectFunction) {
		const [_handleAbort, set] = this.#getAbortRecord(signal);
		set.add(reject);
	}

	#removeAbortListener(signal: AbortSignal, reject: RejectFunction) {
		const [handleAbort, set] = this.#getAbortRecord(signal);
		set.delete(reject);
		if (set.size === 0) {
			signal.removeEventListener("abort", handleAbort);
			this.#abortMap.delete(signal);
		}
	}

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 */
	public async acquire(): Promise<() => void>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number} [count] - How many permits do you need to acquire for this execution? <br />
	   *                           This will allow you to give some code higher priority / a wider lane <br />
	   *                           than other. 
	 * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number): Promise<() => void>;

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
	 * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number, timeoutMs: number): Promise<() => void>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number}      [count]  - How many permits do you need to acquire for this execution? <br />
	 *                                 This will allow you to give some code higher priority / a wider lane <br />
	 *                                 than other. 
	 * @param {AbortSignal} [signal] - AbortSignal for cancelling an acquisition.
	 * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number, signal: AbortSignal): Promise<() => void>;

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
	 * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(count: number, signal: AbortSignal, timeoutMs: number): Promise<() => void>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {AbortableAcquireOptions} [options] - Defined in type {@link AbortableAcquireOptions}
	 * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
	 * @throws "aborted" when signaled
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(options: AbortableAcquireOptions): Promise<() => void>;

	public async acquire(
		param1?: AbortableAcquireOptions | number,
		param2?: AbortSignal | number,
		param3?: number
	): Promise<() => void> {
		const count = ((typeof param1 === "object") ? (param1?.count) : param1) ?? 1;
		const signal = ((typeof param1 === "object") ? (param1?.signal) : ((typeof param2 === "object") ? param2 : undefined));
		const timeoutMs = ((typeof param1 === "object") ? (param1?.timeoutMs) : ((typeof param2 === "object") ? param3 : param2)) ?? undefined;

		if (typeof count !== "number") {
			throw new TypeError("invalid acquire count");
		}

		if (isCountingNumber(count) === false || count > this.size) {
			throw new RangeError("invalid acquire count");
		}

		if (signal !== undefined && typeof (signal as any).aborted !== "boolean") {
			throw new TypeError("invalid signal");
		}

		if (timeoutMs !== undefined) {
			if (typeof timeoutMs !== "number") {
				throw new TypeError("invalid timeoutMs");
			}

			if (isCountingNumber(timeoutMs) === false) {
				throw new RangeError("invalid timeoutMs");
			}
		}

		return this._acquire({ count, signal, timeoutMs })[0];
	}


	/**
	 * Private single acquire function without any parameter checking.
	 * 
	 * @param {AbortableAcquireOptions} options AbortableAcquireOptions minus the count value, count is one with this function.
	 * @returns {[Promise<function():void>, QueueEntry]} a tuple with a promise that resolves to a release function paired with the QueueEntry.
	 */
	protected _acquire(options: AbortableAcquireOptions): [Promise<() => void>, QueueEntry] {
		const { signal, timeoutMs } = options;

		if (signal?.aborted) {
			return [
				Promise.reject(new Error("aborted")),
				{
					acquired: 0,
					reject: EmptyReject,
					rejected: true,
					requested: options.count ?? 1,
					resolve: EmptyResolve,
				}
			];
		}

		let [promise, queueEntry] = super._acquire(options);

		if (signal !== undefined) {
			if (signal.aborted) {
				queueEntry.reject(new Error("aborted"));
				return [promise, queueEntry];
			}
			this.#addAbortListener(signal, queueEntry.reject);
			promise = promise.finally(() => {
				this.#removeAbortListener(signal, queueEntry.reject);
			});
		}

		if (timeoutMs !== undefined) {
			const timer = setTimeout(() => {
				if (!queueEntry.rejected) {
					queueEntry.reject(new Error("timed out"));
				}
			}, timeoutMs);
			promise = promise.finally(() => clearTimeout(timer));
		}

		return [promise, queueEntry];
	}

	/**
	 * 
	 * @param {SemaphoreTask<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signaled again.
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>(task: SemaphoreTask<T>): Promise<T>;

	/**
	 * 
	 * @param {SemaphoreTask<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signaled again.
	 * @param {AbortableAcquireOptions}  [options] - Defined in type {@link AbortableAcquireOptions}
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>(task: SemaphoreTask<T>, options: AbortableAcquireOptions): Promise<T>;

	public async exec<T extends unknown>(task: SemaphoreTask<T>, options: AbortableAcquireOptions = { count: 1 }): Promise<T> {

		const count: number = options.count ?? 1;
		const signal: AbortSignal | undefined = options.signal;
		const timeoutMs: number | undefined = options.timeoutMs ?? undefined;

		if (typeof task !== "function") {
			throw new TypeError("invalid task");
		}

		if (typeof count !== "number") {
			throw new TypeError("invalid acquire count");
		}

		if (isCountingNumber(count) === false || count > this.size) {
			throw new RangeError("invalid acquire count");
		}

		if (signal !== undefined && typeof (signal as any).aborted !== "boolean") {
			throw new TypeError("invalid signal");
		}

		if (timeoutMs !== undefined) {
			if (typeof timeoutMs !== "number") {
				throw new TypeError("invalid timeoutMs");
			}

			if (isCountingNumber(timeoutMs) === false) {
				throw new RangeError("invalid timeoutMs");
			}
		}

		// In order to run in loop, exec should be synchronous with acquire, but the actual task should run outside of the thread.

		const [acquirePromise, entry] = this._acquire({ count, signal, timeoutMs });

		let release = await acquirePromise;

		try {
			return await task();
		} finally {
			release();
		}
	}

	/**
	 * Waits for permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete. Alias for {@link Semaphore.acquire}.
	 */
	public async wait(): Promise<() => void>;
	public async wait(count: number): Promise<() => void>;
	public async wait(count: number, timeoutMs: number): Promise<() => void>;
	public async wait(count: number, signal: AbortSignal): Promise<() => void>;
	public async wait(count: number, signal: AbortSignal, timeoutMs: number): Promise<() => void>;
	public async wait(options: AbortableAcquireOptions): Promise<() => void>;
	public async wait(
		param1?: AbortableAcquireOptions | number,
		param2?: AbortSignal | number,
		param3?: number
	): Promise<() => void> {
		return this.acquire(param1 as any, param2 as any, param3 as any);
	}

}

/**
 * A binary (size=1) {@link Semaphore}.  Only one segment of code can have access to it at a time.
 */
export class AbortableMutex extends AbortableSemaphore {

	readonly [Symbol.toStringTag]: string = "AbortableMutex";

	get size(): number { return 1; }

	set size(n: number) { }

	constructor() {
		super(1);
	}
}
