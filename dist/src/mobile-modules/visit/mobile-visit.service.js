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
exports.MobileVisitService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_scope_1 = require("../common/mobile-scope");
function decimalOrNull(value) {
    return value === null || value === undefined ? null : new client_1.Prisma.Decimal(value.toString());
}
let MobileVisitService = class MobileVisitService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async create(dto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'visit', dto.cvCompanyId, dto.cvClientUuid);
                const stored = await this.findByClientUuid(tx, dto.cvCompanyId, dto.cvClientUuid);
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
                this.assertPositionPair(dto);
                await (0, mobile_scope_1.assertMobileCompany)(tx, dto.cvCompanyId, 'cvCompanyId');
                const device = await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
                const branchId = await (0, mobile_scope_1.requireMobileBranch)(tx, dto.cvCompanyId, device.devBranchId);
                await this.assertCustomer(tx, dto.cvCustId);
                await this.assertSalesman(tx, dto.cvSalesmanId);
                const userId = this.requestContextService.getUserId();
                const created = await tx.customerVisit.create({
                    data: {
                        cvCompanyId: dto.cvCompanyId,
                        cvBranchId: branchId,
                        cvDeviceId: device.devId,
                        cvCustId: dto.cvCustId,
                        cvSalesmanId: dto.cvSalesmanId,
                        cvUserId: userId,
                        cvReasonCode: dto.cvReasonCode,
                        cvRemarks: dto.cvRemarks ?? null,
                        cvLatitude: decimalOrNull(dto.cvLatitude),
                        cvLongitude: decimalOrNull(dto.cvLongitude),
                        cvGpsAccuracy: decimalOrNull(dto.cvGpsAccuracy),
                        cvVisitAt: new Date(dto.cvVisitAt),
                        cvClientUuid: dto.cvClientUuid,
                        cvCreatedBy: (0, module_shared_utils_1.resolveActor)(null, userId),
                    },
                    select: { cvId: true, cvClientUuid: true, cvVisitAt: true, cvCustId: true },
                });
                return this.answer(created, false);
            });
        }
        catch (error) {
            if ((0, module_shared_utils_1.isUniqueConstraintError)(error)) {
                const stored = await this.findByClientUuid(this.prisma, dto.cvCompanyId, dto.cvClientUuid);
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
            }
            throw error;
        }
    }
    assertPositionPair(dto) {
        const hasLat = dto.cvLatitude !== null && dto.cvLatitude !== undefined;
        const hasLng = dto.cvLongitude !== null && dto.cvLongitude !== undefined;
        if (hasLat !== hasLng) {
            (0, module_shared_utils_1.throwBadRequest)('Validation failed', [
                {
                    field: hasLat ? 'cvLongitude' : 'cvLatitude',
                    message: 'Send cvLatitude and cvLongitude together, or neither.',
                    code: mobile_error_codes_1.MobileErrorCode.VISIT_POSITION_INCOMPLETE,
                },
            ]);
        }
    }
    async assertCustomer(client, cusId) {
        const [row] = await client.$queryRaw `
      SELECT 1 AS ok FROM sales.customers c
       WHERE c.cus_id = ${cusId}::uuid AND c.cus_is_deleted = false`;
        if (!row) {
            (0, module_shared_utils_1.throwNotFound)('Customer not found', 'cvCustId', `No customer ${cusId}`, mobile_error_codes_1.MobileErrorCode.VISIT_CUSTOMER_NOT_FOUND);
        }
    }
    async assertSalesman(client, empId) {
        const [row] = await client.$queryRaw `
      SELECT 1 AS ok FROM public.employee_master e
       WHERE e.emp_id = ${empId}::uuid AND e.emp_is_deleted = false`;
        if (!row) {
            (0, module_shared_utils_1.throwNotFound)('Salesman not found', 'cvSalesmanId', `No employee ${empId}`, mobile_error_codes_1.MobileErrorCode.VISIT_SALESMAN_NOT_FOUND);
        }
    }
    async findByClientUuid(client, companyId, clientUuid) {
        return client.customerVisit.findUnique({
            where: { cvCompanyId_cvClientUuid: { cvCompanyId: companyId, cvClientUuid: clientUuid } },
            select: { cvId: true, cvClientUuid: true, cvVisitAt: true, cvCustId: true },
        });
    }
    resendAnswer(stored, dto) {
        if (stored.cvCustId !== dto.cvCustId) {
            (0, module_shared_utils_1.throwConflict)('Visit id already used', [
                {
                    field: 'cvClientUuid',
                    message: `cvClientUuid ${dto.cvClientUuid} already names a visit to another customer.`,
                    code: mobile_error_codes_1.MobileErrorCode.CLIENT_UUID_REUSED,
                },
            ]);
        }
        return this.answer(stored, true);
    }
    answer(row, duplicate) {
        return {
            cvId: row.cvId,
            cvClientUuid: row.cvClientUuid,
            cvVisitAt: row.cvVisitAt.toISOString(),
            duplicate,
        };
    }
};
exports.MobileVisitService = MobileVisitService;
exports.MobileVisitService = MobileVisitService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], MobileVisitService);
//# sourceMappingURL=mobile-visit.service.js.map