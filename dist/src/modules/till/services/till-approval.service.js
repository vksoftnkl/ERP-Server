"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TillApprovalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let TillApprovalService = class TillApprovalService {
    async ruleFor(client, scope) {
        const [row] = await client.$queryRaw `
      SELECT tar_id, tar_event_code, tar_mode, tar_threshold_amount, tar_channel, tar_min_role,
             tar_two_person, tar_blocks_till
        FROM accounts.till_approval_rule
       WHERE tar_event_code = ${scope.event}
         AND tar_is_active AND NOT tar_is_deleted
         AND (tar_company_id IS NULL OR tar_company_id = ${scope.companyId}::uuid)
         AND (tar_branch_id  IS NULL OR tar_branch_id  = ${scope.branchId}::uuid)
         AND tar_effective_from <= ${scope.onDate}::date
       ORDER BY (tar_branch_id IS NOT NULL) DESC,
                (tar_company_id IS NOT NULL) DESC,
                tar_effective_from DESC
       LIMIT 1`;
        return row ?? null;
    }
    async assess(client, scope) {
        const rule = await this.ruleFor(client, scope);
        if (!rule) {
            return null;
        }
        const threshold = new client_1.Prisma.Decimal(rule.tar_threshold_amount);
        const needed = rule.tar_mode === 'ALWAYS' ||
            (rule.tar_mode === 'OVER_AMOUNT' && scope.amount.greaterThan(threshold));
        if (!needed) {
            return null;
        }
        return {
            event: rule.tar_event_code,
            ruleId: rule.tar_id,
            mode: rule.tar_mode,
            threshold: Number(threshold.toFixed(2)),
            amount: Number(scope.amount.toFixed(2)),
            minRole: rule.tar_min_role,
            channel: rule.tar_channel,
            twoPerson: rule.tar_two_person,
            blocksTill: rule.tar_blocks_till,
            enforced: false,
        };
    }
};
exports.TillApprovalService = TillApprovalService;
exports.TillApprovalService = TillApprovalService = __decorate([
    (0, common_1.Injectable)()
], TillApprovalService);
//# sourceMappingURL=till-approval.service.js.map