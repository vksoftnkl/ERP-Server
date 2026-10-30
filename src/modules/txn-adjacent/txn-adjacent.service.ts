import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMenuRight } from '../../common/posting/rights';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  throwBadRequest,
  throwNotFound,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { TxnAdjacentQueryDto } from './dto/txn-adjacent-query.dto';
import { TXN_ADJ, TXN_RIGHT_PREFIX } from './txn-adjacent.errors';
import { TXN_DOC_REGISTRY, type TxnDocSpec, type TxnDocType } from './txn-adjacent.registry';

/** The neighbouring document's KEY: the screen loads it with its own `/get`. */
export interface TxnAdjacentDoc {
  docId: string;
  companyId: string;
  branchId: string;
  accYear: string;
  /** The row's own type: `svh_voucher_type`, `*_doc_type`, or the voucher type code. */
  typeCode: string;
  /** null on a draft that has no number yet (a sale bill, a voucher). */
  refno: string | null;
  /** YYYY-MM-DD */
  date: string;
  status: string;
}

export interface TxnAdjacentPayload {
  docType: TxnDocType;
  direction: 'prev' | 'next';
  /** null when the walk started from an empty screen. */
  fromDocId: string | null;
  /** null at either end of the list. */
  doc: TxnAdjacentDoc | null;
}

/** Where a draft with no serial sorts: below every number, or above every one. */
const DRAFT_SLNO_SQL = {
  LOW: Prisma.raw('0'),
  HIGH: Prisma.raw('9223372036854775807'),
} as const;

/**
 * Notes 142 — ONE Previous / Next (Ctrl+PgUp / Ctrl+PgDn) for every document
 * type, the walk `/vouchers/adjacent` does for the Voucher Register, driven by
 * the fixed registry in txn-adjacent.registry.ts.
 *
 * Walked: this company / branch / year (the year is the partition key), not
 * deleted, the docType's own rows of a shared table, and only rows on a menu
 * the caller may VIEW. Cancelled documents are stops: the lists show them.
 * `typeCode` / `status` / `fromDate` / `toDate` are the list's own filters.
 *
 * Order: `(date, serial, created_on, id)` where the docType's serial is
 * counted branch-wide, `(date, created_on, id)` where it is counted per device
 * or per counter and so cannot order a date's documents (notes 152;
 * TxnDocSpec.serial). Total either way, so the walk never stalls on a tie;
 * prev is `<` and DESC, next `>` and ASC. A document with no serial yet sorts
 * where its list draws it (TxnDocSerial.draft).
 */
@Injectable()
export class TxnAdjacentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async adjacent(q: TxnAdjacentQueryDto): Promise<TxnAdjacentPayload> {
    const spec = TXN_DOC_REGISTRY[q.docType];
    const userId = this.requestContext.getUserId();

    if (q.status && !spec.statuses.includes(q.status)) {
      refuse(
        `No ${spec.label} has the status '${q.status}' (${spec.statuses.join(', ')})`,
        'status',
        TXN_ADJ.STATUS_NOT_IN_DOC,
      );
    }
    await this.assertCanView(spec, q.typeCode, userId);

    const table = Prisma.raw(spec.table);
    const join = spec.join ? Prisma.raw(spec.join) : Prisma.empty;
    const h = (column: string) => Prisma.raw(`h.${column}`);
    const type = Prisma.raw(spec.type);
    const ownRows = ownRowsSql(spec);

    if (q.docId) {
      // All four keys checked, and the docType's own rows only; a miss on any
      // is a 404, so a caller scoped elsewhere does not learn the document exists.
      const current = await this.prisma.$queryRaw<{ found: number }[]>`
        SELECT 1 AS found
          FROM ${table} h
          ${join}
         WHERE ${h(spec.id)}      = ${q.docId}::uuid
           AND ${h(spec.company)} = ${q.companyId}::uuid
           AND ${h(spec.branch)}  = ${q.branchId}::uuid
           AND ${h(spec.year)}    = ${q.accYear}::bpchar
           AND ${h(spec.deleted)} = false
           ${ownRows}
         LIMIT 1`;
      if (current.length === 0) {
        throwNotFound<ModuleErrorDetail>(
          `No ${spec.label} found`,
          'docId',
          `No ${spec.label} ${q.docId} in ${q.accYear} for this company and branch`,
          TXN_ADJ.DOC_NOT_FOUND,
        );
      }
    }

    // Each optional filter is added only when set: a `$x IS NULL OR …` form
    // turns slow once Postgres switches the prepared statement to a generic plan.
    const filters: Prisma.Sql[] = [];
    if (q.typeCode) {
      filters.push(Prisma.sql`AND ${type} = ${q.typeCode}`);
    }
    if (q.status) {
      filters.push(Prisma.sql`AND ${h(spec.status)} = ${q.status}`);
    }
    // DATE columns compared as dates (a JS Date bound as timestamptz lands
    // 5h30 off in the IST session).
    if (q.fromDate) {
      filters.push(Prisma.sql`AND ${h(spec.date)} >= ${q.fromDate}::date`);
    }
    if (q.toDate) {
      filters.push(Prisma.sql`AND ${h(spec.date)} <= ${q.toDate}::date`);
    }

    // The voucher register reads each row on its own type's menu.
    const rightsJoin =
      spec.menu === 'VOUCHER_TYPE'
        ? Prisma.sql`JOIN public.user_menus um ON um.um_menu_id = vt.vchr_menu_id
                                             AND um.um_user_id = ${userId}::uuid
                                             AND um.um_is_deleted = false
                                             AND um.um_can_view = true`
        : Prisma.empty;

