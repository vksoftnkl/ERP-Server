import { ApiProperty } from '@nestjs/swagger';
export interface PhysicalStockErrorDetail {
  field: string;
  message: string;
}
export interface PhysicalStockErrorResponse {
  success: false;
  message: string;
  errors: PhysicalStockErrorDetail[];
}
export interface PhysicalStockSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}
export interface PhysicalStockDeleteResponse {
  ps_id: string;
  deleted: true;
}
export interface PhysicalStockHeaderResponse {
  psc_id: string;
  psc_refno: string;
  psc_date: string;
}
export interface PhysicalStockBatchDetailResponse {
  psb_id: string;
  psb_psd_id: string;
  psb_row_no: number;
}
export interface PhysicalStockDetailResponse {
  psd_id: string;
  psd_psc_id: string;
  psd_row_no: number;
  batch_details: PhysicalStockBatchDetailResponse[];
}
export interface PhysicalStockDocumentResponse {
  header: PhysicalStockHeaderResponse;
  details: PhysicalStockDetailResponse[];
}
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
