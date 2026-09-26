import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { loadRights, NO_RIGHTS, type MenuRights } from '../../../common/posting/rights';
import type {
  VoucherGroupRef,
  VoucherRights,
  VoucherTypeRules,
  VoucherTypeWithRights,
} from './types/vouchers-api.types';

type Client = Prisma.TransactionClient | PrismaService;

interface TypeRow {
  vchr_type_id: number;
  vchr_type_code: string;
  vchr_type_name: string;
  vchr_nature: string;
  vchr_no_prefix: string | null;
  vchr_menu_id: number | null;
  vchr_party_mode: string;
  vchr_party_side: string;
  vchr_billwise_mode: string;
  vchr_raise_bill_type: string | null;
  vchr_dr_groups: string[];
  vchr_cr_groups: string[];
  vchr_gst_register: string | null;
  vchr_gst_side: string | null;
  vchr_tds_mode: string;
  vchr_in_register: boolean;
  vchr_affects_inventory: boolean;
  vchr_is_active: boolean;
}

/**
 * The voucher TYPE carries the rules (voucher_register.md §3, §5.2). This
 * service reads them, resolves the group ids the rule columns hold into
 * names for the screen's rule strip, and answers §6.1 — the types a caller may
 * VIEW, each with the caller's rights on its own menu (decision E).
 *
 * Types are resolved by `vchr_type_code`, never by a literal id: the id is a
 * sequence value and differs between databases.
 */
@Injectable()
export class VoucherTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every register type, active, in band order. */
  async loadRegisterTypes(client: Client = this.prisma): Promise<VoucherTypeRules[]> {
    const rows = await client.$queryRaw<TypeRow[]>`
      ${TYPE_SELECT}
       WHERE vchr_in_register = true AND vchr_is_active = true
       ORDER BY vchr_sort_order, vchr_type_name`;
    return this.withGroupNames(client, rows);
  }

  /** One type by code (any type, so a cancel can read a `Rev` or a receipt's). */
  async loadTypeByCode(client: Client, typeCode: string): Promise<VoucherTypeRules | null> {
    const rows = await client.$queryRaw<TypeRow[]>`
      ${TYPE_SELECT}
       WHERE vchr_type_code = ${typeCode}
       LIMIT 1`;
    if (rows.length === 0 || !rows[0].vchr_is_active) {
      return null;
    }
    return (await this.withGroupNames(client, rows))[0];
  }

  async loadTypeById(client: Client, typeId: number): Promise<VoucherTypeRules | null> {
    const rows = await client.$queryRaw<TypeRow[]>`
      ${TYPE_SELECT}
       WHERE vchr_type_id = ${typeId}::int
       LIMIT 1`;
    if (rows.length === 0) {
      return null;
    }
    return (await this.withGroupNames(client, rows))[0];
  }

  /**
   * §7.1 — the caller's rights on the type's menu. A type with no menu (`Rev`)
   * grants nothing of its own; a cancel is judged on the ORIGINAL's type.
   * No row means no right.
   */
  async rightsFor(
    client: Client,
    userId: string | null,
    type: VoucherTypeRules,
  ): Promise<VoucherRights> {
    if (!userId || type.menuId === null) {
      return toVoucherRights(NO_RIGHTS);
    }
    return toVoucherRights(await loadRights(client, userId, type.menuId));
  }

  /**
   * §6.1 — the register types the caller may VIEW, each with its rights.
   *
   * `menuId`: opened from a type's own menu (101, 102, …) → that type alone.
   * The Voucher Register menu (262), or no menu, → every permitted type. A
   * menu no type points at is treated as the register's.
   */
  async typesForCaller(
    userId: string | null,
    menuId: number | null,
    client: Client = this.prisma,
  ): Promise<VoucherTypeWithRights[]> {
    const all = await this.loadRegisterTypes(client);
    const scoped =
      menuId !== null && all.some((t) => t.menuId === menuId)
        ? all.filter((t) => t.menuId === menuId)
        : all;

    const rightsByMenu = new Map<number, VoucherRights>();
    const out: VoucherTypeWithRights[] = [];
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

  private async withGroupNames(client: Client, rows: TypeRow[]): Promise<VoucherTypeRules[]> {
    const ids = [...new Set(rows.flatMap((r) => [...r.vchr_dr_groups, ...r.vchr_cr_groups]))];
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const groups = await client.$queryRaw<{ acc_group_id: string; acc_group_name: string }[]>`
        SELECT acc_group_id, acc_group_name FROM accounts.acc_group_master
         WHERE acc_group_id = ANY(${ids}::uuid[])`;
      groups.forEach((g) => names.set(g.acc_group_id, g.acc_group_name));
    }
    const refs = (list: string[]): VoucherGroupRef[] =>
      list.map((groupId) => ({ groupId, name: names.get(groupId) ?? groupId }));
    return rows.map((r) => ({
      typeId: r.vchr_type_id,
      typeCode: r.vchr_type_code,
      typeName: r.vchr_type_name,
      nature: r.vchr_nature,
      numberPrefix: r.vchr_no_prefix,
      menuId: r.vchr_menu_id,
      partyMode: r.vchr_party_mode as VoucherTypeRules['partyMode'],
      partySide: r.vchr_party_side as VoucherTypeRules['partySide'],
      billwiseMode: r.vchr_billwise_mode as VoucherTypeRules['billwiseMode'],
      raiseBillType: r.vchr_raise_bill_type,
      drGroups: refs(r.vchr_dr_groups),
      crGroups: refs(r.vchr_cr_groups),
      gstRegister: r.vchr_gst_register,
      gstSide: r.vchr_gst_side as VoucherTypeRules['gstSide'],
      tdsMode: r.vchr_tds_mode as VoucherTypeRules['tdsMode'],
      inRegister: r.vchr_in_register,
      affectsInventory: r.vchr_affects_inventory,
    }));
  }
}

const TYPE_SELECT = Prisma.sql`
  SELECT vchr_type_id, vchr_type_code, vchr_type_name, vchr_nature::text AS vchr_nature,
         vchr_no_prefix, vchr_menu_id,
         vchr_party_mode, vchr_party_side, vchr_billwise_mode, vchr_raise_bill_type,
         vchr_dr_groups, vchr_cr_groups, vchr_gst_register, vchr_gst_side, vchr_tds_mode,
         vchr_in_register, vchr_affects_inventory, vchr_is_active
    FROM accounts.acc_voucher_types`;

export function toVoucherRights(r: MenuRights): VoucherRights {
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