    const isPrev = q.direction === 'prev';
    // Both from a closed set the DTO validated; nothing else can reach them.
    const comparison = Prisma.raw(isPrev ? '<' : '>');
    const order = Prisma.raw(isPrev ? 'DESC' : 'ASC');
    const key = walkKey(spec, 'h');
    // The walk key of the document on screen, read in SQL so neither the date
    // nor the microseconds of created_on round-trip through a JS Date. No
    // document → no bound: the first row in walk order is the answer.
    const bound = q.docId
      ? Prisma.sql`AND (${Prisma.join(key)}) ${comparison}
                       (SELECT ${Prisma.join(walkKey(spec, 'c'))}
                          FROM ${table} c
                         WHERE c.${Prisma.raw(spec.id)}   = ${q.docId}::uuid
                           AND c.${Prisma.raw(spec.year)} = ${q.accYear}::bpchar)`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<AdjacentRow[]>`
      SELECT ${h(spec.id)}      AS doc_id,
             ${h(spec.company)} AS company_id,
             ${h(spec.branch)}  AS branch_id,
             ${h(spec.year)}    AS acc_year,
             ${type}            AS type_code,
             ${h(spec.refno)}   AS refno,
             to_char(${h(spec.date)}, 'YYYY-MM-DD') AS doc_date,
             ${h(spec.status)}  AS status
        FROM ${table} h
        ${join}
        ${rightsJoin}
       WHERE ${h(spec.company)} = ${q.companyId}::uuid
         AND ${h(spec.branch)}  = ${q.branchId}::uuid
         AND ${h(spec.year)}    = ${q.accYear}::bpchar
         AND ${h(spec.deleted)} = false
         ${ownRows}
         ${filters.length > 0 ? Prisma.join(filters, ' ') : Prisma.empty}
         ${bound}
       ORDER BY ${Prisma.join(key.map((k) => Prisma.sql`${k} ${order}`))}
       LIMIT 1`;

    const row = rows[0];
    return {
      docType: q.docType,
      direction: q.direction,
      fromDocId: q.docId ?? null,
      doc: row
        ? {
            docId: row.doc_id,
            companyId: row.company_id,
            branchId: row.branch_id,
            accYear: row.acc_year.trim(),
            typeCode: row.type_code,
            refno: row.refno,
            date: row.doc_date,
            status: row.status,
          }
        : null,
    };
  }

  /**
   * VIEW on the docType's menu, or a 403. The voucher register has no menu of
   * its own: without `typeCode` the rows are filtered type by type in the
   * walk; with one, the type must be an active register type and the caller
   * must view ITS menu — `/vouchers/adjacent`'s rule.
   */
  private async assertCanView(
    spec: TxnDocSpec,
    typeCode: string | undefined,
    userId: string | null,
  ): Promise<void> {
    if (typeCode && spec.types && !spec.types.includes(typeCode)) {
      refuse(
        `No ${spec.label} has the type '${typeCode}' (${spec.types.join(', ')})`,
        'typeCode',
        TXN_ADJ.TYPE_NOT_IN_DOC,
      );
    }

    let menuId: number | null = spec.menu === 'VOUCHER_TYPE' ? null : spec.menu;
    if (spec.menu === 'VOUCHER_TYPE' && typeCode) {
      const types = await this.prisma.$queryRaw<{ vchr_menu_id: number | null }[]>`
        SELECT vchr_menu_id
          FROM accounts.acc_voucher_types
         WHERE vchr_type_code   = ${typeCode}
           AND vchr_is_active   = true
           AND vchr_in_register = true
         LIMIT 1`;
      if (types.length === 0 || types[0].vchr_menu_id === null) {
        refuse(
          `'${typeCode}' is not an active Voucher Register type`,
          'typeCode',
          TXN_ADJ.TYPE_NOT_IN_DOC,
        );
      }
      menuId = types[0].vchr_menu_id;
    }

    if (menuId !== null) {
      await assertMenuRight(this.prisma, {
        userId,
        menuId,
        right: 'view',
        codePrefix: TXN_RIGHT_PREFIX,
        action: `view ${spec.label}s`,
      });
    }
  }
}

/** The rows of a shared table that are this docType's. Fixed SQL and bound type values. */
function ownRowsSql(spec: TxnDocSpec): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (spec.types) {
    parts.push(Prisma.sql`AND ${Prisma.raw(spec.type)} IN (${Prisma.join([...spec.types])})`);
  }
  if (spec.where) {
    parts.push(Prisma.sql`AND ${Prisma.raw(spec.where)}`);
  }
  return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
}

/**
 * `(date, serial, created_on, id)` on one alias — the serial only where the
 * registry keeps one, coalesced where drafts have none (notes 152).
 */
function walkKey(spec: TxnDocSpec, alias: 'h' | 'c'): Prisma.Sql[] {
  const col = (column: string) => Prisma.raw(`${alias}.${column}`);
  const serial = spec.serial
    ? spec.serial.draft === null
      ? col(spec.serial.column)
      : Prisma.sql`COALESCE(${col(spec.serial.column)}, ${DRAFT_SLNO_SQL[spec.serial.draft]})`
    : null;
  return [col(spec.date), ...(serial ? [serial] : []), col(spec.createdOn), col(spec.id)];
}

/** 400 — the request names something this docType does not have. */
function refuse(message: string, field: string, code: string): never {
  throwBadRequest<ModuleErrorDetail>(message, [{ field, message, code }]);
}

/** One neighbouring row, as the raw query hands it back. */
interface AdjacentRow {
  doc_id: string;
  company_id: string;
  branch_id: string;
  acc_year: string;
  type_code: string;
  refno: string | null;
  doc_date: string;
  status: string;
}
