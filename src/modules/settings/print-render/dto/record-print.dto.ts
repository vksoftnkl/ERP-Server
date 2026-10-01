import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { RECORDABLE_OUTPUT_MODES, RecordableOutputMode } from '../print-render.constants';
import { RenderPreviewDto } from './render-preview.dto';

/**
 * A print that has ALREADY happened, to be written to print_log.
 *
 * The print dialog renders through `/preview` — its Format button lets the
 * operator pick any design, and `/print` only renders the ladder's winner — and
 * the operator then views, prints or saves it from the popup. This is that act. The
 * document, company and year fields are the preview's own, so the row names the
 * same subject the render bound.
 */
export class RecordPrintDto extends PickType(RenderPreviewDto, [
  'versionId',
  'docId',
  'docIds',
  'companyId',
  'accYear',
  'branchId',
  'deviceId',
] as const) {
  @ApiProperty({
    enum: RECORDABLE_OUTPUT_MODES as unknown as string[],
    description:
      'PRINT — sent to a printer. FILE — saved as a PDF. PREVIEW — opened in the popup ' +
      '(Preview / Pdf) and not yet sent anywhere.',
  })
  @IsIn(RECORDABLE_OUTPUT_MODES as unknown as string[])
  outputMode!: RecordableOutputMode;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      "The render's page count, from X-Print-Pages. Recorded only for a single document: a " +
      "batch's pages are one number for the whole file.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  pageCount?: number;

  @ApiPropertyOptional({ minimum: 0, description: "The render's size in bytes." })
  @IsOptional()
  @IsInt()
  @Min(0)
  byteCount?: number;
}
