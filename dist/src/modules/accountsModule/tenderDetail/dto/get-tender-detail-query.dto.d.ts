import { TenderSrcDocType, TenderSrcModule } from '../types/tender-detail-api.types';
export declare class GetTenderDetailQueryDto {
    tdId?: string;
    tdSrcModule?: TenderSrcModule;
    tdSrcDocType?: TenderSrcDocType;
    tdSrcDocId?: string;
}
