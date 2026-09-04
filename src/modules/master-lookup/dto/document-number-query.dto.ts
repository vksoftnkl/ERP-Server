import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty } from 'class-validator';
import { RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import {
  DOCUMENT_LOOKUP_MODULE_ALIASES,
  DOCUMENT_LOOKUP_MODULE_KEYS,
  DocumentLookupModuleKey,
} from '../types/master-lookup-api.types';
/** "Sale Order", "sale_order" and "orders" all normalize to `saleorder`. */
const normalizeModuleAlias = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const MODULE_ALIAS_MAP: Record<string, DocumentLookupModuleKey> = Object.fromEntries(
  DOCUMENT_LOOKUP_MODULE_KEYS.flatMap((moduleKey) =>
    [moduleKey, ...DOCUMENT_LOOKUP_MODULE_ALIASES[moduleKey]].map((alias) => [
      normalizeModuleAlias(alias),
      moduleKey,
    ]),
  ),
) as Record<string, DocumentLookupModuleKey>;
/**
 * Resolves an alias to its canonical key, and leaves anything unknown untouched
 * so `IsIn` rejects it with the allowed values spelled out.
 */
const toDocumentModule = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return value === undefined || value === null ? undefined : (value as string);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return MODULE_ALIAS_MAP[normalizeModuleAlias(trimmed)] ?? trimmed;
};
export class DocumentNumberQueryDto {
  @ApiProperty({
    enum: DOCUMENT_LOOKUP_MODULE_KEYS,
    description:
      'Which document table the number is read from. Also accepts display aliases such as sale-bill, invoice, order and quotation.',
  })
  @Transform(({ value }) => toDocumentModule(value))
  @IsIn(DOCUMENT_LOOKUP_MODULE_KEYS, {
    message: `module must be one of: ${DOCUMENT_LOOKUP_MODULE_KEYS.join(', ')}`,
  })
  module!: DocumentLookupModuleKey;
  @ApiProperty({
    maxLength: 100,
    description:
      'The document number as printed on it — sb_bill_refno / so_order_refno / sq_quote_refno. An all-digits value is matched against the serial (sb_bill_slno / so_order_slno / sq_quote_slno) as well, so a screen that shows the bare running number resolves too.',
    example: 'quo00042',
  })
  @TrimmedString(100)
  @IsNotEmpty({ message: 'orderNo should not be empty' })
  orderNo!: string;
  @ApiProperty({ format: 'uuid', description: 'Company the document was raised under' })
  @RequiredUuid()
  companyId!: string;
  @ApiProperty({ format: 'uuid', description: 'Branch the document was raised at' })
  @RequiredUuid()
  branchId!: string;
}
