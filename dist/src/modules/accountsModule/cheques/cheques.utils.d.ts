import { Prisma } from '@prisma/client';
import { TxnStatusDocType, TxnStatusEvent } from "../../../common/txn-status-log/txn-status-log.helper";
import { PdcStatus } from '../receipt/types/receipt-enum';
import { type LockedCheque } from './cheques.guards';
import type { ChequeRow } from './types/cheque-api.types';
export declare function chequeDocTypeOf(traType: string): TxnStatusDocType;
export declare function logChequeStatus(tx: Prisma.TransactionClient, cheque: Pick<LockedCheque, 'apdId' | 'apdAccYear' | 'apdCompanyId' | 'apdBranchId' | 'apdTenantId' | 'apdInstrumentNo' | 'apdTraType'>, entry: {
    fromStatus: PdcStatus | null;
    toStatus: PdcStatus;
    event?: TxnStatusEvent;
    remarks: string | null;
    actor: string;
    changedOn: Date;
    sessionId?: string | null;
    deviceId?: string | null;
}): Promise<void>;
export interface ChequeRowExtras {
    partyName: string;
    bankLedgerName: string | null;
    apdStatusOn?: Date | null;
    apdStatusBy?: string | null;
}
export declare function toChequeRow(cheque: LockedCheque, extras: ChequeRowExtras): ChequeRow;
export declare function reloadChequeRow(tx: Prisma.TransactionClient, apdId: string, apdAccYear: string): Promise<ChequeRow>;
