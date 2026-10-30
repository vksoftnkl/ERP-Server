import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RenderPreviewDto } from './render-preview.dto';

/**
 * A rendered document to hand out as a link — `POST /print-share/create`.
 *
 * The same subject a `/preview` names (revision, document, company, year,
 * branch, counter), because the link renders exactly what the operator just
 * looked at: the client asks for one only after its own preview of that
 * revision succeeded. The document is required here — a link to "no document"
 * would be a link to a report's parameters, which nothing shares.
 */
export class CreatePrintShareDto extends PickType(RenderPreviewDto, [
  'versionId',
  'companyId',
  'accYear',
  'branchId',
  'deviceId',
] as const) {
  @ApiProperty({ format: 'uuid', description: 'The document the link opens. Binds :doc_id.' })
  @IsUUID()
  docId!: string;

  @ApiPropertyOptional({
    maxLength: 80,
    description:
      'File name stem the PDF is served under, without extension — `bill-bil00016`. ' +
      'Anything but letters, digits, dot, dash and underscore is replaced.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  filename?: string;
}
