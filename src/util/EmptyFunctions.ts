import { RejectFunction, ResolveFunction } from "../types";
export const EmptyReject: RejectFunction = (err?: any) => { };
export const EmptyResolve: ResolveFunction<any> = (val: any) => { };