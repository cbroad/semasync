const { AbortController } = require("node-abort-controller");

const { Semaphore } = require("..");

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async function () {
    const sem = new Semaphore(9);
    const abortController = new AbortController();
    let timeoutDuration = 4000;

    const releaseFunctions = [];

    const promises = [...new Array(sem.size - 1)].map(async (x, idx) => {
        const count = 2 + idx;
        try {
            const release = await sem.acquire({
                count,
                signal: count === 7 ? abortController.signal : undefined,
                timeoutMs: timeoutDuration
            });
            console.log("Acquired %j", count)
            releaseFunctions.push(() => {
                release();
                console.log("Released %j", count);
            });;
        } catch (err) { console.error("Error Caught: %j", err.message); }
        finally { promises[idx] = undefined; }
    });


    console.log("Initial State: Queue=", transformQueue(sem));
    console.log("Initial State: Promisees=", promises);

    timeoutDuration -= 1000;
    await sleep(1000);
    console.log(transformQueue(sem));
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });
    console.log(promises);


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log("Aborting size=5");
    abortController.abort();
    console.log("Finished Aborting");


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log(transformQueue(sem));
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });
    console.log(promises);


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log("Shrinking")
    console.log("sem.size=7");
    sem.size = 7;
    console.log("Finished Shrinking");


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log(transformQueue(sem));
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });
    console.log(promises);


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log("Growing");
    console.log("sem.size=9");
    sem.size = 9;
    console.log("Finished Growing");


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log(transformQueue(sem));
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });
    console.log(promises);


    timeoutDuration -= 1000;
    await sleep(1000);
    console.log("Timing Out in %dms", timeoutDuration);
    await sleep(Math.max(timeoutDuration + 100, 0));
    console.log("Finished Timing Out");


    await sleep(500);
    console.log(transformQueue(sem));
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });
    console.log(promises);


    await sleep(1000);
    console.log("Clearing Queue");
    sem.clearQueue();
    console.log("Finished Clearing Queue");


    await sleep(1000);
    console.log();
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });
    console.log(promises);
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });

    releaseFunctions.forEach(f => f());
    console.log("sem: %j", { available: sem.available, size: sem.size, waiting: sem.waiting });

})();

function transformQueue(sem) {
    return [...sem.queue]
        .map(transformEntry);
}

function transformEntry(entry) {
    return {
        remaining: entry.requested - entry.acquired,
        size: entry.requested,
    };
}