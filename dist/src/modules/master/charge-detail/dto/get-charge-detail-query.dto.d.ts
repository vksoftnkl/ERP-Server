import { ChargeDocType } from '../types/charge-detail-api.types';
export declare class GetChargeDetailQueryDto {
    cdId?: string;
    cdDocType?: ChargeDocType;
    cdDocId?: string;
    isActive?: boolean;
}
