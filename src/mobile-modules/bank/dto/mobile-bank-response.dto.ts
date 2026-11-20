import { ApiProperty } from '@nestjs/swagger';

class MobileBankDto {
  @ApiProperty({ format: 'uuid', description: 'fixed.bank_master.bnk_id' }) bankId!: string;
  @ApiProperty({
    example: 'Karur Vysya Bank',
    description: "bnk_name, trimmed: what a cheque's tdBankName carries",
  })
  name!: string;
  @ApiProperty({ nullable: true, type: String, example: 'KVB', description: 'bnk_short_name' })
  shortName!: string | null;
}

class MobileBankListDto {
  @ApiProperty({ type: [MobileBankDto], description: 'Active, live banks, by name' })
  items!: MobileBankDto[];
  @ApiProperty({ example: 146 }) total!: number;
}

export class MobileBankListSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileBankListDto }) data!: MobileBankListDto;
}
