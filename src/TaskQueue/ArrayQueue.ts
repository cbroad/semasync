import { TaskQueue } from "./TaskQueue";

export class ArrayQueue<T> extends Array<T> implements TaskQueue<T> { }