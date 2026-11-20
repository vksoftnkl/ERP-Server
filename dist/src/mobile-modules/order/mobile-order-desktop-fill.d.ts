import type { ItemPriceLookupPayload } from '../../modules/master-lookup/types/master-lookup-api.types';
import type { SaveSaleOrderDto } from '../../modules/sales/sale-order/dto/save-sale-order.dto';
import type { SaveSaleOrderItemDto } from '../../modules/sales/sale-order/dto/save-sale-order-item.dto';
type Line = Omit<SaveSaleOrderItemDto, 'soiId' | 'soiOrderId' | 'soiCompanyId' | 'soiBranchId' | 'soiTenantId' | 'soiAccYear' | 'soiCreatedBy' | 'soiModifiedBy'>;
export interface DesktopLineFacts {
    actPrice: number;
    costPrice: number;
    costPreTax: number;
    maxPrice: number;
    minPrice: number;
    hasFreight: boolean;
    isService: boolean;
    eanCode: string | null;
    hsnCode: string | null;
    weight: number;
    availableStock: number | null;
}
export declare function lineFactsOf(answer: ItemPriceLookupPayload): DesktopLineFacts;
export interface DesktopCustomerFacts {
    gstType: string | null;
    stateCode: string | null;
    posStateCode: string | null;
    posStateName: string | null;
}
export declare const DESKTOP_ORDER_SETTING_KEYS: readonly ["sales.freight_calc_type", "sales.loading_calc_type", "sales.disc_alter_base_rate", "sales.round_off_step", "sales.default_delivery_mode"];
export declare function withDesktopLineFigures<T extends Line>(line: T, facts: DesktopLineFacts | null): T;
export declare function withDesktopHeaderFigures<T extends Partial<SaveSaleOrderDto>>(header: T, lines: readonly Line[], customer: DesktopCustomerFacts | null, settings: ReadonlyMap<string, string | null>): T;
export {};
