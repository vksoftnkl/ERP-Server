import { createHash } from 'node:crypto';
import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { PUR, purConflict, purNotFound, purRefuse } from '../common/purchase.errors';
import { D, jsonSafe, type Tx } from '../common/purchase-doc.helpers';

/**
 * Supplier–Item map (MST-02, menu 295) — who sells us what, in which pack, under which code.
 * One row per (company, supplier, item): psi_id = uuid v5 of the three, so two branches that
 * create it offline converge on one row (R15). Last rate / date / bill count are NOT stored:
 * the list and /get read them from posted bill lines.
 * Rows come two ways: typed here (source TYPED), or made by the first posted bill of the pair
 * (source AUTO, buy unit = the bill line's unit). A bill never overwrites a row that exists —
 * hand edits are kept. One preferred supplier per item.
 */
export const SUPPLIER_ITEM_MENU_ID = 295;
const PSI_NAMESPACE = '6f1d2c3b-4a59-4e78-8b90-a1b2c3d4e5f6';

/** psi_id = uuid v5 over `company|supplier|item` (company blank = shared). */
export function supplierItemId(companyId: string | null, supplierId: string, itemId: string): string {
  const hash = createHash('sha1')
    .update(Buffer.from(PSI_NAMESPACE.replace(/-/g, ''), 'hex'))
    .update(`${(companyId ?? '').toLowerCase()}|${supplierId.toLowerCase()}|${itemId.toLowerCase()}`, 'utf8')
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Called by a posted bill: the pair gets a row if it has none (AUTO); an existing row is left as it is. */
export async function recordSupplierItems(tx: Tx, companyId: string, supplierId: string,
                                          lines: { itemId: string; uomId: string; factor: Prisma.Decimal }[], actor: string) {
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.itemId)) continue;
    seen.add(l.itemId);
    await tx.$executeRaw`
      INSERT INTO purchase.pur_supplier_item (psi_id, psi_company_id, psi_supplier_id, psi_item_id, psi_buy_uom_id, psi_pack_qty, psi_source, psi_created_by)
      VALUES (${supplierItemId(companyId, supplierId, l.itemId)}::uuid, ${companyId}::uuid, ${supplierId}::uuid, ${l.itemId}::uuid,
              ${l.uomId}::uuid, ${l.factor}::numeric, 'AUTO', ${actor})
      ON CONFLICT (psi_id) DO NOTHING`;
  }
}

export class SaveSupplierItemDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiPropertyOptional({ description: "The supplier's own code for the item." }) @IsOptional() @IsString() @MaxLength(60) supplierItemCode?: string;
  @ApiPropertyOptional({ description: "The barcode on the supplier's pack (a scan finds the item)." }) @IsOptional() @IsString() @MaxLength(60) supplierBarcode?: string;
  @ApiPropertyOptional({ description: 'The unit we buy in (item_unit_conversion.iuc_id of the item).' }) @IsOptional() @IsUUID() buyUomId?: string;
  @ApiPropertyOptional({ description: 'Base units in one buy unit (default: the unit\'s factor).' }) @IsOptional() @IsNumber() @Min(0.000001) packQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) moq?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(365) leadDays?: number;
  @ApiPropertyOptional({ description: 'First in Reorder → PO; one preferred supplier per item.' }) @IsOptional() @IsBoolean() isPreferred?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class SupplierItemRefDto {
  @ApiProperty() @IsUUID() psiId!: string;
}
export class SupplierItemActiveDto extends SupplierItemRefDto {
  @ApiProperty() @IsBoolean() active!: boolean;
}

