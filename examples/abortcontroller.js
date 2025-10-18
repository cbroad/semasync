const { AbortController } = require("node-abort-controller");

const { AbortableSemaphore: Semaphore, ArrayQueue, CircularBuffer, LinkedListQueue } = require("..");

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async function () {
    const sem = new Semaphore(3);
    const abortController = new AbortController();

    const promises = [...new Array(100)].map(async (x, idx) => {
        const count = (idx % 3) + 1
        try {
            let release = await sem.acquire({
                signal: idx % 2 ? abortController.signal : undefined,
                size: count,
                // timeoutMs: idx > 50 ? 6000 : undefined,
            })
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


    console.log(abortController);
    sleep(2000)
        .then(() => abortController.abort())
        .then(() => console.log(abortController));

    await Promise.allSettled(promises);
    console.log(abortController);


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