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
exports.MobileBankService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const mobile_scope_1 = require("../common/mobile-scope");
let MobileBankService = class MobileBankService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, query.deviceUid);
        const items = await this.prisma.$queryRaw `
      SELECT b.bnk_id::text AS "bankId", btrim(b.bnk_name) AS name,
             NULLIF(btrim(b.bnk_short_name), '') AS "shortName"
        FROM fixed.bank_master b
       WHERE b.bnk_is_active = true
         AND b.bnk_is_deleted = false
         AND btrim(b.bnk_name) <> ''
       ORDER BY lower(btrim(b.bnk_name)), b.bnk_id`;
        return { items, total: items.length };
    }
};
exports.MobileBankService = MobileBankService;
exports.MobileBankService = MobileBankService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MobileBankService);
//# sourceMappingURL=mobile-bank.service.js.map