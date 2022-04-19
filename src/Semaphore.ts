/**
 * Options for functions acquiring semaphores.
 * 
 * @typedef {Object} AcquireOptions
 * @property {number}  [count=1]          - How many permits do you need to acquire for this execution? <br />
 *                                          This will allow you to give some code higher priority / a wider lane <br />
 *                                          than other. 
 * @property {number}  [timeoutMs]        - Number of milliseconds before acquisition is aborted and exec does not procede.<br />
 *                                          This does not timeout the execution once it has begun, only timeout before it begins.
 */
export type AcquireOptions = { count?:number, timeoutMs?:number};

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
		if( ! ( typeof size==="number" && Number.isInteger(size)===true && size>0 ) ) {
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
	 * @returns {Promise<void>} Promise which resolves once the acquisition is complete
	 */
	public async acquire(): Promise<void>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {number} [count] - How many permits do you need to acquire for this execution? <br />
 	 *                           This will allow you to give some code higher priority / a wider lane <br />
 	 *                           than other. 
	 * @returns {Promise<void>} Promise which resolves once the acquisition is complete
	 */
	public async acquire( count: number ): Promise<void>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param    {number} [count]     - How many permits do you need to acquire for this execution? <br />
 	 *                                  This will allow you to give some code higher priority / a wider lane <br />
 	 *                                  than other. 
	 * @property {number} [timeoutMs] - Number of milliseconds before acquisition is aborted and exec does not procede.<br />
	 *                                  This does not timeout the execution once it has begun, only timeout before it begins.
	 * @returns {Promise<void>} Promise which resolves once the acquisition is complete
	 * @throws "timed out" when timing out
	 */
	public async acquire( count: number, timeoutMs: number ): Promise<void>;

	/**
	 * Acquires permission for this semaphore.  Returns a promise which
	 * resolves once the acquisition is complete.
	 * 
	 * @async
	 * @param {AcquireOptions} [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<void>} Promise which resolves once the acquisition is complete
	 * @throws "timed out" when timing out
	 */
	public async acquire( options: {count?:number, timeoutMs?: number }  ): Promise<void>;

	public async acquire( param1?: {count?:number, timeoutMs?: number }|number, param2?:number ): Promise<void> {
		const count =     ( (typeof param1==="object") ? (param1?.count)     : (param1) ) ?? 1;
		const timeoutMs = ( (typeof param1==="object") ? (param1?.timeoutMs) : (param2) ) ?? undefined;

		if( ! ( typeof count==="number" && Number.isInteger(count)===true && count>0 && count<=this.size ) ) {
			throw new Error( "Semaphore.acquire() option count must be a positive integer or left undefined." );
		}

		if( ! ( timeoutMs===undefined || ( typeof timeoutMs==="number" && Number.isInteger(timeoutMs)===true ) && timeoutMs>0 ) ) {
			throw new Error( "Semaphore.acquire() option timeoutMs must be a positive integer or left undefined." );
		}

		if( count===1 ) {
			// let queueEntry: { resolve: ( value: void|PromiseLike<void> ) => void, reject: (reason?:any)=>void }|undefined = undefined;
			let timer: NodeJS.Timeout|undefined = undefined;
			return new Promise<void>( ( resolve, reject ) => {
					const queueEntry = { reject, resolve };
					if( timeoutMs ) {
						timer = setTimeout( () => {
								this.#queue = this.#queue.splice( this.#queue.indexOf( queueEntry ), 1 ); // Remove resolve function from queue
								reject( new Error("timed out") );
							}, timeoutMs );
					}
		
					this.#queue.push( queueEntry );
					this.#next();
				} )
				.then( () => timer && clearTimeout( timer! ) )
			;
		} else {
			let acquired = 0;
			try {
				await Promise.all( [ ...new Array( count ) ].map( () => this.acquire( { timeoutMs } ).then( () => acquired++ ) ) );
			} catch(err) {
				this.release( acquired );
				throw err;
			}
			return;
		}
	 }


	/**
	 * 
	 * @param {()=>T|PromiseLike<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                     used to block execution before the semaphore is signalled again.
	 * @returns {Promise<T>} resolves when task completed.
	 * @throws any thrown values from the task
	 */
	public async exec<T extends unknown>( task: ()=>T|PromiseLike<T> ): Promise<T>;

	/**
	 * 
	 * @param {()=>T|PromiseLike<T>} task - Code to be run.  If this is an asynchronous function, await will <br/>
	 *                                     used to block execution before the semaphore is signalled again.
	 * @param {AcquireOptions}  [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<T>} resolves when task completed.
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
			const { resolve } = this.#queue.shift()!;
			resolve();
		}
	}

	/**
	 * Releases permission back to this semaphore.
	 */
	public release(): void;
	public release( count:number ): void;
	public release( count:number=1 ): void {
		count = count ?? 1;
		if( ! ( typeof count==="number" && Number.isInteger(count)===true && count>0 && count<=this.size ) ) {
			throw new Error( "Semaphore.release() option count must be a positive integer or left undefined." );
		}
		if( count===1 ) {
			if( this.#available===this.#size ) {
				throw new Error( "Semaphore.release() trying to release when all permits are available." );
			}
			this.#available++;
			this.#next();
		} else {
			for( let i=0 ; i<count ; i++ ) {
				this.release( 1 );
			}
		}
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
	 * 
	 * @async
	 * @param {AcquireOptions} [options] - Defined in type {@link AcquireOptions}
	 * @returns {Promise<void>} Promise which resolves once the acquisition is complete
	 * @throws "timed out" when timing out
	 */
	public async wait(): Promise<void>;
	public async wait( options: AcquireOptions ): Promise<void>;
	public async wait( options?: AcquireOptions ): Promise<void> {
		return options ? this.acquire(options) : this.acquire();
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