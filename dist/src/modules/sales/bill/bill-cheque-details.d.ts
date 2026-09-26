import { Prisma } from '@prisma/client';
import type { SaveTenderDetailDto, TenderChequeDetailDto } from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { type PdcChequeDetail } from '../posting/pdc-register.helper';
export type BillDraftCheques = Record<string, PdcChequeDetail | null>;
export declare function readDraftCheques(value: Prisma.JsonValue | null | undefined): BillDraftCheques;
export declare function buildDraftCheques(payload: readonly SaveTenderDetailDto[] | undefined, persisted: readonly {
    tdId: string;
    tdRowNo: number;
    tdTenderTypeId: number | string;
    tdIsDeleted?: boolean | null;
}[], prior: BillDraftCheques): BillDraftCheques | undefined;
export declare function toDraftChequesJson(drafts: BillDraftCheques): Prisma.InputJsonValue | typeof Prisma.DbNull;
export declare function chequeDetailsFor(client: Prisma.TransactionClient, tenders: readonly {
    tdId: string;
    tdTenderTypeId: number | string;
}[], draft: Prisma.JsonValue | null | undefined): Promise<Map<string, TenderChequeDetailDto | null>>;
