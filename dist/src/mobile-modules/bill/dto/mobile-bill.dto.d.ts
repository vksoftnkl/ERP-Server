import { SaveBillDto } from "../../../modules/sales/bill/dto/save-bill.dto";
import { SaveBillItemDto } from "../../../modules/sales/bill/dto/save-bill-item.dto";
export declare const MOBILE_BILL_TYPE = "CREDIT";
declare const MobileBillLineDto_base: import("@nestjs/common").Type<Omit<SaveBillItemDto, "sbiId" | "sbiBillId" | "sbiCompanyId" | "sbiBranchId" | "sbiTenantId" | "sbiAccYear" | "sbiSrcDocType" | "sbiSrcDocId" | "sbiSrcDocYear" | "sbiSrcDocRefno" | "sbiSrcDocLineNo" | "sbiSrcItemQty" | "sbiSrcFreeQty" | "sbiSrcItemId" | "sbiCogsAmt" | "sbiCreatedBy" | "sbiModifiedBy">>;
export declare class MobileBillLineDto extends MobileBillLineDto_base {
}
declare const CreateMobileBillDto_base: import("@nestjs/common").Type<Omit<SaveBillDto, "items" | "post" | "charges" | "tenders" | "adjustments" | "sbId" | "sbBranchId" | "sbTenantId" | "sbAccYear" | "sbSessionId" | "sbCounterId" | "sbDeviceType" | "sbDeviceId" | "sbBillType" | "sbBillSlno" | "sbBillRefno" | "sbSrcDocType" | "sbSrcDocId" | "sbSrcDocRefno" | "sbSrcDocDate" | "sbSrcDocYear" | "sbBillMode" | "sbHasDc" | "sbCogsAmt" | "sbDeliveryStatus" | "sbLoyaltyEarned" | "sbLoyaltyRedeemed" | "sbRevisionNo" | "sbDocRegisterId" | "sbUserId" | "sbReturnedAmt" | "sbReturnStatus" | "sbStatus" | "sbPostedVoucherId" | "sbApprovedOn" | "sbApprovedBy" | "sbVersionNo" | "sbPrintCount" | "sbCreatedBy" | "sbModifiedBy" | "sbCancelReason">>;
export declare class CreateMobileBillDto extends CreateMobileBillDto_base {
    sbClientUuid: string;
    deviceUid: string;
    sbBillType?: string;
    items: MobileBillLineDto[];
}
export declare class MobileBillOptionsQueryDto {
    companyId: string;
    deviceUid: string;
}
export {};
