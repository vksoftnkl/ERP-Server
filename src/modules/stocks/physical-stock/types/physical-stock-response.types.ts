import { ApiProperty } from "@nestjs/swagger";

export interface PhysicalStockErrorDetail {
  field: string;
  message: string;
}

export interface PhysicalStockErrorResponse {
  success: false;
  message: string;
  errors: PhysicalStockErrorDetail[];
}

export interface PhysicalStockSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
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



export class PhysicalStockSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Physical stock fetched successfully' })
  message!: string;

  @ApiProperty({ type: PhysicalStockDocumentResponse })
  data!: PhysicalStockDocumentResponse;
}