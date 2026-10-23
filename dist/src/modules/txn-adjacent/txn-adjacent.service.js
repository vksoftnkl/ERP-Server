"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxnAdjacentService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const rights_1 = require("../../common/posting/rights");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const txn_adjacent_errors_1 = require("./txn-adjacent.errors");
const txn_adjacent_registry_1 = require("./txn-adjacent.registry");
const DRAFT_SLNO_SQL = {
    LOW: client_1.Prisma.raw('0'),
    HIGH: client_1.Prisma.raw('9223372036854775807'),
};
let TxnAdjacentService = class TxnAdjacentService {
    prisma;
    requestContext;
    constructor(prisma, requestContext) {
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async adjacent(q) {
        const spec = txn_adjacent_registry_1.TXN_DOC_REGISTRY[q.docType];
        const userId = this.requestContext.getUserId();
        if (q.status && !spec.statuses.includes(q.status)) {
            refuse(`No ${spec.label} has the status '${q.status}' (${spec.statuses.join(', ')})`, 'status', txn_adjacent_errors_1.TXN_ADJ.STATUS_NOT_IN_DOC);
        }
        await this.assertCanView(spec, q.typeCode, userId);
        const table = client_1.Prisma.raw(spec.table);
        const join = spec.join ? client_1.Prisma.raw(spec.join) : client_1.Prisma.empty;
        const h = (column) => client_1.Prisma.raw(`h.${column}`);
        const type = client_1.Prisma.raw(spec.type);
        const ownRows = ownRowsSql(spec);
        if (q.docId) {
            const current = await this.prisma.$queryRaw `
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
                (0, module_shared_utils_1.throwNotFound)(`No ${spec.label} found`, 'docId', `No ${spec.label} ${q.docId} in ${q.accYear} for this company and branch`, txn_adjacent_errors_1.TXN_ADJ.DOC_NOT_FOUND);
            }
        }
        const filters = [];
        if (q.typeCode) {
            filters.push(client_1.Prisma.sql `AND ${type} = ${q.typeCode}`);
        }
        if (q.status) {
            filters.push(client_1.Prisma.sql `AND ${h(spec.status)} = ${q.status}`);
        }
        if (q.fromDate) {
            filters.push(client_1.Prisma.sql `AND ${h(spec.date)} >= ${q.fromDate}::date`);
        }
        if (q.toDate) {
            filters.push(client_1.Prisma.sql `AND ${h(spec.date)} <= ${q.toDate}::date`);
        }
        const rightsJoin = spec.menu === 'VOUCHER_TYPE'
            ? client_1.Prisma.sql `JOIN public.user_menus um ON um.um_menu_id = vt.vchr_menu_id
                                             AND um.um_user_id = ${userId}::uuid
                                             AND um.um_is_deleted = false
                                             AND um.um_can_view = true`
            : client_1.Prisma.empty;
        const isPrev = q.direction === 'prev';
        const comparison = client_1.Prisma.raw(isPrev ? '<' : '>');
        const order = client_1.Prisma.raw(isPrev ? 'DESC' : 'ASC');
        const key = walkKey(spec, 'h');
        const bound = q.docId
            ? client_1.Prisma.sql `AND (${client_1.Prisma.join(key)}) ${comparison}
                       (SELECT ${client_1.Prisma.join(walkKey(spec, 'c'))}
                          FROM ${table} c
                         WHERE c.${client_1.Prisma.raw(spec.id)}   = ${q.docId}::uuid
                           AND c.${client_1.Prisma.raw(spec.year)} = ${q.accYear}::bpchar)`
            : client_1.Prisma.empty;
        const rows = await this.prisma.$queryRaw `
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
         ${filters.length > 0 ? client_1.Prisma.join(filters, ' ') : client_1.Prisma.empty}
         ${bound}
       ORDER BY ${client_1.Prisma.join(key.map((k) => client_1.Prisma.sql `${k} ${order}`))}
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
    async assertCanView(spec, typeCode, userId) {
        if (typeCode && spec.types && !spec.types.includes(typeCode)) {
            refuse(`No ${spec.label} has the type '${typeCode}' (${spec.types.join(', ')})`, 'typeCode', txn_adjacent_errors_1.TXN_ADJ.TYPE_NOT_IN_DOC);
        }
        let menuId = spec.menu === 'VOUCHER_TYPE' ? null : spec.menu;
        if (spec.menu === 'VOUCHER_TYPE' && typeCode) {
            const types = await this.prisma.$queryRaw `
        SELECT vchr_menu_id
          FROM accounts.acc_voucher_types
         WHERE vchr_type_code   = ${typeCode}
           AND vchr_is_active   = true
           AND vchr_in_register = true
         LIMIT 1`;
            if (types.length === 0 || types[0].vchr_menu_id === null) {
                refuse(`'${typeCode}' is not an active Voucher Register type`, 'typeCode', txn_adjacent_errors_1.TXN_ADJ.TYPE_NOT_IN_DOC);
            }
            menuId = types[0].vchr_menu_id;
        }
        if (menuId !== null) {
            await (0, rights_1.assertMenuRight)(this.prisma, {
                userId,
                menuId,
                right: 'view',
                codePrefix: txn_adjacent_errors_1.TXN_RIGHT_PREFIX,
                action: `view ${spec.label}s`,
            });
        }
    }
};
exports.TxnAdjacentService = TxnAdjacentService;
exports.TxnAdjacentService = TxnAdjacentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], TxnAdjacentService);
function ownRowsSql(spec) {
    const parts = [];
    if (spec.types) {
        parts.push(client_1.Prisma.sql `AND ${client_1.Prisma.raw(spec.type)} IN (${client_1.Prisma.join([...spec.types])})`);
    }
    if (spec.where) {
        parts.push(client_1.Prisma.sql `AND ${client_1.Prisma.raw(spec.where)}`);
    }
    return parts.length > 0 ? client_1.Prisma.join(parts, ' ') : client_1.Prisma.empty;
}
function walkKey(spec, alias) {
    const col = (column) => client_1.Prisma.raw(`${alias}.${column}`);
    const slno = spec.draftSlno === null
        ? col(spec.slno)
        : client_1.Prisma.sql `COALESCE(${col(spec.slno)}, ${DRAFT_SLNO_SQL[spec.draftSlno]})`;
    return [col(spec.date), slno, col(spec.createdOn), col(spec.id)];
}
function refuse(message, field, code) {
    (0, module_shared_utils_1.throwBadRequest)(message, [{ field, message, code }]);
}
//# sourceMappingURL=txn-adjacent.service.js.map