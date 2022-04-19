/* This is a simple code which will cause */
const { Mutex, Semaphore } = require( ".." );

/* main() */
( async () => {
    await NoControl();
    await OneByOne();
    await ThreeConcurrently_PromiseAll();
    await ThreeConcurrently_Looped();
})();



/* First run, all promises will be fulfilled in parallel. */
async function NoControl() {
    console.log( "No control" );
    await Promise.all( [...new Array(100)].map( async ( x, idx ) => {
            await asyncTest(idx);
        } ) );
}


/* Second run, all promises will be fulfilled one-by-one. */
async function OneByOne() {
    console.log( "Using mutex ( semaphore of size 1 )" );
    const mutex = new Mutex(); // Same as "new Semaphore( 1 )"
    await Promise.all( // Wait until all executions have completed.
        [...new Array(100)].map( async ( x, idx ) =>  // Running 100x
            mutex.exec( async () => { // If exec is used, acquire and release are automatic
                    await asyncTest(idx);
                } )
        )
    );
}


/* Third run, all promises will be fulfilled with 3 concurrent executions.  Uses Promise.all to control execution. */
async function ThreeConcurrently_PromiseAll() {
    console.log( "Using semaphore of size 3" );
    const sem = new Semaphore( 3 );
    await Promise.all( // Wait until all executions have completed.
        [...new Array(100)].map( async ( x, idx ) =>  // Running 100x
            sem.exec( async () => { // If exec is used, acquire and release are automatic
                    await asyncTest(idx);
                } )
        )
    );
}

/* Fourth run, all promises will be fulfilled with 3 concurrent executions.  Uses a loop to control execution. */
async function ThreeConcurrently_Looped() {
    console.log( "Using semaphore of size 3" );
    const sem = new Semaphore( 3 );

    for( let i=0 ; i<100 ; i++ ) {
        await sem.acquire(); // Implicit calls to acquire and release instead of using exec().
        asyncTest(i).then( () => sem.release() ); // Not using await allows us to execute simultaneously.
    }
    await sem.acquire( sem.size ); // Waiting until the all tasks have completed.
}

/* Simple function which generates an Promise which resolves after a random interval up to 2 seconds. */
async function asyncTest( runNumber) {
    console.log( "Running   number %d.", runNumber )
    await new Promise( (resolve, reject) => {setTimeout( resolve, 2000*Math.random() ); } );
    console.log( "Completed number %d.", runNumber )
}