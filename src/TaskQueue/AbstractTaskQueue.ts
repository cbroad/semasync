import { TaskQueue } from "./TaskQueue";

export abstract class AbstractTaskQueue<T> implements TaskQueue<T> {
    abstract get empty(): boolean;
    abstract get size(): number;

    *[Symbol.iterator](): Iterator<T, any, any> {
        let arr = this.toArray();
        yield* arr;
    }

    abstract clear(): void;
    abstract enqueue(item: T): void;
    abstract dequeue(): T | undefined;
    abstract peek(): T | undefined;
    abstract toArray(): T[];
}