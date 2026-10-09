import { TillErrorCode } from './types/till-enum';
import type { TillErrorDetail } from './types/till-api.types';
export declare function throwTill(code: TillErrorCode, message: string, field: string, extra?: Omit<TillErrorDetail, 'field' | 'message' | 'code'>): never;
export declare function throwTillBadRequest(message: string, field: string): never;
export declare function throwTillNotFound(what: string, field: string, id: string | number): never;
