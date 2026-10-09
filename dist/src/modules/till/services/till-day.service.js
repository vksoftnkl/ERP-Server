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
exports.TillDayService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
const till_event_service_1 = require("./till-event.service");
const till_enum_1 = require("../types/till-enum");
let TillDayService = class TillDayService {
    prisma;
    events;
    constructor(prisma, events) {
        this.prisma = prisma;
        this.events = events;
    }
    async ensureOpenDay(tx, scope, settings, caller, by) {
        const autoOpen = by === 'MANAGER' || settings.dayAutoOpen;
        const businessDate = await (0, till_dates_1.businessDateNow)(tx, settings.dayCutoff);
        const accYear = (0, till_dates_1.accYearOf)(businessDate);
        await (0, till_dates_1.assertTillPartitions)(tx, accYear, 'businessDate');
        let created = false;
        if (autoOpen) {
            const inserted = await tx.$queryRaw `
        INSERT INTO accounts.till_business_day
               (tbd_company_id, tbd_branch_id, tbd_tenant_id, tbd_acc_year, tbd_business_date,
                tbd_status, tbd_opened_by, tbd_created_by)
        VALUES (${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.tenantId}::uuid,
                ${accYear}::char(9), ${businessDate}::date,
                'OPEN', ${caller.userId}::uuid, ${caller.actorName})
        ON CONFLICT (tbd_company_id, tbd_branch_id, tbd_business_date, tbd_acc_year)
          WHERE tbd_is_deleted = false
          DO NOTHING
        RETURNING tbd_id`;
            created = inserted.length === 1;
        }
        const day = await tx.tillBusinessDay.findFirst({
            where: {
                tbdCompanyId: scope.companyId,
                tbdBranchId: scope.branchId,
                tbdAccYear: accYear,
                tbdBusinessDate: (0, till_dates_1.dateParam)(businessDate),
                tbdIsDeleted: false,
            },
            select: { tbdId: true, tbdStatus: true },
        });
        if (!day) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_NOT_OPEN, `Business day ${businessDate} is not open. A manager opens it (Business Day, menu 274), or set till.day_auto_open.`, 'businessDate', { businessDate });
        }
        const status = day.tbdStatus;
        if (status === till_enum_1.TillDayStatus.CLOSING) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSING, `Business day ${businessDate} is closing: no new session may open`, 'businessDate', { businessDate });
        }
        if (status === till_enum_1.TillDayStatus.CLOSED) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SALES_DAY_CLOSED, `Business day ${businessDate} is closed`, 'businessDate', { businessDate });
        }
        if (created) {
            await this.events.log(tx, {
                companyId: scope.companyId,
                branchId: scope.branchId,
                accYear,
                code: till_enum_1.TillEventCode.DAY_OPEN,
                dayId: day.tbdId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                payload: { businessDate, openedBy: by },
            });
        }
        return { tbdId: day.tbdId, tbdAccYear: accYear, businessDate, created };
    }
    async open(scope, settings, caller) {
        const opened = await this.prisma.$transaction((tx) => this.ensureOpenDay(tx, scope, settings, caller, 'MANAGER'));
        return {
            day: await this.get({ ...scope, accYear: opened.tbdAccYear, tbdId: opened.tbdId }),
            created: opened.created,
        };
    }
    async get(scope, settings) {
        let where;
        if (scope.tbdId) {
            where = { tbdId: scope.tbdId, tbdAccYear: scope.accYear };
        }
        else {
            const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings?.dayCutoff ?? '04:00');
            where = { tbdAccYear: (0, till_dates_1.accYearOf)(businessDate), tbdBusinessDate: (0, till_dates_1.dateParam)(businessDate) };
        }
        const day = await this.prisma.tillBusinessDay.findFirst({
            where: {
                ...where,
                tbdCompanyId: scope.companyId,
                tbdBranchId: scope.branchId,
                tbdIsDeleted: false,
            },
        });
        if (!day) {
            (0, till_errors_1.throwTillNotFound)('Business day', 'tbdId', scope.tbdId ?? 'for today');
        }
        const counts = await this.prisma.tillSession.groupBy({
            by: ['tssStatus'],
            where: { tssDayId: day.tbdId, tssAccYear: day.tbdAccYear, tssIsDeleted: false },
            _count: { _all: true },
        });
        return {
            tbdId: day.tbdId,
            tbdAccYear: day.tbdAccYear,
            tbdCompanyId: day.tbdCompanyId,
            tbdBranchId: day.tbdBranchId,
            tbdBusinessDate: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
            tbdStatus: day.tbdStatus,
            tbdOpenedOn: day.tbdOpenedOn.toISOString(),
            tbdOpenedBy: day.tbdOpenedBy,
            tbdClosedOn: day.tbdClosedOn ? day.tbdClosedOn.toISOString() : null,
            tbdZNo: day.tbdZNo,
            tbdReopenCount: day.tbdReopenCount,
            sessions: counts.map((c) => ({
                status: c.tssStatus,
                count: c._count._all,
            })),
        };
    }
};
exports.TillDayService = TillDayService;
exports.TillDayService = TillDayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_event_service_1.TillEventService])
], TillDayService);
//# sourceMappingURL=till-day.service.js.map