import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { OptionalTrimmedString, RequiredUuid } from 'src/common/dto/dtoDecorators';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/** GET /mobile/schemes/active: the same two keys as GET /mobile/items/list. */
export class ActiveMobileSchemesQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The company whose schemes the phone downloads' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid. When sent, an unknown, blocked or switched-off phone " +
      'is refused (403), as /mobile/items/list does. It does not narrow the answer: every ' +
      "branch row of a scheme is sent, and the phone checks the order's own branch.",
  })
  @OptionalTrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid?: string;
}
