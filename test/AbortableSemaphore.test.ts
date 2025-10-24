import { AbortableSemaphore, AbortableMutex } from "..";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("AbortableSemaphore", () => {
    afterEach(() => {
        // ensure timers are restored if fake timers used
        try {
            jest.useRealTimers();
        } catch {
            // ignore in environments that don't support jest timers toggling
        }
    });

    test("basic acquire and release (like SimpleSemaphore)", async () => {
        const sem = new AbortableSemaphore(2);
        expect(sem.size).toBe(2);
        const rel1 = await sem.acquire();
        const rel2 = await sem.acquire();
        expect(sem.available).toBe(0);
        rel1();
        rel2();
        expect(sem.available).toBe(2);
    });

    test("acquire with already-aborted signal rejects immediately with 'aborted'", async () => {
        const sem = new AbortableSemaphore(1);
        const ctrl = new AbortController();
        ctrl.abort();
        await expect(sem.acquire({ count: 1, signal: ctrl.signal })).rejects.toThrow("aborted");
    });

    test("acquire with abort signal that fires later rejects queued acquire with 'aborted'", async () => {
        const sem = new AbortableSemaphore(1);

        // hold the only permit so the next acquire is queued
        const release = await sem.acquire();

        const controller = new AbortController();
        const p = sem.acquire({ signal: controller.signal });

        // give microtick
        await delay(0);

        // not acquired yet (queued)
        await expect(Promise.race([p.then(() => true), Promise.resolve(false)])).resolves.toBe(false);

        // abort the request
        controller.abort();

        await expect(p).rejects.toThrow("aborted");

        // cleanup
        release();
    });

    test("acquire times out with 'timed out' when queued longer than timeoutMs", async () => {
        jest.useFakeTimers();
        const sem = new AbortableSemaphore(1);

        // hold the only permit so the next acquire is queued
        const release = await sem.acquire();

        const p = sem.acquire({ timeoutMs: 50 });

        // advance time by less than timeout => still pending
        jest.advanceTimersByTime(30);
        await Promise.resolve(); // allow microtasks
        await expect(Promise.race([p.then(() => true), Promise.resolve(false)])).resolves.toBe(false);

        // advance to trigger timeout
        jest.advanceTimersByTime(20);
        await Promise.resolve(); // allow microtasks

        await expect(p).rejects.toThrow("timed out");

        // cleanup
        release();
        jest.useRealTimers();
    });

    test("exec() respects abort/timeout input validation and releases on finally", async () => {
        const sem = new AbortableSemaphore(1);

        // exec that throws should still release permit
        await expect(sem.exec(async () => {
            throw new Error("boom");
        })).rejects.toThrow("boom");
        expect(sem.available).toBe(1);

        // exec with abort signal that is aborted should reject
        const ctrl = new AbortController();
        ctrl.abort();
        await expect(sem.exec(async () => 1, { signal: ctrl.signal })).rejects.toThrow("aborted");
    });

    test("AbortableMutex is a size-1 semaphore", async () => {
        const m = new AbortableMutex();
        expect(m.size).toBe(1);
        const r = await m.acquire();
        expect(m.available).toBe(0);
        r();
        expect(m.available).toBe(1);
    });
});