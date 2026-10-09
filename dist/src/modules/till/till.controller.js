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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TillController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const till_context_service_1 = require("./till-context.service");
const till_exception_filter_1 = require("./till-exception.filter");
const till_errors_1 = require("./till-errors");
const till_day_service_1 = require("./services/till-day.service");
const till_event_service_1 = require("./services/till-event.service");
const till_session_service_1 = require("./services/till-session.service");
const till_movement_service_1 = require("./services/till-movement.service");
const till_slip_check_service_1 = require("./services/till-slip-check.service");
const till_session_dto_1 = require("./dto/till-session.dto");
const till_response_dto_1 = require("./dto/till-response.dto");
const till_enum_1 = require("./types/till-enum");
let TillController = class TillController {
    prisma;
    context;
    days;
    sessions;
    events;
    movements;
    slipCheck;
    constructor(prisma, context, days, sessions, events, movements, slipCheck) {
        this.prisma = prisma;
        this.context = context;
        this.days = days;
        this.sessions = sessions;
        this.events = events;
        this.movements = movements;
        this.slipCheck = slipCheck;
    }
    async openDay(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.BUSINESS_DAY, 'create', 'open the business day');
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            ...dto,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const { day, created } = await this.days.open({ companyId: dto.companyId, branchId: dto.branchId, tenantId: dto.tenantId ?? null }, settings, caller);
        return {
            success: true,
            message: created
                ? `Business day ${day.tbdBusinessDate} opened`
                : `Business day ${day.tbdBusinessDate} is already open`,
            data: day,
        };
    }
    async getDay(query) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.BUSINESS_DAY, 'view'],
            [till_enum_1.TILL_MENU.OPEN_TILL, 'view'],
        ], 'view the business day');
        if (query.tbdId && !query.accYear) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'tbdId travels with its accYear', 'accYear');
        }
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            ...query,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const day = await this.days.get({
            companyId: query.companyId,
            branchId: query.branchId,
            accYear: query.accYear ?? '',
            tbdId: query.tbdId ?? null,
        }, settings);
        return {
            success: true,
            message: `Business day ${day.tbdBusinessDate} is ${day.tbdStatus}`,
            data: day,
        };
    }
    async openCheck(query) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'view', 'check a till open');
        const data = await this.sessions.openCheck({
            companyId: query.companyId,
            branchId: query.branchId,
            deviceId: query.deviceId ?? null,
            userId: query.userId ?? null,
            counterId: query.counterId ?? null,
        });
        const where = data.linkedCounter
            ? `linked to ${data.linkedCounter.code}`
            : `${data.freeCounters.length} free counter(s)`;
        return {
            success: true,
            message: data.requireSession
                ? `This device needs a till session: ${where}`
                : 'No till session needed here',
            data,
        };
    }
    async open(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'create', 'open a till session');
        const data = await this.sessions.open({
            companyId: dto.companyId,
            branchId: dto.branchId,
            tenantId: dto.tenantId ?? null,
            counterId: dto.counterId ?? null,
            floatMode: dto.floatMode ?? null,
            floatIssued: dto.floatIssued ?? null,
            prevSessionId: dto.prevSessionId ?? null,
            lines: dto.lines,
            reasonId: dto.reasonId ?? null,
            notes: dto.notes ?? null,
        });
        return { success: true, message: `Session ${data.tssSessionNo} opened`, data };
    }
    async current(query) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'view', 'view your till session');
        const data = await this.sessions.current(query);
        return {
            success: true,
            message: data ? `Session ${data.tssSessionNo} is ${data.tssStatus}` : 'No live till session',
            data,
        };
    }
    async get(query) {
        const asOperator = await this.requireSessionView(query);
        const data = await this.sessions.get(query, { asOperator });
        return { success: true, message: `Session ${data.tssSessionNo} is ${data.tssStatus}`, data };
    }
    async slipCheckRows(query) {
        await this.assertApprover(query, 'check the slips of a till session');
        const data = await this.slipCheck.rows(query);
        return {
            success: true,
            message: `${data.rows.length} row(s) on ${data.tenderName ?? 'the terminal'}`,
            data,
        };
    }
    async slipCheckRecord(dto) {
        await this.assertApprover(dto, 'record a slip check');
        const data = await this.slipCheck.record(dto);
        return { success: true, message: 'Slip check recorded', data };
    }
    async expected(query) {
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'override', 'see the expected till figures');
        const caller = await this.context.caller();
        const owner = await this.operatorOf(query);
        if (owner.tssOperatorId === caller.userId && owner.tssStatus !== 'CLOSED') {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.BLIND_CLOSE, 'The cashier of a session does not see its expected figures before it closes', 'tssId');
        }
        const data = await this.sessions.getWithExpected(query);
        return { success: true, message: `Session ${data.tssSessionNo} — expected figures`, data };
    }
    async suspend(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'edit', 'suspend a till session');
        const data = await this.sessions.suspend(dto, dto.reasonId ?? null);
        return { success: true, message: `Session ${data.tssSessionNo} suspended`, data };
    }
    async resume(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'edit', 'resume a till session');
        const data = await this.sessions.resume(dto);
        return { success: true, message: `Session ${data.tssSessionNo} resumed`, data };
    }
    async endBilling(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'edit', 'end billing on a till session');
        const data = await this.sessions.endBilling({ companyId: dto.companyId, branchId: dto.branchId, accYear: dto.accYear, tssId: dto.tssId }, { outboxCount: dto.outboxCount ?? null, lastClientSeq: dto.lastClientSeq ?? null });
        return { success: true, message: `Session ${data.tssSessionNo} stopped billing`, data };
    }
    async count(dto) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.OPEN_TILL, 'edit'],
            [till_enum_1.TILL_MENU.SESSIONS, 'override'],
        ], 'count a till session');
        const data = await this.sessions.count(dto, {
            lines: dto.lines,
            witnessBy: dto.witnessBy ?? null,
            notes: dto.notes ?? null,
        });
        return { success: true, message: `Count ${data.attemptNo}: ${data.outcome}`, data };
    }
    async close(dto) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.OPEN_TILL, 'edit'],
            [till_enum_1.TILL_MENU.SESSIONS, 'override'],
        ], 'close a till session');
        const data = await this.sessions.close(dto, {
            floatLeft: dto.floatLeft ?? null,
            notes: dto.notes ?? null,
        });
        return {
            success: true,
            message: `Session ${data.tssSessionNo} closed — Z ${data.tssZNo}`,
            data,
        };
    }
    async createMovement(dto) {
        const kind = dto.kind;
        if (till_enum_1.SUPERVISOR_MOVEMENTS.includes(kind)) {
            await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'override', `take a till ${kind.toLowerCase()}`);
        }
        else {
            await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'edit', `post a till ${kind.toLowerCase()}`);
        }
        const data = await this.movements.create({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            tssId: dto.tssId,
            kind,
            amount: dto.amount ?? null,
            lines: dto.lines,
            outLines: dto.outLines,
            reasonId: dto.reasonId ?? null,
            ledgerId: dto.ledgerId ?? null,
            refNo: dto.refNo ?? null,
            refDate: dto.refDate ?? null,
            partyName: dto.partyName ?? null,
            bagNo: dto.bagNo ?? null,
            sealNo: dto.sealNo ?? null,
            witnessBy: dto.witnessBy ?? null,
            notes: dto.notes ?? null,
        });
        return { success: true, message: `${data.tcmKind} ${data.tcmDocNo} posted`, data };
    }
    async change(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'override', 'carry change between counters');
        const data = await this.movements.change({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            fromTssId: dto.fromTssId,
            toTssId: dto.toTssId,
            lines: dto.lines,
            reasonId: dto.reasonId,
            notes: dto.notes ?? null,
        });
        return {
            success: true,
            message: `${data.from.tcmDocNo} → ${data.to.tcmDocNo}: ${data.from.tcmAmount} carried`,
            data,
        };
    }
    async getMovement(query) {
        const caller = await this.context.caller();
        const operator = await this.movements.operatorOf(query);
        if (operator && operator === caller.userId) {
            await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'view', 'view your till movements');
        }
        else {
            await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'view', 'view till movements');
        }
        const data = await this.movements.get(query);
        return { success: true, message: `${data.tcmKind} ${data.tcmDocNo}`, data };
    }
    async voidMovement(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'override', 'void a till movement');
        const data = await this.movements.void({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            tcmId: dto.tcmId,
            reasonId: dto.reasonId,
            notes: dto.notes ?? null,
        });
        return { success: true, message: `${data.tcmKind} ${data.tcmDocNo} voided`, data };
    }
    async batch(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'view', 'report till events');
        const caller = await this.context.caller();
        if (!caller.deviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DEVICE_REQUIRED, 'Till events come from a registered device', 'deviceId');
        }
        const data = await this.events.ingestBatch({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            deviceId: caller.deviceId,
            userId: caller.userId,
            events: dto.events.map((e) => ({
                code: e.code,
                eventOn: new Date(e.eventOn),
                clientSeq: BigInt(e.clientSeq),
                sessionId: e.sessionId ?? null,
                srcDocType: e.srcDocType ?? null,
                srcDocId: e.srcDocId ?? null,
                srcRefno: e.srcRefno ?? null,
                amount: e.amount === null || e.amount === undefined ? null : new client_1.Prisma.Decimal(e.amount),
                reasonId: e.reasonId ?? null,
                payload: (e.payload ?? null),
            })),
        });
        return {
            success: true,
            message: `${data.accepted} event(s) stored, ${data.duplicates} already had`,
            data,
        };
    }
    async requireAny(options, action) {
        for (const [menuId, right] of options) {
            const rights = await this.context.rights(menuId);
            if (rights[right]) {
                return;
            }
        }
        const [menuId, right] = options[0];
        await this.context.requireRight(menuId, right, action);
    }
    async requireSessionView(key) {
        const caller = await this.context.caller();
        const owner = await this.operatorOf(key);
        if (owner.tssOperatorId === caller.userId) {
            await this.context.requireRight(till_enum_1.TILL_MENU.OPEN_TILL, 'view', 'view your till session');
            return true;
        }
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'view', 'view another cashier’s till session');
        return false;
    }
    async assertApprover(key, action) {
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'override', action);
        const caller = await this.context.caller();
        const owner = await this.operatorOf(key);
        if (owner.tssOperatorId === caller.userId && owner.tssStatus !== 'CLOSED') {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.BLIND_CLOSE, 'The cashier of a session does not see its expected figures before it closes', 'tssId');
        }
    }
    async operatorOf(key) {
        const row = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
            select: { tssOperatorId: true, tssStatus: true },
        });
        if (!row) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, `Till session ${key.tssId} was not found`, 'tssId');
        }
        return row;
    }
};
exports.TillController = TillController;
__decorate([
    (0, common_1.Post)('days/open'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Day Open — open today’s business day for the branch',
        description: 'The only way in when till.day_auto_open is false. Idempotent: an open day is returned as it is. ' +
            'Business Day (274) CREATE.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_DAY_CLOSING · SALES_DAY_CLOSED · TILL_YEAR_NOT_SET_UP',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.OpenTillDayDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "openDay", null);
__decorate([
    (0, common_1.Get)('days/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A business day — today’s when no id is given',
        description: 'Status and the sessions hanging off it, by status. Business Day (274) VIEW, or Open Till (272) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillDayGetQueryDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "getDay", null);
__decorate([
    (0, common_1.Get)('sessions/open-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Everything S1 needs before an open, in one call (plan-till-counter-claim §4)',
        description: 'requireSession (false = back office: no S1) · the business day · the counter this device is linked to, or the ' +
            'free counters it may pick (and the busy ones, with who holds them) · a session this device already holds · this ' +
            'user’s session on another device · the carried float. Every free counter carries its own carriedFrom; the ' +
            'top-level one is the linked counter’s, or the counterId asked for. The device and the user are the login’s. ' +
            'Read-only advice: open checks it all again. Open Till (272) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_DEVICE_REQUIRED · TILL_DEVICE_UNKNOWN',
    }),
    (0, swagger_1.ApiForbiddenResponse)({ type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_DEVICE_BLOCKED' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillOpenCheckQueryDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "openCheck", null);
__decorate([
    (0, common_1.Post)('sessions/open'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Open a till session on this device’s counter (S1)',
        description: 'Counter (plan-till-counter-claim §2): a device linked to a counter opens there; an unlinked one names a counter ' +
            'from open-check’s free list. Nothing is written to the counter: the session is stamped with this device and ' +
            'money posts only from it. One live session per counter, per device and per cashier. Opens the business day ' +
            'if till.day_auto_open. The float: ISSUED posts a TFlt (Dr till cash / Cr safe) for what the safe hands over; ' +
            'CARRIED inherits what the previous close left. The opening count is cash only; counted ≠ issued posts the ' +
            'difference at once as an OPEN-stage variance (TVar Dr / Cr Cash Short & Excess against till cash, treatment ' +
            'EXPENSE, the FLOAT_MISMATCH `reasonId` or the UNKNOWN reason) — the phase-3 approver re-treats it. ' +
            'Open Till (272) CREATE.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_DEVICE_REQUIRED · TILL_DEVICE_UNKNOWN · TILL_COUNTER_INACTIVE · TILL_COUNTER_NOT_YOURS · ' +
            'TILL_NO_FREE_COUNTER · TILL_COUNTER_BUSY · TILL_OPERATOR_BUSY · TILL_DAY_NOT_OPEN · TILL_DAY_CLOSING · ' +
            'SALES_DAY_CLOSED',
    }),
    (0, swagger_1.ApiForbiddenResponse)({ type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_DEVICE_BLOCKED' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_FLOAT_INVALID · TILL_COUNT_INVALID · TILL_REASON_INVALID · TILL_SAFE_MISSING · TILL_LEDGER_UNMAPPED',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.OpenTillSessionDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "open", null);
__decorate([
    (0, common_1.Get)('sessions/current'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The live session for this device or this user — resume at login',
        description: '`data` is null when there is none. Superseded by sessions/open-check (plan-till-counter-claim §0). ' +
            'Open Till (272) VIEW.',
        deprecated: true,
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillScopeDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "current", null);
__decorate([
    (0, common_1.Get)('sessions/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One session: header, tenders, the vouchers it posted, its variances',
        description: 'Your own session needs Open Till (272) VIEW; another cashier’s, Till Sessions (273) VIEW. In a hidden-expected count (till.blind_close) the ' +
            'expected / variance figures come back null to the cashier (expectedVisible = false) until the session closes.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillSessionKeyDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('sessions/slip-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The slip check: the rows behind one terminal of a counted session (non-cash plan §4.2)',
        description: 'Expected, the batch total and batch no the cashier entered, and every live row of that tender in the ' +
            'session (time, bill, amount, approval code, last 4, reference) to tick against the slips. Till Sessions ' +
            '(273) OVERRIDE; refused to the session’s own cashier before it closes (TILL_BLIND_CLOSE).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillSlipCheckQueryDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "slipCheckRows", null);
__decorate([
    (0, common_1.Post)('sessions/slip-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Record a slip check: a SLIP_CHECK event with the counts and the exceptions',
        description: 'The ticks are not stored (§4.2): the rows with no slip, the slips with no row and the amounts that ' +
            'differ are. Fixes are re-tenders; what they cannot explain is the NONCASH_VARIANCE the approver ' +
            'decides. Till Sessions (273) OVERRIDE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillSlipCheckDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "slipCheckRecord", null);
__decorate([
    (0, common_1.Get)('sessions/expected'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A session with every expected figure shown — supervisor only',
        description: 'What a hidden-expected count hides from the cashier (§5.4). Till Sessions (273) OVERRIDE; refused to the session’s own ' +
            'cashier while it is not closed (TILL_BLIND_CLOSE).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillSessionKeyDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "expected", null);
__decorate([
    (0, common_1.Post)('sessions/suspend'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Suspend — a break; nothing can be billed until resumed',
        description: 'Open Till (272) EDIT, the session’s own cashier.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.SuspendTillSessionDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "suspend", null);
__decorate([
    (0, common_1.Post)('sessions/resume'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Resume a suspended session',
        description: 'Open Till (272) EDIT, the session’s own cashier.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillSessionKeyDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)('sessions/end-billing'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'End billing — the session stops taking money and waits to be counted',
        description: 'Held bills go to the branch pool (till.close_with_holds RELEASE) or refuse the end (BLOCK → TILL_HOLDS_OPEN). ' +
            'Open Till (272) EDIT.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.EndBillingTillSessionDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "endBilling", null);
__decorate([
    (0, common_1.Post)('sessions/count'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'One count attempt — answers ACCEPTED / RECOUNT_REQUIRED / SENT_FOR_APPROVAL',
        description: 'Every attempt is kept. In a hidden-expected count the cashier is never told the figure (variances = null). Out of tolerance ' +
            'after the last recount (till.max_recounts) the session goes PENDING_APPROVAL. Only the drawer decides: a card / UPI slip ' +
            'total out of tolerance never asks for a recount — the count is final with slipCheckRequired = true, the gap PENDING for ' +
            "the supervisor's slip check; the session still closes. Open Till (272) EDIT by the " +
            'cashier, or Till Sessions (273) OVERRIDE (cash office / supervisor).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiResponse)({ status: 428, type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_RECOUNT_LIMIT' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.CountTillSessionDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "count", null);
__decorate([
    (0, common_1.Post)('sessions/close'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Close — post the variances (TVar) and the hand-over (TDrp), freeze the totals, issue the Z number',
        description: 'floatLeft stays in the drawer; the rest of the cash counted goes to the safe. A session PENDING_APPROVAL ' +
            'answers 428 TILL_APPROVAL_REQUIRED (the approval gate is build phase 3). Open Till (272) EDIT, or Till ' +
            'Sessions (273) OVERRIDE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiResponse)({ status: 428, type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_APPROVAL_REQUIRED' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.CloseTillSessionDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "close", null);
__decorate([
    (0, common_1.Post)('movements/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'A drawer movement — drop, paid-in, exchange (cashier) · pickup, top-up (supervisor)',
        description: 'Each posts its voucher in the session: DROP / PICKUP a TDrp (Dr safe / Cr till cash), TOP_UP a TFlt, ' +
            'PAID_IN a TPIn (Dr till cash / Cr the ledger); an EXCHANGE posts none and counts both sides. The ' +
            'session must still take money (OPEN / SUSPENDED). Cashier kinds: Open Till (272) EDIT, the session’s ' +
            'cashier on its device. PICKUP / TOP_UP: Till Sessions (273) OVERRIDE; a pickup’s witness is the cashier.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_MOVEMENT_INVALID · TILL_REASON_INVALID · TILL_SAFE_MISSING',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.CreateTillMovementDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "createMovement", null);
__decorate([
    (0, common_1.Post)('movements/change'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Change from another counter — a PICKUP there and a TOP_UP here, in one call',
        description: 'REV 2 §2.14: no till-to-till movement; the pair passes each counter’s safe (TDrp on the giving session, ' +
            'TFlt on the receiving one). Both sessions OPEN / SUSPENDED. Till Sessions (273) OVERRIDE; the giving cashier ' +
            'witnesses and is never the supervisor.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillChangeDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "change", null);
__decorate([
    (0, common_1.Get)('movements/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One movement with its denomination counts — the slip',
        description: 'Your own session’s: Open Till (272) VIEW; another’s: Till Sessions (273) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillMovementKeyDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "getMovement", null);
__decorate([
    (0, common_1.Post)('movements/void'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Void a movement — its voucher mirrored (Rev), the row VOIDED with a MOVEMENT_VOID reason',
        description: 'Only a hand-posted movement, and only while its session still takes money. Till Sessions (273) OVERRIDE ' +
            '(MOVEMENT_VOID is ALWAYS a supervisor’s).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_MOVEMENT_NOT_VOIDABLE · TILL_SESSION_NOT_OPEN',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.VoidTillMovementDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "voidMovement", null);
__decorate([
    (0, common_1.Post)('events/batch'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'A device reports what only it saw — drawer kicks, no-sales, X reads, idle locks',
        description: 'Device time is kept as the event time. (device, clientSeq) makes a re-sent batch a no-op. A device may not ' +
            'report a server event (SESSION_CLOSE …). Open Till (272) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillEventBatchDto]),
    __metadata("design:returntype", Promise)
], TillController.prototype, "batch", null);
exports.TillController = TillController = __decorate([
    (0, swagger_1.ApiTags)('Till'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, common_1.Controller)('till'),
    (0, common_1.UseFilters)(till_exception_filter_1.TillExceptionFilter),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_day_service_1.TillDayService,
        till_session_service_1.TillSessionService,
        till_event_service_1.TillEventService,
        till_movement_service_1.TillMovementService,
        till_slip_check_service_1.TillSlipCheckService])
], TillController);
//# sourceMappingURL=till.controller.js.map