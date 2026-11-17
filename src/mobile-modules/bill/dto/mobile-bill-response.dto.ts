import { ApiProperty } from '@nestjs/swagger';

class MobileBillGodownDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as sbiGodownId' }) godownId!: string;
  @ApiProperty({ example: 'Coimbatore' }) name!: string;
  @ApiProperty({ nullable: true, type: String, example: 'CBE' }) shortName!: string | null;
  @ApiProperty({ description: "The branch's default godown (branch_master.br_default_godown_id)" })
  isDefault!: boolean;
}

export class MobileBillOptionsDto {
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({
    format: 'uuid',
    description:
      "The branch the phone's bills for this company land in: the phone's own branch when it " +
      "belongs to the company, else the company's default branch, else its only branch",
  })
  branchId!: string;
  @ApiProperty({
    type: [MobileBillGodownDto],
    description: "The branch's live, active godowns, the default first",
  })
  godowns!: MobileBillGodownDto[];
}

export class MobileBillOptionsSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileBillOptionsDto }) data!: MobileBillOptionsDto;
}

export class MobileBillCreateResultDto {
  @ApiProperty({ format: 'uuid' }) sbId!: string;
  @ApiProperty({ format: 'uuid' }) sbCompanyId!: string;
  @ApiProperty({ format: 'uuid' }) sbBranchId!: string;
  @ApiProperty({ example: '2026-2027' }) sbAccYear!: string;
  @ApiProperty({
    example: 'bil01234',
    description: "VK Nex's number, from the branch's Sales Bill series. Store it on the phone.",
  })
  sbBillRefno!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'A1B2/2627/00001',
    description: "The phone's own number, as sent",
  })
  sbUsrRefno!: string | null;
  @ApiProperty({ example: '2026-11-17' }) sbBillDate!: string;
  @ApiProperty({ example: '1180.00', description: 'The bill total, two decimals' })
  sbBillAmt!: string;
  @ApiProperty({
    example: 'POSTED',
    description: 'Now: POSTED when just saved; a resend reads the stored one (CANCELLED)',
  })
  sbStatus!: string;
  @ApiProperty({ description: 'true = saved before under this sbClientUuid; nothing written now' })
  duplicate!: boolean;
  @ApiProperty({ description: 'A resend of a bill the office has since deleted' })
  sbIsDeleted!: boolean;
}

export class MobileBillCreateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileBillCreateResultDto }) data!: MobileBillCreateResultDto;
}
