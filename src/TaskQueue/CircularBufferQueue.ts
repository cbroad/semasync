import { AbstractTaskQueue } from "./AbstractTaskQueue";

const MIN_CAPACITY = 16;

export class CircularBuffer<T> extends AbstractTaskQueue<T> {

    readonly [Symbol.toStringTag]: string = "CircularBuffer";

    #buffer: (T | undefined)[];
    #count: number = 0;
    #head: number = 0;
    #initialCapacity: number;
    #tail: number = 0;

    protected get capacity(): number {
        return this.#buffer.length;
    }

    get length(): number {
        return this.#count;
    }

    set length(n: number) {
        if (n < 0 || n > this.#count) { throw new RangeError("Invalid array length"); }
        if (n === 0) {
            this.#count = 0;
            this.#buffer = new Array<T | undefined>(this.#initialCapacity);
            this.#head = 0;
            this.#tail = 0;
        }
        else {
            if (n < this.#count) {
                for (let i = n; i < this.#count; i++) {
                    this.#buffer[(this.#head + i) % this.#buffer.length] = undefined;
                }
            }
        }
        this.#tail = (this.#head + n) % this.#buffer.length;
        this.#count = n;
    }

    constructor();
    constructor(capacity: number);
    constructor(capacity: number = MIN_CAPACITY) {
        super();
        this.#initialCapacity = capacity;
        this.#buffer = new Array<T | undefined>(capacity);
    }

    #copyToArray(arr: (T | undefined)[]): (T | undefined)[] {
        if (arr.length < this.length) {
            throw new Error("provided array is too small to copy buffer data");
        }
        for (let i = 0; i < this.length; i++) {
            arr[i] = this.#buffer[(this.#head + i) % this.#buffer.length] as T;
        }
        return arr;
    }

    protected _resize(newCapacity: number): void {
        this.#buffer = this.#copyToArray(new Array<T | undefined>(newCapacity));
        this.#head = 0;
        this.#tail = this.length;
    }

    at(n: number): T | undefined {
        if (n >= this.#count || n < -this.#count) {
            return undefined;
        }

        if (n < 0) {
            n = this.#count + n;
        }

        return this.#buffer[(this.#head + n) % this.#buffer.length];

    }

    push(item: T): void {
        if (this.capacity === this.length) {
            throw new Error("CircularBuffer is full.");
        }
        this.#buffer[this.#tail] = item;
        this.#tail = (this.#tail + 1) % this.#buffer.length;
        this.#count++;
    }

    shift(): T | undefined {
        const item: T | undefined = this.at(0);
        if (item === undefined) {
            return undefined;
        }
        this.#buffer[this.#head] = undefined;
        this.#head = (this.#head + 1) % this.#buffer.length;
        this.#count--;
        return item;
    }
}

export class GrowingCircularBuffer<T> extends CircularBuffer<T> {

    readonly [Symbol.toStringTag]: string = "GrowingCircularBuffer";

    constructor() {
        super(MIN_CAPACITY);
    }

    #grow(): void {
        const newCapacity = this.capacity * 2;
        this._resize(newCapacity);
    }

    push(item: T): void {
        if (this.capacity === this.length) {
            this.#grow();
        }
        super.push(item);
    }
}


export class DynamicCircularBuffer<T> extends GrowingCircularBuffer<T> {

    readonly [Symbol.toStringTag]: string = "DynamicCircularBuffer";

    constructor() {
        super();
    }

    #shrink(): void {
        const newCapacity = this.capacity / 2;
        this._resize(newCapacity);
    }

    shift(): T | undefined {
        const item: T | undefined = super.shift();
        if (this.length <= this.capacity / 4 && this.capacity > MIN_CAPACITY) {
            this.#shrink();
        }
        return item;
    }

}

export class CircularBufferQueue<T> extends DynamicCircularBuffer<T> { }