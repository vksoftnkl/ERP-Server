import { type WaStatus } from './wa.constants';
export type RelayStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export interface StatusRowState {
    status: WaStatus;
    sentOn: Date | null;
    deliveredOn: Date | null;
    readOn: Date | null;
    failedOn: Date | null;
    errorCode: string | null;
    metaErrorCode: number | null;
    errorText: string | null;
}
export interface StatusEvent {
    status: RelayStatus;
    at: Date;
    metaErrorCode?: number | null;
    metaErrorTitle?: string | null;
}
export declare function mergeStatus(row: StatusRowState, ev: StatusEvent): StatusRowState;
export declare function statusChanged(a: StatusRowState, b: StatusRowState): boolean;
export declare function wacStateOf(relayState: string | null | undefined): 'ACTIVATED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'SUSPENDED';
