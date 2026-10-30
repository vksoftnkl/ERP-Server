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
exports.PriceChangeLogService = void 0;
exports.appOf = appOf;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const price_change_diff_1 = require("./price-change-diff");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value) => value && UUID.test(value) ? value : null;
let PriceChangeLogService = class PriceChangeLogService {
    requestContext;
    changeSets = new WeakMap();
    constructor(requestContext) {
        this.requestContext = requestContext;
    }
    async snapshot(tx, table, ids) {
        const live = [...new Set(ids.filter(Boolean))];
        if (!live.length) {
            return new Map();
        }
        const rows = table === 'IPM'
            ? await tx.$queryRaw `
            SELECT p.ipm_id::text AS id, to_jsonb(p) AS row
              FROM inventory.item_price_master p
             WHERE p.ipm_id = ANY(${live}::uuid[])`
            : await tx.$queryRaw `
            SELECT q.iqp_id::text AS id, to_jsonb(q) AS row
              FROM inventory.item_qty_price q
             WHERE q.iqp_id = ANY(${live}::uuid[])`;
        return new Map(rows.map((r) => [r.id, r.row]));
    }
    async record(tx, entry) {
        const action = entry.action ?? (0, price_change_diff_1.actionOf)(entry.table, entry.before, entry.after);
        const changed = (0, price_change_diff_1.changedColumns)(entry.table, entry.before, entry.after);
        if (!changed.length) {
            return false;
        }
        const before = action === 'CREATE' ? null : entry.before;
        const after = action === 'DELETE' ? null : entry.after;
        const scope = (0, price_change_diff_1.scopeOf)(entry.table, after ?? before);
        const set = await this.changeSetOf(tx);
        const json = (row) => (row ? JSON.stringify(row) : null);
        await tx.$executeRaw `
      INSERT INTO inventory.item_price_change_log (
        ipcl_change_set_id, ipcl_price_table, ipcl_row_id, ipcl_action, ipcl_source, ipcl_menu_id,
        ipcl_company_id, ipcl_branch_id, ipcl_item_id, ipcl_unit_id, ipcl_godown_id, ipcl_party_id,
        ipcl_price_level, ipcl_bucket_mrp, ipcl_bucket_sp, ipcl_effective_from, ipcl_effective_to,
        ipcl_item_code, ipcl_item_name, ipcl_unit_name, ipcl_branch_name, ipcl_godown_name, ipcl_party_name,
        ipcl_user_id, ipcl_user_name, ipcl_device_id, ipcl_device_name, ipcl_ip, ipcl_app, ipcl_reason,
        ipcl_before, ipcl_after, ipcl_changed
      )
      SELECT ${set.id}::uuid, ${entry.table}, ${entry.rowId}::uuid, ${action}, ${entry.origin.source},
             ${entry.origin.menuId}::int,
             ${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.itemId}::uuid,
             ${scope.unitId}::uuid, ${scope.godownId}::uuid, ${scope.partyId}::uuid,
             ${scope.priceLevel}::smallint, ${scope.bucketMrp}::numeric, ${scope.bucketSp}::numeric,
             ${scope.effectiveFrom}::date, ${scope.effectiveTo}::date,
             itm.item_code, itm.item_name_en, um.unit_name, br.br_name, gdl.gdl_name, cus.cus_name,
             ${set.userId}::uuid, ${set.userName}, ${set.deviceId}::uuid, ${set.deviceName},
             ${set.ip}, ${set.app}, ${entry.origin.reason ?? null},
             ${json(before)}::jsonb, ${json(after)}::jsonb, ${changed}::text[]
        FROM (SELECT 1) one
        LEFT JOIN inventory.item_master          itm ON itm.item_id = ${scope.itemId}::uuid
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id  = ${scope.unitId}::uuid
        LEFT JOIN inventory.item_unit_master     um  ON um.unit_id  = iuc.iuc_unit_id
        LEFT JOIN public.branch_master           br  ON br.br_id    = ${scope.branchId}::uuid
        LEFT JOIN inventory.godown_locations     gdl ON gdl.gdl_id  = ${scope.godownId}::uuid
        LEFT JOIN sales.customers                cus ON cus.cus_id  = ${scope.partyId}::uuid`;
        return true;
    }
    changeSetOf(tx) {
        let set = this.changeSets.get(tx);
        if (!set) {
            set = this.resolveChangeSet(tx);
            this.changeSets.set(tx, set);
        }
        return set;
    }
    async resolveChangeSet(tx) {
        const userId = uuidOrNull(this.requestContext.getUserId());
        const deviceId = uuidOrNull(this.requestContext.getDeviceId());
        const [names] = await tx.$queryRaw `
      SELECT (SELECT u.usr_login_name FROM public.user_master u WHERE u.usr_id = ${userId}::uuid)
               AS user_name,
             (SELECT COALESCE(d.dev_device_name, d.dev_device_uid)
                FROM fixed.device_master d WHERE d.dev_id = ${deviceId}::uuid) AS device_name,
             (SELECT d.dev_device_type FROM fixed.device_master d WHERE d.dev_id = ${deviceId}::uuid)
               AS device_type`;
        return {
            id: (0, node_crypto_1.randomUUID)(),
            userId,
            userName: names?.user_name?.trim() || null,
            deviceId,
            deviceName: names?.device_name?.trim() || null,
            ip: this.requestContext.getIpAddress()?.slice(0, 60) ?? null,
            app: appOf(userId, names?.device_type ?? null),
        };
    }
};
exports.PriceChangeLogService = PriceChangeLogService;
exports.PriceChangeLogService = PriceChangeLogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [request_context_service_1.RequestContextService])
], PriceChangeLogService);
function appOf(userId, deviceType) {
    if (!userId) {
        return 'SYSTEM';
    }
    const type = (deviceType ?? '').trim().toLowerCase();
    if (type === 'desktop' || type === 'pc') {
        return 'DESKTOP';
    }
    if (type === 'web') {
        return 'WEB';
    }
    return 'API';
}
//# sourceMappingURL=price-change-log.service.js.map