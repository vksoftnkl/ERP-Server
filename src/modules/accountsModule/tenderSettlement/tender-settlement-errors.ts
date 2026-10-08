import { HttpException } from '@nestjs/common';
import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
} from 'src/common/types/module-api.types';
import { buildErrorResponse } from 'src/common/utils/module-shared.utils';
import { SETTLEMENT_ERROR_STATUS, SettlementErrorCode } from './types/tender-settlement-enum';

export type SettlementErrorDetail = ModuleApiErrorDetail & {
  code?: string;
  [key: string]: unknown;
};

/** The house error body at the status the code carries (SETTLEMENT_ERROR_STATUS). */
export function throwSettlement(
  code: SettlementErrorCode,
  message: string,
  field: string,
  extra: Record<string, unknown> = {},
): never {
  throwSettlementDetails(code, message, [{ field, message, code, ...extra }]);
}

/** Several details under one code — every bad row of a file at once. */
export function throwSettlementDetails(
  code: SettlementErrorCode,
  message: string,
  details: SettlementErrorDetail[],
): never {
  throw new HttpException(
    buildErrorResponse<SettlementErrorDetail, ModuleApiErrorResponse<SettlementErrorDetail>>(
      message,
      details.map((d) => ({ ...d, code: d.code ?? code })),
    ),
    SETTLEMENT_ERROR_STATUS[code],
  );
}
