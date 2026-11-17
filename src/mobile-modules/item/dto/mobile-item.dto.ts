import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { OptionalInteger, OptionalTrimmedString, RequiredUuid } from 'src/common/dto/dtoDecorators';

export const MOBILE_ITEM_DEFAULT_PAGE_SIZE = 200;
export const MOBILE_ITEM_MAX_PAGE_SIZE = 500;
/** dev_device_uid is varchar(120). */
export const MOBILE_DEVICE_UID_MAX_LENGTH = 120;

/** GET /mobile/items/list */
export class ListMobileItemsQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The company the order is for' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid. When sent, prices are read for the phone's own branch " +
      '(when it belongs to the company), the branch its orders are saved in; an unknown or blocked ' +
      "phone is refused (403). Omitted: the company's default branch.",
  })
  @OptionalTrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MOBILE_ITEM_MAX_PAGE_SIZE,
    default: MOBILE_ITEM_DEFAULT_PAGE_SIZE,
  })
  @OptionalInteger(1, MOBILE_ITEM_MAX_PAGE_SIZE)
  pageSize?: number;
}
