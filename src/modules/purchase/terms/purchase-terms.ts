import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { isForeignKeyConstraintError, isUniqueConstraintError, isPresentField } from 'src/common/utils/module-shared.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { purConflict, purNotFound, purRefuse } from '../common/purchase.errors';
import { jsonSafe } from '../common/purchase-doc.helpers';

/**
 * PO terms master (purchase.pur_terms, migration 20261029130000): payment / delivery / other conditions picked on a
 * PO (dropdown 73). Company NULL = shared with every company. The PO copies the text into po_terms_text, so editing
 * a row never rewrites an old PO. Code unique per company among live rows, any case (ux_pte_code) → 409 PUR_TERMS_CODE_EXISTS.
 * The list is dropdown 73 / a registered grid — no /list route. No master menu yet: rights ride on the PO menu (23).
 *
 *  POST /purchase/terms/create   create (no pteId) or update (pteId) one row
 *  GET  /purchase/terms/get      one row (+ how many POs name it)
 *  POST /purchase/terms/delete   soft-delete (pte_is_deleted); POs keep their own copy of the text
 */
export const TERMS_MENU_ID = 23;   // = PURCHASE_ORDER_MENU_ID (not imported: purchase-order imports termsOf from here)

export class SaveTermsDto {
  @ApiPropertyOptional({ description: 'Present = update that row.' }) @IsOptional() @IsUUID() pteId?: string;
  @ApiPropertyOptional({ nullable: true, description: 'The owning company; null / omitted on create = shared with every company. Omit on update = keep.' })
  @IsOptional() @IsUUID() companyId?: string | null;
  @ApiProperty({ description: 'Letters, digits, _ or - (unique per company, any case).', maxLength: 30 })
  @IsString() @MinLength(1) @MaxLength(30) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code may hold only letters, digits, _ and -' }) code!: string;
  @ApiProperty({ maxLength: 100 }) @IsString() @MaxLength(100) name!: string;
  @ApiProperty({ description: 'The terms text copied into the PO.' }) @IsString() termsText!: string;
  @ApiPropertyOptional({ description: 'List order (dropdown 73 sorts by it, then name). Default 0.' }) @IsOptional() @IsInt() @Min(0) sort?: number;
  @ApiPropertyOptional({ description: 'Default true.' }) @IsOptional() @IsBoolean() isActive?: boolean;
}
export class TermsRefDto {
  @ApiProperty() @IsUUID() pteId!: string;
}
export class TermsDeleteDto extends TermsRefDto {}

