import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { GstErrorDetail, GstErrorResponse } from './types/gst-config.types';

/** The gst_* config routes: refusals as { success: false, message, errors: [{ field, message, code? }] }. */
@Catch()
export class GstExceptionFilter extends SettingsExceptionFilter<GstErrorDetail, GstErrorResponse> {
  constructor() {
    super(
      /\b(gpv\w+|gps\w+|gpe\w+|gfm\w+|gem\w+|gpa\w+|gcc\w+|password|clientId|clientSecret|apiKey|appKey|clear)\b/,
    );
  }
}
