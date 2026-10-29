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
exports.TillEventService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_errors_1 = require("../till-errors");
const till_enum_1 = require("../types/till-enum");
let TillEventService = class TillEventService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(tx, event) {
        await tx.tillEvent.create({
            data: {
                tevCompanyId: event.companyId,
                tevBranchId: event.branchId,
                tevAccYear: event.accYear,
                tevEventCode: event.code,
                tevEventOn: event.eventOn ?? new Date(),
                tevSessionId: event.sessionId ?? null,
                tevDayId: event.dayId ?? null,
                tevCounterId: event.counterId ?? null,
                tevDeviceId: event.deviceId ?? null,
                tevUserId: event.userId ?? null,
                tevSrcDocType: event.srcDocType ?? null,
                tevSrcDocId: event.srcDocId ?? null,
                tevSrcRefno: event.srcRefno ?? null,
                tevAmount: event.amount ?? null,
                tevReasonId: event.reasonId ?? null,
                tevApprovalId: event.approvalId ?? null,
                tevClientSeq: event.clientSeq ?? null,
                tevPayload: event.payload ?? client_1.Prisma.JsonNull,
            },
        });
    }
    async ingestBatch(scope) {
        scope.events.forEach((event, index) => {
            if (!till_enum_1.CLIENT_EVENT_CODES.includes(event.code)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.EVENT_INVALID, `${event.code} is not an event a device may report (allowed: ${till_enum_1.CLIENT_EVENT_CODES.join(', ')})`, `events.${index}.code`);
            }
        });
        const sessionIds = [
            ...new Set(scope.events.map((e) => e.sessionId).filter((id) => !!id)),
        ];
        if (sessionIds.length > 0) {
            const found = await this.prisma.tillSession.findMany({
                where: {
                    tssId: { in: sessionIds },
                    tssAccYear: scope.accYear,
                    tssCompanyId: scope.companyId,
                    tssBranchId: scope.branchId,
                },
                select: { tssId: true, tssCounterId: true },
            });
            const known = new Map(found.map((s) => [s.tssId, s.tssCounterId]));
            scope.events.forEach((event, index) => {
                if (event.sessionId && !known.has(event.sessionId)) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, `Session ${event.sessionId} is not a ${scope.accYear} session of this branch`, `events.${index}.sessionId`);
                }
            });
            return this.insertBatch(scope, known);
        }
        return this.insertBatch(scope, new Map());
    }
    async insertBatch(scope, counterBySession) {
        if (scope.events.length === 0) {
            return { accepted: 0, duplicates: 0 };
        }
        const values = scope.events.map((e) => client_1.Prisma.sql `(
        ${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.accYear}::char(9),
        ${e.code}, ${e.eventOn}::timestamptz,
        ${e.sessionId ?? null}::uuid,
        ${e.sessionId ? (counterBySession.get(e.sessionId) ?? null) : null}::uuid,
        ${scope.deviceId}::uuid, ${scope.userId}::uuid,
        ${e.srcDocType ?? null}, ${e.srcDocId ?? null}::uuid, ${e.srcRefno ?? null},
        ${e.amount ?? null}::numeric, ${e.reasonId ?? null}::uuid,
        ${e.clientSeq}::bigint,
        ${e.payload === undefined || e.payload === null ? null : JSON.stringify(e.payload)}::jsonb
      )`);
        const inserted = await this.prisma.$executeRaw `
      INSERT INTO accounts.till_event (
        tev_company_id, tev_branch_id, tev_acc_year,
        tev_event_code, tev_event_on,
        tev_session_id, tev_counter_id,
        tev_device_id, tev_user_id,
        tev_src_doc_type, tev_src_doc_id, tev_src_refno,
        tev_amount, tev_reason_id,
        tev_client_seq, tev_payload
      ) VALUES ${client_1.Prisma.join(values)}
      ON CONFLICT (tev_device_id, tev_client_seq, tev_acc_year)
        WHERE tev_device_id IS NOT NULL AND tev_client_seq IS NOT NULL
        DO NOTHING`;
        return { accepted: inserted, duplicates: scope.events.length - inserted };
    }
};
exports.TillEventService = TillEventService;
exports.TillEventService = TillEventService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TillEventService);
//# sourceMappingURL=till-event.service.js.map