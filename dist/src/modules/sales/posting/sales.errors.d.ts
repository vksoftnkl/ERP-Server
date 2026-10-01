import { type SalesErrorDetail } from "../../../common/utils/module-service.utils";
import type { SalesErrorCodeLike, SalesRefusal, SalesStatutoryRef } from './types/posting.types';
export interface SalesCodedErrorDetail extends SalesErrorDetail {
    code: SalesErrorCodeLike;
    line?: number;
    statutory?: SalesStatutoryRef;
}
export declare function throwSalesLocked(message: string, code: SalesErrorCodeLike, field: string, detail?: Partial<SalesCodedErrorDetail>): never;
export declare function throwSalesRefused(message: string, code: SalesErrorCodeLike, field: string, detail?: Partial<SalesCodedErrorDetail>): never;
export declare function throwSalesRefusals(message: string, refusals: SalesRefusal[]): never;
export declare function throwSalesRight(message: string, code: SalesErrorCodeLike, field?: string): never;
export declare function throwSalesInvalid(message: string, code: SalesErrorCodeLike, field: string): never;
