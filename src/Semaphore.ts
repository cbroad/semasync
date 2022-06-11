import { EventEmitter } from "events";

/**
 * Options for functions acquiring semaphores.
 * 
 * @typedef {Object} AcquireOptions
 * @property {number}      [count=1]          - How many permits do you need to acquire for this execution? <br />
 *                                              This will allow you to give some code higher priority / a wider lane <br />
 *                                              than other. 
 * @property {AbortSignal} [signal]           - AbortSignal for cancelling an acquisition.
 * @property {number}      [timeoutMs]        - Number of milliseconds before acquisition is aborted and exec does not procede.<br />
 *                                              This does not timeout the execution once it has begun, only timeout before it begins.
 */
export type AcquireOptions = {
	count?:number,
	signal?:AbortSignal,
	timeoutMs?:number,
};

/**
 * Entry for items queued waiting on the semaphore.  These will be the resolve and reject functions of
 * promises generated in #acquire()
 * 
 * @typedef {Object} QueueEntry
 * @property {(reason?:any)=>void} reject
 * @property {(value:void|PromiseLikd<void>)=>void} resolve
 */
type QueueEntry = {
	reject: (reason?:any)=>void,
	resolve: (value:void|PromiseLike<void>)=>void
};

/**
 * A device used to control access to a shared resource by multiple actors.
 */
export class Semaphore {

	#available: number;
	#queue: Array< { reject: (reason?:any)=>void, resolve: ( value: void|PromiseLike<void> ) => void } >;
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
	constructor( size:number );

	constructor( size:number = 1 ) {
		if( ! ( isCountingNumber(size)===true ) ) {
			throw new Error( "Semaphore size must be an integer greater than zero." );
		}
		this.#available = size;
		this.#queue = [];
		this.#size = size;
	}


	 /**
	  * Gets the number of permits currently available for this semaphore.
	  * @returns the number of permits currently available for this semaphore
	  */
	public get available():number {
		return this.#available;
	}

	/**
	 * Gets the size of the execution pool associated with this semaphore.
	 * @returns the size of the execution pool associated with this semaphore.
	 */
	public get size():number {
		return this.#size;
	}

	public get waiting():number {
		return this.#queue.length;
	}

