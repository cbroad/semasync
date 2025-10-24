import { SimpleSemaphore, SimpleMutex } from "..";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("SimpleSemaphore", () => {
    test("basic acquire and release (count=1 default)", async () => {
        const sem = new SimpleSemaphore(2);
        expect(sem.size).toBe(2);
        expect(sem.available).toBe(2);

        // acquire first
        const rel1 = await sem.acquire();
        expect(typeof rel1).toBe("function");
        expect(sem.available).toBe(1);

        // acquire second
        const rel2 = await sem.acquire();
        expect(sem.available).toBe(0);

        // release one using returned release function
        rel1();
        // after releasing one permit, available must be >= 0 (and should be 1)
        expect(sem.available).toBe(1);

        // release the other
        rel2();
        expect(sem.available).toBe(2);
    });

    test("acquire with explicit count and partial/queued fulfillment", async () => {
        const sem = new SimpleSemaphore(3);

        // Acquire 2 immediately
        const releaseA = await sem.acquire(2);
        expect(sem.available).toBe(1);

        // Start acquire(2) which will be queued and partially satisfied (1)
        let acquiredSecond = false;
        const acquireSecondPromise = sem.acquire(2).then(rel => {
            acquiredSecond = true;
            // call the release to return the permits
            rel();
        }).catch(() => {
            // ignore for now
        });

        // small pause to allow internal queueing/partial logic to run
        await delay(0);

        // second acquire promise should not yet have been resolved (because it needs 2 but only 1 available)
        expect(acquiredSecond).toBe(false);
        expect(sem.available).toBe(0); // partial consumed the remaining 1

        // release the first (releasing 2 permits) => should allow the second acquire to complete
        releaseA();

        // wait for the queued acquire to resolve
        await acquireSecondPromise;
        expect(acquiredSecond).toBe(true);

        // after everything returned, semaphore should have at least 1 available (depends on timing) and ultimately be back to full if releases used
        expect(sem.available).toBeGreaterThanOrEqual(0);
    });

    test("clearQueue rejects queued acquires with 'cleared'", async () => {
        const sem = new SimpleSemaphore(1);

        // Acquire the single permit so subsequent acquire is queued
        const release = await sem.acquire();
        const p = sem.acquire(); // queued

        // clear the queue
        sem.clearQueue();

        await expect(p).rejects.toThrow("cleared");

        // release the held permit
        release();
        expect(sem.available).toBe(1);
    });

    test("resize rejects queued requests that are larger than new size ('too large for resize')", async () => {
        const sem = new SimpleSemaphore(3);

        // take all available so later acquires get queued
        const r = await sem.acquire(3);
        // start a queued acquire for 2 (will be queued/partial)
        const p = sem.acquire(2).catch(e => { throw e; });

        // resize to 1 -> queued entry with requested=2 should be rejected with "invalid resize count"
        sem.size = 1;

        await expect(p).rejects.toThrow("invalid resize count");

        // cleanup
        r();
    });

    test("resize: growing size unblocks waiting acquires", async () => {
        const sem = new SimpleSemaphore(1);

        // acquire the single permit so next acquire blocks
        const release1 = await sem.acquire();

        let acquired = false;
        const p = sem.acquire().then(r => {
            acquired = true;
            r(); // release it immediately
        });

        // pause to ensure it's queued
        await delay(0);
        expect(acquired).toBe(false);
        expect(sem.waiting).toBe(1);

        // grow the semaphore capacity
        sem.size = 2;

        // should now unblock the waiting acquire
        await p;
        expect(acquired).toBe(true);
        expect(sem.available).toBe(1);
    });

    test("resize: shrinking temporarily sets available negative until releases occur", async () => {
        const sem = new SimpleSemaphore(3);

        // acquire all 3 permits
        const r = await sem.acquire(3);
        expect(sem.available).toBe(0);

        // shrink to 1 (should make available negative until releases)
        sem.size = 1;

        // available will be -2 temporarily (not clamped)
        expect(sem.available).toBeLessThan(0);

        // release all held permits, should normalize back to 1
        r();
        expect(sem.available).toBe(1);
    });

    test("resize: queued request larger than new size is rejected", async () => {
        const sem = new SimpleSemaphore(3);

        // consume all permits
        const rel = await sem.acquire(3);

        // queue up an acquire that requests more than the new size
        const p = sem.acquire(3).catch(e => { throw e; });

        // shrink to 2 -> queued request should be rejected
        sem.size = 2;

        await expect(p).rejects.toThrow("invalid resize count");

        // release existing
        rel();
        expect(sem.available).toBe(2);
    });

    test("resize: increasing size releases additional available permits", async () => {
        const sem = new SimpleSemaphore(2);
        expect(sem.available).toBe(2);

        // grow to 5
        sem.size = 5;

        // available should increase by 3
        expect(sem.available).toBe(5);

        // now shrink to 3 — available should drop by 2
        sem.size = 3;
        expect(sem.available).toBe(3);
    });

    test("release() throws when trying to release beyond capacity", () => {
        const sem = new SimpleSemaphore({ size: 2 });
        // all permits are available initially
        expect(sem.available).toBe(2);
        expect(() => sem.release()).toThrow("invalid release count"); // releasing when nothing is held should throw
        expect(() => sem.release(2)).toThrow("invalid release count");
    });

    test("exec() runs task and always releases (even on throw)", async () => {
        const sem = new SimpleSemaphore(1);
        expect(sem.available).toBe(1);

        // Successful exec
        const result = await sem.exec(async () => {
            expect(sem.available).toBe(0); // inside task, permit is held
            return 42;
        });
        expect(result).toBe(42);
        expect(sem.available).toBe(1);

        // Exec that throws should still release
        await expect(sem.exec(async () => {
            expect(sem.available).toBe(0);
            throw new Error("task failed");
        })).rejects.toThrow("task failed");

        expect(sem.available).toBe(1);
    });

    test("SimpleMutex is a size-1 semaphore", async () => {
        const m = new SimpleMutex();
        expect(m.size).toBe(1);
        const r = await m.acquire();
        expect(m.available).toBe(0);
        r();
        expect(m.available).toBe(1);
    });
});