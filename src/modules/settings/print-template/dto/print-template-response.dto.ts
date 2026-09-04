import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleErrorFieldDto, ModuleErrorResponseDto } from 'src/common/utils/module-response.dto';
import {
  PTD_ROLES,
  PTD_SOURCE_KINDS,
  PTV_ENGINES,
  PTV_ORIENTATIONS,
  PTV_STATUSES,
} from '../print-template.constants';

export { ModuleErrorFieldDto as PrintTemplateErrorFieldDto };
export { ModuleErrorResponseDto as PrintTemplateErrorResponseDto };

export class PrintTemplateDatasetPayloadDto {
  @ApiProperty({ format: 'uuid' }) ptdId!: string;
  @ApiProperty({ format: 'uuid' }) ptdVersionId!: string;
  @ApiProperty({ enum: PTD_ROLES }) ptdRole!: string;
  @ApiProperty({ example: 1, description: 'THE BINDING. The master is always 0.' })
  ptdDatasetNo!: number;
  @ApiProperty({ example: 0, description: 'Display order only. Binds nothing.' })
  ptdSortOrder!: number;
  @ApiProperty({ example: 'items' }) ptdName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdLabel!: string | null;
  @ApiProperty({ enum: PTD_SOURCE_KINDS }) ptdSourceKind!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdProviderCode!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdSql!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Read-only, computed by the database: comments stripped, literals and quoted identifiers ' +
      'replaced by tokens, casts flattened, lowercased. Every SQL guard reads THIS, not ptdSql, ' +
      'so it is what to look at when a guard refuses a query that looks fine.',
  })
  ptdSqlNorm!: string | null;
  @ApiProperty({ example: true }) ptdRequiresCompany!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) ptdParentNo!: number | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'sb_id=bill_id' })
  ptdLinkFields!: string | null;
  @ApiProperty({ example: 5000 }) ptdRowLimit!: number;
  @ApiProperty({ example: 15000 }) ptdTimeoutMs!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdRemarks!: string | null;
  @ApiProperty({ example: false }) ptdIsDeleted!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' }) ptdCreatedOn!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdCreatedBy!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdModifiedOn!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptdModifiedBy!: string | null;
}

export class PrintTemplateVersionPayloadDto {
  @ApiProperty({ format: 'uuid' }) ptvId!: string;
  @ApiProperty({ format: 'uuid' }) ptvTemplateId!: string;
  @ApiProperty({ example: 3 }) ptvRevNo!: number;
  @ApiProperty({ enum: PTV_STATUSES }) ptvStatus!: string;
  @ApiProperty({ enum: PTV_ENGINES }) ptvEngine!: string;
  @ApiProperty({ description: 'The design. Text — a JSON object for JSON_BANDS.' })
  ptvBody!: string;
  @ApiProperty({ example: 1 }) ptvSchemaVer!: number;
  @ApiProperty({ example: 'A4' }) ptvPaperCode!: string;
  @ApiProperty({ enum: PTV_ORIENTATIONS }) ptvOrientation!: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) ptvWidthMm!: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) ptvHeightMm!: number | null;
  @ApiProperty({ example: 0 }) ptvMarginTopMm!: number;
  @ApiProperty({ example: 0 }) ptvMarginBottomMm!: number;
  @ApiProperty({ example: 0 }) ptvMarginLeftMm!: number;
  @ApiProperty({ example: 0 }) ptvMarginRightMm!: number;
  @ApiPropertyOptional({ type: Number, nullable: true, example: 48 }) ptvColumns!: number | null;
  @ApiProperty({ example: 'en-IN' }) ptvLang!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvFontFamily!: string | null;
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    nullable: true,
    description: 'What the operator is asked, once, for the whole render',
  })
  ptvParams!: unknown;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvNote!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvApprovedOn!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvApprovedBy!: string | null;
  @ApiProperty({ example: false }) ptvIsDeleted!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' }) ptvCreatedOn!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvCreatedBy!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvModifiedOn!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptvModifiedBy!: string | null;
  @ApiProperty({
    example: false,
    description: 'Derived: is this the revision the template currently publishes?',
  })
  ptvIsPublishedRev!: boolean;
  @ApiProperty({
    example: true,
    description: 'Derived: DRAFT and nothing else. A published version is never UPDATEd.',
  })
  ptvIsEditable!: boolean;
  @ApiProperty({ type: PrintTemplateDatasetPayloadDto, isArray: true })
  datasets!: PrintTemplateDatasetPayloadDto[];
}

export class PrintTemplatePayloadDto {
  @ApiProperty({ format: 'uuid' }) ptlId!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'NULL = shipped with the product',
  })
  ptlCompanyId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlCompanyName!: string | null;
  @ApiProperty({ format: 'uuid' }) ptlPurposeId!: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'SALE_INVOICE' })
  ptlPurposeCode!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlPurposeName!: string | null;
  @ApiProperty({ example: 'SALE_INVOICE_A4' }) ptlCode!: string;
  @ApiProperty({ example: 'Tax Invoice — A4' }) ptlName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlDescription!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlPublishedRevId!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) ptlPublishedRevNo!: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlForkedFromId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlForkedFromCode!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) ptlForkedFromRev!: number | null;
  @ApiProperty({ example: 100 }) ptlSortOrder!: number;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Read-only, generated: the owner with NULL folded to the nil uuid',
  })
  ptlCompanyKey!: string | null;
  @ApiProperty({ example: true }) ptlIsActive!: boolean;
  @ApiProperty({ example: false }) ptlIsDeleted!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' }) ptlCreatedOn!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlCreatedBy!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlModifiedOn!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ptlModifiedBy!: string | null;
  @ApiProperty({
    type: PrintTemplateVersionPayloadDto,
    isArray: true,
    description: 'Newest revision first',
  })
  versions!: PrintTemplateVersionPayloadDto[];
}

export class PrintTemplateDeleteResultDto {
  @ApiProperty({ format: 'uuid' }) ptlId!: string;
  @ApiProperty({ example: true }) deleted!: true;
}

export class PrintTemplateListMetaDto {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 3 }) total!: number;
  @ApiProperty({ example: 1 }) total_pages!: number;
}

export class PrintTemplateSuccessSingleDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Print template fetched successfully' }) message!: string;
  @ApiProperty({ type: PrintTemplatePayloadDto }) data!: PrintTemplatePayloadDto;
}

export class PrintTemplateSuccessListDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Print templates fetched successfully' }) message!: string;
  @ApiProperty({ type: PrintTemplatePayloadDto, isArray: true })
  data!: PrintTemplatePayloadDto[];
  @ApiProperty({ type: PrintTemplateListMetaDto }) meta!: PrintTemplateListMetaDto;
}

export class PrintTemplateSuccessDeleteDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Print template deleted successfully' }) message!: string;
  @ApiProperty({ type: PrintTemplateDeleteResultDto }) data!: PrintTemplateDeleteResultDto;
}
