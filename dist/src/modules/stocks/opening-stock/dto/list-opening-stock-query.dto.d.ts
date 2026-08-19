import { OpeningStockStatus } from '../opening-stock.enums';
export declare class ListOpeningStockQueryDto {
    avh_voucher_id?: string;
    avh_voucher_refno?: string;
    page?: number;
    limit?: number;
    search?: string;
    osh_acc_year?: string;
    osh_company_id?: string;
    osh_branch_id?: string;
    osh_status?: OpeningStockStatus;
    date_from?: string;
    date_to?: string;
}
