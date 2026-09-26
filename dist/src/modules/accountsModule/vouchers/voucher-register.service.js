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
exports.roleKey = exports.registerDeductee = exports.VoucherRegisterService = void 0;
exports.accYearOf = accYearOf;
exports.quarterOf = quarterOf;
exports.statusDocType = statusDocType;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const doc_register_service_1 = require("../../../common/posting/doc-register.service");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_guards_1 = require("../receipt/receipt.guards");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const voucher_derive_1 = require("./voucher-derive");
Object.defineProperty(exports, "registerDeductee", { enumerable: true, get: function () { return voucher_derive_1.registerDeductee; } });
Object.defineProperty(exports, "roleKey", { enumerable: true, get: function () { return voucher_derive_1.roleKey; } });
const voucher_facts_1 = require("./voucher-facts");
const voucher_billwise_helper_1 = require("./voucher-billwise.helper");
const voucher_types_service_1 = require("./voucher-types.service");
const vouchers_errors_1 = require("./vouchers.errors");
const TX = { maxWait: 15_000, timeout: 120_000 };
const BACKDATE_SETTING = 'accounts.backdate_mode';
const GENERATED = new Set(voucher_facts_1.GENERATED_ROLES);
let VoucherRegisterService = class VoucherRegisterService {
    prisma;
    requestContext;
    types;
    posting;
    docRegister;
    recompute;
    constructor(prisma, requestContext, types, posting, docRegister, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.types = types;
        this.posting = posting;
        this.docRegister = docRegister;
        this.recompute = recompute;
    }
    caller() {
        const userId = this.requestContext.getUserId();
        return { userId, actor: userId ?? module_service_utils_1.DEFAULT_ACTOR };
    }
    async create(dto, raw) {
        const { userId, actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            const type = await this.loadRegisterType(tx, dto.header.typeCode);
            const rights = await this.types.rightsFor(tx, userId, type);
            this.assertDateInYear(dto.header.date, dto.header.accYear);
            if (type.partyMode === 'ONE' && !dto.header.partyId) {
                (0, vouchers_errors_1.throwInvalid)(`A ${type.typeName} needs one party`, vouchers_errors_1.VCH.PARTY_MODE, 'header.partyId');
            }
            if (type.partyMode !== 'ONE' && dto.header.partyId) {
                (0, vouchers_errors_1.throwInvalid)(`A ${type.typeName} carries no party on the header`, vouchers_errors_1.VCH.PARTY_MODE, 'header.partyId');
            }
            const existing = dto.header.voucherId
                ? await this.lockHeader(tx, dto.header.voucherId, dto.header.accYear)
                : null;
            if (dto.header.voucherId && !existing) {
                (0, vouchers_errors_1.throwMissing)(`No voucher ${dto.header.voucherId} in ${dto.header.accYear}`, vouchers_errors_1.VCH.NOT_FOUND, 'header.voucherId');
            }
            if (existing) {
                this.assertScope(existing, dto.header);
                if (existing.avh_voucher_status !== 'DRAFT') {
                    (0, vouchers_errors_1.throwState)(`${existing.avh_voucher_refno ?? existing.avh_voucher_id} is ${existing.avh_voucher_status} — a posted voucher is corrected by cancel and re-enter`, existing.avh_voucher_status === 'POSTED' ? vouchers_errors_1.VCH.POSTED : vouchers_errors_1.VCH.NOT_DRAFT, 'header.voucherId');
                }
                if (existing.avh_voucher_type_id !== type.typeId) {
                    (0, vouchers_errors_1.throwState)('A draft keeps its type — start a new voucher to change it', vouchers_errors_1.VCH.NOT_DRAFT, 'header.typeCode');
                }
                if (!rights.edit) {
                    (0, vouchers_errors_1.throwRight)('This user may not edit on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_EDIT);
                }
            }
            else if (!rights.create) {
                (0, vouchers_errors_1.throwRight)('This user may not create on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_CREATE);
            }
            const { overrides: _o, ...sent } = (raw ?? dto);
            const draft = JSON.parse(JSON.stringify(sent));
            const docAmount = dto.lines
                .filter((l) => l.drCr === 'DR')
                .reduce((s, l) => s.plus(new client_1.Prisma.Decimal(l.amount)), new client_1.Prisma.Decimal(0))
                .toDecimalPlaces(2);
            const now = new Date();
            const partyId = type.partyMode === 'ONE' ? (dto.header.partyId ?? null) : null;
            let voucherId;
            if (existing) {
                voucherId = existing.avh_voucher_id;
                await tx.$executeRaw `
          UPDATE accounts.acc_voucher_header
             SET avh_voucher_date = ${dto.header.date}::date,
                 avh_party_id     = ${partyId}::uuid,
                 avh_doc_refno    = ${dto.header.docRefno ?? null},
                 avh_doc_date     = ${dto.header.docDate ?? null}::date,
                 avh_usr_refno    = ${dto.header.usrRefno ?? null},
                 avh_remarks      = ${dto.header.remarks ?? null},
                 avh_doc_amount   = ${docAmount.toFixed(2)}::numeric,
                 avh_draft_lines  = ${JSON.stringify(draft)}::jsonb,
                 avh_modified_on  = ${now},
                 avh_modified_by  = ${actor}
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${dto.header.accYear}::char(9)`;
            }
            else {
                const [row] = await tx.$queryRaw `
          INSERT INTO accounts.acc_voucher_header (
            avh_company_id, avh_branch_id, avh_acc_year, avh_voucher_type_id,
            avh_voucher_date, avh_party_id, avh_doc_refno, avh_doc_date, avh_usr_refno,
            avh_remarks, avh_doc_amount, avh_voucher_status, avh_user_id, avh_draft_lines,
            avh_created_by
          ) VALUES (
            ${dto.header.companyId}::uuid, ${dto.header.branchId}::uuid, ${dto.header.accYear}::char(9),
            ${type.typeId}::int,
            ${dto.header.date}::date, ${partyId}::uuid, ${dto.header.docRefno ?? null},
            ${dto.header.docDate ?? null}::date, ${dto.header.usrRefno ?? null},
            ${dto.header.remarks ?? null}, ${docAmount.toFixed(2)}::numeric, 'DRAFT',
            ${actor}::uuid, ${JSON.stringify(draft)}::jsonb, ${actor}
          )
          RETURNING avh_voucher_id`;
                voucherId = row.avh_voucher_id;
                await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                    companyId: dto.header.companyId,
                    branchId: dto.header.branchId,
                    tenantId: null,
                    accYear: dto.header.accYear,
                    srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                    srcDocType: statusDocType(type),
                    srcDocId: voucherId,
                    event: txn_status_log_helper_1.TxnStatusEvent.CREATED,
                    toStatus: 'DRAFT',
                    changedBy: actor,
                    changedOn: now,
                });
            }
            return {
                voucherId,
                companyId: dto.header.companyId,
                branchId: dto.header.branchId,
                accYear: dto.header.accYear,
                typeCode: type.typeCode,
                status: 'DRAFT',
                created: !existing,
            };
        }, TX);
    }
    async validate(dto) {
        const { userId } = this.caller();
        const tx = this.prisma;
        const type = await this.loadRegisterType(tx, dto.header.typeCode);
        const rights = await this.types.rightsFor(tx, userId, type);
        if (!rights.view) {
            (0, vouchers_errors_1.throwRight)('This user may not view on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_VIEW);
        }
        const p = await this.prepare(tx, type, rights, dto, { dryRun: true, lock: false });
        return {
            ok: p.ctx.refusals.length === 0,
            derived: (0, voucher_derive_1.toWire)(type.typeCode, dto.header.date, p.derived),
            refusals: p.ctx.refusals,
            warnings: p.ctx.warnings,
        };
    }
    async post(dto) {
        const { userId, actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            const type = await this.loadRegisterType(tx, dto.header.typeCode);
            const rights = await this.types.rightsFor(tx, userId, type);
            if (!rights.post) {
                (0, vouchers_errors_1.throwRight)('This user may not post on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_POST);
            }
            let existing = null;
            if (dto.header.voucherId) {
                existing = await this.lockHeader(tx, dto.header.voucherId, dto.header.accYear);
                if (!existing) {
                    (0, vouchers_errors_1.throwMissing)(`No voucher ${dto.header.voucherId} in ${dto.header.accYear}`, vouchers_errors_1.VCH.NOT_FOUND, 'header.voucherId');
                }
                this.assertScope(existing, dto.header);
                if (existing.avh_voucher_status !== 'DRAFT') {
                    (0, vouchers_errors_1.throwState)(`${existing.avh_voucher_refno ?? existing.avh_voucher_id} is already ${existing.avh_voucher_status}`, existing.avh_voucher_status === 'POSTED' ? vouchers_errors_1.VCH.POSTED : vouchers_errors_1.VCH.CANCELLED, 'header.voucherId');
                }
                if (existing.avh_voucher_type_id !== type.typeId) {
                    (0, vouchers_errors_1.throwState)('A draft keeps its type — start a new voucher to change it', vouchers_errors_1.VCH.NOT_DRAFT, 'header.typeCode');
                }
            }
            else if (!rights.create) {
                (0, vouchers_errors_1.throwRight)('This user may not create on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_CREATE);
            }
            await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, dto.header.accYear, 'header.accYear');
            const p = await this.prepare(tx, type, rights, dto, { dryRun: false, lock: true });
            if (p.ctx.refusals.length > 0) {
                (0, vouchers_errors_1.throwRefusals)(`${type.typeName} cannot be posted`, p.ctx.refusals);
            }
            const d = p.derived;
            const now = new Date();
            const partyIds = new Set();
            if (d.party)
                partyIds.add(d.party.ledger.ledId);
            for (const b of d.bills)
                partyIds.add(b.party.ledId);
            for (const a of d.allocations)
                partyIds.add(a.party.ledId);
            const legs = d.legs.map((l) => ({
                ledgerId: l.ledger.ledId,
                drCr: l.drCr,
                amount: Number(l.amount.toFixed(2)),
                remarks: l.remarks,
                roleTag: l.role,
                oppLedgerId: l.oppLedgerId,
                field: l.lineRowNo === null ? l.source : `lines.${l.lineRowNo}`,
            }));
            const docAmount = d.party ? d.party.amount : d.totals.debit;
            const voucher = await this.posting.postLegs(tx, {
                header: {
                    companyId: dto.header.companyId,
                    branchId: dto.header.branchId,
                    tenantId: existing?.avh_tenant_id ?? null,
                    accYear: dto.header.accYear,
                    voucherTypeId: type.typeId,
                    voucherDate: dto.header.date,
                    docLabel: type.typeName,
                    docRefno: p.header.docRefno,
                    docDate: p.header.docDate ?? dto.header.date,
                    usrRefno: p.header.usrRefno,
                    docAmount: Number(docAmount.toFixed(2)),
                    roundOff: 0,
                    partyId: d.party?.ledger.ledId ?? null,
                    userId: actor,
                    sessionId: existing?.avh_session_id ?? null,
                    deviceType: existing?.avh_device_type ?? null,
                    deviceId: existing?.avh_device_id ?? null,
                    remarks: p.header.remarks,
                    deviceCode: null,
                    createdBy: actor,
                    draftVoucherId: existing?.avh_voucher_id ?? null,
                },
                legs,
            });
            const voucherId = voucher.voucherId;
            const refno = voucher.voucherRefno ?? voucherId;
            if (existing) {
                await tx.$executeRaw `
          UPDATE accounts.acc_voucher_header SET avh_draft_lines = NULL
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${dto.header.accYear}::char(9)`;
            }
            const legRows = await tx.$queryRaw `
        SELECT av_id, av_row_no FROM accounts.acc_vouchers
         WHERE av_voucher_id = ${voucherId}::uuid AND av_acc_year = ${dto.header.accYear}::char(9)
           AND av_is_deleted = false`;
            const legAvIdByRow = new Map(legRows.map((r) => [r.av_row_no, r.av_id]));
            const billCtx = {
                companyId: dto.header.companyId,
                branchId: dto.header.branchId,
                tenantId: existing?.avh_tenant_id ?? null,
                accYear: dto.header.accYear,
                voucherId,
                voucherTypeId: type.typeId,
                voucherNo: voucher.voucherLastNo,
                voucherDate: dto.header.date,
                voucherRefno: refno,
                docDate: p.header.docDate,
                userId: actor,
                sessionId: existing?.avh_session_id ?? null,
                actor,
                now,
            };
            const raisedByLine = new Map();
            const touched = [];
            for (const b of d.bills) {
                const raised = await (0, voucher_billwise_helper_1.raiseBill)(tx, billCtx, b, legAvIdByRow.get(b.legRowNo) ?? null);
                raisedByLine.set(b.lineRowNo, raised);
                touched.push(raised);
            }
            touched.push(...(await (0, voucher_billwise_helper_1.writeAllocations)(tx, billCtx, d.allocations, raisedByLine, legAvIdByRow)));
            if (touched.length > 0) {
                await this.recompute.recomputeBills(tx, touched, now);
            }
            if (d.gst) {
                await this.docRegister.write(tx, this.registerDoc(p, d, voucherId, voucher.voucherLastNo, refno, dto, actor), {
                    companyEinvoiceFlag: d.gst.docFlow === 'OUTWARD' && !!p.party?.gstin
                        ? p.company.einvoiceApplicable
                        : false,
                    interState: d.gst.supplyNature === 'INTER',
                });
            }
            if (d.tds && p.party) {
                const raised = raisedByLine.get(0) ?? null;
                await tx.$executeRaw `
          INSERT INTO accounts.acc_tds_register (
            atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
            atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
            atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
            atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_remarks, atd_created_by
          ) VALUES (
            ${dto.header.companyId}::uuid, ${dto.header.branchId}::uuid, ${existing?.avh_tenant_id ?? null}::uuid,
            ${dto.header.accYear}::char(9), ${quarterOf(dto.header.date)}::bpchar, 'DEDUCTED',
            ${p.party.ledId}::uuid, ${p.party.pan}, ${p.party.name.slice(0, 150)},
            ${d.tds.registerDeductee}, ${d.tds.section}, ${d.tds.rate.toFixed(3)}::numeric,
            ${d.tds.rateSource}, ${d.tds.base.toFixed(2)}::numeric, ${d.tds.tax.toFixed(2)}::numeric,
            ${voucherId}::uuid, ${dto.header.accYear}::char(9),
            ${refno.slice(0, 50)}, ${dto.header.date}::date,
            ${raised?.billId ?? null}::uuid, ${raised?.accYear ?? null}::char(9),
            ${d.tds.reason?.slice(0, 250) ?? null}, ${actor}
          )`;
            }
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: dto.header.companyId,
                branchId: dto.header.branchId,
                tenantId: existing?.avh_tenant_id ?? null,
                accYear: dto.header.accYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: statusDocType(type),
                srcDocId: voucherId,
                srcDocRefno: refno,
                event: txn_status_log_helper_1.TxnStatusEvent.POSTED,
                fromStatus: existing ? 'DRAFT' : null,
                toStatus: 'POSTED',
                changedBy: actor,
                changedOn: now,
                deviceId: existing?.avh_device_id ?? null,
                sessionId: existing?.avh_session_id ?? null,
            });
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: dto.header.companyId,
                accYear: dto.header.accYear,
                ledgerIds: [...partyIds],
                vouchers: [{ voucherId, accYear: dto.header.accYear }],
            });
            const stored = await this.loadHeader(tx, voucherId, dto.header.accYear);
            return this.assemble(tx, stored, type, rights);
        }, TX);
    }
    async deleteDraft(keys) {
        const { userId, actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            const stored = await this.lockHeader(tx, keys.voucherId, keys.accYear);
            if (!stored) {
                (0, vouchers_errors_1.throwMissing)(`No voucher ${keys.voucherId} in ${keys.accYear}`, vouchers_errors_1.VCH.NOT_FOUND);
            }
            this.assertScope(stored, keys);
            const type = await this.types.loadTypeById(tx, stored.avh_voucher_type_id);
            const rights = type ? await this.types.rightsFor(tx, userId, type) : null;
            if (!rights?.delete) {
                (0, vouchers_errors_1.throwRight)('This user may not delete on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_DELETE);
            }
            if (stored.avh_voucher_status !== 'DRAFT') {
                (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno ?? keys.voucherId} is ${stored.avh_voucher_status} — a posted voucher is cancelled, never deleted`, stored.avh_voucher_status === 'POSTED' ? vouchers_errors_1.VCH.POSTED : vouchers_errors_1.VCH.CANCELLED);
            }
            const now = new Date();
            await tx.$executeRaw `
        UPDATE accounts.acc_voucher_header
           SET avh_is_deleted = true, avh_is_active = false,
               avh_modified_on = ${now}, avh_modified_by = ${actor}
         WHERE avh_voucher_id = ${keys.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: stored.avh_company_id,
                branchId: stored.avh_branch_id,
                tenantId: stored.avh_tenant_id,
                accYear: stored.avh_acc_year,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: statusDocType(type),
                srcDocId: keys.voucherId,
                event: txn_status_log_helper_1.TxnStatusEvent.DELETED,
                fromStatus: 'DRAFT',
                toStatus: 'DRAFT',
                changedBy: actor,
                changedOn: now,
            });
            return { voucherId: keys.voucherId, accYear: keys.accYear, deleted: true };
        }, TX);
    }
    async get(keys) {
        const { userId } = this.caller();
        const tx = this.prisma;
        const stored = await this.loadHeader(tx, keys.voucherId, keys.accYear);
        if (!stored) {
            (0, vouchers_errors_1.throwMissing)(`No voucher ${keys.voucherId} in ${keys.accYear}`, vouchers_errors_1.VCH.NOT_FOUND);
        }
        this.assertScope(stored, keys);
        const type = await this.types.loadTypeById(tx, stored.avh_voucher_type_id);
        if (!type) {
            (0, vouchers_errors_1.throwMissing)('The voucher’s type no longer exists', vouchers_errors_1.VCH.NOT_FOUND, 'typeCode');
        }
        const rightsType = type.menuId === null && stored.avh_against_voucher_id && stored.avh_against_acc_year
            ? await this.typeOfVoucher(tx, stored.avh_against_voucher_id, stored.avh_against_acc_year)
            : type;
        const rights = await this.types.rightsFor(tx, userId, rightsType ?? type);
        if (!rights.view) {
            (0, vouchers_errors_1.throwRight)('This user may not view on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_VIEW);
        }
        return this.assemble(tx, stored, type, rights);
    }
    async loadRegisterType(tx, typeCode) {
        const type = await this.types.loadTypeByCode(tx, typeCode);
        if (!type) {
            (0, vouchers_errors_1.throwMissing)(`No active voucher type '${typeCode}'`, vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'header.typeCode');
        }
        if (!type.inRegister) {
            (0, vouchers_errors_1.throwState)(`${type.typeName} is not a Voucher Register type`, vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'header.typeCode');
        }
        if (type.affectsInventory) {
            (0, vouchers_errors_1.throwState)(`${type.typeName} moves stock — the register never does`, vouchers_errors_1.VCH.TYPE_INVENTORY, 'header.typeCode');
        }
        return type;
    }
    async typeOfVoucher(tx, voucherId, accYear) {
        const rows = await tx.$queryRaw `
      SELECT avh_voucher_type_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
        return rows[0] ? this.types.loadTypeById(tx, rows[0].avh_voucher_type_id) : null;
    }
    async loadHeader(tx, voucherId, accYear, lock = false) {
        const rows = await tx.$queryRaw `
      SELECT h.*, p.led_name AS party_name,
             rv.avh_voucher_refno AS reversal_refno, ag.avh_voucher_refno AS against_refno
        FROM accounts.acc_voucher_header h
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
        LEFT JOIN accounts.acc_voucher_header rv
               ON rv.avh_voucher_id = h.avh_reversal_voucher_id AND rv.avh_acc_year = h.avh_reversal_acc_year
        LEFT JOIN accounts.acc_voucher_header ag
               ON ag.avh_voucher_id = h.avh_against_voucher_id AND ag.avh_acc_year = h.avh_against_acc_year
       WHERE h.avh_voucher_id = ${voucherId}::uuid AND h.avh_acc_year = ${accYear}::char(9)
         AND h.avh_is_deleted = false
       ${lock ? client_1.Prisma.sql `FOR UPDATE OF h` : client_1.Prisma.empty}`;
        const r = rows[0];
        if (!r) {
            return null;
        }
        return {
            ...r,
            avh_acc_year: r.avh_acc_year.trim(),
            avh_voucher_status: r.avh_voucher_status.trim(),
        };
    }
    lockHeader(tx, voucherId, accYear) {
        return this.loadHeader(tx, voucherId, accYear, true);
    }
    assertScope(stored, keys) {
        if (stored.avh_company_id !== keys.companyId ||
            stored.avh_branch_id !== keys.branchId ||
            stored.avh_acc_year !== keys.accYear) {
            (0, vouchers_errors_1.throwMissing)('No such voucher at this company / branch / year', vouchers_errors_1.VCH.NOT_FOUND);
        }
    }
    assertDateInYear(date, accYear) {
        if (accYearOf(date) !== accYear) {
            (0, vouchers_errors_1.throwInvalid)(`${date} falls in ${accYearOf(date)}, not ${accYear}`, vouchers_errors_1.VCH.DATE_OUTSIDE_YEAR, 'header.date');
        }
    }
    async prepare(tx, type, rights, dto, opts) {
        const h = dto.header;
        const ctx = (0, vouchers_errors_1.newGuardContext)({
            dryRun: opts.dryRun,
            overrides: dto.overrides,
            canOverride: rights.override,
        });
        const company = await (0, voucher_facts_1.loadCompanyFacts)(tx, h.companyId);
        if (!company) {
            (0, vouchers_errors_1.throwMissing)('No such company', vouchers_errors_1.VCH.NOT_FOUND, 'header.companyId');
        }
        if (accYearOf(h.date) !== h.accYear) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.DATE_OUTSIDE_YEAR, `${h.date} falls in ${accYearOf(h.date)}, not ${h.accYear}`, { field: 'header.date' });
        }
        const fy = await tx.$queryRaw `
      SELECT fy_status, fy_lock_date FROM public.fiscal_years
       WHERE comp_id = ${h.companyId}::uuid AND fy_year_name = ${h.accYear}::char(9) AND is_deleted = false
       LIMIT 1`;
        if (fy[0]) {
            if (fy[0].fy_status.trim().toUpperCase() !== 'OPEN') {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.YEAR_CLOSED, `Accounting year ${h.accYear} is ${fy[0].fy_status.trim()}`, {
                    field: 'header.accYear',
                });
            }
            const lock = fy[0].fy_lock_date ? fy[0].fy_lock_date.toISOString().slice(0, 10) : null;
            if (lock && h.date <= lock) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.PERIOD_LOCKED, `${h.accYear} is locked up to ${lock}; ${h.date} cannot be posted into`, { field: 'header.date' });
            }
        }
        const lines = dto.lines.map((l) => ({
            rowNo: l.rowNo,
            drCr: l.drCr,
            ledgerId: l.ledgerId,
            amount: new client_1.Prisma.Decimal(l.amount),
            remarks: l.remarks?.trim() || null,
            gst: l.gst
                ? {
                    taxId: l.gst.taxId,
                    hsn: l.gst.hsn ?? null,
                    itcEligibility: l.gst.itcEligibility ?? null,
                }
                : null,
            tdsBase: l.tdsBase ?? null,
        }));
        const allocations = (dto.allocations ?? []).map((a, index) => ({
            index,
            lineRowNo: a.lineRowNo,
            billId: a.billId,
            billAccYear: a.billAccYear,
            amount: new client_1.Prisma.Decimal(a.amount),
        }));
        const ledgerIds = lines.map((l) => l.ledgerId);
        if (h.partyId)
            ledgerIds.push(h.partyId);
        const [ledgers, instrumentLedgers, generatedRoleLedgers, taxRates] = await Promise.all([
            (0, voucher_facts_1.loadLedgerFacts)(tx, h.companyId, ledgerIds),
            (0, voucher_facts_1.loadInstrumentLedgers)(tx, h.companyId),
            (0, voucher_facts_1.loadGeneratedRoleLedgers)(tx, h.companyId, h.branchId),
            (0, voucher_facts_1.loadTaxRates)(tx, lines.filter((l) => l.gst).map((l) => l.gst.taxId)),
        ]);
        const party = h.partyId ? (ledgers.get(h.partyId) ?? null) : null;
        const asks = [];
        if (type.gstRegister && type.gstSide) {
            const prefix = type.gstSide === 'INPUT' ? 'INPUT_' : 'OUTPUT_';
            const taxIds = [...new Set(lines.filter((l) => l.gst).map((l) => l.gst.taxId))];
            for (const taxId of taxIds) {
                for (const nature of ['INTRA', 'INTER']) {
                    for (const c of ['CGST', 'SGST', 'IGST', 'CESS']) {
                        asks.push({ role: `${prefix}${c}`, taxId, supplyNature: nature });
                    }
                    if (h.reverseCharge && type.gstSide === 'INPUT') {
                        for (const c of ['CGST', 'SGST', 'IGST']) {
                            asks.push({ role: `RCM_${c}_PAYABLE`, taxId, supplyNature: nature });
                        }
                    }
                }
            }
        }
        if (type.tdsMode === 'DEDUCT') {
            asks.push({ role: 'TDS_PAYABLE', taxId: null, supplyNature: null });
        }
        const roleLedgers = await (0, voucher_facts_1.resolveRoleLedgerMap)(tx, h.companyId, h.branchId, asks);
        const creditDaysByLedger = new Map();
        const partyLedgers = new Set();
        if (party)
            partyLedgers.add(party.ledId);
        for (const l of lines) {
            const f = ledgers.get(l.ledgerId);
            if (f && (f.isParty || f.isBillByBill))
                partyLedgers.add(f.ledId);
        }
        for (const id of partyLedgers) {
            creditDaysByLedger.set(id, await (0, voucher_facts_1.loadPartyCreditDays)(tx, id));
        }
        let tds = null;
        if (type.tdsMode === 'DEDUCT' && party?.isTdsApplicable && party.tdsSection) {
            const [rate, annualBaseSoFar] = await Promise.all([
                (0, voucher_facts_1.loadTdsRate)(tx, h.companyId, party.tdsSection, party.tdsDeducteeType, h.date),
                (0, voucher_facts_1.loadTdsAnnualBase)(tx, h.companyId, party.ledId, h.accYear, party.tdsSection),
            ]);
            tds = { rate, annualBaseSoFar };
        }
        const bills = await (0, voucher_facts_1.loadBills)(tx, allocations, opts.lock);
        let docRefnoClash = null;
        const docRefno = h.docRefno?.trim() || null;
        if (docRefno && party) {
            const [hit] = await tx.$queryRaw `
        SELECT
          (SELECT count(*) FROM accounts.acc_voucher_header x
            WHERE x.avh_company_id = ${h.companyId}::uuid AND x.avh_party_id = ${party.ledId}::uuid
              AND x.avh_voucher_type_id = ${type.typeId}::int AND x.avh_acc_year = ${h.accYear}::char(9)
              AND x.avh_doc_refno = ${docRefno} AND x.avh_is_deleted = false
              AND x.avh_voucher_status <> 'CANCELLED'
              AND (${h.voucherId ?? null}::uuid IS NULL OR x.avh_voucher_id <> ${h.voucherId ?? null}::uuid)) AS exact,
          (SELECT count(*) FROM accounts.acc_voucher_header x
            WHERE x.avh_company_id = ${h.companyId}::uuid AND x.avh_party_id = ${party.ledId}::uuid
              AND x.avh_doc_refno = ${docRefno} AND x.avh_is_deleted = false
              AND x.avh_voucher_status <> 'CANCELLED'
              AND (${h.voucherId ?? null}::uuid IS NULL OR x.avh_voucher_id <> ${h.voucherId ?? null}::uuid)) AS other,
          (SELECT count(*) FROM accounts.acc_bill_balance b
            WHERE b.abl_company_id = ${h.companyId}::uuid AND b.abl_party_id = ${party.ledId}::uuid
              AND b.abl_bill_type = ${type.raiseBillType ?? ''} AND b.abl_acc_year = ${h.accYear}::char(9)
              AND b.abl_doc_refno = ${docRefno} AND b.abl_is_deleted = false) AS bill`;
            if (Number(hit.exact) > 0 || (type.billwiseMode === 'RAISE' && Number(hit.bill) > 0)) {
                docRefnoClash = 'INDEX';
            }
            else if (Number(hit.other) > 0) {
                docRefnoClash = 'OTHER';
            }
        }
        const backdateMode = await this.backdateMode(tx, h.companyId);
        const input = {
            type,
            header: {
                date: h.date,
                partyId: h.partyId ?? null,
                posStcd: h.posStcd?.trim() || null,
                reverseCharge: h.reverseCharge ?? false,
                docRefno,
            },
            lines,
            allocations,
            newBill: dto.newBill ? { dueDays: dto.newBill.dueDays ?? null } : null,
            company,
            ledgers,
            instrumentLedgers,
            generatedRoleLedgers,
            taxRates,
            roleLedgers,
            party,
            creditDaysByLedger,
            tds,
            bills,
            docRefnoClash,
            backdateMode,
            today: new Date().toISOString().slice(0, 10),
            ctx,
        };
        const derived = (0, voucher_derive_1.derive)(input);
        return {
            type,
            rights,
            company,
            party,
            ledgers,
            derived,
            ctx,
            header: {
                date: h.date,
                docRefno,
                docDate: h.docDate ?? null,
                usrRefno: h.usrRefno?.trim() || null,
                remarks: h.remarks?.trim() || null,
                posStcd: h.posStcd?.trim() || null,
                reverseCharge: h.reverseCharge ?? false,
            },
        };
    }
    async backdateMode(tx, companyId) {
        const [row] = await tx.$queryRaw `
      SELECT out_effective_value AS value
        FROM public.fn_app_settings_effective(${companyId}::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
       WHERE out_asd_key = ${BACKDATE_SETTING}`;
        const token = row?.value?.trim().toUpperCase();
        return token === 'WARN' || token === 'REFUSE' ? token : 'OFF';
    }
    registerDoc(p, d, voucherId, voucherNo, refno, dto, actor) {
        const g = d.gst;
        const party = p.party;
        const supplyNature = g.supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE';
        const tax = g.cgst.plus(g.sgst).plus(g.igst).plus(g.cess);
        const billValue = g.reverseCharge ? g.taxable : g.taxable.plus(tax);
        const n = (v) => Number(v.toFixed(2));
        const services = g.lines.filter((l) => l.isService).length;
        const lines = g.lines.map((l) => {
            const ledger = p.ledgers.get(l.taxableLedgerId);
            const lineTax = l.cgst.plus(l.sgst).plus(l.igst).plus(l.cess);
            return {
                rowNo: l.rowNo,
                description: ledger?.name ?? null,
                hsnCode: l.hsn,
                qty: 1,
                rate: n(l.taxable),
                discount: 0,
                isService: l.isService,
                taxableValue: n(l.taxable),
                taxId: l.rate.taxId,
                totalTaxRate: Number(l.rate.ratePerc.toString()),
                cgstRate: Number(l.rate.cgstPerc.toString()),
                sgstRate: Number(l.rate.sgstPerc.toString()),
                igstRate: Number(l.rate.igstPerc.toString()),
                cessRate: Number(l.rate.cessPerc.toString()),
                cgstAmount: n(l.cgst),
                sgstAmount: n(l.sgst),
                igstAmount: n(l.igst),
                cessAmount: n(l.cess),
                otherAmount: 0,
                totalValue: n(l.taxable.plus(lineTax)),
                billValue: n(g.reverseCharge ? l.taxable : l.taxable.plus(lineTax)),
                taxability: detailTaxability(l.rate.taxability),
                supplyNature,
                taxableLedgerId: l.taxableLedgerId,
                cgstLedgerId: l.cgstLedgerId,
                sgstLedgerId: l.sgstLedgerId,
                igstLedgerId: l.igstLedgerId,
                cessLedgerId: l.cessLedgerId,
                itcEligibility: l.itcEligibility,
            };
        });
        return {
            companyId: dto.header.companyId,
            branchId: dto.header.branchId,
            accYear: dto.header.accYear,
            voucherId,
            voucherTypeId: p.type.typeId,
            voucherNo,
            voucherDate: dto.header.date,
            voucherRefno: refno,
            sourceModule: 'ACCOUNTS',
            sourceDocId: voucherId,
            docType: g.docType,
            tranNature: g.tranNature,
            docFlow: g.docFlow,
            docSign: g.docSign,
            docNo: refno,
            docDate: dto.header.date,
            docRefNo: p.header.docRefno,
            taxability: lines.every((l) => l.taxability === lines[0].taxability)
                ? lines[0].taxability
                : 'MIXED',
            supplyClass: services === 0 ? 'GOODS' : services === lines.length ? 'SERVICES' : 'MIXED',
            supplyNature,
            placeOfSupplyCode: g.posStcd,
            placeOfSupplyName: null,
            isReverseCharge: g.reverseCharge,
            igstOnIntra: false,
            partyType: g.docFlow === 'INWARD' ? 'VENDOR' : 'CUSTOMER',
            partyId: party.ledId,
            partyName: party.name,
            partyAddr1: party.addr1,
            partyAddr2: party.addr2,
            partyAddr3: party.addr3,
            partyLocation: party.city,
            partyPin: party.pin,
            partyStateCode: party.stateCode,
            partyStateName: party.stateName,
            partyGstType: party.gstType,
            partyGstin: party.gstin,
            grossValue: n(g.taxable),
            discountValue: 0,
            taxableValue: n(g.taxable),
            cgstValue: n(g.cgst),
            sgstValue: n(g.sgst),
            igstValue: n(g.igst),
            cessValue: n(g.cess),
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: 0,
            roundOff: 0,
            billValue: n(billValue),
            remarks: p.header.remarks,
            createdBy: actor,
            lines,
        };
    }
    async assemble(tx, s, type, rights) {
        const n = (v) => Number(new client_1.Prisma.Decimal(v ?? 0).toFixed(2));
        const iso = (d) => d ? d.toISOString().slice(0, 10) : null;
        const ts = (d) => (d ? d.toISOString() : null);
        const status = s.avh_voucher_status;
        const legRows = await tx.$queryRaw `
      SELECT v.av_id, v.av_row_no, v.av_dr_cr, v.av_ledger_id, l.led_name, g.acc_group_name,
             v.av_amount, v.av_role, v.av_remarks, v.av_opp_ledger_id
        FROM accounts.acc_vouchers v
        JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE v.av_voucher_id = ${s.avh_voucher_id}::uuid AND v.av_acc_year = ${s.avh_acc_year}::char(9)
         AND v.av_is_deleted = false
       ORDER BY v.av_row_no`;
        let partyLegRow = -1;
        if (type.partyMode === 'ONE' && s.avh_party_id) {
            for (const r of legRows) {
                if (r.av_ledger_id === s.avh_party_id && r.av_dr_cr.trim() === type.partySide)
                    partyLegRow = r.av_row_no;
            }
        }
        const legs = legRows.map((r) => ({
            avId: r.av_id,
            rowNo: r.av_row_no,
            drCr: r.av_dr_cr.trim(),
            ledgerId: r.av_ledger_id,
            ledgerName: r.led_name,
            groupName: r.acc_group_name,
            amount: n(r.av_amount),
            role: r.av_role,
            generated: (r.av_role !== null && GENERATED.has(r.av_role)) || r.av_row_no === partyLegRow,
            remarks: r.av_remarks,
            oppLedgerId: r.av_opp_ledger_id,
        }));
        const adjRows = await tx.$queryRaw `
      SELECT j.abj_id, j.abj_row_no, j.abj_bill_id, j.abj_bill_acc_year, b.abl_doc_refno, b.abl_bill_type,
             j.abj_against_bill_id, j.abj_against_bill_acc_year, j.abj_adj_type, j.abj_dr_cr,
             j.abj_amount, j.abj_adj_date, j.abj_reversal_of_id
        FROM accounts.acc_bill_adjustment j
        LEFT JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
       WHERE j.abj_is_deleted = false
         AND ((j.abj_voucher_id = ${s.avh_voucher_id}::uuid AND j.abj_voucher_acc_year = ${s.avh_acc_year}::char(9))
           -- the counter-rows a cancel filed against the REVERSAL voucher, shown with what they undo
           OR j.abj_reversal_of_id IN (SELECT o.abj_id FROM accounts.acc_bill_adjustment o
                                        WHERE o.abj_voucher_id = ${s.avh_voucher_id}::uuid
                                          AND o.abj_voucher_acc_year = ${s.avh_acc_year}::char(9)))
       ORDER BY (j.abj_reversal_of_id IS NOT NULL), j.abj_row_no`;
        const allocations = adjRows.map((r) => ({
            abjId: r.abj_id,
            rowNo: r.abj_row_no,
            billId: r.abj_bill_id,
            billAccYear: r.abj_bill_acc_year.trim(),
            billRefno: r.abl_doc_refno,
            billType: r.abl_bill_type,
            againstBillId: r.abj_against_bill_id,
            againstBillAccYear: r.abj_against_bill_acc_year?.trim() ?? null,
            adjType: r.abj_adj_type,
            drCr: r.abj_dr_cr.trim(),
            amount: n(r.abj_amount),
            adjDate: iso(r.abj_adj_date),
            isReversal: r.abj_reversal_of_id !== null,
            reversalOfId: r.abj_reversal_of_id,
        }));
        const billRows = await tx.$queryRaw `
      SELECT abl_id, abl_acc_year, abl_bill_type, abl_doc_refno, abl_doc_date, abl_due_date, abl_dr_cr,
             abl_bill_amount, abl_alloc_amount, abl_pending_amount, abl_status, abl_is_deleted
        FROM accounts.acc_bill_balance
       WHERE abl_voucher_id = ${s.avh_voucher_id}::uuid AND abl_acc_year = ${s.avh_acc_year}::char(9)
       ORDER BY abl_created_on`;
        const bills = billRows.map((r) => ({
            ablId: r.abl_id,
            ablAccYear: r.abl_acc_year.trim(),
            billType: r.abl_bill_type,
            docRefno: r.abl_doc_refno,
            docDate: iso(r.abl_doc_date),
            dueDate: iso(r.abl_due_date),
            side: r.abl_dr_cr.trim(),
            billAmount: n(r.abl_bill_amount),
            allocAmount: n(r.abl_alloc_amount),
            pendingAmount: n(r.abl_pending_amount),
            status: r.abl_status,
            isDeleted: r.abl_is_deleted,
        }));
        const gdrRows = await tx.$queryRaw `
      SELECT gdr_id, gdr_doc_type::text AS gdr_doc_type, gdr_doc_status::text AS gdr_doc_status, gdr_doc_no,
             gdr_doc_date, gdr_supply_nature::text AS gdr_supply_nature, gdr_place_of_supply_code,
             gdr_is_reverse_charge, gdr_is_einvoice_applicable, gdr_taxable_value, gdr_cgst_value,
             gdr_sgst_value, gdr_igst_value, gdr_cess_value, gdr_bill_value
        FROM accounts.acc_voucher_doc_register
       WHERE gdr_voucher_id = ${s.avh_voucher_id}::uuid AND gdr_acc_year = ${s.avh_acc_year}::char(9)
         AND gdr_is_deleted = false
       ORDER BY gdr_created_on DESC LIMIT 1`;
        let gstDoc = null;
        if (gdrRows[0]) {
            const g = gdrRows[0];
            const vtx = await tx.$queryRaw `
        SELECT vtx_row_no, vtx_tax_id, vtx_hsn_code, vtx_is_service, vtx_taxable_value, vtx_total_tax_rate,
               vtx_cgst_amount, vtx_sgst_amount, vtx_igst_amount, vtx_cess_amount, vtx_itc_eligibility
          FROM accounts.acc_voucher_doc_detail
         WHERE vtx_gdr_id = ${g.gdr_id}::uuid AND vtx_acc_year = ${s.avh_acc_year}::char(9)
           AND vtx_is_deleted = false
         ORDER BY vtx_row_no`;
            gstDoc = {
                gdrId: g.gdr_id,
                docType: g.gdr_doc_type,
                docStatus: g.gdr_doc_status,
                docNo: g.gdr_doc_no,
                docDate: iso(g.gdr_doc_date),
                supplyNature: g.gdr_supply_nature,
                placeOfSupply: g.gdr_place_of_supply_code?.trim() ?? null,
                isReverseCharge: g.gdr_is_reverse_charge,
                isEinvoiceApplicable: g.gdr_is_einvoice_applicable,
                taxable: n(g.gdr_taxable_value),
                cgst: n(g.gdr_cgst_value),
                sgst: n(g.gdr_sgst_value),
                igst: n(g.gdr_igst_value),
                cess: n(g.gdr_cess_value),
                billValue: n(g.gdr_bill_value),
                lines: vtx.map((l) => ({
                    rowNo: l.vtx_row_no,
                    taxId: l.vtx_tax_id,
                    hsn: l.vtx_hsn_code,
                    isService: l.vtx_is_service,
                    taxable: n(l.vtx_taxable_value),
                    ratePerc: Number(l.vtx_total_tax_rate.toString()),
                    cgst: n(l.vtx_cgst_amount),
                    sgst: n(l.vtx_sgst_amount),
                    igst: n(l.vtx_igst_amount),
                    cess: n(l.vtx_cess_amount),
                    itcEligibility: l.vtx_itc_eligibility,
                })),
            };
        }
        const tdsRows = await tx.$queryRaw `
      SELECT atd_id, atd_section, atd_deductee_type, atd_rate, atd_rate_source, atd_base_amount,
             atd_tax_amount, atd_challan_no, atd_reversal_of_id
        FROM accounts.acc_tds_register
       WHERE atd_is_deleted = false
         AND ((atd_voucher_id = ${s.avh_voucher_id}::uuid AND atd_voucher_acc_year = ${s.avh_acc_year}::char(9))
           OR atd_reversal_of_id IN (SELECT o.atd_id FROM accounts.acc_tds_register o
                                      WHERE o.atd_voucher_id = ${s.avh_voucher_id}::uuid
                                        AND o.atd_voucher_acc_year = ${s.avh_acc_year}::char(9)))
       ORDER BY (atd_reversal_of_id IS NOT NULL), atd_created_on`;
        const tds = tdsRows.map((r) => ({
            atdId: r.atd_id,
            section: r.atd_section,
            deducteeType: r.atd_deductee_type,
            rate: Number(r.atd_rate.toString()),
            rateSource: r.atd_rate_source,
            base: n(r.atd_base_amount),
            tax: n(r.atd_tax_amount),
            challanNo: r.atd_challan_no,
            isReversal: r.atd_reversal_of_id !== null,
        }));
        const [fy] = await tx.$queryRaw `
      SELECT fy_lock_date FROM public.fiscal_years
       WHERE comp_id = ${s.avh_company_id}::uuid AND fy_year_name = ${s.avh_acc_year}::char(9) AND is_deleted = false
       LIMIT 1`;
        const lock = fy?.fy_lock_date ? fy.fy_lock_date.toISOString().slice(0, 10) : null;
        const elsewhere = status === 'POSTED'
            ? await (0, voucher_billwise_helper_1.otherVoucherOnRaisedBills)(tx, s.avh_voucher_id, s.avh_acc_year)
            : [];
        const header = {
            voucherId: s.avh_voucher_id,
            companyId: s.avh_company_id,
            branchId: s.avh_branch_id,
            accYear: s.avh_acc_year,
            typeId: type.typeId,
            typeCode: type.typeCode,
            typeName: type.typeName,
            voucherNo: s.avh_voucher_no === null ? null : Number(s.avh_voucher_no),
            voucherRefno: s.avh_voucher_refno,
            date: iso(s.avh_voucher_date),
            partyId: s.avh_party_id,
            partyName: s.party_name,
            docRefno: s.avh_doc_refno,
            docDate: iso(s.avh_doc_date),
            usrRefno: s.avh_usr_refno,
            remarks: s.avh_remarks,
            docAmount: n(s.avh_doc_amount),
            totalDebit: n(s.avh_total_debit),
            totalCredit: n(s.avh_total_credit),
            status,
            statusOn: ts(s.avh_status_on),
            postedOn: ts(s.avh_posted_on),
            cancelReason: s.avh_cancel_reason,
            reversalVoucherId: s.avh_reversal_voucher_id,
            reversalAccYear: s.avh_reversal_acc_year?.trim() ?? null,
            reversalRefno: s.reversal_refno,
            againstVoucherId: s.avh_against_voucher_id,
            againstAccYear: s.avh_against_acc_year?.trim() ?? null,
            againstRefno: s.against_refno,
            createdBy: s.avh_created_by,
            createdOn: ts(s.avh_created_on),
            modifiedBy: s.avh_modified_by,
            modifiedOn: ts(s.avh_modified_on),
        };
        return {
            header,
            rules: type,
            rights,
            locks: {
                editable: status === 'DRAFT' && rights.edit,
                dayClosed: false,
                periodLocked: lock !== null && header.date <= lock,
                allocatedElsewhere: elsewhere.length > 0,
            },
            legs,
            allocations,
            bills,
            gstDoc,
            tds,
            draft: status === 'DRAFT' && s.avh_draft_lines && typeof s.avh_draft_lines === 'object'
                ? s.avh_draft_lines
                : null,
        };
    }
};
exports.VoucherRegisterService = VoucherRegisterService;
exports.VoucherRegisterService = VoucherRegisterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        voucher_types_service_1.VoucherTypesService,
        voucher_posting_service_1.VoucherPostingService,
        doc_register_service_1.DocRegisterService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], VoucherRegisterService);
function accYearOf(iso) {
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    const start = m >= 4 ? y : y - 1;
    return `${start}-${start + 1}`;
}
function quarterOf(iso) {
    const m = Number(iso.slice(5, 7));
    if (m >= 4 && m <= 6)
        return 'Q1';
    if (m >= 7 && m <= 9)
        return 'Q2';
    if (m >= 10)
        return 'Q3';
    return 'Q4';
}
function statusDocType(type) {
    switch (type.nature) {
        case 'RECEIPT':
            return txn_status_log_helper_1.TxnStatusDocType.RECEIPT;
        case 'PAYMENT':
            return txn_status_log_helper_1.TxnStatusDocType.PAYMENT;
        default:
            return txn_status_log_helper_1.TxnStatusDocType.JOURNAL;
    }
}
function detailTaxability(rate) {
    switch (rate.toUpperCase()) {
        case 'EXEMPT':
            return 'EXEMPT';
        case 'NIL_RATED':
            return 'NIL_RATED';
        case 'NON_GST':
            return 'NON_GST';
        default:
            return 'TAXABLE';
    }
}
//# sourceMappingURL=voucher-register.service.js.map