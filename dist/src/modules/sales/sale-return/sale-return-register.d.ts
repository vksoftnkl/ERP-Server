import type { RegisterDoc } from '../../../common/posting/doc-register.types';
import type { DocRow } from '../posting/sales-doc-store';
import type { ReturnMoney } from './sale-return-preview';
export declare function returnRegisterDoc(row: DocRow, money: ReturnMoney, voucherId: string, voucherNo: bigint, actor: string): RegisterDoc;
