const { AbortController } = require( "node-abort-controller" );

const { Semaphore } = require("..");

function sleep( ms ) { return new Promise( resolve => setTimeout( resolve, ms ) ); }

( async function() {
    const sem = new Semaphore(9);
    const abortController = new AbortController();
    const abortController2 = new AbortController();

    const promises = [ ...new Array(sem.size-1) ].map( async ( x, idx ) => {
        try { return await sem.acquire( 2+idx, idx===3 ? abortController2.signal : abortController.signal, idx<5 ? 8100 : undefined ).then( n => console.log( "Resolved %j", n )); }
        catch( err ) { console.error( "Error Caught: %j", err.message ); }
        finally { promises[idx] = undefined; }
    } );

    await sleep( 1000 );
    console.log( sem.queue.map( entry => ( { remaining:entry.remaining, size:entry.size } ) ) );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );


    await sleep( 1000 );
    console.log( "Aborting size=5" );
    abortController2.abort();
    console.log( "Finished Aborting" );


    await sleep( 1000 );
    console.log( sem.queue.map( entry => ( { remaining:entry.remaining, size:entry.size } ) ) );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );


    await sleep( 1000 );
    console.log( "Shrinking " );
    sem.size = 7;
    console.log( "Finished Shrinking" );


    await sleep( 1000 );
    console.log( sem.queue.map( entry => ( { remaining:entry.remaining, size:entry.size } ) ) );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );


    await sleep( 1000 );
    console.log( "Growing" );
    sem.size = 9;
    console.log( "Finished Growing" );


    await sleep( 1000 );
    console.log( sem.queue.map( entry => ( { remaining:entry.remaining, size:entry.size } ) ) );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );


    await sleep( 1000 );
    console.log( "Timing Out" );
    await sleep( 500 );
    console.log( "Finished Timing Out" );


    await sleep( 500 );
    console.log( sem.queue.map( entry => ( { remaining:entry.remaining, size:entry.size } ) ) );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );


    await sleep( 1000 );
    console.log( "Clearing Queue" );
    sem.clearQueue();
    console.log( "Finished Clearing Queue" );


    await sleep( 1000 );
    console.log( sem.queue.map( entry => ( { remaining:entry.remaining, size:entry.size } ) ) );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );

} )();
