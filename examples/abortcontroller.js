const { AbortController } = require("node-abort-controller");

const { AbortableSemaphore: Semaphore, ArrayQueue, CircularBuffer, LinkedListQueue } = require("..");

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async function () {
    const sem = new Semaphore(3);
    const abortControllers = [new AbortController(), new AbortController()];

    const promises = [...new Array(100)].map(async (x, idx) => {
        const count = (idx % 3) + 1
        try {
            let release = await sem.acquire(count, abortControllers[idx % 2].signal, idx > 50 ? 60000 : undefined)
            try {
                console.log("Resolved[%j] %j", idx, count);
                await sleep(200 * Math.random());
            } finally { release(count); }
        } catch (err) { console.error("Err[%j]: %j", idx, err.message); }
        finally {
            promises[idx] = undefined;
            console.log("sem.waiting=", sem.waiting);
        }
    });


    console.log(abortControllers[1]);
    sleep(5000)
        .then(() => abortControllers[1].abort())
        .then(() => console.log(abortControllers[1]));

    await Promise.allSettled(promises);
    console.log(abortControllers[1]);


})();

function transformQueue(sem) {
    return sem.queue
        .map(transformEntry);
}

function transformEntry(entry) {
    return {
        remaining: entry.requested - entry.acquired,
        size: entry.requested,
    };
}