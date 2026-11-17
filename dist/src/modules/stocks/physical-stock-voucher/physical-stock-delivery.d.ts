import { Prisma } from '@prisma/client';
import { type UserWording } from "../../../common/error-wording/error-wording";
import type { PagedResult, StockCountSheetRow, StockVoucherLineProblem, StockVoucherPayload } from '../stock-voucher/types/stock-voucher.types';
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;
export interface UndeliveredValidateWarning {
    code: string;
    level: 'WARN';
    message: string;
    params: Record<string, string | number>;
    user: UserWording | null;
}
export type ValidateRowWithUndelivered = StockVoucherLineProblem & {
    undeliveredQty?: number;
    previousUndeliveredQty?: number;
    undeliveredChanged?: boolean;
    warning?: UndeliveredValidateWarning | null;
};
export declare function withUndeliveredOnSheet(client: Client, scope: {
    companyId: string;
    branchId: string;
    godownId: string;
}, page: PagedResult<StockCountSheetRow>): Promise<PagedResult<StockCountSheetRow>>;
export declare function withUndeliveredOnDocument<T extends StockVoucherPayload>(client: Client, doc: T): Promise<T>;
export declare function withUndeliveredOnValidate(client: Client, scope: {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
}, rows: readonly StockVoucherLineProblem[]): Promise<ValidateRowWithUndelivered[]>;
export {};
