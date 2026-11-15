import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertMenuRight } from '../../../common/posting/rights';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { previewNextVoucherNumber } from '../../../common/Sequence/voucher-sequence.helper';
import { isOfflineSite } from '../../../config/offline-site';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SalesContextService } from '../posting/sales-context.service';
import { SALES_MENU_ID } from '../posting/sales-doc.utils';
import type { BillVoucherTypeChoicesQueryDto } from './dto/bill-voucher-type-choices.dto';
import {
  BILL_BASE_VCHR_TYPE_ID,
  billSeriesDeviceCode,
  billTypeChoices,
} from './bill-voucher-type.helper';

export interface BillVoucherTypeChoice {
  vchrTypeId: number;
  vchrTypeCode: string;
  vchrTypeName: string;
  vchrTypeShort: string | null;
  /** The type's prefix as written ({FY} / {YY} / {BR} unexpanded) — C1's Prefix column. */
  vchrNoPrefix: string | null;
  /** True for Sales Bill (3) itself. */
  isBase: boolean;
  /** The number the next bill of this type would get here, not drawn; null when it cannot open. */
  nextRefno: string | null;
  /** Why nextRefno is null (the refusal the save would answer), else null. */
  nextRefnoCode: string | null;
}

export interface BillVoucherTypeChoices {
  choices: BillVoucherTypeChoice[];
  /** The device's sales.bill_voucher_type when offered; null → the user's last pick, else choices[0]. */
  defaultVchrTypeId: number | null;
  /** sales.offer_base_bill_type for the company. */
  offerBase: boolean;
  /**
   * A child type is offered: the screen shows the pick. False at an offline site
   * (CLOUD_SYNC_ENABLED), which bills Sales Bill (3) only (decision 64).
   */
  hasChildTypes: boolean;
}

/**
 * GET /bills/voucher-type-choices (Voucher Types plan §7.1, decision 37): the bill
 * header's Voucher Type pick, from one place on the server — the offer rule
 * (§5.3), the counter's default and each type's next number.
 */
@Injectable()
export class BillVoucherTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly requestContext: RequestContextService,
    private readonly config: ConfigService,
  ) {}

  async choices(q: BillVoucherTypeChoicesQueryDto): Promise<BillVoucherTypeChoices> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId() ?? null,
      menuId: SALES_MENU_ID.SALE_BILL,
      right: 'view',
      codePrefix: 'SALES',
      action: 'open sales bills',
    });
    const { offered, defaultVchrTypeId, offerBase } = await billTypeChoices(
      this.prisma,
      (companyId, branchId, deviceId, keys) =>
        this.salesContext.values(companyId, branchId, deviceId, keys),
      {
        companyId: q.companyId,
        branchId: q.branchId,
        deviceId: q.deviceId ?? null,
        // Decision 64: an offline site is offered Sales Bill (3) alone.
        offlineSite: isOfflineSite(this.config),
      },
    );
    // N11: sales.pos_series_per_device read exactly as the save reads it —
    // company / branch scope, no device (bill.service createBillInTx) — so the
    // previewed number is the one the save draws.
    const settings = await this.salesContext.settings(q.companyId, q.branchId);
    const today = new Date();
    const choices = await Promise.all(
      offered.map(async (t) => {
        const isBase = t.vchrTypeId === BILL_BASE_VCHR_TYPE_ID;
        // Sales Bill itself numbers POS bills per device (sales.pos_series_per_device);
        // a child always draws the branch counter (decision 34).
        const next = await previewNextVoucherNumber(this.prisma, {
          vchrTypeId: t.vchrTypeId,
          companyId: q.companyId,
          branchId: q.branchId,
          accYear: q.accYear,
          deviceCode: billSeriesDeviceCode({
            vchrTypeId: t.vchrTypeId,
            billMode: q.billMode,
            posSeriesPerDevice: settings.posSeriesPerDevice,
            deviceId: q.deviceId,
          }),
          documentDate: today,
        });
        return {
          vchrTypeId: t.vchrTypeId,
          vchrTypeCode: t.vchrTypeCode,
          vchrTypeName: t.vchrTypeName,
          vchrTypeShort: t.vchrTypeShort,
          vchrNoPrefix: t.vchrNoPrefix,
          isBase,
          nextRefno: next.refno,
          nextRefnoCode: next.code,
        };
      }),
    );
    return {
      choices,
      defaultVchrTypeId,
      offerBase,
      hasChildTypes: offered.some((t) => t.vchrParentId === BILL_BASE_VCHR_TYPE_ID),
    };
  }
}
