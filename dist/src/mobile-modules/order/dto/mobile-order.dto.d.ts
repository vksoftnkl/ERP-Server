import { SaveSaleOrderDto } from "../../../modules/sales/sale-order/dto/save-sale-order.dto";
import { SaveSaleOrderItemDto } from "../../../modules/sales/sale-order/dto/save-sale-order-item.dto";
declare const MobileOrderLineDto_base: import("@nestjs/common").Type<Omit<SaveSaleOrderItemDto, "soiId" | "soiOrderId" | "soiCompanyId" | "soiBranchId" | "soiTenantId" | "soiAccYear" | "soiCreatedBy" | "soiModifiedBy">>;
export declare class MobileOrderLineDto extends MobileOrderLineDto_base {
}
declare const CreateMobileOrderDto_base: import("@nestjs/common").Type<Omit<SaveSaleOrderDto, "items" | "charges" | "tenders" | "post" | "soId" | "soBranchId" | "soTenantId" | "soAccYear" | "soSessionId" | "soDeviceId" | "soOrderSlno" | "soOrderRefno" | "soUserId" | "soStatus" | "soCreatedBy" | "soModifiedBy">>;
export declare class CreateMobileOrderDto extends CreateMobileOrderDto_base {
    soClientUuid: string;
    deviceUid: string;
    soUserId?: string;
    items: MobileOrderLineDto[];
}
export {};
