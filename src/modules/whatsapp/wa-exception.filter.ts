import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-shared.utils';

/**
 * /whatsapp/*: the house error body, worded from fixed.error_message (WA_* rows, notes 120).
 * The regex names the request keys of this build's DTOs (dto/wa.dto.ts) only.
 */
@Catch()
export class WaExceptionFilter extends SettingsExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse<ModuleErrorDetail>
> {
  constructor() {
    super(
      /\b(companyId|branchId|activationCode|replace|reason|phone|docType|docId|docAccYear|lang|wmlId|accYear|confirmResend|onPostTypes|defaultLanguage|ratePerMessage|rateGstPercent|fallbackClickToChat|logRetentionYears|vchrTypeId|on)\b/,
    );
  }
}