@Injectable()
export class PurchaseSupplierItemService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }

  async save(dto: SaveSupplierItemDto) {
    const actor = this.actor();
    const id = supplierItemId(dto.companyId, dto.supplierId, dto.itemId);
    const code = dto.supplierItemCode?.trim() || null;
    const barcode = dto.supplierBarcode?.trim() || null;
    await this.prisma.$transaction(async (tx) => {
      const [sup] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM purchase.suppliers WHERE sup_id = ${dto.supplierId}::uuid AND NOT sup_is_deleted`;
      if (!Number(sup.n)) purNotFound(`Supplier ${dto.supplierId} not found`, PUR.SUPPLIER_NOT_FOUND, 'supplierId');
      const [item] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM inventory.item_master WHERE item_id = ${dto.itemId}::uuid AND NOT item_is_deleted`;
      if (!Number(item.n)) purNotFound(`Item ${dto.itemId} not found`, PUR.ITEM_NOT_FOUND, 'itemId');
      let pack = dto.packQty === undefined ? null : D(dto.packQty);
      if (dto.buyUomId) {
        const [u] = await tx.$queryRaw<{ iuc_item_id: string; iuc_to_base_factor: Prisma.Decimal }[]>`
          SELECT iuc_item_id, iuc_to_base_factor FROM inventory.item_unit_conversion WHERE iuc_id = ${dto.buyUomId}::uuid AND NOT iuc_is_deleted`;
        if (!u || u.iuc_item_id !== dto.itemId) purRefuse('The buy unit must be one of the item\'s units.', PUR.UNIT_NOT_FOUND, 'buyUomId');
        pack = pack ?? D(u.iuc_to_base_factor);
      }
      if (code) {
        const [c] = await tx.$queryRaw<{ item: string }[]>`
          SELECT im.item_name_en AS item FROM purchase.pur_supplier_item p JOIN inventory.item_master im ON im.item_id = p.psi_item_id
           WHERE p.psi_supplier_id = ${dto.supplierId}::uuid AND upper(p.psi_supplier_item_code) = upper(${code}) AND NOT p.psi_is_deleted
             AND p.psi_id <> ${id}::uuid AND (p.psi_company_id IS NULL OR p.psi_company_id = ${dto.companyId}::uuid) LIMIT 1`;
        if (c) purConflict(`Code ${code} is already this supplier's code for ${c.item}.`, 'PUR_SUPPLIER_CODE_TAKEN', 'supplierItemCode');
      }
      if (barcode) {
        const [b] = await tx.$queryRaw<{ item: string; sup: string }[]>`
          SELECT im.item_name_en AS item, s.sup_name AS sup FROM purchase.pur_supplier_item p
            JOIN inventory.item_master im ON im.item_id = p.psi_item_id JOIN purchase.suppliers s ON s.sup_id = p.psi_supplier_id
           WHERE upper(p.psi_supplier_barcode) = upper(${barcode}) AND NOT p.psi_is_deleted AND p.psi_id <> ${id}::uuid
             AND p.psi_item_id <> ${dto.itemId}::uuid AND (p.psi_company_id IS NULL OR p.psi_company_id = ${dto.companyId}::uuid) LIMIT 1`;
        if (b) purConflict(`Barcode ${barcode} already finds ${b.item} (${b.sup}) — a scan would not know which item.`, 'PUR_SUPPLIER_BARCODE_TAKEN', 'supplierBarcode');
      }
      await tx.$executeRaw`
        INSERT INTO purchase.pur_supplier_item (psi_id, psi_company_id, psi_supplier_id, psi_item_id, psi_supplier_item_code, psi_supplier_barcode,
                    psi_buy_uom_id, psi_pack_qty, psi_moq, psi_lead_days, psi_is_preferred, psi_source, psi_is_active, psi_created_by)
        VALUES (${id}::uuid, ${dto.companyId}::uuid, ${dto.supplierId}::uuid, ${dto.itemId}::uuid, ${code}, ${barcode},
                ${dto.buyUomId ?? null}::uuid, ${pack ?? D(1)}::numeric, ${dto.moq ?? null}::numeric, ${dto.leadDays ?? null}::smallint,
                ${dto.isPreferred ?? false}, 'TYPED', ${dto.isActive ?? true}, ${actor})
        ON CONFLICT (psi_id) DO UPDATE SET
          psi_supplier_item_code = EXCLUDED.psi_supplier_item_code, psi_supplier_barcode = EXCLUDED.psi_supplier_barcode,
          psi_buy_uom_id = EXCLUDED.psi_buy_uom_id, psi_pack_qty = EXCLUDED.psi_pack_qty, psi_moq = EXCLUDED.psi_moq,
          psi_lead_days = EXCLUDED.psi_lead_days, psi_is_preferred = EXCLUDED.psi_is_preferred, psi_source = 'TYPED',
          psi_is_active = EXCLUDED.psi_is_active, psi_is_deleted = false, psi_modified_on = now(), psi_modified_by = ${actor}`;
      if (dto.isPreferred) {
        await tx.$executeRaw`
          UPDATE purchase.pur_supplier_item SET psi_is_preferred = false, psi_modified_on = now(), psi_modified_by = ${actor}
           WHERE psi_item_id = ${dto.itemId}::uuid AND psi_id <> ${id}::uuid AND psi_is_preferred
             AND (psi_company_id IS NULL OR psi_company_id = ${dto.companyId}::uuid)`;
      }
    }, { timeout: 30000, maxWait: 10000 });
    return this.get(id);
  }

  async setActive(dto: SupplierItemActiveDto) {
    const actor = this.actor();
    const n = await this.prisma.$executeRaw`
      UPDATE purchase.pur_supplier_item SET psi_is_active = ${dto.active}, psi_is_preferred = (psi_is_preferred AND ${dto.active}),
             psi_modified_on = now(), psi_modified_by = ${actor}
       WHERE psi_id = ${dto.psiId}::uuid AND NOT psi_is_deleted`;
    if (!n) purNotFound(`Supplier–item row ${dto.psiId} not found`);
    return this.get(dto.psiId);
  }

  async get(psiId: string) {
    const [row] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT p.*, s.sup_name, im.item_name_en AS item_name, um.unit_name AS buy_unit_name,
             st.last_rate, st.last_date, st.bill_count
        FROM purchase.pur_supplier_item p
        JOIN purchase.suppliers s ON s.sup_id = p.psi_supplier_id
        JOIN inventory.item_master im ON im.item_id = p.psi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = p.psi_buy_uom_id
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
        LEFT JOIN LATERAL (
          SELECT (array_agg(pii.pii_rate ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC))[1] AS last_rate,
                 max(pi.pi_doc_date) AS last_date, count(DISTINCT pi.pi_id) AS bill_count
            FROM purchase.pur_invoice_item pii
            JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
           WHERE pi.pi_supplier_id = p.psi_supplier_id AND pii.pii_item_id = p.psi_item_id
             AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
             AND (p.psi_company_id IS NULL OR pi.pi_company_id = p.psi_company_id)) st ON true
       WHERE p.psi_id = ${psiId}::uuid AND NOT p.psi_is_deleted`;
    if (!row) purNotFound(`Supplier–item row ${psiId} not found`);
    return jsonSafe(row);
  }
}

@ApiTags('Purchase — Supplier–Item map')
@ApiBearerAuth()
@Controller('purchase/supplier-items')
export class PurchaseSupplierItemController {
  constructor(private readonly service: PurchaseSupplierItemService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: SUPPLIER_ITEM_MENU_ID, right, codePrefix: 'PSI', action });
  }
  @Post('save') @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update the row of a (supplier, item) pair — one per company, id derived from the three.' })
  async save(@Body() dto: SaveSupplierItemDto) {
    await this.right('edit', 'save a supplier–item row');
    return { success: true, message: 'Supplier–item saved', data: await this.service.save(dto) };
  }
  @Post('active') @Version(API_VERSION) @ApiOperation({ summary: 'Switch a supplier–item row on or off (off also drops preferred).' })
  async active(@Body() dto: SupplierItemActiveDto) {
    await this.right('edit', 'switch a supplier–item row on or off');
    return { success: true, message: dto.active ? 'Reactivated' : 'Deactivated', data: await this.service.setActive(dto) };
  }
  @Get('get') @Version(API_VERSION) @ApiOperation({ summary: 'One row with names and the last rate / date / bill count from posted bills.' })
  async get(@Query() q: SupplierItemRefDto) {
    await this.right('view', 'open a supplier–item row');
    return { success: true, message: 'Supplier–item fetched', data: await this.service.get(q.psiId) };
  }
}
