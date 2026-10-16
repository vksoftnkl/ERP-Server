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
exports.BranchProfileProvider = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../../../database/pg/pg.service");
const provider_utils_1 = require("./provider.utils");
let BranchProfileProvider = class BranchProfileProvider {
    pg;
    code = 'branch.profile';
    label = 'Branch address';
    cardinality = 'one';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const { branchId, companyId } = request.context;
        if (!branchId)
            return {};
        const rows = await (0, provider_utils_1.providerQuery)(this.pg, `SELECT br_id           AS branch_id,
              br_code         AS branch_code,
              br_name         AS branch_name,
              br_mailing_name AS mailing_name,
              br_short        AS short_name,
              br_addr1        AS addr1,
              br_addr2        AS addr2,
              br_addr3        AS addr3,
              br_city         AS city,
              br_district     AS district,
              br_state        AS state,
              br_state_code   AS state_code,
              br_pin          AS pin,
              br_country      AS country,
              br_landmark     AS landmark,
              br_contact_person AS contact_person,
              br_tel          AS tel,
              br_phone        AS phone,
              concat_ws(', ',
                 nullif(br_addr1, ''), nullif(br_addr2, ''), nullif(br_addr3, ''),
                 nullif(br_city, ''), nullif(br_state, ''),
                 nullif(br_pin::text, '')) AS address_block
         FROM public.branch_master
        -- The company predicate is not redundant with the id: a branch id from
        -- somewhere else must resolve to nothing rather than to a branch.
        WHERE br_id = $1 AND br_comp_id = $2`, [branchId, companyId]);
        return rows[0] ?? {};
    }
};
exports.BranchProfileProvider = BranchProfileProvider;
exports.BranchProfileProvider = BranchProfileProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], BranchProfileProvider);
//# sourceMappingURL=branch-profile.provider.js.map