import { HttpException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
import {
  SaleOrderLifecycleService,
  type SaleOrderPostOptions,
} from '../../modules/sales/sale-order/sale-order-lifecycle.service';
import type { SaveSaleOrderDto } from '../../modules/sales/sale-order/dto/save-sale-order.dto';
import type { SaleOrderPayload } from '../../modules/sales/sale-order/types/sale-order-api.types';
import type { SaleOrderKeysDto } from '../../modules/sales/sale-order/dto/sale-order-lifecycle.dto';
import { MobileErrorCode } from '../common/mobile-error-codes';
import {
  assertMobileCompany,
  databaseToday,
  lockMobileClientUuid,
  requireMobileAccYear,
  requireMobileBranch,
  requireMobileBranchOfCompany,
  resolveMobileDevice,
  type MobileReadClient,
} from '../common/mobile-scope';
import {
  resolveDefaultSaleGodowns,
  saleGodownKey,
  type SaleGodown,
  type SaleGodownReader,
} from '../../common/utils/sale-line-godown.utils';
import { ItemPriceLookup } from '../../modules/master-lookup/lookups/item-price.lookup';
import type { ItemPriceLookupQueryDto } from '../../modules/master-lookup/dto/item-price-lookup-query.dto';
import { AppSettingValueService } from '../../modules/settings/appSettings/app-setting-value.service';
import { CreateMobileOrderDto, type MobileOrderLineDto } from './dto/mobile-order.dto';
import {
  DESKTOP_ORDER_SETTING_KEYS,
  lineFactsOf,
  withDesktopHeaderFigures,
  withDesktopLineFigures,
  type DesktopCustomerFacts,
  type DesktopLineFacts,
} from './mobile-order-desktop-fill';
import type {
  MobileOrderConfirmRefusal,
  MobileOrderCreateResult,
} from './types/mobile-order-api.types';

/** What the desktop reads before it saves (MobileOrderService.desktopFacts). */
interface MobileOrderDesktopFacts {
  /** Per line, in order; null = the item lookup could not price the line. */
  lineFacts: (DesktopLineFacts | null)[];
  customer: DesktopCustomerFacts | null;
  /** DESKTOP_ORDER_SETTING_KEYS → effective value. */
  settings: ReadonlyMap<string, string | null>;
}

/** The order a client uuid already names, whatever its year or state. */
interface StoredOrder {
  soId: string;
  soOrderRefno: string;
  soStatus: string;
  soAccYear: string;
  soIsDeleted: boolean;
  soCustId: string;
}

/**
 * The phone's confirm (user, 2026-11-19): a phone order is confirmed even
 * without the login's Post right on Sales Order (menu 11), or without a login;
 * every other check of /sale-orders/post applies. The trail and the audit say
 * it came from the phone.
 */
const PHONE_CONFIRM: SaleOrderPostOptions = { skipPostRight: true, origin: 'PHONE' };

/**
 * A refusal the confirm may fall back from: a coded 4xx (the house refusal
 * shape, `errors[].code`), e.g. SALES_DAY_CLOSED, VCH_YEAR_CLOSED /
 * VCH_PERIOD_LOCKED, SALES_SALESMAN_INVALID. Anything else (a database error,
 * a 5xx, an uncoded throw) is null: not a refusal, the upload fails.
 */
export function confirmRefusalOf(error: unknown): MobileOrderConfirmRefusal | null {
  if (!(error instanceof HttpException)) {
    return null;
  }
  const status = error.getStatus();
  if (status < 400 || status >= 500) {
    return null;
  }
  const body = error.getResponse();
  const errors = isRecord(body) && Array.isArray(body.errors) ? (body.errors as unknown[]) : [];
  const first = errors[0];
  if (!isRecord(first) || typeof first.code !== 'string' || first.code === '') {
    return null;
  }
  return {
    code: first.code,
    field: typeof first.field === 'string' ? first.field : null,
    message: typeof first.message === 'string' ? first.message : error.message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The part of a phone line the godown rule reads. */
type GodownLine = { soiItemId: string; soiItemUnitId: string; soiGodownId?: string | null };

/**
 * The godown each phone line with none of its own is saved in (user,
 * 2026-11-20: "fill their items godown"): the one a desktop sale line of that
 * item defaults to (notes 51, resolveDefaultSaleGodowns, as /master-lookups/
 * item-price and /quotations/get default it):
 *   1. the item's price-row godown for the line's unit
 *      (item_price_master.ipm_godown_id, a branch row before a chain row), else
 *   2. the order branch's default (branch_master.br_default_godown_id), when live.
 * Replaces the 2026-11-19 branch-default-only rule, which also refused a
 * default of another branch and so left Counter2's lines (default namakkal,
 * a Coimbatore godown) without a godown. Keyed by saleGodownKey; only the
 * lines that name no godown are read.
 */
export async function mobileOrderLineGodowns(
  client: SaleGodownReader,
  branchId: string,
  items: readonly GodownLine[],
): Promise<Map<string, SaleGodown | null>> {
  return resolveDefaultSaleGodowns(
    client,
    branchId,
    items
      .filter((item) => !item.soiGodownId)
      .map((item) => ({ itemId: item.soiItemId, iucId: item.soiItemUnitId })),
  );
}

/**
 * The lines with their item's godown (mobileOrderLineGodowns) on each one that
 * names none; a sent godown is kept, and a line no rule gives one stays blank.
 */
export function withLineGodowns<T extends GodownLine>(
  items: readonly T[],
  godownByLine: ReadonlyMap<string, SaleGodown | null>,
): T[] {
  return items.map((item) => {
    if (item.soiGodownId) return item;
    const godown = godownByLine.get(
      saleGodownKey({ itemId: item.soiItemId, iucId: item.soiItemUnitId }),
    );
    return godown ? { ...item, soiGodownId: godown.gdlId } : item;
  });
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
 * leave two orders or a number consumed for nothing. In the same transaction
 * it is then confirmed through SaleOrderLifecycleService.postInTx, as the
 * office's Confirm would (reservations, CONFIRMED, the POSTED step, the
 * audit); a refusal there keeps it a DRAFT (confirmInTx). A line with no
 * godown is saved in its item's godown, else the branch default
 * (mobileOrderLineGodowns), so the confirm reserves there. After the commit, WhatsApp on Post goes out for
 * an order this call confirmed, as after the desktop /post.
 */
@Injectable()
export class MobileOrderService {
  private readonly logger = new Logger(MobileOrderService.name);

  /** The desktop order screen's item lookup (/master-lookups/item-price), for the line figures. */
  private readonly itemPrice: ItemPriceLookup;

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly saleOrderService: SaleOrderService,
    private readonly saleOrderLifecycle: SaleOrderLifecycleService,
    private readonly appSettings: AppSettingValueService,
  ) {
    this.itemPrice = new ItemPriceLookup(prisma, appSettings);
  }

  async create(dto: CreateMobileOrderDto): Promise<MobileOrderCreateResult> {
    // The keys of an order THIS call moved DRAFT → CONFIRMED: WhatsApp on Post
    // goes out for it after the commit, as the desktop /post does.
    const confirmed: { keys: SaleOrderKeysDto | null } = { keys: null };
    let answer: MobileOrderCreateResult;
    try {
      answer = await this.prisma.$transaction(async (tx) => {
        // Two copies of one resend in flight: the second waits here, then
        // finds the first's order below.
        await lockMobileClientUuid(tx, 'order', dto.soCompanyId, dto.soClientUuid);
        const stored = await this.findByClientUuid(tx, dto.soCompanyId, dto.soClientUuid);
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
        await assertMobileCompany(tx, dto.soCompanyId, 'soCompanyId');
        const device = await resolveMobileDevice(tx, dto.deviceUid);
        const branchId = await this.orderBranchId(tx, dto, device.devBranchId);
        const orderDay = orderDayOf(dto.soOrderDate, await databaseToday(tx));
        const accYear = await requireMobileAccYear(tx, dto.soCompanyId, orderDay, 'soOrderDate');
        const items = withLineGodowns(
          dto.items,
          await mobileOrderLineGodowns(tx, branchId, dto.items),
        );
        const desktop = await this.desktopFacts(tx, dto, items, {
          branchId,
          accYear,
          orderDay,
          deviceId: device.devId,
        });
        const saveDto = this.toSaveDto(
          dto,
          {
            soBranchId: branchId,
            soAccYear: accYear,
            soDeviceId: device.devId,
            soUserId: this.orderUserId(dto),
            soOrderDate: orderDay,
          },
          items,
          desktop,
        );
        this.saleOrderService.prepareSave(saveDto);
        const created = await this.saleOrderService.createOrderInTx(tx, saveDto);
        await tx.saleOrder.update({
          where: { soId_soAccYear: { soId: created.soId, soAccYear: created.soAccYear } },
          data: { soClientUuid: dto.soClientUuid },
        });
        const confirm = await this.confirmInTx(tx, created);
        if (confirm.confirmedNow) {
          confirmed.keys = {
            soId: created.soId,
            soCompanyId: created.soCompanyId,
            soBranchId: created.soBranchId,
            soAccYear: created.soAccYear,
          };
        }
        return {
          soId: created.soId,
          soOrderRefno: created.soOrderRefno,
          soStatus: confirm.soStatus,
          soAccYear: created.soAccYear,
          duplicate: false,
          soIsDeleted: false,
          confirmRefused: confirm.confirmRefused,
          warnings: confirm.warnings,
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
    const whatsapp = confirmed.keys ? await this.whatsappAfterCommit(confirmed.keys) : null;
    return whatsapp ? { ...answer, whatsapp } : answer;
  }

  /**
   * WhatsApp on Post for the order this upload confirmed, after the commit,
   * through the desktop's own step (SaleOrderLifecycleService.whatsappAfterPost)
   * with waOnPost undefined: only the company's whatsapp.on_post_types decides
   * (user, 2026-11-19). Never a resend, never a DRAFT kept by a refusal. It
   * cannot fail the upload: the hook never throws, and anything that still
   * does is logged and dropped.
   */
  private async whatsappAfterCommit(keys: SaleOrderKeysDto) {
    try {
      return await this.saleOrderLifecycle.whatsappAfterPost(keys, undefined);
    } catch (error: unknown) {
      this.logger.error(
        `WhatsApp on Post for phone order ${keys.soId} failed (the order stands): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * The office's Confirm, on the order just saved, in the same transaction.
   * It runs behind a savepoint: a refusal (confirmRefusalOf: a closed day, a
   * locked or closed year, a salesman who is not the company's …) rolls back
   * only what the confirm wrote, so the saved DRAFT and its so_client_uuid
   * commit and the answer says why (confirmRefused). Anything that is not a
   * refusal is thrown, and fails the whole upload as before. WhatsApp on Post
   * is not sent from here (postInTx never sends): `confirmedNow` tells create()
   * to fire it after the commit.
   */
  private async confirmInTx(
    tx: Prisma.TransactionClient,
    created: SaleOrderPayload,
  ): Promise<
    Pick<MobileOrderCreateResult, 'soStatus' | 'confirmRefused' | 'warnings'> & {
      confirmedNow: boolean;
    }
  > {
    await tx.$executeRaw`SAVEPOINT mobile_order_confirm`;
    try {
      const posted = await this.saleOrderLifecycle.postInTx(
        tx,
        {
          soId: created.soId,
          soCompanyId: created.soCompanyId,
          soBranchId: created.soBranchId,
          soAccYear: created.soAccYear,
        },
        new Date(),
        PHONE_CONFIRM,
      );
      await tx.$executeRaw`RELEASE SAVEPOINT mobile_order_confirm`;
      return {
        soStatus: posted.soStatus,
        confirmRefused: null,
        warnings: posted.warnings,
        confirmedNow: posted.confirmedNow === true,
      };
    } catch (error: unknown) {
      const refused = confirmRefusalOf(error);
      if (!refused) {
        throw error;
      }
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT mobile_order_confirm`;
      return {
        soStatus: created.soStatus,
        confirmRefused: refused,
        warnings: [],
        confirmedNow: false,
      };
    }
  }

  /**
   * so_branch_id. The branch the salesman picked (soBranchId, VKSMAN Switch
   * company, 2026-11-18) when the phone sends one: it must be an active, live
   * branch of the order's company (422 MOBILE_BRANCH_NOT_OF_COMPANY), and no
   * other branch is tried instead. Without one (older phones, and orders saved
   * before the pick existed), the fallback as before: the phone's Device List
   * branch when it is the company's, else the default, else the only branch.
   * No user-to-branch rule applies: the desktop save checks none.
   */
  private orderBranchId(
    tx: MobileReadClient,
    dto: CreateMobileOrderDto,
    deviceBranchId: string | null,
  ): Promise<string> {
    return dto.soBranchId
      ? requireMobileBranchOfCompany(tx, dto.soCompanyId, dto.soBranchId, 'soBranchId')
      : requireMobileBranch(tx, dto.soCompanyId, deviceBranchId);
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

  /**
   * The desktop save payload: the phone's fields, the server's scope, nothing
   * mobile-only. `items` already carry their godown (mobileOrderLineGodowns);
   * the lines and the header then get what the desktop order screen would have
   * sent beside the phone's keys (mobile-order-desktop-fill, user 2026-11-20).
   */
  private toSaveDto(
    dto: CreateMobileOrderDto,
    scope: Pick<
      SaveSaleOrderDto,
      'soBranchId' | 'soAccYear' | 'soDeviceId' | 'soUserId' | 'soOrderDate'
    >,
    items: readonly MobileOrderLineDto[],
    desktop: MobileOrderDesktopFacts,
  ): SaveSaleOrderDto {
    const { soClientUuid: _clientUuid, deviceUid: _deviceUid, ...order } = dto;
    void _clientUuid;
    void _deviceUid;
    const lines = items.map((item, i) => withDesktopLineFigures(item, desktop.lineFacts[i]));
    return {
      ...withDesktopHeaderFigures(order, lines, desktop.customer, desktop.settings),
      items: lines,
      ...scope,
    };
  }

  /**
   * What the desktop order screen reads before it saves, for the phone's
   * order: per line, the item-price lookup it prices a picked line with
   * (company, branch, customer, the line's level, unit and godown, the order's
   * date and year); the customer's GST type and state; the company's pricing
   * settings. A line the lookup cannot price gets null (only what its own
   * money gives is filled), never a refused upload: the phone already priced it.
   */
  private async desktopFacts(
    tx: MobileReadClient,
    dto: CreateMobileOrderDto,
    items: readonly MobileOrderLineDto[],
    scope: { branchId: string; accYear: string; orderDay: string; deviceId: string },
  ): Promise<MobileOrderDesktopFacts> {
    const queryOf = (item: MobileOrderLineDto): ItemPriceLookupQueryDto => ({
      item_id: item.soiItemId,
      unit_id: item.soiItemUnitId,
      company_id: dto.soCompanyId,
      branch_id: scope.branchId,
      customer_id: dto.soCustId,
      ...(item.soiGodownId ? { godown_id: item.soiGodownId } : {}),
      acccyear: scope.accYear,
      price_level: item.soiPriceLevel ?? dto.soPriceLevel,
      doc_date: scope.orderDay,
      regional: false,
    });
    const keyOf = (q: ItemPriceLookupQueryDto) =>
      [q.item_id, q.unit_id, q.price_level, q.godown_id ?? ''].join('|');
    const queries = new Map(items.map((item) => [keyOf(queryOf(item)), queryOf(item)]));
    const factsByKey = new Map<string, DesktopLineFacts | null>();
    const pending = [...queries];
    // A few at a time: each lookup is several reads, and an order can be long.
    const worker = async () => {
      for (let next = pending.shift(); next; next = pending.shift()) {
        const [key, query] = next;
        factsByKey.set(key, await this.lineFacts(query));
      }
    };
    const [customerRows, settings] = await Promise.all([
      // The place of supply is the desktop's state dropdown seeded from the
      // customer's state: only a state of fixed.state_codes (fk_so_pos_state),
      // named as that list names it. A code the list lacks ('TN') sets none.
      tx.$queryRaw<DesktopCustomerFacts[]>`
        SELECT c.cus_gst_type AS "gstType", NULLIF(TRIM(c.cus_state_code), '') AS "stateCode",
               sc.state_code AS "posStateCode", sc.state_name AS "posStateName"
          FROM sales.customers c
          LEFT JOIN fixed.state_codes sc
            ON sc.state_code = c.cus_state_code AND sc.is_deleted = false AND sc.is_active = true
         WHERE c.cus_id = ${dto.soCustId}::uuid`,
      this.appSettings.resolveEffective({
        companyId: dto.soCompanyId,
        branchId: scope.branchId,
        deviceId: scope.deviceId,
        userId: null,
      }),
      ...Array.from({ length: Math.min(4, pending.length) }, worker),
    ]);
    const wanted = new Set<string>(DESKTOP_ORDER_SETTING_KEYS);
    return {
      lineFacts: items.map((item) => factsByKey.get(keyOf(queryOf(item))) ?? null),
      customer: customerRows[0] ?? null,
      settings: new Map(
        settings.filter((s) => wanted.has(s.asdKey)).map((s) => [s.asdKey, s.value] as const),
      ),
    };
  }

  private async lineFacts(query: ItemPriceLookupQueryDto): Promise<DesktopLineFacts | null> {
    try {
      return lineFactsOf(await this.itemPrice.getItemPriceLookup(query));
    } catch (error: unknown) {
      this.logger.warn(
        `Item lookup for phone order line (item ${query.item_id}, unit ${query.unit_id}) failed; ` +
          `the line keeps the phone's figures only: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
      confirmRefused: null,
      warnings: [],
    };
  }
}
