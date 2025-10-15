import type { AcquireOptions } from "./SimpleSemaphore";
import { SimpleSemaphore } from "./SimpleSemaphore";
/** @import { SemaphoreTask } from "./types.ts"; */
import type { QueueEntry, SemaphoreTask } from "./types";
import { isCountingNumber } from "./util";

const CAN_ADJUST_LISTENERS: boolean = (() => {
	const ac = new AbortController();
	const signal = ac.signal;
	const eventEmitter = (signal as any).eventEmitter;
	return eventEmitter &&
		typeof eventEmitter.getMaxListeners === "function" &&
		typeof eventEmitter.setMaxListeners === "function";
})();

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

		if (isCountingNumber(count) === false || count > this.size) {
			throw new Error("AbortableSemaphore.acquire() option 'count' must be a positive integer or left undefined.");
		}

		if (signal !== undefined && typeof (signal as any).aborted !== "boolean") {
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
	 * @returns {[Promise<function():void>, QueueEntry]} a tuple with a promise that resolves to a release function paired with the QueueEntry.
	 */
	protected _acquire(options: AbortableAcquireOptions): [Promise<() => void>, QueueEntry] {
		const { signal, timeoutMs } = options;

		if (signal?.aborted) {
			return [
				Promise.reject(new Error("aborted")),
				{
					acquired: 0,
					reject: null as any,
					rejected: true,
					requested: options.count ?? 1,
					resolve: null as any,
				}
			];
		}

		let [promise, queueEntry] = super._acquire(options);

		if (signal !== undefined) {
			if (signal.aborted) {
				queueEntry.reject(new Error("aborted"));
				return [promise, queueEntry];
			}

			const onAbort = () => {
				if (!queueEntry.rejected) {
					queueEntry.reject(new Error("aborted"));
				}
			};

			// In Node.js, AbortSignal contains an events.EventEmitter. An EventEmitter will
			// print a warning if when the number of listeners passes maxListeners. This code
			// will increment and decrement the maxListeners count to avoid the warning message.

			const eventEmitter: any = (signal as any).eventEmitter;
			if (CAN_ADJUST_LISTENERS) {
				eventEmitter.setMaxListeners(eventEmitter.getMaxListeners() + 1);
			}
			signal.addEventListener("abort", onAbort);
			promise = promise.finally(() => {
				signal.removeEventListener("abort", onAbort);
				if (CAN_ADJUST_LISTENERS) {
					eventEmitter?.setMaxListeners(eventEmitter.getMaxListeners() - 1);
				}
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
			throw new Error("Semaphore.exec() parameter task must be a function.");
		}

		if (isCountingNumber(count) === false || count > this.size) {
			throw new Error("AbortableSemaphore.exec() option 'count' must be a positive integer or left undefined.");
		}

		if (signal !== undefined && typeof (signal as any).aborted !== "boolean") {
			throw new Error("AbortableSemaphore.exec() option 'signal' must be an AbortSignal or left undefined.");
		}

		if (timeoutMs !== undefined && isCountingNumber(timeoutMs) === false) {
			throw new Error("AbortableSemaphore.exec() option 'timeoutMs' must be a positive integer or left undefined.");
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

	constructor() {
		super(1);
	}
}
