import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type PhysicalStockErrorDetail = ModuleApiErrorDetail;
export type PhysicalStockErrorResponse = ModuleApiErrorResponse<PhysicalStockErrorDetail>;
export type PhysicalStockSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;
export type PhysicalStockListMeta = ModuleListMeta;

import { ApiProperty } from '@nestjs/swagger';
export interface PhysicalStockDeleteResponse {
  ps_id: string;
  deleted: true;
}
export interface PhysicalStockHeaderResponse {
  psc_id: string;
  psc_refno: string;
  psc_date: string;
  psc_acc_year?: string;
  psc_company_id?: string;
  psc_branch_id?: string;
  psc_godown_id?: string;
  psc_godown_name?: string | null;
  psc_doc_no?: string;
  psc_status?: string;
  psc_total_lines?: number;
  psc_total_book_value?: number;
  psc_total_counted_value?: number;
  psc_net_variance_value?: number;
  psc_device_type?: string | null;
  psc_device_id?: string | null;
  psc_counter_id?: string | null;
  psc_session_id?: string | null;
  psc_remarks?: string | null;
  psc_is_active?: boolean;
  psc_is_deleted?: boolean;
  psc_created_on?: string;
  psc_created_by?: string | null;
  psc_modified_on?: string | null;
  psc_modified_by?: string | null;
}
export interface PhysicalStockBatchDetailResponse {
  psb_id: string;
  psb_psd_id: string;
  psb_row_no: number;
  psb_psh_id?: string;
  psb_acc_year?: string;
  psb_company_id?: string;
  psb_branch_id?: string;
  psb_godown_id?: string;
  psb_item_id?: string;
  psb_unit_id?: string;
  psb_base_unit_id?: string;
  psb_to_base_factor?: number;
  psb_batch_id?: string | null;
  psb_batch_no?: string | null;
  psb_mfg_batch_no?: string | null;
  psb_batch_date?: string | null;
  psb_mfg_date?: string | null;
  psb_expiry_date?: string | null;
  psb_mrp?: number;
  psb_barcode?: string | null;
  psb_serial_no?: string | null;
  psb_book_qty?: number;
  psb_book_base_qty?: number;
  psb_physical_qty?: number;
  psb_physical_base_qty?: number;
  psb_diff_qty?: number;
  psb_diff_base_qty?: number;
  psb_stock_rate_wot?: number;
  psb_stock_rate_with_tax?: number;
  psb_reason_id?: string | null;
  psb_resolution?: string;
  psb_notes?: string | null;
}
export interface PhysicalStockDetailResponse {
  psd_id: string;
  psd_psc_id: string;
  psd_row_no: number;
  psd_acc_year?: string;
  psd_company_id?: string;
  psd_branch_id?: string;
  psd_godown_id?: string;
  psd_godown_name?: string | null;
  psd_item_id?: string;
  psd_item_code?: string | null;
  psd_item_name?: string | null;
  psd_unit_id?: string;
  psd_unit_name?: string | null;
  psd_base_unit_id?: string;
  psd_base_unit_name?: string | null;
  psd_to_base_factor?: number;
  psd_barcode?: string | null;
  psd_mrp?: number;
  psd_tracking_type?: string;
  psd_book_qty?: number;
  psd_book_base_qty?: number;
  psd_physical_qty?: number;
  psd_physical_base_qty?: number;
  psd_diff_qty?: number;
  psd_diff_base_qty?: number;
  psd_stock_rate_wot?: number;
  psd_stock_rate_with_tax?: number;
  psd_reason_id?: string | null;
  psd_resolution?: string;
  psd_notes?: string | null;
  batch_details: PhysicalStockBatchDetailResponse[];
}
export interface PhysicalStockDocumentResponse {
  header: PhysicalStockHeaderResponse;
  details: PhysicalStockDetailResponse[];
}
export type PhysicalStockListItem = PhysicalStockHeaderResponse;
export class PhysicalStockHeaderResponseDto implements PhysicalStockHeaderResponse {
  @ApiProperty({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11' })
  psc_id!: string;
  @ApiProperty({ example: 'PHY-STK-1001' })
  psc_refno!: string;
  @ApiProperty({ example: '2026-05-07' })
  psc_date!: string;
}
export class PhysicalStockBatchDetailResponseDto implements PhysicalStockBatchDetailResponse {
  @ApiProperty({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a12' })
  psb_id!: string;
  @ApiProperty({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a13' })
  psb_psd_id!: string;
  @ApiProperty({ example: 1 })
  psb_row_no!: number;
}
export class PhysicalStockDetailResponseDto implements PhysicalStockDetailResponse {
  @ApiProperty({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a13' })
  psd_id!: string;
  @ApiProperty({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11' })
  psd_psc_id!: string;
  @ApiProperty({ example: 1 })
  psd_row_no!: number;
  @ApiProperty({ type: PhysicalStockBatchDetailResponseDto, isArray: true })
  batch_details!: PhysicalStockBatchDetailResponse[];
}
export class PhysicalStockDocumentResponseDto implements PhysicalStockDocumentResponse {
  @ApiProperty({ type: PhysicalStockHeaderResponseDto })
  header!: PhysicalStockHeaderResponse;
  @ApiProperty({ type: PhysicalStockDetailResponseDto, isArray: true })
  details!: PhysicalStockDetailResponse[];
}
export class PhysicalStockDeleteResponseDto implements PhysicalStockDeleteResponse {
  @ApiProperty({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11' })
  ps_id!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class PhysicalStockSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Physical stock fetched successfully' })
  message!: string;
  @ApiProperty({ type: PhysicalStockDocumentResponseDto })
  data!: PhysicalStockDocumentResponse;
}
export class PhysicalStockSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Physical stock deleted successfully' })
  message!: string;
  @ApiProperty({ type: PhysicalStockDeleteResponseDto })
  data!: PhysicalStockDeleteResponse;
}
