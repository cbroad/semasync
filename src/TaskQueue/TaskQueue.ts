export interface TaskQueue<T> extends Iterable<T> {
    empty: boolean;
    size: number;

    clear(): void;
    enqueue(item: T): void;
    dequeue(): T | undefined;
    peek(): T | undefined;
    toArray(): T[];
}