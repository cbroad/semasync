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
 * @property {number} acquired
 * @property {number} count
 * @property {(reason?:any)=>void} reject
 * @property {(value:number|PromiseLike<number>)=>void} resolve
 */
type QueueEntry = {
	acquired  : number,
	reject    : (reason?:any)=>void,
	requested : number,
	resolve   : (value:number|PromiseLike<number>)=>void,
};

/**
 * A device used to control access to a shared resource by multiple actors.
 */
export class Semaphore {

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
	public get size():number {
		return this.#size;
	}

	public get waiting():number {
		return this.#queue.reduce( ( R, queueEntry ) => R+(queueEntry.requested - queueEntry.acquired) , 0);
	}

	/**
	 * Sets the size of the execution pool associated with this semaphore.
	 */
	public set size( size:number ) {
		if( size<=0 ) {
			throw new Error( "Semaphore size must be >0." );
		}
		const nextCount = this.#available===0 && size>this.#size ? Math.min( this.waiting, (size-this.#size) ) : 0;
		this.#available = Math.max( 0, this.#available + (size-this.#size) );
		this.#size = size;
		for( let i=0 ; i<nextCount ; i++ ) {
			this.#next();
		}
		this.#queue.forEach( queueEntry => { if( queueEntry.requested>this.#size ) { queueEntry.reject( new Error( "too large for resize" ) ); } } );
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
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
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
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
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
	 * @throws "aborted" when signaled.
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out.
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
	 */
	public async acquire( count: number, signal: AbortSignal, timeoutMs: number ): Promise<number>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {AcquireOptions} [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<number>} Promise which resolves the number of leases acquired once the acquisition is complete
	 * @throws "aborted" when signaled
	 * @throws "cleared" cleared out of queue using {@link Semaphore.clearQueue}.
	 * @throws "timed out" when timing out
	 * @throws "too large for resize" if semaphore is resized to smaller than count.
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

		return this.#acquire( { count, signal, timeoutMs } );
	 }


	/**
	 * Private single acquire function without any parameter checking.
	 * 
	 * @param {AcquireOptions} options AcquireOptions minus the count value, count is one with this function.
	 * @returns {Promise<number>} promise that resolves once acquisition is made.
	 */
	async #acquire( options: AcquireOptions ): Promise<number> {
		const { count, signal, timeoutMs } = options;

		const queueEntry: QueueEntry = { acquired:0, reject:()=>{}, requested:count!, resolve:(value:number|PromiseLike<number>)=>{} };
		const finalizers:(()=>void)[] = [];

		if( signal!==undefined )  {
			if( (signal as any).eventEmitter !== undefined ) {
				const emitter = ( (signal as any).eventEmitter as EventEmitter );
				const incremented = emitter.listenerCount( "abort" )>=emitter.getMaxListeners();
				emitter.setMaxListeners( emitter.listenerCount( "abort" )+1 );
				finalizers.push( () => emitter.setMaxListeners( emitter.getMaxListeners()-1 ) );
			}
			
			function onAbort() { queueEntry.reject( new Error( "aborted" ) ); }
			signal.addEventListener( "abort", onAbort );
			finalizers.push( () => signal.removeEventListener( "abort", onAbort ) );
		}

		if( timeoutMs!==undefined ) {
			const timer = setTimeout( () => queueEntry.reject( new Error( "timed out" ) ), timeoutMs );
			finalizers.push( () => clearTimeout( timer ) );
		}

		return new Promise<number>( ( resolve, reject ) => {
				queueEntry.reject = reject;
				queueEntry.resolve = resolve;
				this.#queue.push( queueEntry );
				this.#next();
			} ).catch( err => {
				this.#queue.splice( this.#queue.indexOf( queueEntry ), 1 );
				if( queueEntry.acquired===queueEntry.requested ) {
					this.release( queueEntry.acquired );
				}
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
	 *                                      used to block execution before the semaphore is signaled again.
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T> ): Promise<T>;

	/**
	 * 
	 * @param {()=>T|PromiseLike<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                      used to block execution before the semaphore is signaled again.
	 * @param {AcquireOptions}  [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws "aborted" if Aborted
	 * @throws "timed out" if timing out
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T>, options: AcquireOptions ): Promise<T>;

	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T>, options?: AcquireOptions ): Promise<T> {

		const count:number = options?.count ?? 1;
		const signal = options?.signal;
		const timeoutMs: number|undefined = options?.timeoutMs ?? undefined;

		if( ! ( typeof task === "function" ) ) {
			throw new Error( "Semaphore.exec() parameter task must be a function." );
		}
		
		// In order to run in loop, exec should be synchronous with acquire, but the actual task should run outside of the thread.

		await this.acquire( { count, signal, timeoutMs } );

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
		if( this.#available>0 && this.#queue.length>0 ) {
			this.#available--;
			const queueEntry = this.#queue[0];
			queueEntry.acquired++;
			if( queueEntry.acquired===queueEntry.requested ) {
				this.#queue.shift();
				queueEntry.resolve( queueEntry.requested );
			}
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
