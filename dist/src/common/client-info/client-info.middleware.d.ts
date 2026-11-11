import type { NextFunction, Request, Response } from 'express';
import { type ClientInfo } from './client-info';
export interface ErrorLogSink {
    warn(message: string): void;
    error(message: string): void;
}
type RequestWithIdentity = Request & {
    clientInfo?: ClientInfo;
    user?: {
        sub?: unknown;
        user_name?: unknown;
        company_id?: unknown;
    };
};
export declare function createClientInfoMiddleware(sink?: ErrorLogSink): (request: Request, response: Response, next: NextFunction) => void;
export declare function describeErrorResponse(request: RequestWithIdentity, status: number, codes: readonly string[]): string;
export declare function errorCodesOf(body: unknown): string[];
export {};
