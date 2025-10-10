import type { TaskQueue } from "./TaskQueue";

export abstract class AbstractTaskQueue<T> implements TaskQueue<T> {
    abstract get length(): number;
    abstract set length(n: number);

    *[Symbol.iterator](): Iterator<T, any, any> {
        for (let i = 0; i < this.length; i++) {
            yield this.at(i) as T;
        }
    }

    abstract at(n: number): T | undefined;
    abstract push(item: T): void;
    abstract shift(): T | undefined;
}