@Injectable()
export class PurchaseTermsService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }

  async save(dto: SaveTermsDto) {
    const actor = this.actor();
    const name = dto.name.replace(/\s+/g, ' ').trim();
    if (!name) purRefuse('Give the terms a name.', 'PUR_TERMS_NAME_REQUIRED', 'name');
    const code = dto.code.trim();
    const text = dto.termsText.trim();
    if (!text) purRefuse('Type the terms text.', 'PUR_TERMS_TEXT_REQUIRED', 'termsText');
    let id = dto.pteId ?? null;
    try {
      if (!id) {
        const row = await this.prisma.purTerms.create({ data: {
          pteCompanyId: dto.companyId ?? null, pteCode: code, pteName: name, pteTermsText: text, pteSort: dto.sort ?? 0, pteIsActive: dto.isActive ?? true, pteCreatedBy: actor,
        }, select: { pteId: true } });
        id = row.pteId;
      } else {
        const cur = await this.prisma.purTerms.findFirst({ where: { pteId: id, pteIsDeleted: false }, select: { pteId: true } });
        if (!cur) purNotFound(`PO terms ${id} not found`, 'PUR_TERMS_NOT_FOUND', 'pteId');
        await this.prisma.purTerms.update({ where: { pteId: id }, data: {
          pteCode: code, pteName: name, pteTermsText: text,
          ...(isPresentField(dto, 'companyId') ? { pteCompanyId: dto.companyId ?? null } : {}),
          ...(dto.sort !== undefined ? { pteSort: dto.sort } : {}),
          ...(dto.isActive !== undefined ? { pteIsActive: dto.isActive } : {}),
          pteModifiedBy: actor, pteModifiedOn: new Date(),
        } });
      }
    } catch (e) {
      if (isUniqueConstraintError(e)) purConflict(`PO terms with the code "${code}" already exist.`, 'PUR_TERMS_CODE_EXISTS', 'code');
      if (isForeignKeyConstraintError(e)) purNotFound(`Company ${dto.companyId} not found`, 'PUR_COMPANY_NOT_FOUND', 'companyId');
      throw e;
    }
    return this.get(id);
  }

  async get(pteId: string) {
    const [row] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT t.pte_id AS "pteId", t.pte_company_id AS "companyId", c.comp_name AS "companyName", t.pte_code AS "code", t.pte_name AS "name",
             t.pte_terms_text AS "termsText", t.pte_sort AS "sort", t.pte_is_active AS "isActive",
             t.pte_created_on AS "createdOn", t.pte_created_by AS "createdBy", t.pte_modified_on AS "modifiedOn", t.pte_modified_by AS "modifiedBy",
             (SELECT count(*) FROM purchase.pur_order o WHERE o.po_terms_id = t.pte_id AND NOT o.po_is_deleted)::int AS "poCount"
        FROM purchase.pur_terms t LEFT JOIN public.companys c ON c.comp_id = t.pte_company_id
       WHERE t.pte_id = ${pteId}::uuid AND NOT t.pte_is_deleted`;
    if (!row) purNotFound(`PO terms ${pteId} not found`, 'PUR_TERMS_NOT_FOUND', 'pteId');
    return jsonSafe(row);
  }

  async delete(dto: TermsDeleteDto) {
    const actor = this.actor();
    const n = await this.prisma.purTerms.updateMany({ where: { pteId: dto.pteId, pteIsDeleted: false },
                                                      data: { pteIsDeleted: true, pteModifiedBy: actor, pteModifiedOn: new Date() } });
    if (!n.count) purNotFound(`PO terms ${dto.pteId} not found`, 'PUR_TERMS_NOT_FOUND', 'pteId');
    return { pteId: dto.pteId, deleted: true };
  }
}

/**
 * A PO's terms row. A NEW pick (a new PO, or an edit that changes termsId) must be live, active, and shared or the
 * PO's company's: PUR_TERMS_NOT_FOUND (404) / PUR_TERMS_INACTIVE (409). `keep` = the PO already names this row: it is
 * kept whatever became of it since (switched off, or deleted → null), as the PO keeps its own copy of the text.
 */
export async function termsOf(db: Prisma.TransactionClient | PrismaService, termsId: string, companyId: string, field = 'header.termsId', opts: { keep?: boolean } = {}) {
  const [t] = await db.$queryRaw<{ id: string; name: string; text: string; company: string | null; active: boolean }[]>`
    SELECT pte_id AS id, pte_name AS name, pte_terms_text AS text, pte_company_id AS company, pte_is_active AS active
      FROM purchase.pur_terms WHERE pte_id = ${termsId}::uuid AND NOT pte_is_deleted`;
  if (opts.keep) return t ?? null;
  if (!t || (t.company && t.company !== companyId)) purNotFound(`PO terms ${termsId} not found`, 'PUR_TERMS_NOT_FOUND', field);
  if (!t.active) purConflict(`PO terms "${t.name}" are switched off — pick other terms.`, 'PUR_TERMS_INACTIVE', field);
  return t;
}

/** termsId when that row could be picked on a new PO now (live, active, shared or this company's), else null — what a clone carries. */
export async function pickableTermsId(db: Prisma.TransactionClient | PrismaService, termsId: string | null | undefined, companyId: string) {
  if (!termsId) return null;
  const [t] = await db.$queryRaw<{ id: string }[]>`
    SELECT pte_id AS id FROM purchase.pur_terms
     WHERE pte_id = ${termsId}::uuid AND NOT pte_is_deleted AND pte_is_active AND (pte_company_id IS NULL OR pte_company_id = ${companyId}::uuid)`;
  return t?.id ?? null;
}

@ApiTags('Purchase — PO terms')
@ApiBearerAuth()
@Controller('purchase/terms')
export class PurchaseTermsController {
  constructor(private readonly service: PurchaseTermsService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: TERMS_MENU_ID, right, codePrefix: 'PO', action });
  }
  @Post('create') @Version(API_VERSION)
  @ApiOperation({ summary: 'Create a PO terms row (no pteId) or update one (pteId). Code unique per company, any case: 409 PUR_TERMS_CODE_EXISTS. Create / Edit on menu 23.' })
  async create(@Body() dto: SaveTermsDto) {
    await this.right(dto.pteId ? 'edit' : 'create', 'save PO terms');
    const data = await this.service.save(dto);
    return { success: true, message: `PO terms ${String((data as Record<string, unknown>).code)} saved`, data };
  }
  @Get('get') @Version(API_VERSION) @ApiOperation({ summary: 'One PO terms row and how many POs name it. View on menu 23.' })
  async get(@Query() q: TermsRefDto) {
    await this.right('view', 'open PO terms');
    return { success: true, message: 'PO terms fetched', data: await this.service.get(q.pteId) };
  }
  @Post('delete') @Version(API_VERSION) @ApiOperation({ summary: 'Delete a PO terms row (soft). POs keep their own copy of the text. Delete on menu 23.' })
  async delete(@Body() dto: TermsDeleteDto) {
    await this.right('delete', 'delete PO terms');
    return { success: true, message: 'PO terms deleted', data: await this.service.delete(dto) };
  }
}
