import { AbstractTaskQueue } from "./AbstractTaskQueue";
import { TaskQueue } from "./TaskQueue";

class LinkedListNode<T> {
    value: T;
    next: LinkedListNode<T> | null = null;

    constructor(value: T) {
        this.value = value;
    }
}

class NodePool<T> {
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

export class LinkedList<T> extends AbstractTaskQueue<T> implements TaskQueue<T> {
    #head: LinkedListNode<T> | null = null;
    #tail: LinkedListNode<T> | null = null;
    #pool: NodePool<T> = new NodePool<T>();
    #size: number = 0;

    get size(): number {
        return this.#size;
    }

    get empty(): boolean {
        return this.#size === 0;
    }

    clear(): void {
        this.#head = null;
        this.#tail = null;
        this.#size = 0;
    }

    dequeue(): T | undefined {
        if (this.#head === null) {
            return undefined;
        }
        const node = this.#head;
        this.#head = this.#head.next;
        this.#size--;
        if (this.#head === null) {
            this.#tail = null;
        }
        const value = node.value;
        this.#pool.release(node);
        return value;
    }

    enqueue(item: T): void {
        const node = this.#pool.acquire(item);
        if (this.#tail) {
            this.#tail.next = node;
        } else {
            this.#head = node;
        }
        this.#tail = node;
        this.#size++;
    }

    peek(): T | undefined {
        return this.#head?.value;
    }

    toArray(): T[] {
        const arr = new Array<T>(this.#size);
        for (let node: LinkedListNode<T> | null = this.#head; node !== null; node = node.next) {
            arr.push(node.value);
        }
        return arr;
    }

}