import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { TrimmedString } from 'src/common/dto/dtoDecorators';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/** GET /mobile/banks/list */
export class MobileBankListQueryDto {
  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid (fixed.device_master.dev_device_uid): an unknown, " +
      'blocked or switched-off phone is refused with a 403, as on every mobile read.',
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;
}
