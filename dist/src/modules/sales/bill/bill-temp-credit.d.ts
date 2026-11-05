import type { SaveTenderDetailDto, TenderTempCreditDto } from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
export interface TempCreditDetails {
    name: string;
    mobile: string;
    place: string | null;
    addr: string | null;
    idRef: string | null;
    days: number;
    notes: string | null;
}
export declare function encodeTempCreditTenders(tenders: SaveTenderDetailDto[] | undefined): SaveTenderDetailDto[] | undefined;
export declare function decodeTempCredit(row: {
    tdTenderTypeId: number | string;
    tdBankName: string | null;
    tdRefNo: string | null;
    tdPayerVpa: string | null;
    tdNotes: string | null;
}): TempCreditDetails | null;
export declare function toTempCreditDto(d: TempCreditDetails): TenderTempCreditDto;
