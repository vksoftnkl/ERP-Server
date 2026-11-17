import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  isUniqueConstraintError,
  throwBadRequest,
  throwConflict,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import { ORDER_TX_OPTIONS } from '../../modules/sales/sale-order/sale-order-tx.options';
import { SaleOrderService } from '../../modules/sales/sale-order/sale-order.service';
import type { SaveSaleOrderDto } from '../../modules/sales/sale-order/dto/save-sale-order.dto';
import { MobileErrorCode } from '../common/mobile-error-codes';
import {
  assertMobileCompany,
  databaseToday,
  lockMobileClientUuid,
  requireMobileAccYear,
  requireMobileBranch,
  resolveMobileDevice,
  type MobileReadClient,
} from '../common/mobile-scope';
import { CreateMobileOrderDto } from './dto/mobile-order.dto';
import type { MobileOrderCreateResult } from './types/mobile-order-api.types';

/** The order a client uuid already names, whatever its year or state. */
interface StoredOrder {
  soId: string;
  soOrderRefno: string;
  soStatus: string;
  soAccYear: string;
  soIsDeleted: boolean;
  soCustId: string;
}

/** The order's date as the fiscal year is read for it: YYYY-MM-DD, no time zone shift. */
export function orderDayOf(soOrderDate: string | undefined, today: string): string {
  return soOrderDate ? soOrderDate.slice(0, 10) : today;
}

/**
 * Order upload from the phone. The order is the desktop's: it is saved by
 * SaleOrderService.createOrderInTx (voucher type 4 number, the lines, the
 * CREATED status step, the revision), inside a transaction of ours that also
 * holds the duplicate check and writes so_client_uuid, so a resend can never
 * leave two orders or a number consumed for nothing.
 */
@Injectable()
export class MobileOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly saleOrderService: SaleOrderService,
  ) {}

  async create(dto: CreateMobileOrderDto): Promise<MobileOrderCreateResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Two copies of one resend in flight: the second waits here, then
        // finds the first's order below.
        await lockMobileClientUuid(tx, 'order', dto.soCompanyId, dto.soClientUuid);
        const stored = await this.findByClientUuid(tx, dto.soCompanyId, dto.soClientUuid);
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
        await assertMobileCompany(tx, dto.soCompanyId, 'soCompanyId');
        const device = await resolveMobileDevice(tx, dto.deviceUid);
        const branchId = await requireMobileBranch(tx, dto.soCompanyId, device.devBranchId);
        const orderDay = orderDayOf(dto.soOrderDate, await databaseToday(tx));
        const accYear = await requireMobileAccYear(tx, dto.soCompanyId, orderDay, 'soOrderDate');
        const saveDto = this.toSaveDto(dto, {
          soBranchId: branchId,
          soAccYear: accYear,
          soDeviceId: device.devId,
          soUserId: this.orderUserId(dto),
          soOrderDate: orderDay,
        });
        this.saleOrderService.prepareSave(saveDto);
        const created = await this.saleOrderService.createOrderInTx(tx, saveDto);
        await tx.saleOrder.update({
          where: { soId_soAccYear: { soId: created.soId, soAccYear: created.soAccYear } },
          data: { soClientUuid: dto.soClientUuid },
        });
        return {
          soId: created.soId,
          soOrderRefno: created.soOrderRefno,
          soStatus: created.soStatus,
          soAccYear: created.soAccYear,
          duplicate: false,
          soIsDeleted: false,
        };
      }, ORDER_TX_OPTIONS);
    } catch (error: unknown) {
      // The lock makes this a backstop only (ux_so_client_uuid): another
      // writer won the race, so its order is the answer.
      if (isUniqueConstraintError(error)) {
        const stored = await this.findByClientUuid(this.prisma, dto.soCompanyId, dto.soClientUuid);
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
      }
      this.saleOrderService.throwIfDuplicate(error);
      throw error;
    }
  }

  /**
   * so_user_id: the login when the upload carries a token (a sent soUserId is
   * then ignored), else the body's. NOT NULL, so neither = 400.
   */
  private orderUserId(dto: CreateMobileOrderDto): string {
    const userId = this.requestContextService.getUserId() ?? dto.soUserId;
    if (!userId) {
      throwBadRequest<ModuleErrorDetail>('Validation failed', [
        {
          field: 'soUserId',
          message: "Send soUserId, or upload with the salesman's login token.",
          code: MobileErrorCode.ORDER_USER_REQUIRED,
        },
      ]);
    }
    return userId;
  }

  /** The desktop save payload: the phone's fields, the server's scope, nothing mobile-only. */
  private toSaveDto(
    dto: CreateMobileOrderDto,
    scope: Pick<
      SaveSaleOrderDto,
      'soBranchId' | 'soAccYear' | 'soDeviceId' | 'soUserId' | 'soOrderDate'
    >,
  ): SaveSaleOrderDto {
    const { soClientUuid: _clientUuid, deviceUid: _deviceUid, ...order } = dto;
    void _clientUuid;
    void _deviceUid;
    return { ...order, ...scope };
  }

  private async findByClientUuid(
    client: MobileReadClient,
    companyId: string,
    clientUuid: string,
  ): Promise<StoredOrder | null> {
    const [row] = await client.$queryRaw<StoredOrder[]>`
      SELECT so.so_id AS "soId", so.so_order_refno AS "soOrderRefno", so.so_status AS "soStatus",
             so.so_acc_year::text AS "soAccYear", so.so_is_deleted AS "soIsDeleted",
             so.so_cust_id AS "soCustId"
        FROM sales.sale_order so
       WHERE so.so_company_id = ${companyId}::uuid
         AND so.so_client_uuid = ${clientUuid}::uuid
       ORDER BY so.so_created_on
       LIMIT 1`;
    return row ?? null;
  }

  /**
   * A resend: the order already saved, as it stands now. The same uuid on
   * another customer's order is a phone bug, not a lost answer: 409.
   */
  private resendAnswer(stored: StoredOrder, dto: CreateMobileOrderDto): MobileOrderCreateResult {
    if (stored.soCustId !== dto.soCustId) {
      throwConflict<ModuleErrorDetail>('Order id already used', [
        {
          field: 'soClientUuid',
          message: `soClientUuid ${dto.soClientUuid} already names order ${stored.soOrderRefno} of another customer.`,
          code: MobileErrorCode.CLIENT_UUID_REUSED,
        },
      ]);
    }
    return {
      soId: stored.soId,
      soOrderRefno: stored.soOrderRefno,
      soStatus: stored.soStatus,
      soAccYear: stored.soAccYear.trim(),
      duplicate: true,
      soIsDeleted: stored.soIsDeleted,
    };
  }
}
