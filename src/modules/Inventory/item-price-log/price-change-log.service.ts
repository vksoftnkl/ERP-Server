import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { actionOf, changedColumns, scopeOf } from './price-change-diff';
import type {
  PriceChangeApp,
  PriceChangeEntry,
  PriceRowSnapshot,
  PriceTable,
} from './types/price-change-log.types';

type Client = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

/** Who and from where, resolved once for every row a transaction logs. */
interface ChangeSet {
  id: string;
  userId: string | null;
  userName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  ip: string | null;
  app: PriceChangeApp;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: string | null | undefined): string | null =>
  value && UUID.test(value) ? value : null;

/**
 * Notes 144 — `PriceChangeLog.record()`: the one writer of
 * inventory.item_price_change_log, called only by PriceMasterWriter, in the
 * transaction of the price write it describes. Append-only: there is no
 * update or delete here, and no route that reaches one.
 *
 * ONE CHANGE SET PER TRANSACTION. A save is one transaction, so every row it
 * logs shares `ipcl_change_set_id` and the who / from-where read once for it.
 * WHO is the token's user and device and the request's IP — never a body
 * field: a body can name anyone. No user at all (a job) is app SYSTEM.
 */
@Injectable()
export class PriceChangeLogService {
  private readonly changeSets = new WeakMap<object, Promise<ChangeSet>>();

  constructor(private readonly requestContext: RequestContextService) {}

  /** The rows as stored, keyed by id, as `to_jsonb` — raw column names, what the log keeps. */
  async snapshot(
    tx: Client,
    table: PriceTable,
    ids: readonly string[],
  ): Promise<Map<string, PriceRowSnapshot>> {
    const live = [...new Set(ids.filter(Boolean))];
    if (!live.length) {
      return new Map();
    }
    const rows =
      table === 'IPM'
        ? await tx.$queryRaw<Array<{ id: string; row: PriceRowSnapshot }>>`
            SELECT p.ipm_id::text AS id, to_jsonb(p) AS row
              FROM inventory.item_price_master p
             WHERE p.ipm_id = ANY(${live}::uuid[])`
        : await tx.$queryRaw<Array<{ id: string; row: PriceRowSnapshot }>>`
            SELECT q.iqp_id::text AS id, to_jsonb(q) AS row
              FROM inventory.item_qty_price q
             WHERE q.iqp_id = ANY(${live}::uuid[])`;
    return new Map(rows.map((r) => [r.id, r.row]));
  }

  /**
   * One log row for one changed price row. A change that touched no business
   * column (IGNORED_COLUMNS) is not a change and writes nothing; the answer
   * says whether a row was written.
   *
   * The names of the item, unit, branch, godown and party are copied as they
   * are NOW: the report must read the same next year, after a rename.
   */
  async record(tx: Client, entry: PriceChangeEntry): Promise<boolean> {
    const action = entry.action ?? actionOf(entry.table, entry.before, entry.after);
    const changed = changedColumns(entry.table, entry.before, entry.after);
    if (!changed.length) {
      return false;
    }
    // ck_ipcl_shape: a delete keeps only the row before it.
    const before = action === 'CREATE' ? null : entry.before;
    const after = action === 'DELETE' ? null : entry.after;
    const scope = scopeOf(entry.table, after ?? before);
    const set = await this.changeSetOf(tx);
    const json = (row: PriceRowSnapshot | null) => (row ? JSON.stringify(row) : null);

    await tx.$executeRaw`
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

  /** This transaction's change set: created on its first log row, shared by the rest. */
  private changeSetOf(tx: Client): Promise<ChangeSet> {
    let set = this.changeSets.get(tx);
    if (!set) {
      set = this.resolveChangeSet(tx);
      this.changeSets.set(tx, set);
    }
    return set;
  }

  private async resolveChangeSet(tx: Client): Promise<ChangeSet> {
    const userId = uuidOrNull(this.requestContext.getUserId());
    const deviceId = uuidOrNull(this.requestContext.getDeviceId());
    const [names] = await tx.$queryRaw<
      Array<{ user_name: string | null; device_name: string | null; device_type: string | null }>
    >`
      SELECT (SELECT u.usr_login_name FROM public.user_master u WHERE u.usr_id = ${userId}::uuid)
               AS user_name,
             (SELECT COALESCE(d.dev_device_name, d.dev_device_uid)
                FROM fixed.device_master d WHERE d.dev_id = ${deviceId}::uuid) AS device_name,
             (SELECT d.dev_device_type FROM fixed.device_master d WHERE d.dev_id = ${deviceId}::uuid)
               AS device_type`;
    return {
      id: randomUUID(),
      userId,
      userName: names?.user_name?.trim() || null,
      deviceId,
      deviceName: names?.device_name?.trim() || null,
      ip: this.requestContext.getIpAddress()?.slice(0, 60) ?? null,
      app: appOf(userId, names?.device_type ?? null),
    };
  }
}

/**
 * device_master.dev_device_type → ck_ipcl_app. A login on a registered PC is
 * DESKTOP, a web device WEB; a user with no registered device (or a mobile
 * one) reached the API directly; no user at all is the SYSTEM.
 */
export function appOf(userId: string | null, deviceType: string | null): PriceChangeApp {
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
