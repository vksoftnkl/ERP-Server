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
exports.TxnStatusService = exports.PENDING_STATUSES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
exports.PENDING_STATUSES = ['DRAFT', 'HELD', 'CONFIRMED', 'IN_TRANSIT'];
let TxnStatusService = class TxnStatusService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async pending(query) {
        const limit = Math.min(Math.max(query.limit ?? 200, 1), 2000);
        const offset = Math.max(query.offset ?? 0, 0);
        const branchId = query.branchId ?? null;
        const srcModule = query.srcModule?.trim().toUpperCase() || null;
        const upTo = query.upToDate ? new Date(`${query.upToDate}T23:59:59.999`) : null;
        const latest = client_1.Prisma.sql `
      SELECT DISTINCT ON (tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_acc_year)
             tsl.tsl_src_module, tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_src_doc_refno,
             tsl.tsl_acc_year, tsl.tsl_event, tsl.tsl_to_status, tsl.tsl_changed_on,
             tsl.tsl_changed_by, tsl.tsl_branch_id
        FROM public.txn_status_log tsl
       WHERE tsl.tsl_company_id = ${query.companyId}::uuid
         AND tsl.tsl_acc_year   = ${query.accYear}::bpchar
         AND (${branchId}::uuid IS NULL OR tsl.tsl_branch_id = ${branchId}::uuid)
         AND (${srcModule}::text IS NULL OR tsl.tsl_src_module = ${srcModule}::text)
         AND (${upTo}::timestamptz IS NULL OR tsl.tsl_changed_on <= ${upTo}::timestamptz)
         AND tsl.tsl_is_deleted = false
       ORDER BY tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_acc_year, tsl.tsl_seq_no DESC
    `;
        const pendingWhere = client_1.Prisma.sql `
      l.tsl_to_status = ANY(${[...exports.PENDING_STATUSES]}::text[])
      AND l.tsl_event <> 'DELETED'
    `;
        const [rows, counts] = await Promise.all([
            this.prisma.$queryRaw `
        WITH latest AS (${latest})
        SELECT l.tsl_src_module, l.tsl_src_doc_type, l.tsl_src_doc_id, l.tsl_src_doc_refno,
               l.tsl_acc_year, l.tsl_to_status, l.tsl_changed_on, l.tsl_changed_by, l.tsl_branch_id,
               u.usr_login_name AS changed_by_name,
               COUNT(*) OVER () AS total_count
          FROM latest l
          LEFT JOIN public.user_master u ON u.usr_id = l.tsl_changed_by
         WHERE ${pendingWhere}
         ORDER BY l.tsl_changed_on ASC, l.tsl_src_doc_refno
         LIMIT ${limit} OFFSET ${offset}
      `,
            this.prisma.$queryRaw `
        WITH latest AS (${latest})
        SELECT l.tsl_src_module, l.tsl_src_doc_type, l.tsl_to_status, COUNT(*) AS n
          FROM latest l
         WHERE ${pendingWhere}
         GROUP BY 1, 2, 3
         ORDER BY 1, 2, 3
      `,
        ]);
        return {
            items: rows.map((r) => ({
                srcModule: r.tsl_src_module,
                srcDocType: r.tsl_src_doc_type,
                srcDocId: r.tsl_src_doc_id,
                refno: r.tsl_src_doc_refno,
                accYear: r.tsl_acc_year.trim(),
                status: r.tsl_to_status,
                since: r.tsl_changed_on.toISOString(),
                changedBy: r.tsl_changed_by,
                changedByName: r.changed_by_name,
                branchId: r.tsl_branch_id,
            })),
            counts: counts.map((c) => ({
                srcModule: c.tsl_src_module,
                srcDocType: c.tsl_src_doc_type,
                status: c.tsl_to_status,
                count: Number(c.n),
            })),
            total: Number(rows[0]?.total_count ?? 0),
        };
    }
};
exports.TxnStatusService = TxnStatusService;
exports.TxnStatusService = TxnStatusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TxnStatusService);
//# sourceMappingURL=txn-status.service.js.map