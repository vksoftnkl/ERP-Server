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
exports.TransporterService = exports.TRANSPORTER_LEDGER_GROUP_ID = exports.TRANSPORTER_TABLE_NAME = exports.TRANSPORTER_AUDIT_SCREEN_NAME = exports.TRANSPORTER_MENU_ID = void 0;
exports.transporterLedgerFields = transporterLedgerFields;
exports.isLedgerNameTaken = isLedgerNameTaken;
exports.toTransporterPayload = toTransporterPayload;
const common_1 = require("@nestjs/common");
const party_balance_service_1 = require("../../../common/party/party-balance.service");
const party_gst_type_1 = require("../../../common/party/party-gst-type");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const account_ledger_masters_service_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.service");
const account_ledger_master_error_codes_1 = require("../../accountsModule/accountLedgerMasters/types/account-ledger-master-error-codes");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const transporter_error_codes_1 = require("./types/transporter-error-codes");
exports.TRANSPORTER_MENU_ID = 149;
exports.TRANSPORTER_AUDIT_SCREEN_NAME = 'Transporter Master';
exports.TRANSPORTER_TABLE_NAME = 'public.transporter_master';
exports.TRANSPORTER_LEDGER_GROUP_ID = '01a1ca91-1010-73d8-a329-f97aa1de5c9c';
const GSTIN_SHAPE = /^[A-Z0-9]{15}$/;
const GSTIN_STATE_PREFIX = /^[0-9]{2}/;
const trimOrNull = (v) => (v && v.trim() ? v.trim() : null);
function transporterLedgerFields(t) {
    const realGstin = t.gstin && !t.isEnrolmentId ? t.gstin : null;
    return {
        ledGroupId: exports.TRANSPORTER_LEDGER_GROUP_ID,
        ledName: t.name,
        ledCompanyId: t.companyId,
        ledIsBillByBill: true,
        ...(0, party_gst_type_1.ledgerGstFieldsOf)(realGstin ? 'REGULAR' : 'UNREGISTERED'),
        ledGstinNo: realGstin,
        ledStateCode: t.stateCode,
        ledStateName: t.stateName,
        ledPhone1: t.phone,
        ledEmail: t.email,
        ledAddr1: t.addr,
        ledCity: t.place,
        ledPin: t.pin,
        ledIsActive: t.isActive,
    };
}
function isLedgerNameTaken(error) {
    if ((0, module_shared_utils_1.isUniqueConstraintError)(error)) {
        return true;
    }
    if (error instanceof common_1.HttpException) {
        const body = error.getResponse();
        return typeof body === 'object' && (body.errors ?? []).some((e) => e.code === account_ledger_master_error_codes_1.AccountLedgerErrorCode.NAME_TAKEN);
    }
    return false;
}
const iso = (d) => (d ? d.toISOString() : null);
let TransporterService = class TransporterService {
    prisma;
    ctx;
    auditLogService;
    ledgers;
    partyBalance;
    constructor(prisma, ctx, auditLogService, ledgers, partyBalance) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.auditLogService = auditLogService;
        this.ledgers = ledgers;
        this.partyBalance = partyBalance;
    }
    actor() {
        return this.ctx.getUserId() ?? module_shared_utils_1.DEFAULT_ACTOR;
    }
    assertRight(client, right, action) {
        return (0, rights_1.assertMenuRight)(client, {
            userId: this.ctx.getUserId() ?? null,
            menuId: exports.TRANSPORTER_MENU_ID,
            right,
            codePrefix: transporter_error_codes_1.TRANSPORTER_RIGHT_PREFIX,
            action,
        });
    }
    loginCompany() {
        return this.ctx.getCompanyId()?.toLowerCase() ?? null;
    }
    async resolveCompany(client, bodyCompanyId) {
        const token = this.loginCompany();
        const body = bodyCompanyId.toLowerCase();
        let refusal = null;
        if (token && token !== body) {
            refusal = `companyId ${body} is not the login company ${token}`;
        }
        else if (!token) {
            const [c] = await client.$queryRaw `
        SELECT comp_id FROM public.companys
         WHERE comp_id = ${body}::uuid AND coalesce(comp_is_deleted, false) = false`;
            if (!c) {
                refusal = `companyId ${body} is not a live company`;
            }
        }
        if (refusal) {
            (0, module_shared_utils_1.throwForbidden)('Transporter belongs to another company', [
                { field: 'companyId', message: refusal, code: transporter_error_codes_1.TransporterErrorCode.COMPANY_MISMATCH },
            ]);
        }
        return body;
    }
    refuse(code, field, message) {
        (0, module_shared_utils_1.throwUnprocessable)(message, [{ field, message, code }]);
    }
    notFound(trnId) {
        (0, module_shared_utils_1.throwNotFound)('Transporter not found', 'trnId', `No live transporter of this company with id ${trnId}`, transporter_error_codes_1.TransporterErrorCode.NOT_FOUND);
    }
    async loadLive(client, trnId, company = this.loginCompany()) {
        const row = await client.transporterMaster.findFirst({
            where: {
                trnId,
                trnIsDeleted: false,
                ...(company ? { OR: [{ trnCompanyId: company }, { trnCompanyId: null }] } : {}),
            },
        });
        if (!row) {
            this.notFound(trnId);
        }
        return row;
    }
    async save(dto) {
        const isCreate = !dto.trnId;
        let id;
        try {
            id = await this.prisma.$transaction(async (tx) => {
                await this.assertRight(tx, isCreate ? 'create' : 'edit', isCreate ? 'make transporters' : 'change transporters');
                const company = await this.resolveCompany(tx, dto.companyId);
                const name = (dto.name ?? '').replace(/\s+/g, ' ').trim();
                if (!name) {
                    this.refuse(transporter_error_codes_1.TransporterErrorCode.NAME_REQUIRED, 'name', 'The transporter name is empty');
                }
                const isEnrolmentId = dto.isEnrolmentId ?? false;
                const gstin = trimOrNull(dto.gstin)?.toUpperCase().replace(/\s+/g, '') ?? null;
                if (gstin && (!GSTIN_SHAPE.test(gstin) || (!isEnrolmentId && !GSTIN_STATE_PREFIX.test(gstin)))) {
                    this.refuse(transporter_error_codes_1.TransporterErrorCode.GSTIN_INVALID, 'gstin', `${gstin} is ${gstin.length} characters${isEnrolmentId ? '' : ' (a GSTIN starts with the 2-digit state code)'}`);
                }
                const stateCode = trimOrNull(dto.stateCode);
                let stateName = null;
                if (stateCode) {
                    const [st] = await tx.$queryRaw `
              SELECT state_name FROM fixed.state_codes
               WHERE state_code = ${stateCode} AND is_active = true AND is_deleted = false`;
                    if (!st) {
                        this.refuse(transporter_error_codes_1.TransporterErrorCode.STATE_INVALID, 'stateCode', `${stateCode} is not a GST state code`);
                    }
                    stateName = st.state_name;
                }
                const existing = isCreate ? null : await this.loadLive(tx, dto.trnId, company);
                if (isCreate || existing.trnName.toLowerCase() !== name.toLowerCase()) {
                    const [dup] = await tx.$queryRaw `
              SELECT trn_id FROM public.transporter_master
               WHERE lower(trn_name) = lower(${name})
                 AND trn_is_deleted = false
                 AND (trn_company_id IS NULL OR trn_company_id = ${company}::uuid)
                 AND (${dto.trnId ?? null}::uuid IS NULL OR trn_id <> ${dto.trnId ?? null}::uuid)
               LIMIT 1`;
                    if (dup) {
                        (0, module_shared_utils_1.throwConflict)('Transporter name already used', [
                            {
                                field: 'name',
                                message: `A transporter named ${name} already exists`,
                                code: transporter_error_codes_1.TransporterErrorCode.NAME_TAKEN,
                            },
                        ]);
                    }
                }
                const data = {
                    trnCompanyId: company,
                    trnCode: trimOrNull(dto.code),
                    trnName: name,
                    trnGstin: gstin,
                    trnIsEnrolmentId: isEnrolmentId,
                    trnMode: dto.mode ?? 'ROAD',
                    trnPhone: trimOrNull(dto.phone),
                    trnEmail: trimOrNull(dto.email),
                    trnAddr: trimOrNull(dto.addr),
                    trnPlace: trimOrNull(dto.place),
                    trnPin: trimOrNull(dto.pin),
                    trnStateCode: stateCode,
                    trnRemarks: trimOrNull(dto.remarks),
                    trnIsActive: dto.isActive ?? true,
                };
                const ledgerFields = transporterLedgerFields({
                    name,
                    companyId: company,
                    gstin,
                    isEnrolmentId,
                    stateCode,
                    stateName,
                    phone: data.trnPhone,
                    email: data.trnEmail,
                    addr: data.trnAddr,
                    place: data.trnPlace,
                    pin: data.trnPin,
                    isActive: data.trnIsActive,
                });
                let saved;
                if (isCreate) {
                    const ledger = await this.ledgers.createLedgerWithinTx(ledgerFields, tx);
                    saved = await tx.transporterMaster.create({
                        data: { trnId: ledger.ledId, trnLedgerId: ledger.ledId, ...data, trnCreatedBy: this.actor() },
                    });
                }
                else {
                    saved = await tx.transporterMaster.update({
                        where: { trnId: dto.trnId },
                        data: { ...data, trnModifiedBy: this.actor(), trnModifiedOn: new Date() },
                    });
                    const ledId = existing.trnLedgerId;
                    if (ledId) {
                        const led = await tx.accLedgerMaster.findFirst({
                            where: { ledId, ledIsDeleted: false },
                            select: { ledGroupId: true },
                        });
                        if (led) {
                            await this.ledgers.updateLedgerWithinTx({ ...ledgerFields, ledId, ledGroupId: led.ledGroupId }, tx);
                        }
                    }
                }
                await this.auditLogService.logEntityChange({
                    action: isCreate ? 'New' : 'update',
                    tableName: exports.TRANSPORTER_TABLE_NAME,
                    screenName: exports.TRANSPORTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: saved.trnId,
                    displayName: saved.trnName,
                    originalRecord: existing,
                    modifiedRecord: saved,
                    userId: this.actor(),
                    notes: isCreate ? 'Transporter created with its ledger' : 'Transporter updated; its ledger follows',
                }, tx);
                return saved.trnId;
            }, { timeout: 30000, maxWait: 10000 });
        }
        catch (error) {
            if (isLedgerNameTaken(error)) {
                (0, module_shared_utils_1.throwConflict)('Transporter name already a ledger', [
                    {
                        field: 'name',
                        message: `Another ledger of this company (or a shared one) is named ${dto.name?.trim()}`,
                        code: transporter_error_codes_1.TransporterErrorCode.LEDGER_NAME_TAKEN,
                    },
                ]);
            }
            throw error;
        }
        return this.load(this.prisma, id);
    }
    async getById(trnId) {
        await this.assertRight(this.prisma, 'view', 'open transporters');
        await this.loadLive(this.prisma, trnId);
        return this.load(this.prisma, trnId);
    }
    async softDelete(trnId) {
        return this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, 'delete', 'delete transporters');
            const existing = await this.loadLive(tx, trnId);
            const ledId = existing.trnLedgerId;
            const ledger = ledId ? await this.partyBalance.lockLedger(tx, ledId) : undefined;
            if (ledId && ledger && !ledger.ledIsDeleted) {
                const balances = await this.partyBalance.balances(tx, ledId);
                if (balances.length > 0) {
                    const first = balances[0];
                    const side = first.amount.isNegative() ? 'Cr' : 'Dr';
                    (0, module_shared_utils_1.throwConflict)('Transporter cannot be deleted', [
                        (0, party_balance_service_1.withFigures)({
                            field: 'trnId',
                            code: transporter_error_codes_1.TransporterErrorCode.HAS_BALANCE,
                            message: `The transporter's ledger balance is ${first.amount.abs().toFixed(2)} ${side.toUpperCase()} in company ${first.companyId}; a transporter is deleted only at a zero balance`,
                        }, `This transporter still has ₹${(0, party_balance_service_1.formatRupees)(first.amount.abs())} ${side} in ${first.companyName ?? 'a company'}.`),
                    ]);
                }
                const cheques = await this.partyBalance.chequesInHand(tx, ledId);
                if (cheques > 0) {
                    (0, module_shared_utils_1.throwConflict)('Transporter cannot be deleted', [
                        {
                            field: 'trnId',
                            code: transporter_error_codes_1.TransporterErrorCode.HAS_CHEQUE_IN_HAND,
                            message: `${cheques} cheque(s) of this transporter are HELD / DEPOSITED and post only on clearing`,
                        },
                    ]);
                }
            }
            const now = new Date();
            const saved = await tx.transporterMaster.update({
                where: { trnId },
                data: { trnIsDeleted: true, trnIsActive: false, trnModifiedBy: this.actor(), trnModifiedOn: now },
            });
            if (ledId) {
                await tx.accLedgerMaster.updateMany({
                    where: { ledId, ledIsDeleted: false },
                    data: { ledIsDeleted: true, ledIsActive: false, ledModifiedBy: this.actor(), ledModifiedOn: now },
                });
            }
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: exports.TRANSPORTER_TABLE_NAME,
                screenName: exports.TRANSPORTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: trnId,
                displayName: existing.trnName,
                originalRecord: existing,
                modifiedRecord: saved,
                userId: this.actor(),
                notes: 'Transporter and its ledger soft deleted',
            }, tx);
            return { trnId, deleted: true, name: existing.trnName };
        }, { timeout: 30000, maxWait: 10000 });
    }
    async load(client, trnId) {
        const [r] = await client.$queryRaw `
      SELECT t.trn_id, t.trn_company_id, t.trn_code, t.trn_name, t.trn_gstin, t.trn_is_enrolment_id,
             t.trn_mode, t.trn_phone, t.trn_email, t.trn_addr, t.trn_place, t.trn_pin, t.trn_state_code,
             s.state_name, t.trn_remarks, t.trn_is_active, t.trn_ledger_id, l.led_name, g.acc_group_name,
             (SELECT count(*)::int FROM public.vehicle_master v
               WHERE v.veh_transporter_id = t.trn_id AND v.veh_is_deleted = false) AS vehicle_count,
             t.trn_created_by, t.trn_created_on, t.trn_modified_by, t.trn_modified_on
        FROM public.transporter_master t
        LEFT JOIN fixed.state_codes s ON s.state_code = t.trn_state_code
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = t.trn_ledger_id
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE t.trn_id = ${trnId}::uuid AND t.trn_is_deleted = false`;
        if (!r) {
            this.notFound(trnId);
        }
        return toTransporterPayload(r);
    }
};
exports.TransporterService = TransporterService;
exports.TransporterService = TransporterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        audit_log_service_1.AuditLogService,
        account_ledger_masters_service_1.AccountLedgerMastersService,
        party_balance_service_1.PartyBalanceService])
], TransporterService);
function toTransporterPayload(r) {
    return {
        trnId: r.trn_id,
        companyId: r.trn_company_id,
        code: r.trn_code,
        name: r.trn_name,
        gstin: r.trn_gstin,
        isEnrolmentId: r.trn_is_enrolment_id,
        mode: r.trn_mode,
        phone: r.trn_phone,
        email: r.trn_email,
        addr: r.trn_addr,
        place: r.trn_place,
        pin: r.trn_pin,
        stateCode: r.trn_state_code,
        stateName: r.state_name,
        remarks: r.trn_remarks,
        isActive: r.trn_is_active,
        ledgerId: r.trn_ledger_id,
        ledgerName: r.led_name,
        ledgerGroupName: r.acc_group_name,
        vehicleCount: Number(r.vehicle_count ?? 0),
        createdBy: r.trn_created_by,
        createdOn: iso(r.trn_created_on),
        modifiedBy: r.trn_modified_by,
        modifiedOn: iso(r.trn_modified_on),
    };
}
//# sourceMappingURL=transporter.service.js.map