import { type UserWording } from "../../../common/error-wording/error-wording";
import type { SalesMessageParams } from '../posting/types/posting.types';
export type NoteSeverity = 'REFUSE' | 'WARN' | 'INFO';
export interface DeliveryNote {
    code: string;
    severity: NoteSeverity;
    field: string;
    lineNo?: number | null;
    params: SalesMessageParams;
    message: string;
}
export interface WordedNote extends DeliveryNote {
    user?: UserWording;
}
export declare function httpStatusOf(code: string): 403 | 404 | 409 | 422;
export declare function raiseNote(note: Pick<DeliveryNote, 'code' | 'field' | 'message' | 'params' | 'lineNo'> & {
    event?: string;
}): never;
export declare function refuseWith(code: string, message: string, field: string, params?: SalesMessageParams, lineNo?: number | null, event?: string): never;
export declare function worded(note: DeliveryNote): WordedNote;
export declare function note(code: string, severity: NoteSeverity, field: string, message: string, params?: SalesMessageParams, lineNo?: number | null): DeliveryNote;
