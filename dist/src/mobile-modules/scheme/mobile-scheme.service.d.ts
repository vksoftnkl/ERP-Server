import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ActiveMobileSchemesQueryDto } from './dto/mobile-scheme.dto';
import type { MobileScheme, MobileSchemesPayload } from './types/mobile-scheme-api.types';
export declare const PHONE_SCHEME_WHERE: {
    prmIsDeleted: false;
    prmIsActive: true;
    prmStatus: string;
    prmAutoApply: true;
    prmCouponBatchId: null;
};
declare const PHONE_SCHEME_SELECT: {
    prmId: true;
    prmCompId: true;
    prmBranchId: true;
    prmCode: true;
    prmName: true;
    prmStatus: true;
    prmApplyOn: true;
    prmBenefit: true;
    prmPriority: true;
    prmStackMode: true;
    prmAutoApply: true;
    prmAllowWithManualDisc: true;
    prmCalcOnAmountType: true;
    prmIncludeTax: true;
    prmBillType: true;
    prmMinBillAmount: true;
    prmMinQty: true;
    prmBranchScope: true;
    prmCustScope: true;
    prmItemScope: true;
    prmPriceLevelId: true;
    prmMaxBenefitPerBill: true;
    prmCouponBatchId: true;
    prmStartDate: true;
    prmEndDate: true;
    prmValidFromTime: true;
    prmValidToTime: true;
    prmValidWeekdays: true;
    prmRemarks: true;
    prmModifiedOn: true;
    branches: {
        where: {
            prbIsDeleted: false;
            prbIsActive: true;
        };
        orderBy: ({
            prbSlno: "asc";
            prbId?: undefined;
        } | {
            prbId: "asc";
            prbSlno?: undefined;
        })[];
        select: {
            prbId: true;
            prbBranchId: true;
            prbIsExclude: true;
            branch: {
                select: {
                    brName: true;
                };
            };
        };
    };
    parties: {
        where: {
            prpIsDeleted: false;
            prpIsActive: true;
        };
        orderBy: ({
            prpSlno: "asc";
            prpId?: undefined;
        } | {
            prpId: "asc";
            prpSlno?: undefined;
        })[];
        select: {
            prpId: true;
            prpKind: true;
            prpScopeId: true;
            prpIsExclude: true;
            prpMatchPriority: true;
            customer: {
                select: {
                    cusName: true;
                };
            };
            customerGroup: {
                select: {
                    cgrName: true;
                };
            };
            area: {
                select: {
                    armName: true;
                };
            };
            city: {
                select: {
                    ctmName: true;
                };
            };
        };
    };
    items: {
        where: {
            priIsDeleted: false;
            priIsActive: true;
        };
        orderBy: ({
            priSlno: "asc";
            priId?: undefined;
        } | {
            priId: "asc";
            priSlno?: undefined;
        })[];
        select: {
            priId: true;
            priKind: true;
            priScopeId: true;
            priUnitId: true;
            priIsExclude: true;
            priDiscPerc: true;
            priDiscQty: true;
            priDiscAmt: true;
            priMinQty: true;
            priFactor: true;
            priMaxBenefit: true;
            priMatchPriority: true;
            item: {
                select: {
                    itemNameEn: true;
                };
            };
            itemGroup: {
                select: {
                    itgName: true;
                };
            };
            itemCategory: {
                select: {
                    categoryName: true;
                };
            };
            itemBrand: {
                select: {
                    brand_name: true;
                };
            };
            itemSection: {
                select: {
                    secName: true;
                };
            };
            unit: {
                readonly select: {
                    readonly unit: {
                        readonly select: {
                            readonly unit_name: true;
                        };
                    };
                };
            };
        };
    };
    slabs: {
        where: {
            prsIsDeleted: false;
            prsIsActive: true;
        };
        orderBy: ({
            prsSlno: "asc";
            prsId?: undefined;
        } | {
            prsId: "asc";
            prsSlno?: undefined;
        })[];
        select: {
            prsId: true;
            prsSlno: true;
            prsBenefit: true;
            prsExceeds: true;
            prsUpto: true;
            prsEach: true;
            prsIsRepeat: true;
            prsMaxRepeats: true;
            prsFreeItemId: true;
            prsFreeUnitId: true;
            prsFreeQty: true;
            prsFreeStockCheck: true;
            prsDiscPerc: true;
            prsDiscQty: true;
            prsDiscAmt: true;
            prsFixedPrice: true;
            prsMaxBenefitAmt: true;
            freeItem: {
                select: {
                    itemNameEn: true;
                };
            };
            freeUnit: {
                select: {
                    iucToBaseFactor: true;
                    unit: {
                        select: {
                            unit_name: true;
                        };
                    };
                };
            };
        };
    };
};
export type PhoneSchemeRow = Prisma.PromotionSchemeGetPayload<{
    select: typeof PHONE_SCHEME_SELECT;
}>;
export declare function numText(value: Prisma.Decimal, scale: number): string;
export declare function numText(value: Prisma.Decimal | null, scale: number): string | null;
export declare function istTimestamp(value: Date | null): string | null;
export declare function toPhoneScheme(row: PhoneSchemeRow): MobileScheme;
export declare class MobileSchemeService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    active(q: ActiveMobileSchemesQueryDto): Promise<MobileSchemesPayload>;
    private liveSchemeIds;
}
export {};
