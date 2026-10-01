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
exports.TransportBandService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const sales_guards_1 = require("./sales.guards");
let TransportBandService = class TransportBandService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async read(ref, client) {
        const c = client ?? this.prisma;
        const row = await c.txnTransportDetail.findFirst({
            where: {
                ttdDocType: ref.docType,
                ttdDocId: ref.docId,
                ttdAccYear: ref.accYear,
                ttdIsDeleted: false,
            },
        });
        return row ? toRow(row) : null;
    }
    async write(tx, ref, input, actor, opts) {
        await (0, sales_guards_1.assertBandWritable)(tx, opts.gdrId);
        const now = opts.now ?? new Date();
        const existing = await tx.txnTransportDetail.findFirst({
            where: {
                ttdDocType: ref.docType,
                ttdDocId: ref.docId,
                ttdAccYear: ref.accYear,
                ttdIsDeleted: false,
            },
            select: { ttdId: true },
        });
        const from = input.from ?? {};
        const to = input.to ?? {};
        const data = {
            ttdDirection: input.direction,
            ttdDocRefno: ref.docRefno ?? null,
            ttdFromGodownId: from.godownId ?? null,
            ttdFromBranchId: from.branchId ?? null,
            ttdFromAddrId: from.addrId ?? null,
            ttdFromName: from.name ?? null,
            ttdFromAddr: from.addr ?? null,
            ttdFromPlace: from.place ?? null,
            ttdFromPin: from.pin ?? null,
            ttdFromPhone: from.phone ?? null,
            ttdFromStcd: from.stcd ?? null,
            ttdFromGstin: from.gstin ?? null,
            ttdToGodownId: to.godownId ?? null,
            ttdToBranchId: to.branchId ?? null,
            ttdToAddrId: to.addrId ?? null,
            ttdToName: to.name ?? null,
            ttdToAddr: to.addr ?? null,
            ttdToPlace: to.place ?? null,
            ttdToPin: to.pin ?? null,
            ttdToPhone: to.phone ?? null,
            ttdToStcd: to.stcd ?? null,
            ttdToGstin: to.gstin ?? null,
            ttdTransportMode: input.mode ?? null,
            ttdTransporterId: input.transporterId ?? null,
            ttdTransporterName: input.transporterName ?? null,
            ttdTransporterGstin: input.transporterGstin ?? null,
            ttdLrNo: input.lrNo ?? null,
            ttdLrDate: input.lrDate ? new Date(`${input.lrDate}T00:00:00Z`) : null,
            ttdDistanceKm: input.distanceKm ?? null,
            ttdRemarks: input.remarks ?? null,
        };
        const row = existing
            ? await tx.txnTransportDetail.update({
                where: { ttdId_ttdAccYear: { ttdId: existing.ttdId, ttdAccYear: ref.accYear } },
                data: { ...data, ttdModifiedOn: now, ttdModifiedBy: actor },
            })
            : await tx.txnTransportDetail.create({
                data: {
                    ...data,
                    ttdCompanyId: ref.companyId,
                    ttdBranchId: ref.branchId,
                    ttdTenantId: ref.tenantId ?? null,
                    ttdAccYear: ref.accYear,
                    ttdDocType: ref.docType,
                    ttdDocId: ref.docId,
                    ttdCreatedOn: now,
                    ttdCreatedBy: actor,
                },
            });
        return toRow(row);
    }
    async remove(tx, ref, actor) {
        await tx.txnTransportDetail.updateMany({
            where: {
                ttdDocType: ref.docType,
                ttdDocId: ref.docId,
                ttdAccYear: ref.accYear,
                ttdIsDeleted: false,
            },
            data: { ttdIsDeleted: true, ttdModifiedOn: new Date(), ttdModifiedBy: actor },
        });
    }
    static hasContent(input) {
        if (!input) {
            return false;
        }
        const ends = [input.from ?? {}, input.to ?? {}];
        const endHas = ends.some((e) => Object.values(e).some((v) => v !== null && v !== undefined && v !== ''));
        return (endHas ||
            !!input.mode ||
            !!input.transporterId ||
            !!input.transporterName ||
            !!input.transporterGstin ||
            !!input.lrNo ||
            !!input.lrDate ||
            (input.distanceKm ?? null) !== null);
    }
};
exports.TransportBandService = TransportBandService;
exports.TransportBandService = TransportBandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TransportBandService);
function toRow(r) {
    return {
        ttdId: r.ttdId,
        direction: r.ttdDirection === 'INWARD' ? 'INWARD' : 'OUTWARD',
        from: {
            godownId: r.ttdFromGodownId,
            branchId: r.ttdFromBranchId,
            addrId: r.ttdFromAddrId,
            name: r.ttdFromName,
            addr: r.ttdFromAddr,
            place: r.ttdFromPlace,
            pin: r.ttdFromPin,
            phone: r.ttdFromPhone,
            stcd: r.ttdFromStcd,
            gstin: r.ttdFromGstin,
        },
        to: {
            godownId: r.ttdToGodownId,
            branchId: r.ttdToBranchId,
            addrId: r.ttdToAddrId,
            name: r.ttdToName,
            addr: r.ttdToAddr,
            place: r.ttdToPlace,
            pin: r.ttdToPin,
            phone: r.ttdToPhone,
            stcd: r.ttdToStcd,
            gstin: r.ttdToGstin,
        },
        mode: r.ttdTransportMode,
        transporterId: r.ttdTransporterId,
        transporterName: r.ttdTransporterName,
        transporterGstin: r.ttdTransporterGstin,
        lrNo: r.ttdLrNo,
        lrDate: r.ttdLrDate ? r.ttdLrDate.toISOString().slice(0, 10) : null,
        distanceKm: r.ttdDistanceKm,
        remarks: r.ttdRemarks,
    };
}
//# sourceMappingURL=transport-band.service.js.map