/**
 * Comprehensive Jest test suite for TaskQueue implementations.
 * Covers ArrayTaskQueue, LinkedListQueue, and CircularBufferQueue.
 */

import { TaskQueue, ArrayQueue, CircularBufferQueue, LinkedListQueue } from "..";

// Type alias for queue factories
type Factory = <T>() => TaskQueue<T>;

/**
 * Shared Jest test suite for TaskQueue implementations.
 */
function runTaskQueueTests(name: string, factory: Factory) {
    describe(`${name}`, () => {
        let q: TaskQueue<number>;

        beforeEach(() => {
            q = factory<number>();
        });

        test("starts empty", () => {
            expect(q.length).toBe(0);
            expect(q.shift()).toBeUndefined();
            expect([...q]).toEqual([]);
        });

        test("push() increases length and retains order", () => {
            q.push(10);
            q.push(20);
            q.push(30);
            expect(q.length).toBe(3);
            expect(q.at(0)).toBe(10);
            expect(q.at(1)).toBe(20);
            expect(q.at(2)).toBe(30);
        });

        test("shift() removes in FIFO order", () => {
            q.push(1);
            q.push(2);
            q.push(3);
            expect(q.shift()).toBe(1);
            expect(q.shift()).toBe(2);
            expect(q.shift()).toBe(3);
            expect(q.shift()).toBeUndefined();
            expect(q.length).toBe(0);
        });

        test("handles interleaved push/shift correctly", () => {
            q.push(1);
            q.push(2);
            expect(q.shift()).toBe(1);
            q.push(3);
            q.push(4);
            expect(q.shift()).toBe(2);
            expect(q.shift()).toBe(3);
            expect(q.shift()).toBe(4);
            expect(q.length).toBe(0);
        });

        test("at() handles bounds properly", () => {
            q.push(5);
            q.push(6);
            expect(q.at(-3)).toBeUndefined();
            expect(q.at(-1)).toBe(6);
            expect(q.at(0)).toBe(5);
            expect(q.at(1)).toBe(6);
            expect(q.at(2)).toBeUndefined();
        });

        test("is iterable in FIFO order", () => {
            q.push(1);
            q.push(2);
            q.push(3);
            const arr = [...q];
            expect(arr).toEqual([1, 2, 3]);
        });

        test("iteration does not modify the queue", () => {
            q.push(1);
            q.push(2);
            for (const _ of q) {
                // noop
            }
            expect(q.length).toBe(2);
            expect(q.shift()).toBe(1);
            expect(q.shift()).toBe(2);
        });

        test("handles shifting from empty queue gracefully", () => {
            expect(q.shift()).toBeUndefined();
            expect(q.length).toBe(0);
            q.push(42);
            expect(q.shift()).toBe(42);
            expect(q.shift()).toBeUndefined();
        });

        test("supports high-volume push/shift cycles", () => {
            const N = 10_000;
            for (let i = 0; i < N; i++) q.push(i);
            expect(q.length).toBe(N);

            // halfway shift
            for (let i = 0; i < N / 2; i++) {
                const val = q.shift();
                expect(val).toBe(i);
            }
            expect(q.length).toBe(N / 2);

            // refill
            for (let i = N; i < N * 1.5; i++) q.push(i);
            expect(q.length).toBeGreaterThan(0);
            expect([...q].length).toBe(q.length);
        });

        test("maintains integrity after many wraparounds", () => {
            // Stresses CircularBufferQueue’s wrapping logic
            const N = 5000;
            for (let i = 0; i < N; i++) {
                q.push(i);
                q.shift();
            }
            expect(q.length).toBe(0);
            q.push(123);
            expect(q.shift()).toBe(123);
        });

        test("allows iteration while queue is mutated (live view behavior)", () => {
            q.push(1);
            q.push(2);
            const iterated: number[] = [];
            for (const item of q) {
                iterated.push(item);
                if (item === 1) q.push(3);
            }
            // Depending on semantics, most queues iterate over snapshot
            expect(iterated).toEqual([1, 2, 3]);
            expect([...q]).toEqual([1, 2, 3]);
        });

        test("correctly reports length after alternating operations", () => {
            for (let i = 0; i < 5; i++) q.push(i);
            q.shift();
            q.shift();
            q.push(5);
            q.push(6);
            expect(q.length).toBe(5);
            expect([...q]).toEqual([2, 3, 4, 5, 6]);
        });

        test("preserves data consistency under random operations", () => {
            const ref: number[] = [];
            for (let i = 0; i < 1000; i++) {
                if (Math.random() < 0.5 || ref.length === 0) {
                    const val = i;
                    q.push(val);
                    ref.push(val);
                } else {
                    const a = q.shift();
                    const b = ref.shift();
                    expect(a).toBe(b);
                }
            }
            expect([...q]).toEqual(ref);
        });
    });
}

// Run the shared suite for all TaskQueue implementations
runTaskQueueTests("ArrayQueue", () => new ArrayQueue());
runTaskQueueTests("LinkedListQueue", () => new LinkedListQueue());
runTaskQueueTests("CircularBufferQueue", () => new CircularBufferQueue());
