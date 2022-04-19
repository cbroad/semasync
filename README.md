# semasync
Simple semaphore for use with asynchronous (promise-based) functions to help control execution.

## Isn't JavaScript single-threaded?  Why do I need a semaphore?

A semaphore is device used to control access to a shared resource by multiple threads.  This is generally done in order to maintain consistency and sanity in a multithreaded environment.  Why is this relevant in JavaScript's single threaded environment?

These days, JavaScript's single threaded nature can be compared to a computer with a single CPU core.  While it is possible for a javascript program to run through, one command to the next, without stopping, it's more likely that your program will make use of JavaScript's event loop and multiple contexts.  This allows JavaScript to work in a more dynamic and responsive manner.  Examples of this behavior are responding to user events, such as clicks and keyboard events on a webpage, timers, system I/O in Node.js and network activity in both the web and node.js evironments.

So, why do we need a semaphore construct in JavaScript?  Because at times, we still need to isolate the actions of these execution contexts to provide a consistent, uncongested and predictable experience.

## Examples

```
/* A simple example showing code running a moderate amount of asynchronous
 * tasks without and then with a semaphore.
 */
const { Mutex, Semaphore } = require( "semasync" );

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
    await sem.acquire( 3 ); // Waiting until the last three have finished.
}


/* Simple function which generates an Promise which resolves after a random interval up to 2 seconds. */
async function asyncTest( runNumber) {
    console.log( "Running   number %d.", runNumber )
    await new Promise( (resolve, reject) => {setTimeout( resolve, 2000*Math.random() ); } );
    console.log( "Completed number %d.", runNumber )
}
```
