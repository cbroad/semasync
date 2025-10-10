export * from "./ArrayQueue";
export * from "./CircularBufferQueue";
export * from "./LinkedListQueue";

// Which structure is our default TaskQueue?
// export { ArrayTaskQueue as TaskQueue } from "./ArrayQueue";
export { CircularBufferQueue as TaskQueue } from "./CircularBufferQueue";
// export { LinkedListQueue as TaskQueue } from "./LinkedList";

export * from "./TaskQueue";