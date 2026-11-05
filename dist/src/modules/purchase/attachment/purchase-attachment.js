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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseAttachmentController = exports.PurchaseAttachmentService = exports.UploadAttachmentDto = exports.AttachmentRefDto = exports.AttachmentListQueryDto = exports.ATT = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.ATT = { TOO_BIG: 'ATTACHMENT_TOO_BIG', BAD_FILE: 'ATTACHMENT_INVALID' };
const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = ['PURCHASE_BILL', 'GRN', 'PURCHASE_RETURN', 'PURCHASE_ORDER', 'SHORTAGE_RECEIPT'];
class AttachmentListQueryDto {
    docType;
    docId;
}
exports.AttachmentListQueryDto = AttachmentListQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: DOC_TYPES }),
    (0, class_validator_1.IsIn)(DOC_TYPES),
    __metadata("design:type", String)
], AttachmentListQueryDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttachmentListQueryDto.prototype, "docId", void 0);
class AttachmentRefDto {
    tatId;
    accYear;
}
exports.AttachmentRefDto = AttachmentRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttachmentRefDto.prototype, "tatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], AttachmentRefDto.prototype, "accYear", void 0);
class UploadAttachmentDto {
    companyId;
    branchId;
    accYear;
    docType;
    docId;
    fileName;
    mime;
    caption;
    contentBase64;
}
exports.UploadAttachmentDto = UploadAttachmentDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: DOC_TYPES }),
    (0, class_validator_1.IsIn)(DOC_TYPES),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "fileName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: MIMES }),
    (0, class_validator_1.IsIn)(MIMES),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "mime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "caption", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The file, base64 (at most 5 MB decoded).' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UploadAttachmentDto.prototype, "contentBase64", void 0);
let PurchaseAttachmentService = class PurchaseAttachmentService {
    prisma;
    ctx;
    constructor(prisma, ctx) {
        this.prisma = prisma;
        this.ctx = ctx;
    }
    get db() { return this.prisma; }
    async list(q) {
        const rows = await this.db.$queryRaw `
      SELECT tat_id AS "tatId", tat_acc_year AS "accYear", tat_page_no AS "pageNo", tat_file_name AS "fileName", tat_mime_type AS "mime",
             tat_size_bytes AS "size", tat_caption AS "caption", tat_created_on AS "createdOn", tat_created_by AS "createdBy"
        FROM public.txn_attachment WHERE tat_src_doc_type = ${q.docType} AND tat_src_doc_id = ${q.docId}::uuid AND NOT tat_is_deleted
       ORDER BY tat_page_no, tat_created_on`;
        return (0, purchase_doc_helpers_1.jsonSafe)(rows);
    }
    async upload(dto) {
        const bytes = Buffer.from(dto.contentBase64, 'base64');
        if (!bytes.length)
            (0, purchase_errors_1.purRefuse)('The file is empty.', exports.ATT.BAD_FILE, 'contentBase64');
        if (bytes.length > MAX_BYTES)
            (0, purchase_errors_1.purRefuse)(`The file is ${(bytes.length / 1048576).toFixed(1)} MB — at most 5 MB.`, exports.ATT.TOO_BIG, 'contentBase64', common_1.HttpStatus.PAYLOAD_TOO_LARGE);
        const actor = this.ctx.getUserId() ?? 'SYSTEM';
        const sha = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
        const [row] = await this.db.$queryRaw `
      INSERT INTO public.txn_attachment (tat_company_id, tat_branch_id, tat_acc_year, tat_src_module, tat_src_doc_type, tat_src_doc_id, tat_page_no,
                                         tat_file_name, tat_mime_type, tat_size_bytes, tat_sha256, tat_caption, tat_content, tat_created_by)
      VALUES (${dto.companyId}::uuid, ${dto.branchId}::uuid, ${dto.accYear}::bpchar, 'PURCHASE', ${dto.docType}, ${dto.docId}::uuid,
              (SELECT COALESCE(MAX(tat_page_no), 0) + 1 FROM public.txn_attachment WHERE tat_src_doc_type = ${dto.docType} AND tat_src_doc_id = ${dto.docId}::uuid),
              ${dto.fileName.trim()}, ${dto.mime}, ${bytes.length}, ${sha}, ${dto.caption ?? null}, ${bytes}, ${actor})
      RETURNING tat_id, tat_page_no`;
        return { tatId: row.tat_id, accYear: dto.accYear, pageNo: row.tat_page_no, size: bytes.length };
    }
    async file(q) {
        const [row] = await this.db.$queryRaw `
      SELECT tat_file_name, tat_mime_type AS tat_mime, tat_content FROM public.txn_attachment
       WHERE tat_id = ${q.tatId}::uuid AND tat_acc_year = ${q.accYear}::bpchar AND NOT tat_is_deleted`;
        if (!row)
            (0, purchase_errors_1.purNotFound)(`Attachment ${q.tatId} not found`);
        return { tatId: q.tatId, fileName: row.tat_file_name, mime: row.tat_mime, contentBase64: Buffer.from(row.tat_content).toString('base64') };
    }
    async remove(dto) {
        const n = await this.db.$executeRaw `
      UPDATE public.txn_attachment SET tat_is_deleted = true, tat_modified_on = now(), tat_modified_by = ${this.ctx.getUserId() ?? 'SYSTEM'}
       WHERE tat_id = ${dto.tatId}::uuid AND tat_acc_year = ${dto.accYear}::bpchar AND NOT tat_is_deleted`;
        if (!n)
            (0, purchase_errors_1.purNotFound)(`Attachment ${dto.tatId} not found`);
        return { tatId: dto.tatId, deleted: true };
    }
};
exports.PurchaseAttachmentService = PurchaseAttachmentService;
exports.PurchaseAttachmentService = PurchaseAttachmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseAttachmentService);
let PurchaseAttachmentController = class PurchaseAttachmentController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(q) {
        return { success: true, message: 'Attachments', data: await this.service.list(q) };
    }
    async file(q) {
        return { success: true, message: 'Attachment', data: await this.service.file(q) };
    }
    async upload(dto) {
        return { success: true, message: 'Attached', data: await this.service.upload(dto) };
    }
    async remove(dto) {
        return { success: true, message: 'Removed', data: await this.service.remove(dto) };
    }
};
exports.PurchaseAttachmentController = PurchaseAttachmentController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'ENT-26: the attachments of a document (no file content).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AttachmentListQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseAttachmentController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('file'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'ENT-26: one attachment with its file, base64.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AttachmentRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseAttachmentController.prototype, "file", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'ENT-26: attach a file (base64, ≤ 5 MB) to a document.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UploadAttachmentDto]),
    __metadata("design:returntype", Promise)
], PurchaseAttachmentController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'ENT-26: remove an attachment (soft delete).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AttachmentRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseAttachmentController.prototype, "remove", null);
exports.PurchaseAttachmentController = PurchaseAttachmentController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Attachments'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('txn-attachments'),
    __metadata("design:paramtypes", [PurchaseAttachmentService])
], PurchaseAttachmentController);
//# sourceMappingURL=purchase-attachment.js.map