import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ModuleErrorResponse } from 'src/common/utils/module-shared.utils';
import type { StickerErrorDetail } from './sticker.errors';

/**
 * /stickers — passes the module's coded refusals (STICKER_*, the shared
 * STOCK_DEVICE_*, PRINT_ASSIGN_RIGHT_PRINT) through with their wording, and
 * maps the ValidationPipe's 400 onto the request keys (`lines.3.labels`).
 */
@Catch()
export class StickerExceptionFilter extends InventoryExceptionFilter<
  StickerErrorDetail,
  ModuleErrorResponse<StickerErrorDetail>
> {
  constructor() {
    super(
      /\b((?:company|branch|purpose|price|template|printer|item|unit|lot|job|reason|line|labels|start|status|acc|code|key|doc|sticker|src)[A-Za-z0-9]*|(?:lines|source)(?:\.[A-Za-z0-9_]+)+)\b/,
    );
  }
}
