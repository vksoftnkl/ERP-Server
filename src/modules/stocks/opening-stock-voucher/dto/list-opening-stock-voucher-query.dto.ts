import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import {
  NullableUuid,
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * The scope every read on this screen carries.
 *
 * Company, branch and year are required on all of them. stock_voucher is
 * PARTITIONED BY LIST (svh_acc_year) and every index on it starts with
 * (company, branch), so a query missing any of the three is a scan across every
 * partition — which on a chain's second year is every branch's documents for
 * every year they have traded.
 */
export class OpeningStockVoucherScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027', minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;
}

/**
 * GET /stock/opening/get — LOADS EXACTLY ONE DOCUMENT.
 *
 * It used to be a dual-purpose route: `svhId` present loaded one document and
 * `svhId` absent listed them, filtered by status, date and refno and paged.
 * BOTH OF THOSE ARE GONE. The filters went first, and `svhId` is now REQUIRED,
 * which retires the listing branch altogether — there is no query this class
 * can express that does not name one document.
 *
 * WHAT THAT COSTS, said plainly: `/stock/opening` has no list route any more.
 * `StockVoucherService.list` is untouched and the other voucher screens still
 * use it, so a list can be given back at its own path whenever the screen wants
 * one; it is simply not reachable through this one.
 *
 * WHY REQUIRED RATHER THAN OPTIONAL-AND-VALIDATED: an absent `svhId` was a
 * silent mode switch. A client that meant to load a document and dropped the id
 * — a null in a Qt field, a stale binding — got a 200 with somebody else's
 * fifty documents in it instead of an error, and looked like it had worked.
 * Required, that mistake is a 400 naming `svhId`, which is the whole point.
 *
 * NOTE FOR CLIENTS: the API runs with `forbidNonWhitelisted`, so a caller still
 * sending `?status=` or `?limit=` gets a 400 naming the property rather than
 * having it quietly ignored. An old client breaks loudly, which is intended.
 *
 * Structurally this is now the same shape as OpeningStockVoucherRefQueryDto
 * below. It is kept as its own class because it is the one Swagger names on
 * this route, and because the two will not necessarily stay identical.
 */
export class GetOpeningStockVoucherQueryDto extends OpeningStockVoucherScopeQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The document to load. REQUIRED — this route no longer lists.',
  })
  @RequiredUuid()
  svhId!: string;
}

/** The routes that address exactly one document: validate and delete. */
export class OpeningStockVoucherRefQueryDto extends OpeningStockVoucherScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;
}

/** §10 — both reports can cover a 40,000-row item master, so they page. */
export class OpeningStockReportQueryDto extends OpeningStockVoucherScopeQueryDto {
  @ApiPropertyOptional({ default: 200, maximum: 1000 })
  @OptionalQueryInt(1, 1000)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}

/**
 * GET /stock/opening/item-lookup — THE ITEM PICKER, 19q Q6.
 *
 * Runs once per item picked on the line grid. Company and branch are the
 * DOCUMENT's, not the session's, and `onDate` is the document date: the
 * tracking policy is resolved AS AT the date the stock is being opened on, so a
 * back-dated opening is keyed under the policy that was in force then. It is
 * required rather than defaulted to today for exactly that reason — a default
 * would be a silent "as at today" on every back-dated document.
 *
 * No `accYear`: nothing here is read from a partitioned document table. The
 * `alreadyOpened` warning looks across every year on purpose, because an item
 * opened last year is still an item that has been opened.
 */
export class OpeningStockItemLookupQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      "The DOCUMENT's company. Omit, or send null / empty, to look the item up without a company restriction.",
  })
  @NullableUuid()
  companyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      "The DOCUMENT's branch. Omit, or send null / empty, to look the item up without a branch restriction.",
  })
  @NullableUuid()
  branchId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'What the picker returned.' })
  @RequiredUuid()
  itemId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "An iuc_id (inventory.item_unit_conversion), never a unit_id. Omit for the item's default unit.",
  })
  @OptionalUuid()
  uomId?: string;

  @ApiProperty({
    type: 'string',
    format: 'date',
    example: '2026-04-01',
    description: 'The document date. The tracking policy is resolved as at this date, not today.',
  })
  @TrimmedString(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'onDate must be yyyy-MM-dd' })
  onDate!: string;
}
