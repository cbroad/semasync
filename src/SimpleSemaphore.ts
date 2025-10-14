/** @import { QueueEntry, SemaphoreTask } from "./types.ts"; */
import { type TaskQueue, CircularBufferQueue } from "./TaskQueue";
import type { QueueEntry, SemaphoreTask } from "./types";
import { isCountingNumber } from "./util";

/**
 * Options for functions acquiring semaphores.
 * 
 * @typedef {Object} AcquireOptions
 * @property {number}      [count=1]          - How many permits do you need to acquire for this execution? <br />
 *                                              This will allow you to give some code higher priority / a wider lane <br />
 *                                              than other code.
 */
export type AcquireOptions = {
    count?: number,
};

/**
 * A device used to control access to a shared resource by multiple actors.
 */
export class SimpleSemaphore {

    readonly [Symbol.toStringTag]: string = "Semaphore";

    #available: number;
    #queue: TaskQueue<QueueEntry>;
    #size: number;
    #waiting: number;

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

    /**
     * Create a semaphore.
     * @constructor
     * @param {number} [size=1] Size of execution pool.  This is the number of threads whose execution is allowed by this semaphore
     * @param {TaskQueue} [queue=CircularBufferQueue] queue to be used in semaphore
     *                          (Compatible with Array APIs: .length (Set and Get), &lsqb;Symbol.iterator&rsqb;() .at(), .push(), .shift())  
     */
    constructor(size: number, queue: TaskQueue<any>);

    constructor(size: number = 1, queue: TaskQueue<any> = new CircularBufferQueue()) {
        if (isCountingNumber(size) === false) {
            throw new Error("Semaphore size must be an integer greater than zero.");
        }
        this.#available = size;
        this.#queue = queue;
        this.#size = size;
        this.#waiting = 0;
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
        return Object.freeze([...this.#queue].filter(entry => !entry.rejected));
    }

    /**
     * Gets the size of the execution pool associated with this semaphore.
     * @returns the size of the execution pool associated with this semaphore.
     */
    public get size(): number {
        return this.#size;
    }

    /**
     * Gets the number of waiting leases in queue.  Not the number of threads waiting for
     * access, but the aggregate number of requested leases.
     * @returns the number or requested leases.
     */
    public get waiting(): number {
        return this.#waiting;
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
        for (const queueEntry of this.#queue) {
            if (!queueEntry.rejected && queueEntry.requested > this.#size) {
                queueEntry.reject(new Error("too large for resize"));
            }
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
     * @param {AcquireOptions} [options] - Defined in type {@link AcquireOptions}
     * @returns {Promise<function():void>} Promise which resolves to a release function for the number of permits acquired
     * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
     * @throws "too large for resize" if semaphore is resized to smaller than count.
     */
    public async acquire(options: AcquireOptions): Promise<() => void>;

    public async acquire(options: AcquireOptions | number = 1): Promise<() => void> {
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
     * @returns {[Promise<function():void>, QueueEntry]} a tuple with a promise that resolves to a release function paired with the QueueEntry.
     */
    protected _acquire(options: AcquireOptions): [Promise<() => void>, QueueEntry] {
        const { count } = options;

        const queueEntry: QueueEntry = {
            acquired: 0,
            reject: null as any,
            rejected: false,
            requested: count!,
            resolve: null as any,
        };

        const promise = new Promise<() => void>((resolve, reject) => {
            queueEntry.reject = reject;
            queueEntry.resolve = resolve;
            this.#queue.push(queueEntry);
            this.#waiting += queueEntry.requested;
            this.#next();
        }).catch(err => {
            queueEntry.rejected = true;
            this.#waiting -= queueEntry.requested - queueEntry.acquired;
            if (queueEntry.acquired) {
                this.release(queueEntry.acquired);
                queueEntry.acquired = 0;
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

    public async exec<T extends unknown>(task: SemaphoreTask<T>, options: AcquireOptions = {}): Promise<T> {

        const count: number = options.count ?? 1;

        if (typeof task !== "function") {
            throw new Error("Semaphore.exec() parameter task must be a function.");
        }

        if (isCountingNumber(count) === false || count > this.size) {
            throw new Error("AbortableSemaphore.exec() option 'count' must be a positive integer or left undefined.");
        }


        const [semPromise, entry] = this._acquire({ count });

        let release = await semPromise;

        // Execute the task in another "thread", release semaphore upon completion.
        const taskPromise = (async () => {
            try {
                return await task();
            } finally {
                release();
            }
        })();

        return taskPromise
    }

    /**
     * Iff there is available resource and a promise in the queue, resolves the next acquire promise.
     */
    #next(): void {
        while (this.#available > 0 && this.#queue.length > 0) {
            const queueEntry = this.#queue.at(0) as QueueEntry;
            if (queueEntry.rejected) {
                this.#queue.shift();
            } else {
                this.#available--;
                queueEntry.acquired++;
                this.#waiting--;
                if (queueEntry.acquired === queueEntry.requested) {
                    this.#queue.shift();
                    queueEntry.resolve(() => this.#release(queueEntry.requested));
                }
            }
        }
    }

    /**
     * Repermits permission back to this semaphore.
     */
    public release(): void;
    public release(count: number): void;
    public release(count: number = 1): void {
        if (typeof count === "number") {
            if (isCountingNumber(count) === false || count > this.size) {
                throw new Error("Semaphore.release() option count must be a positive integer less than the semaphore's or left undefined.");
            }
        }
        this.#release(count);
    }

    #release(): void;
    #release(count: number): void;
    #release(count: number = 1): void {
        if (this.#available + count > this.#size) {
            throw new Error("Semaphore.release() trying to release when all permits are available.");
        }
        this.#available += count;
        this.#next();
    }

    /**
     * Repermits permission back to this semaphore. Alias for {@link Semaphore.release}.
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
    public async wait(): Promise<() => void>;
    public async wait(count: number): Promise<() => void>;
    public async wait(options: AcquireOptions): Promise<() => void>;

    public async wait(param1: AcquireOptions | number = 1): Promise<() => void> {
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
