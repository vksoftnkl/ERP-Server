import { Prisma } from '@prisma/client';
import { ModuleErrorDetail, throwBadRequest } from 'src/common/utils/module-service.utils';

/**
 * What makes a tax_rate_master reference usable, checked once here rather than
 * once per table that points at one.
 *
 * Five columns now reference the rate master — sbi_tax_id, soi_tax_id,
 * sqi_tax_id, cd_tax_code and led_tax_id — and every one of them is an FK,
 * which gets "the row exists" for free and nothing else. The two rules an FK
 * cannot state are the ones that matter to an operator:
 *
 *   · a SOFT-DELETED rate is still a row, so the FK is satisfied by a rate
 *     nobody may quote any more;
 *   · a DEACTIVATED rate is a rate withdrawn from new documents, which is the
 *     whole reason tax_is_active is separate from tax_is_deleted.
 *
 * Both come back as a 400 naming the line that referenced it, instead of the
 * P2003 the ORM would otherwise report — or, worse, a save that succeeds and
 * prices a document under a rate that was retired last quarter.
 */

/** One reference to check, paired with the field to report it against. */
export interface TaxRateRef {
  /** The referenced inventory.tax_rate_master.tax_id. */
  taxId: string;
  /** The caller's own field path — e.g. `items.3.sqiTaxId`. */
  field: string;
}

type TaxRateRefClient = Pick<Prisma.TransactionClient, 'taxRateMaster'>;

/**
 * The throwing form: a 400 listing every unusable reference, or nothing when
 * they are all live rates.
 */
export async function assertTaxRateRefs(
  client: TaxRateRefClient,
  refs: readonly TaxRateRef[],
  message = 'Validation failed',
): Promise<void> {
  const errors = await collectTaxRateRefErrors(client, refs);
  if (errors.length > 0) {
    throwBadRequest(message, errors);
  }
}

/**
 * Every unusable reference in one pass, so a grid of twenty lines is corrected
 * in one round-trip. Distinct ids are looked up once however many lines quote
 * them.
 */
export async function collectTaxRateRefErrors(
  client: TaxRateRefClient,
  refs: readonly TaxRateRef[],
): Promise<ModuleErrorDetail[]> {
  if (refs.length === 0) {
    return [];
  }
  const taxIds = [...new Set(refs.map((ref) => ref.taxId))];
  const rates = await client.taxRateMaster.findMany({
    where: { taxId: { in: taxIds } },
    select: { taxId: true, taxName: true, taxIsActive: true, taxIsDeleted: true },
  });
  const rateById = new Map(rates.map((rate) => [rate.taxId, rate]));

  const errors: ModuleErrorDetail[] = [];
  for (const ref of refs) {
    const rate = rateById.get(ref.taxId);
    if (!rate || rate.taxIsDeleted) {
      errors.push({ field: ref.field, message: `No tax rate found with id ${ref.taxId}` });
      continue;
    }
    if (!rate.taxIsActive) {
      errors.push({
        field: ref.field,
        message: `Tax rate "${rate.taxName}" is inactive and cannot be quoted on a new document`,
      });
    }
  }
  return errors;
}

/**
 * The refs a grid contributes: one per line that names a rate, skipping the
 * lines that leave it null. NULL is the normal case and always will be — every
 * historical row has no answer, and NULL is honest.
 */
export function collectTaxRateRefs<TLine>(
  lines: readonly TLine[],
  taxIdOf: (line: TLine) => string | null | undefined,
  fieldOf: (index: number) => string,
): TaxRateRef[] {
  const refs: TaxRateRef[] = [];
  lines.forEach((line, index) => {
    const taxId = taxIdOf(line);
    if (typeof taxId === 'string' && taxId.length > 0) {
      refs.push({ taxId, field: fieldOf(index) });
    }
  });
  return refs;
}
