import { AbstractTaskQueue } from "./AbstractTaskQueue";

const USE_OBJECT_POOLING = false as const;

class LinkedListNode<T> {
    value: T;
    next: LinkedListNode<T> | null = null;

    constructor(value: T) {
        this.value = value;
    }
}

interface LinkedListNodePool<T> {
    acquire(value: T): LinkedListNode<T>;
    release(node: LinkedListNode<T>): void;
}

class NodePool<T> implements LinkedListNodePool<T> {
    #stack: LinkedListNode<T>[] = [];

    acquire(value: T): LinkedListNode<T> {
        if (this.#stack.length > 0) {
            const node = this.#stack.pop()!;
            node.value = value;
            return node;
        }
        return new LinkedListNode(value);
    }

    release(node: LinkedListNode<T>): void {
        if (this.#stack.length < 100) {
            node.next = null;
            node.value = null as unknown as T; // Clear the value to avoid memory leaks
            this.#stack.push(node);
        }
    }
}

class FakePool<T> implements LinkedListNodePool<T> {
    acquire(value: T): LinkedListNode<T> {
        return new LinkedListNode(value);
    }
    release(node: LinkedListNode<T>) { }
}

export class LinkedListQueue<T> extends AbstractTaskQueue<T> {
    #head: LinkedListNode<T> | null = null;
    #tail: LinkedListNode<T> | null = null;
    #pool: LinkedListNodePool<T> = USE_OBJECT_POOLING ? new NodePool<T>() : new FakePool<T>();
    #count: number = 0;

    get length(): number {
        return this.#count;
    }

    set length(n: number) {
        if (n < 0 || n > this.#count) { throw new RangeError("Invalid array length"); }
        if (n === 0) {
            this.#head = null;
            this.#tail = null;
            this.#count = 0;
            return;
        }
        let node = this.#head!;
        for (let i = 1; i < n; i++) {
            node = node.next!;
        }
        node.next = null;
        this.#tail = node;
        this.#count = n;
    }

    *[Symbol.iterator](): Iterator<T, any, any> {
        let node: LinkedListNode<T> | null = this.#head;
        while (node) {
            yield node.value;
            node = node.next;
        }
    }

    at(n: number): T | undefined {
        let idx: number = (n < 0) ? (this.length + n) : n;
        if (idx > this.length || idx < 0) {
            return undefined;
        }
        let node = this.#head!;
        while (idx--) {
            node = node.next!
        }
        return node.value;
    }

    push(item: T): void {
        const node = this.#pool.acquire(item);
        if (this.#tail) {
            this.#tail.next = node;
        } else {
            this.#head = node;
        }
        this.#tail = node;
        this.#count++;
    }

    shift(): T | undefined {
        if (this.#head === null) {
            return undefined;
        }
        const node = this.#head;
        this.#head = this.#head.next;
        this.#count--;
        if (this.#head === null) {
            this.#tail = null;
        }
        const value = node.value;
        this.#pool.release(node);
        return value;
    }
}