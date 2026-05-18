import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
  SalesListMetaDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as CustomerGroupErrorFieldDto };
export { SalesErrorResponseDto as CustomerGroupErrorResponseDto };
export { SalesListMetaDto as CustomerGroupListMetaDto };

export class CustomerGroupPayloadDto {
  @ApiProperty({ format: 'uuid' })
  cgrId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cgrCompanyId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cgrBranchId!: string | null;

  @ApiProperty({ maxLength: 200 })
  cgrName!: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  cgrAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  cgrShort!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cgrNarration!: string | null;

  @ApiProperty()
  cgrOrder!: number;

  @ApiProperty()
  cgrDiscPerc!: number;

  @ApiProperty({ type: [Number], example: [] })
  cgrCollectionDays!: number[];

  @ApiProperty()
  cgrDebitAllowed!: boolean;

  @ApiProperty()
  cgrDebitDays!: number;

  @ApiProperty()
  cgrDebitLimit!: number;

  @ApiProperty()
  cgrBillsLimit!: number;

  @ApiProperty()
  cgrOverdueBilling!: boolean;

  @ApiProperty()
  cgrIsActive!: boolean;

  @ApiProperty()
  cgrIsDeleted!: boolean;

  @ApiProperty()
  cgrCreatedOn!: string;

  @ApiProperty()
  cgrModifiedOn!: string;
}

export class CustomerGroupDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  cgrId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class CustomerGroupSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Customer group fetched successfully' })
  message!: string;

  @ApiProperty({ type: CustomerGroupPayloadDto })
  data!: CustomerGroupPayloadDto;
}

export class CustomerGroupSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Customer groups fetched successfully' })
  message!: string;

  @ApiProperty({ type: CustomerGroupPayloadDto, isArray: true })
  data!: CustomerGroupPayloadDto[];

  @ApiProperty({ type: SalesListMetaDto })
  meta!: SalesListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class CustomerGroupSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Customer group deleted successfully' })
  message!: string;

  @ApiProperty({ type: CustomerGroupDeleteResultDto })
  data!: CustomerGroupDeleteResultDto;
}
