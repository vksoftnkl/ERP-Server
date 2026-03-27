import { WidgetPlatform } from '@prisma/client';

export interface WidgetMasterErrorDetail {
  field: string;
  message: string;
}

export interface WidgetMasterErrorResponse {
  success: false;
  message: string;
  errors: WidgetMasterErrorDetail[];
}

export interface WidgetMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface WidgetMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
