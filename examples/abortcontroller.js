const { AbortController } = require( "node-abort-controller" );

const { Semaphore } = require("..");

function sleep( ms ) { return new Promise( resolve => setTimeout( resolve, ms ) ); }

( async function() {
    const sem = new Semaphore(9);
    const abortController = new AbortController();

    const promises = [ ...new Array(sem.size+1) ].map( async ( x, idx ) => {
        try { await sem.acquire( 2, abortController.signal ); }
        catch( err ) { console.error( "Error Caught: %j", err.message ); }
        finally { promises[idx] = undefined; }
    } );

    await sleep( 1000 );
    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );

    await sleep( 1000 );
    console.log( "Aborting" );
    abortController.abort();
    console.log( "Finished Aborting" );

    await sleep( 1000 );

    console.log( "Waiting:%j", sem.waiting );
    console.log( promises );

} )();
