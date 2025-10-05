import { AbstractTaskQueue } from "./AbstractTaskQueue";
import { TaskQueue } from "./TaskQueue";

const MIN_CAPACITY = 16;

export class CircularBuffer<T> extends AbstractTaskQueue<T> implements TaskQueue<T> {

    readonly [Symbol.toStringTag]: string = "CircularBuffer";

    protected _buffer: (T | undefined)[];
    protected _capacity: number;
    protected _head: number = 0;
    protected _size: number = 0;
    protected _tail: number = 0;

    get capacity(): number {
        return this._capacity;
    }

    get empty(): boolean {
        return this._size === 0;
    }

    get full(): boolean {
        return this._size === this._capacity;
    }

    get size(): number {
        return this._size;
    }

    constructor();
    constructor(capacity: number);
    constructor(capacity: number = MIN_CAPACITY) {
        super();
        this._capacity = capacity;
        this._buffer = new Array<T | undefined>(this._capacity);
    }

    clear(): void {
        this._buffer = new Array<T | undefined>(this._capacity);
        this._head = 0;
        this._size = 0;
        this._tail = 0;
    }

    dequeue(): T | undefined {
        const item: T | undefined = this.peek();
        if (item === undefined) {
            return undefined;
        }
        this._buffer[this._head] = undefined;
        this._head = (this._head + 1) % this._capacity;
        this._size--;
        return item;
    }

    enqueue(item: T): void {
        if (this.full) {
            throw new Error("CircularBuffer is full.");
        }
        this._buffer[this._tail] = item;
        this._tail = (this._tail + 1) % this._capacity;
        this._size++;
    }

    peek(): T | undefined {
        if (this.empty) {
            return undefined
        }
        return this._buffer[this._head] as T; // item is guaranteed to be defined here
    }

    // toArray(): T[] {
    //     return this._copyToArray();
    // }



    toArray(): T[];
    toArray(arr: T[]): T[];
    toArray(arr: (T | undefined)[]): (T | undefined)[];
    toArray(arr: (T | undefined)[] = new Array<T>(this._size)): (T | undefined)[] {
        if (arr.length < this._size) {
            throw new Error("provided array is too small to copy buffer data");
        }
        let j = this._head;
        for (let i = 0; i < this._size; i++) {
            arr[i] = this._buffer[j] as T;
            j = (j + 1) % this._size;
        }
        return arr;
    }
}

export class GrowingCircularBuffer<T> extends CircularBuffer<T> {

    readonly [Symbol.toStringTag]: string = "GrowingCircularBuffer";

    get full(): boolean {
        return false;
    }

    constructor() {
        super(MIN_CAPACITY);
    }

    #grow(): void {
        const newCapacity = this._capacity * 2;
        this._resize(newCapacity);
    }

    clear(): void {
        this._capacity = MIN_CAPACITY;
        super.clear();
    }

    enqueue(item: T): void {
        super.enqueue(item);
        if (this.full) {
            this.#grow();
        }
    }

    protected _resize(newCapacity: number): void {
        const newBuffer = new Array<T | undefined>(newCapacity);
        this._buffer = this.toArray(newBuffer);
        this._head = 0;
        this._tail = this._size;
        this._capacity = newCapacity;
    }
}


export class DynamicCircularBuffer<T> extends GrowingCircularBuffer<T> {

    readonly [Symbol.toStringTag]: string = "DynamicCircularBuffer";

    constructor() {
        super();
    }

    #shrink(): void {
        const newCapacity = this._capacity / 2;
        this._resize(newCapacity);
    }

    dequeue(): T | undefined {
        const item: T | undefined = super.dequeue();
        if (this._size <= this._capacity / 4 && this._capacity > MIN_CAPACITY) {
            this.#shrink();
        }
        return item;
    }

}