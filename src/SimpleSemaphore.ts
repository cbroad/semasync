/** @import { RejectFunction, ResolveFunction, SemaphoreTask } from "./types.ts"; */
import type { RejectFunction, ResolveFunction, SemaphoreTask } from "./types";
import { isCountingNumber } from "./util";

/**
 * Options for functions acquiring semaphores.
 * 
 * @typedef {Object} AcquireOptions
 * @property {number}      [count=1]          - How many permits do you need to acquire for this execution? <br />
 *                                              This will allow you to give some code higher priority / a wider lane <br />
 *                                              than other.
 */
export type AcquireOptions = {
	count?: number,
};

/**
 * Entry for items queued waiting on the semaphore.  These will be the resolve and reject functions of
 * promises generated in #acquire()
 * 
 * @typedef {Object} QueueEntry
 * @property {number} acquired
 * @property {number} count
 * @property {RejectFunction} reject
 * @property {ResolveFunction<number>} resolve
 */
type QueueEntry = {
	acquired: number,
	reject: RejectFunction,
	requested: number,
	resolve: ResolveFunction<number>,
};

/**
 * A device used to control access to a shared resource by multiple actors.
 */
export class SimpleSemaphore {

	readonly [Symbol.toStringTag]: string = "Semaphore";

	#available: number;
	#queue: QueueEntry[];
	#size: number;

	/**
	 * Creates a mutex, a semaphore of size 1.
	 */
	constructor();

	/**
	 * Create a semaphore.
	 * @constructor
	 * @param {number} [size=1] Size of execution pool.  This is the number of threads whose execution is allowed by this semaphore
	 */
	constructor(size: number);

	constructor(size: number = 1) {
		if (isCountingNumber(size) === false) {
			throw new Error("Semaphore size must be an integer greater than zero.");
		}
		this.#available = size;
		this.#queue = [];
		this.#size = size;
	}


	/**
	 * Gets the number of permits currently available for this semaphore.
	 * @returns the number of permits currently available for this semaphore
	 */
	public get available(): number {
		return this.#available;
	}

	/**
	 * Gets the queue for semaphore.  For testing purposes.
	 * @returns an Array of QueueEntries.
	 */
	public get queue(): readonly QueueEntry[] {
		return this.#queue;
	}

	/**
	 * Gets the size of the execution pool associated with this semaphore.
	 * @returns the size of the execution pool associated with this semaphore.
	 */
	public get size(): number {
		return this.#size;
	}

	public get waiting(): number {
		return this.#queue.reduce((R, queueEntry) => R + (queueEntry.requested - queueEntry.acquired), 0);
	}

	/**
	 * Sets the size of the execution pool associated with this semaphore.
	 */
	public set size(size: number) {
		if (isCountingNumber(size) === false) {
			throw new Error("Semaphore size must be an integer >0.");
		}
		const nextCount = this.#available === 0 && size > this.#size ? Math.min(this.waiting, (size - this.#size)) : 0;
		this.#available = Math.max(0, this.#available + (size - this.#size));
		this.#size = size;
		for (let i = 0; i < nextCount; i++) {
			this.#next();
		}
		this.#queue.forEach(queueEntry => { if (queueEntry.requested > this.#size) { queueEntry.reject(new Error("too large for resize")); } });
	}


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
	 * @param {AcquireOptions} [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire(options: AcquireOptions): Promise<number>;

	public async acquire(options: AcquireOptions | number = 1): Promise<number> {
		const count: number = (typeof options === "object") ? (options.count ?? 1) : options;

		if (isCountingNumber(count) === false || count > this.size) {
			throw new Error("Semaphore.acquire() option 'count' must be a positive integer less than the semaphore's size or left undefined.");
		}
		return this._acquire({ count })[0];
	}


	/**
	 * Private single acquire function without any parameter checking.
	 * 
	 * @param {AcquireOptions} options AcquireOptions minus the count value, count is one with this function.
	 * @returns {Promise<number>} promise that resolves once acquisition is made.
	 */
	protected _acquire(options: AcquireOptions): [Promise<number>, QueueEntry] {
		const { count } = options;

		const queueEntry: QueueEntry = { acquired: 0, reject: () => { }, requested: count!, resolve: (value: number | PromiseLike<number>) => { } };

		const promise = new Promise<number>((resolve, reject) => {
			queueEntry.reject = reject;
			queueEntry.resolve = resolve;
			this.#queue.push(queueEntry);
			this.#next();
		}).catch(err => {
			this.#queue.splice(this.#queue.indexOf(queueEntry), 1);
			if (queueEntry.acquired === queueEntry.requested) {
				this.release(queueEntry.acquired);
			}
			throw err;
		});

		return [promise, queueEntry];

	}

	public clearQueue(): void {
		for (const queueEntry of this.#queue) {
			queueEntry.reject(new Error("cleared"));
		}
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
	 * @param {AcquireOptions}  [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws "aborted" if Aborted
	 * @throws "timed out" if timing out
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>(task: SemaphoreTask<T>, options: AcquireOptions): Promise<T>;

	public async exec<T extends unknown>(task: SemaphoreTask<T>, options?: AcquireOptions): Promise<T> {

		const count: number = options?.count ?? 1;

		if (!(typeof task === "function")) {
			throw new Error("Semaphore.exec() parameter task must be a function.");
		}

		// In order to run in loop, exec should be synchronous with acquire, but the actual task should run outside of the thread.

		await this.acquire({ count });

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
	 * Iff there is available resource and a promise in the queue, resolves the next acquire promise.
	 */
	#next(): void {
		if (this.#available > 0 && this.#queue.length > 0) {
			this.#available--;
			const queueEntry = this.#queue[0];
			queueEntry.acquired++;
			if (queueEntry.acquired === queueEntry.requested) {
				this.#queue.shift();
				queueEntry.resolve(queueEntry.requested);
			}
			this.#next();
		}
	}

	/**
	 * Releases permission back to this semaphore.
	 */
	public release(): void;
	public release(count: number): void;
	public release(count: number = 1): void {
		if (isCountingNumber(count) === false || count > this.size) {
			throw new Error("Semaphore.release() option count must be a positive integer less than the semaphore's or left undefined.");
		}
		for (let i = 0; i < count; i++) {
			this.#release();
		}
	}

	#release(): void {
		if (this.#available === this.#size) {
			throw new Error("Semaphore.release() trying to release when all permits are available.");
		}
		this.#available++;
		this.#next();
	}



	/**
	 * Releases permission back to this semaphore. Alias for {@link Semaphore.release}.
	 */
	public signal(): void;
	public signal(count: number): void;
	public signal(count: number = 1): void {
		return this.release(count);
	}




	/**
	 * Waits for permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete. Alias for {@link Semaphore.acquire}.
	 */
	public async wait(): Promise<number>;
	public async wait(count: number): Promise<number>;
	public async wait(options: AcquireOptions): Promise<number>;

	public async wait(param1: AcquireOptions | number = 1): Promise<number> {
		return this.acquire(param1 as AcquireOptions);
	}
}

/**
 * A binary (size=1) {@link Semaphore}.  Only one segment of code can have access to it at a time.
 */
export class SimpleMutex extends SimpleSemaphore {

	readonly [Symbol.toStringTag]: string = "Mutex";

	constructor() {
		super(1);
	}
}
