import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type WidgetMasterErrorDetail = ModuleApiErrorDetail;
export type WidgetMasterErrorResponse = ModuleApiErrorResponse<WidgetMasterErrorDetail>;
export type WidgetMasterSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;
export type WidgetMasterListMeta = ModuleListMeta;

import { WidgetPlatform } from '@prisma/client';

export interface WidgetMasterPayload {
  widgetNo: number;
  widgetGroupId: number;
  widgetName: string;
  widgetPosition: number;
  widgetVisibility: boolean;
  widgetGuiName: string | null;
  widgetType: WidgetPlatform;
  widgetSecondaryText: string | null;
}

