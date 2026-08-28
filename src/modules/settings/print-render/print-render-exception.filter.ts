import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { PrintRenderErrorDetail, PrintRenderErrorResponse } from './types/print-render-api.types';

/**
 * The field pattern is wider than its siblings' on purpose.
 *
 * The other modules in this engine own one table each and answer with its
 * column prefix — `pta[A-Za-z0-9]+` for an assignment. This module owns no
 * table. What it refuses is a DESIGN, and the place that failed is a path into
 * the canvas (`bands.3.elements.7.value`), a query on the Data tab
 * (`datasets.items.ptdSql`) or an operator prompt (`params.from_date`), so the
 * pattern has to recognise a dotted path as well as a bare column name.
 */
@Catch()
export class PrintRenderExceptionFilter extends SettingsExceptionFilter<
  PrintRenderErrorDetail,
  PrintRenderErrorResponse
> {
  constructor() {
    super(
      /\b((?:ptv|ptd|ptl|pta|plg)[A-Za-z0-9]+|(?:bands|datasets|params)(?:\.[A-Za-z0-9_]+)+)\b/,
    );
  }
}
