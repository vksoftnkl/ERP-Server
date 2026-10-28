import { createHash } from 'node:crypto';
import { Body, Controller, Get, HttpStatus, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { API_VERSION } from 'src/common/constants/api-version';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { purNotFound, purRefuse } from '../common/purchase.errors';
import { jsonSafe, type Tx } from '../common/purchase-doc.helpers';

/**
 * ENT-26 / P16 — attachments on a document (the supplier's bill scan, damage photos), in the shared
 * public.txn_attachment (B1 migration 20261028110000): the file is kept in the row (pdf / jpeg / png /
 * webp, ≤ 5 MB), sent and read as base64, numbered as pages of the document, sha256 kept. Soft delete.
 */
export const ATT = { TOO_BIG: 'ATTACHMENT_TOO_BIG', BAD_FILE: 'ATTACHMENT_INVALID' } as const;
const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = ['PURCHASE_BILL', 'GRN', 'PURCHASE_RETURN', 'PURCHASE_ORDER', 'SHORTAGE_RECEIPT'];

export class AttachmentListQueryDto {
  @ApiProperty({ enum: DOC_TYPES }) @IsIn(DOC_TYPES) docType!: string;
  @ApiProperty() @IsUUID() docId!: string;
}
export class AttachmentRefDto {
  @ApiProperty() @IsUUID() tatId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class UploadAttachmentDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty({ enum: DOC_TYPES }) @IsIn(DOC_TYPES) docType!: string;
  @ApiProperty() @IsUUID() docId!: string;
  @ApiProperty() @IsString() @MaxLength(200) fileName!: string;
  @ApiProperty({ enum: MIMES }) @IsIn(MIMES) mime!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) caption?: string;
  @ApiProperty({ description: 'The file, base64 (at most 5 MB decoded).' }) @IsString() contentBase64!: string;
}

@Injectable()
export class PurchaseAttachmentService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private get db(): Tx { return this.prisma as unknown as Tx; }

  async list(q: AttachmentListQueryDto) {
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT tat_id AS "tatId", tat_acc_year AS "accYear", tat_page_no AS "pageNo", tat_file_name AS "fileName", tat_mime_type AS "mime",
             tat_size_bytes AS "size", tat_caption AS "caption", tat_created_on AS "createdOn", tat_created_by AS "createdBy"
        FROM public.txn_attachment WHERE tat_src_doc_type = ${q.docType} AND tat_src_doc_id = ${q.docId}::uuid AND NOT tat_is_deleted
       ORDER BY tat_page_no, tat_created_on`;
    return jsonSafe(rows);
  }

  async upload(dto: UploadAttachmentDto) {
    const bytes = Buffer.from(dto.contentBase64, 'base64');
    if (!bytes.length) purRefuse('The file is empty.', ATT.BAD_FILE, 'contentBase64');
    if (bytes.length > MAX_BYTES) purRefuse(`The file is ${(bytes.length / 1048576).toFixed(1)} MB — at most 5 MB.`, ATT.TOO_BIG, 'contentBase64', HttpStatus.PAYLOAD_TOO_LARGE);
    const actor = this.ctx.getUserId() ?? 'SYSTEM';
    const sha = createHash('sha256').update(bytes).digest('hex');
    const [row] = await this.db.$queryRaw<{ tat_id: string; tat_page_no: number }[]>`
      INSERT INTO public.txn_attachment (tat_company_id, tat_branch_id, tat_acc_year, tat_src_module, tat_src_doc_type, tat_src_doc_id, tat_page_no,
                                         tat_file_name, tat_mime_type, tat_size_bytes, tat_sha256, tat_caption, tat_content, tat_created_by)
      VALUES (${dto.companyId}::uuid, ${dto.branchId}::uuid, ${dto.accYear}::bpchar, 'PURCHASE', ${dto.docType}, ${dto.docId}::uuid,
              (SELECT COALESCE(MAX(tat_page_no), 0) + 1 FROM public.txn_attachment WHERE tat_src_doc_type = ${dto.docType} AND tat_src_doc_id = ${dto.docId}::uuid),
              ${dto.fileName.trim()}, ${dto.mime}, ${bytes.length}, ${sha}, ${dto.caption ?? null}, ${bytes}, ${actor})
      RETURNING tat_id, tat_page_no`;
    return { tatId: row.tat_id, accYear: dto.accYear, pageNo: row.tat_page_no, size: bytes.length };
  }

  async file(q: AttachmentRefDto) {
    const [row] = await this.db.$queryRaw<{ tat_file_name: string; tat_mime: string; tat_content: Buffer }[]>`
      SELECT tat_file_name, tat_mime_type AS tat_mime, tat_content FROM public.txn_attachment
       WHERE tat_id = ${q.tatId}::uuid AND tat_acc_year = ${q.accYear}::bpchar AND NOT tat_is_deleted`;
    if (!row) purNotFound(`Attachment ${q.tatId} not found`);
    return { tatId: q.tatId, fileName: row.tat_file_name, mime: row.tat_mime, contentBase64: Buffer.from(row.tat_content).toString('base64') };
  }

  async remove(dto: AttachmentRefDto) {
    const n = await this.db.$executeRaw`
      UPDATE public.txn_attachment SET tat_is_deleted = true, tat_modified_on = now(), tat_modified_by = ${this.ctx.getUserId() ?? 'SYSTEM'}
       WHERE tat_id = ${dto.tatId}::uuid AND tat_acc_year = ${dto.accYear}::bpchar AND NOT tat_is_deleted`;
    if (!n) purNotFound(`Attachment ${dto.tatId} not found`);
    return { tatId: dto.tatId, deleted: true };
  }
}

@ApiTags('Purchase — Attachments')
@ApiBearerAuth()
@Controller('txn-attachments')
export class PurchaseAttachmentController {
  constructor(private readonly service: PurchaseAttachmentService) {}

  @Get() @Version(API_VERSION) @ApiOperation({ summary: 'ENT-26: the attachments of a document (no file content).' })
  async list(@Query() q: AttachmentListQueryDto) {
    return { success: true, message: 'Attachments', data: await this.service.list(q) };
  }
  @Get('file') @Version(API_VERSION) @ApiOperation({ summary: 'ENT-26: one attachment with its file, base64.' })
  async file(@Query() q: AttachmentRefDto) {
    return { success: true, message: 'Attachment', data: await this.service.file(q) };
  }
  @Post('upload') @Version(API_VERSION) @ApiOperation({ summary: 'ENT-26: attach a file (base64, ≤ 5 MB) to a document.' })
  async upload(@Body() dto: UploadAttachmentDto) {
    return { success: true, message: 'Attached', data: await this.service.upload(dto) };
  }
  @Post('delete') @Version(API_VERSION) @ApiOperation({ summary: 'ENT-26: remove an attachment (soft delete).' })
  async remove(@Body() dto: AttachmentRefDto) {
    return { success: true, message: 'Removed', data: await this.service.remove(dto) };
  }
}