	/**
	 * Sets the size of the execution pool associated with this semaphore.
	 */
	public set size( size:number ) {
		if( size<=0 ) {
			throw new Error( "Semaphore size must be >0." );
		}
		if(size > this.#size ) {
			this.#available += (size-this.#size);
		}
		this.#size = size;
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
	 */
	public async acquire( count: number ): Promise<number>;

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
	 * @throws "timed out" when timing out
	 */
	public async acquire( count: number, timeoutMs: number ): Promise<number>;

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
	 * @throws "aborted" when signalled
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out
	 */
	public async acquire( count: number, signal: AbortSignal ): Promise<number>;

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
	 * @throws "aborted" when signalled
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out
	 */
	public async acquire( count: number, signal: AbortSignal, timeoutMs: number ): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {AcquireOptions} [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "aborted" when signalled
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out
	 */
	public async acquire( options: AcquireOptions  ): Promise<number>;

	public async acquire( param1?: AcquireOptions|number, param2?:AbortSignal|number, param3?:number ): Promise<number> {
		const count     = ( (typeof param1==="object") ? (param1?.count)     : param1 ) ?? 1;
		const signal    = ( (typeof param1==="object") ? (param1?.signal)     : ( (typeof param2==="object") ? param2 :  undefined ) );
		const timeoutMs = ( (typeof param1==="object") ? (param1?.timeoutMs) : ( (typeof param2==="object") ? param3 :  param2 ) ) ?? undefined;

		if( ! ( isCountingNumber(count)===true && count<=this.size ) ) {
			throw new Error( "Semaphore.acquire() option 'count' must be a positive integer or left undefined." );
		}

		if( ! ( signal===undefined || signal.constructor.name==="AbortSignal" ) ) {
			throw new Error( "Semaphore.acquire() option 'signal' must be an AbortSignal or left undefined." );
		}

		if( ! ( timeoutMs===undefined || isCountingNumber(timeoutMs)===true ) ) {
			throw new Error( "Semaphore.acquire() option 'timeoutMs' must be a positive integer or left undefined." );
		}

		let acquiredCount = 0;
		try {
			await Promise.all( [ ...new Array(count) ].map( () => this.#acquire( { signal, timeoutMs } ).then( () => acquiredCount++ ) ) );
		} catch(err) {
			if( acquiredCount>0 ) {
				this.release( acquiredCount );
			}
			throw err;
		}
		return acquiredCount;
	 }


	/**
	 * Private single count acquire function without any parameter checking.
	 * 
	 * @param {AcquireOptions} options AcquireOptions minus the count value, count is one with this function.
	 * @returns {Promise<void>} promise that resolves once acquisition is made.
	 */
	async #acquire( options: AcquireOptions ): Promise<void> {
		const { signal, timeoutMs } = options;

		const queueEntry: QueueEntry = { reject:()=>{}, resolve:()=>{} };
		const finalizers:(()=>void)[] = [];

		if( signal!==undefined ) {
			const emitter = ( (signal as any).eventEmitter as EventEmitter );
			const incremented = emitter.listenerCount( "abort" )>=emitter.getMaxListeners();
			emitter.setMaxListeners( emitter.listenerCount( "abort" )+1 );
			function onAbort() { queueEntry.reject( new Error( "aborted" ) ); }
			signal.addEventListener( "abort", onAbort );
			finalizers.push( () => {
				signal.removeEventListener( "abort", onAbort );
				emitter.setMaxListeners( emitter.getMaxListeners()-1 );
			} );
		}

		if( timeoutMs!==undefined ) {
			const timer = setTimeout( () => queueEntry.reject( new Error( "timed out" ) ), timeoutMs );
			finalizers.push( () => clearTimeout( timer ) );
		}

		return new Promise<void>( ( resolve, reject ) => {
				queueEntry.reject = reject;
				queueEntry.resolve = resolve;
				this.#queue.push( queueEntry );
				this.#next();
			} ).catch( err => {
				this.#queue.splice( this.#queue.indexOf( queueEntry ), 1 );
				throw err;
			} ).finally( () => {
				for( const finalizer of finalizers ) {
					finalizer();
				}
			} );


	 }

	public clearQueue():void {
		for( const queueEntry of this.#queue ) {
			queueEntry.reject( new Error( "cleared" ) );
		}
	}

	/**
	 * 
	 * @param {()=>T|PromiseLike<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signalled again.
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T> ): Promise<T>;

	/**
	 * 
	 * @param {()=>T|PromiseLike<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signalled again.
	 * @param {AcquireOptions}  [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws "aborted" if Aborted
	 * @throws "timed out" if timing out
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T>, options: AcquireOptions ): Promise<T>;

	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T>, options?: AcquireOptions ): Promise<T> {

		const count:number = options?.count ?? 1;
		const timeoutMs: number|undefined = options?.timeoutMs ?? undefined;

		if( ! ( typeof task === "function" ) ) {
			throw new Error( "Semaphore.exec() parameter task must be a function." );
		}
		
		// In order to run in loop, exec should be synchronous with acquire, but the actual task should run outside of the thread.

		await this.acquire( { count, timeoutMs } );

		// Execute the task in another "thread", release semaphore upon completion.
		const taskPromise = ( async () => {
			try {
				return await task();
			} finally {
				this.release( count );
			}
		} )();

		return taskPromise
	}

	/**
	 * Iff there is available resource and a promise in the queue, resolves the next acquire promise.
	 */
	#next(): void {
		if( this.#available && this.#queue.length ) {
			this.#available--;
			this.#queue.shift()!.resolve();
		}
	}

	/**
	 * Releases permission back to this semaphore.
	 */
	public release(): void;
	public release( count:number ): void;
	public release( count:number=1 ): void {
		count = count ?? 1;
		if( ! ( isCountingNumber(count)===true && count<=this.size ) ) {
			throw new Error( "Semaphore.release() option count must be a positive integer or left undefined." );
		}
		for( let i=0 ; i<count ; i++ ) {
			this.#release();
		}
	}

	#release():void {
		if( this.#available===this.#size ) {
			throw new Error( "Semaphore.release() trying to release when all permits are available." );
		}
		this.#available++;
		this.#next();
	}



	/**
	 * Releases permission back to this semaphore. Alias for {@link Semaphore.release}.
	 */
	public signal(): void;
	public signal( count:number ): void;
	public signal( count:number=1 ): void {
		return this.release( count );
	}




	/**
	 * Waits for permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete. Alias for {@link Semaphore.acquire}.
	 */
	public async wait(): Promise<number>;
	public async wait( count: number ): Promise<number>;
	public async wait( count: number, timeoutMs: number ): Promise<number>;
	public async wait( count: number, signal: AbortSignal ): Promise<number>;
	public async wait( count: number, signal: AbortSignal, timeoutMs: number ): Promise<number>;
	public async wait( options: AcquireOptions  ): Promise<number>;
	
	public async wait( param1?: AcquireOptions|number, param2?:AbortSignal|number, param3?:number ): Promise<number> {
		return this.acquire( param1 as number, param2 as AbortSignal, param3 as number );
	}
}

/**
 * A binary (size=1) {@link Semaphore}.  Only one segment of code can have access to it at a time.
 */
export class Mutex extends Semaphore {
	constructor() {
		super( 1 );
	}	
}

/**
 * Tests if a value is a counting number, an integer greater than zero.
 * 
 * @param n value being tested
 * @returns true if n is a counting number, otherwise false
 */
function isCountingNumber( n:number ):boolean {
	return Number.isInteger(n)===true && n>0;
}
