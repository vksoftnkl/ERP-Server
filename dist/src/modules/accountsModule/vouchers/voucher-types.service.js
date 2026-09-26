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
exports.VoucherTypesService = void 0;
exports.toVoucherRights = toVoucherRights;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const rights_1 = require("../../../common/posting/rights");
let VoucherTypesService = class VoucherTypesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async loadRegisterTypes(client = this.prisma) {
        const rows = await client.$queryRaw `
      ${TYPE_SELECT}
       WHERE vchr_in_register = true AND vchr_is_active = true
       ORDER BY vchr_sort_order, vchr_type_name`;
        return this.withGroupNames(client, rows);
    }
    async loadTypeByCode(client, typeCode) {
        const rows = await client.$queryRaw `
      ${TYPE_SELECT}
       WHERE vchr_type_code = ${typeCode}
       LIMIT 1`;
        if (rows.length === 0 || !rows[0].vchr_is_active) {
            return null;
        }
        return (await this.withGroupNames(client, rows))[0];
    }
    async loadTypeById(client, typeId) {
        const rows = await client.$queryRaw `
      ${TYPE_SELECT}
       WHERE vchr_type_id = ${typeId}::int
       LIMIT 1`;
        if (rows.length === 0) {
            return null;
        }
        return (await this.withGroupNames(client, rows))[0];
    }
    async rightsFor(client, userId, type) {
        if (!userId || type.menuId === null) {
            return toVoucherRights(rights_1.NO_RIGHTS);
        }
        return toVoucherRights(await (0, rights_1.loadRights)(client, userId, type.menuId));
    }
    async typesForCaller(userId, menuId, client = this.prisma) {
        const all = await this.loadRegisterTypes(client);
        const scoped = menuId !== null && all.some((t) => t.menuId === menuId)
            ? all.filter((t) => t.menuId === menuId)
            : all;
        const rightsByMenu = new Map();
        const out = [];
        for (const type of scoped) {
            if (type.menuId === null) {
                continue;
            }
            let rights = rightsByMenu.get(type.menuId);
            if (!rights) {
                rights = await this.rightsFor(client, userId, type);
                rightsByMenu.set(type.menuId, rights);
            }
            if (rights.view) {
                out.push({ ...type, rights });
            }
        }
        return out;
    }
    async withGroupNames(client, rows) {
        const ids = [...new Set(rows.flatMap((r) => [...r.vchr_dr_groups, ...r.vchr_cr_groups]))];
        const names = new Map();
        if (ids.length > 0) {
            const groups = await client.$queryRaw `
        SELECT acc_group_id, acc_group_name FROM accounts.acc_group_master
         WHERE acc_group_id = ANY(${ids}::uuid[])`;
            groups.forEach((g) => names.set(g.acc_group_id, g.acc_group_name));
        }
        const refs = (list) => list.map((groupId) => ({ groupId, name: names.get(groupId) ?? groupId }));
        return rows.map((r) => ({
            typeId: r.vchr_type_id,
            typeCode: r.vchr_type_code,
            typeName: r.vchr_type_name,
            nature: r.vchr_nature,
            numberPrefix: r.vchr_no_prefix,
            menuId: r.vchr_menu_id,
            partyMode: r.vchr_party_mode,
            partySide: r.vchr_party_side,
            billwiseMode: r.vchr_billwise_mode,
            raiseBillType: r.vchr_raise_bill_type,
            drGroups: refs(r.vchr_dr_groups),
            crGroups: refs(r.vchr_cr_groups),
            gstRegister: r.vchr_gst_register,
            gstSide: r.vchr_gst_side,
            tdsMode: r.vchr_tds_mode,
            inRegister: r.vchr_in_register,
            affectsInventory: r.vchr_affects_inventory,
        }));
    }
};
exports.VoucherTypesService = VoucherTypesService;
exports.VoucherTypesService = VoucherTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VoucherTypesService);
const TYPE_SELECT = client_1.Prisma.sql `
  SELECT vchr_type_id, vchr_type_code, vchr_type_name, vchr_nature::text AS vchr_nature,
         vchr_no_prefix, vchr_menu_id,
         vchr_party_mode, vchr_party_side, vchr_billwise_mode, vchr_raise_bill_type,
         vchr_dr_groups, vchr_cr_groups, vchr_gst_register, vchr_gst_side, vchr_tds_mode,
         vchr_in_register, vchr_affects_inventory, vchr_is_active
    FROM accounts.acc_voucher_types`;
function toVoucherRights(r) {
    return {
        view: r.view,
        create: r.create,
        edit: r.edit,
        delete: r.delete,
        post: r.post,
        cancel: r.cancel,
        print: r.print,
        override: r.override,
    };
}
//# sourceMappingURL=voucher-types.service.js.map