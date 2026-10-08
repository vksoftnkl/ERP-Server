import { Injectable } from '@nestjs/common';
import { PgService } from 'src/database/pg/pg.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { providerQuery } from './provider.utils';

/**
 * `company.profile` — the letterhead.
 *
 * A MASTER-shaped dataset almost every design binds: the name, address, GSTIN
 * and contact block at the top of the page. It is a provider rather than
 * stored SQL for one reason that has nothing to do with the query being hard —
 * it is trivial — and everything to do with `:company_id`: a stored query
 * reading `public.companys` would be one WHERE clause away from printing
 * another tenant's letterhead, and there is no reason for a hundred sites to
 * each keep their own copy of that clause.
 */
@Injectable()
export class CompanyProfileProvider implements PrintDataProvider {
  readonly code = 'company.profile';

  readonly label = 'Company letterhead';

  readonly cardinality = 'one' as const;

  constructor(private readonly pg: PgService) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const rows = await providerQuery(
      this.pg,
      `SELECT comp_id            AS company_id,
              comp_code          AS company_code,
              comp_name          AS company_name,
              comp_legal_name    AS legal_name,
              comp_short         AS short_name,
              comp_gstin_no      AS gstin,
              comp_gst_reg_type  AS gst_reg_type,
              comp_pan_no        AS pan_no,
              comp_fssai_no      AS fssai_no,
              comp_drug_license_no AS drug_license_no,
              comp_addr1         AS addr1,
              comp_addr2         AS addr2,
              comp_addr3         AS addr3,
              comp_city          AS city,
              comp_district      AS district,
              comp_state         AS state,
              comp_state_code    AS state_code,
              comp_pin           AS pin,
              comp_country       AS country,
              comp_tel           AS tel,
              comp_phone         AS phone,
              comp_mail          AS email,
              -- The address as one printable block, because every design wants
              -- it and none of them want to write the same COALESCE chain.
              concat_ws(', ',
                 nullif(comp_addr1, ''), nullif(comp_addr2, ''), nullif(comp_addr3, ''),
                 nullif(comp_city, ''), nullif(comp_state, ''),
                 nullif(comp_pin::text, '')) AS address_block
         FROM public.companys
        WHERE comp_id = $1`,
      [request.context.companyId],
    );

    return rows[0] ?? {};
  }
}
