import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleErrorFieldDto, ModuleErrorResponseDto } from 'src/common/utils/module-response.dto';
import {
  PTA_OUTPUT_MODES,
  PTA_PRINTER_SOURCES,
  PTA_SHIPPED_TEMPLATE_KEY,
  type PtaPrinterSource,
  type PtaScope,
} from '../print-template-assignment.constants';

export { ModuleErrorFieldDto as PrintTemplateAssignmentErrorFieldDto };
export { ModuleErrorResponseDto as PrintTemplateAssignmentErrorResponseDto };

const PTA_SCOPES = ['GLOBAL', 'COMPANY', 'BRANCH', 'COUNTER'] as const;

export class PrintTemplateAssignmentPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ptaId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = every company — the widest rung, and shipped designs only',
  })
  ptaCompanyId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Acme Pvt Ltd' })
  ptaCompanyName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'NULL = every branch' })
  ptaBranchId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Main Branch' })
  ptaBranchName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'NULL = every counter' })
  ptaDeviceId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Counter 1' })
  ptaDeviceName!: string | null;

  @ApiProperty({ format: 'uuid' })
  ptaPurposeId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'SALE_INVOICE' })
  ptaPurposeCode!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Tax Invoice' })
  ptaPurposeName!: string | null;

  @ApiProperty({ format: 'uuid' })
  ptaTemplateId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'A4-TAX-INVOICE' })
  ptaTemplateCode!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'A4 Tax Invoice' })
  ptaTemplateName!: string | null;

  @ApiProperty({
    format: 'uuid',
    example: PTA_SHIPPED_TEMPLATE_KEY,
    description:
      "The template's owner, the nil uuid meaning shipped with the product. Derived from the template, never accepted from the caller.",
  })
  ptaTemplateCompanyKey!: string;

  @ApiProperty({ example: true, description: 'ptaTemplateCompanyKey is the nil uuid' })
  ptaTemplateIsShipped!: boolean;

  @ApiProperty({ enum: PTA_OUTPUT_MODES, example: 'PRINT' })
  ptaOutputMode!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ptaPrinterId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 150,
    example: 'HP-LaserJet-Front',
    description:
      'The bare queue name column — a fallback for a scope with no registered profile. Never set alongside ptaPrinterId.',
  })
  ptaPrinterName!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Counter 1 laser',
    description: "The registered profile's name, joined. NULL whenever ptaPrinterId is NULL.",
  })
  ptaPrinterProfileName!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 2 })
  ptaCopies!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 3,
    description:
      'Derived in the database, never written: 3 counter, 2 branch, 1 company, 0 every company',
  })
  ptaSpecificity!: number | null;

  @ApiProperty({ enum: PTA_SCOPES, example: 'COUNTER', description: 'ptaSpecificity as a word' })
  ptaScope!: PtaScope;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  ptaRemarks!: string | null;

  @ApiProperty({ example: true })
  ptaIsActive!: boolean;

  @ApiProperty({ example: false })
  ptaIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  ptaSyncDate!: string | null;

  @ApiProperty()
  ptaCreatedOn!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ptaCreatedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ptaModifiedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ptaModifiedBy!: string | null;
}

export class PrintTemplateAssignmentResolutionDto {
  @ApiProperty({ format: 'uuid' })
  ptaId!: string;

  @ApiPropertyOptional({ nullable: true, example: 3 })
  ptaSpecificity!: number | null;

  @ApiProperty({ enum: PTA_SCOPES, example: 'COUNTER' })
  scope!: PtaScope;

  @ApiProperty({ format: 'uuid' })
  ptaTemplateId!: string;

  @ApiPropertyOptional({ nullable: true })
  ptaTemplateCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ptaTemplateName!: string | null;

  @ApiProperty({ example: false, description: 'The winning design ships with the product' })
  ptaTemplateIsShipped!: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL means the template has no published revision and cannot render',
  })
  publishedRevId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ptaPrinterId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "One name for the render path: the registered profile's when ptaPrinterId is set, the bare fallback otherwise, NULL when the server's default queue applies.",
  })
  ptaPrinterName!: string | null;

  @ApiProperty({
    enum: PTA_PRINTER_SOURCES,
    example: 'PROFILE',
    description:
      'PROFILE — paper, codepage and columns are known and can be asserted. NAME — a bare queue, so none of that is known. DEFAULT — the counter default.',
  })
  printerSource!: PtaPrinterSource;

  @ApiProperty({ enum: PTA_OUTPUT_MODES })
  ptaOutputMode!: string;

  @ApiProperty({ example: 3, description: 'Assignment override, else the purpose count' })
  copies!: number;

  @ApiProperty({ example: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'], type: [String] })
  copyLabels!: string[];
}

export class PrintTemplateAssignmentDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ptaId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class PrintTemplateAssignmentListDataDto {
  @ApiProperty({ type: [PrintTemplateAssignmentPayloadDto] })
  items!: PrintTemplateAssignmentPayloadDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}

export class PrintTemplateAssignmentSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Print template assignment fetched successfully' })
  message!: string;

  @ApiProperty({ type: PrintTemplateAssignmentPayloadDto })
  data!: PrintTemplateAssignmentPayloadDto;
}

export class PrintTemplateAssignmentSuccessCreateDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Print template assignment created successfully' })
  message!: string;

  @ApiProperty({ type: PrintTemplateAssignmentPayloadDto })
  data!: PrintTemplateAssignmentPayloadDto;
}

export class PrintTemplateAssignmentSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Print template assignments fetched successfully' })
  message!: string;

  @ApiProperty({ type: PrintTemplateAssignmentListDataDto })
  data!: PrintTemplateAssignmentListDataDto;
}

export class PrintTemplateAssignmentSuccessResolveDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Print template resolved successfully' })
  message!: string;

  @ApiProperty({ type: PrintTemplateAssignmentResolutionDto })
  data!: PrintTemplateAssignmentResolutionDto;
}

export class PrintTemplateAssignmentSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Print template assignment deleted successfully' })
  message!: string;

  @ApiProperty({ type: PrintTemplateAssignmentDeleteResultDto })
  data!: PrintTemplateAssignmentDeleteResultDto;
}
