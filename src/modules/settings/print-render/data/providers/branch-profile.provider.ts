import { Injectable } from '@nestjs/common';
import { PgService } from 'src/database/pg/pg.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { providerQuery } from './provider.utils';

/**
 * `branch.profile` — the address the goods actually left from.
 *
 * Separate from `company.profile` because a chain's invoice carries both: the
 * registered entity at the top and the supplying branch's address and GSTIN
 * beside it, which is what a GST officer reads to decide whether the supply was
 * intra-state.
 *
 * A render with no branch in context resolves to `{}` rather than failing.
 * `pta_branch_id` is nullable all the way down the assignment ladder — a
 * single-location shop has no branch to name — and a design that prints the
 * branch block would then print an empty one, which is correct.
 */
@Injectable()
export class BranchProfileProvider implements PrintDataProvider {
  readonly code = 'branch.profile';

  readonly label = 'Branch address';

  readonly cardinality = 'one' as const;

  constructor(private readonly pg: PgService) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const { branchId, companyId } = request.context;
    if (!branchId) return {};

    const rows = await providerQuery(
      this.pg,
      `SELECT br_id           AS branch_id,
              br_code         AS branch_code,
              br_name         AS branch_name,
              br_mailing_name AS mailing_name,
              br_short        AS short_name,
              br_addr1        AS addr1,
              br_addr2        AS addr2,
              br_addr3        AS addr3,
              br_city         AS city,
              br_district     AS district,
              br_state        AS state,
              br_state_code   AS state_code,
              br_pin          AS pin,
              br_country      AS country,
              br_landmark     AS landmark,
              br_contact_person AS contact_person,
              br_tel          AS tel,
              br_phone        AS phone,
              concat_ws(', ',
                 nullif(br_addr1, ''), nullif(br_addr2, ''), nullif(br_addr3, ''),
                 nullif(br_city, ''), nullif(br_state, ''),
                 nullif(br_pin::text, '')) AS address_block
         FROM public.branch_master
        -- The company predicate is not redundant with the id: a branch id from
        -- somewhere else must resolve to nothing rather than to a branch.
        WHERE br_id = $1 AND br_comp_id = $2`,
      [branchId, companyId],
    );

    return rows[0] ?? {};
  }
}
