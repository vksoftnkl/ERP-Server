import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
  FixedListMetaDto,
} from '../../utils/fixed-response.dto';

export { FixedErrorFieldDto as BankListErrorFieldDto };
export { FixedErrorResponseDto as BankListErrorResponseDto };
export { FixedListMetaDto as BankListMetaDto };

export class BankListPayloadDto {
  @ApiProperty({ format: 'uuid' })
  bnkId!: string;

  @ApiProperty({ maxLength: 200 })
  bnkName!: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  bnkShortName!: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  bnkAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  bnkRbiCode!: string | null;

  @ApiProperty({ example: false })
  bnkIbanSupported!: boolean;

  @ApiProperty({ example: true })
  bnkIsActive!: boolean;

  @ApiProperty({ example: false })
  bnkIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  bnkSyncDate!: string | null;

  @ApiProperty()
  bnkCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  bnkCreatedBy!: string | null;

  @ApiProperty()
  bnkModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  bnkModifiedBy!: string | null;
}

export class BankListDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  bnkId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class BankListSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Bank fetched successfully' })
  message!: string;

  @ApiProperty({ type: BankListPayloadDto })
  data!: BankListPayloadDto;
}

export class BankListSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Banks fetched successfully' })
  message!: string;

  @ApiProperty({ type: BankListPayloadDto, isArray: true })
  data!: BankListPayloadDto[];

  @ApiProperty({ type: FixedListMetaDto })
  meta!: FixedListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class BankListSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Bank deleted successfully' })
  message!: string;

  @ApiProperty({ type: BankListDeleteResultDto })
  data!: BankListDeleteResultDto;
}
