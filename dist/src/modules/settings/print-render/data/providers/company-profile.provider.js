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
exports.CompanyProfileProvider = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../../../database/pg/pg.service");
const provider_utils_1 = require("./provider.utils");
let CompanyProfileProvider = class CompanyProfileProvider {
    pg;
    code = 'company.profile';
    label = 'Company letterhead';
    cardinality = 'one';
    constructor(pg) {
        this.pg = pg;
    }
    async resolve(request) {
        const rows = await (0, provider_utils_1.providerQuery)(this.pg, `SELECT comp_id            AS company_id,
              comp_code          AS company_code,
              comp_name          AS company_name,
              comp_legal_name    AS legal_name,
              comp_short         AS short_name,
              comp_gstin_no      AS gstin,
              comp_gst_reg_type  AS gst_reg_type,
              comp_pan_no        AS pan_no,
              comp_fssai_no      AS fssai_no,
              comp_drug_license_no AS drug_license_no,
              comp_addr1         AS addr1,
              comp_addr2         AS addr2,
              comp_addr3         AS addr3,
              comp_city          AS city,
              comp_district      AS district,
              comp_state         AS state,
              comp_state_code    AS state_code,
              comp_pin           AS pin,
              comp_country       AS country,
              comp_tel           AS tel,
              comp_phone         AS phone,
              comp_mail          AS email,
              -- The address as one printable block, because every design wants
              -- it and none of them want to write the same COALESCE chain.
              concat_ws(', ',
                 nullif(comp_addr1, ''), nullif(comp_addr2, ''), nullif(comp_addr3, ''),
                 nullif(comp_city, ''), nullif(comp_state, ''),
                 nullif(comp_pin::text, '')) AS address_block
         FROM public.companys
        WHERE comp_id = $1`, [request.context.companyId]);
        return rows[0] ?? {};
    }
};
exports.CompanyProfileProvider = CompanyProfileProvider;
exports.CompanyProfileProvider = CompanyProfileProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], CompanyProfileProvider);
//# sourceMappingURL=company-profile.provider.js.map