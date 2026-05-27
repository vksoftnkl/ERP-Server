import { ApiProperty } from '@nestjs/swagger';
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  usrId!: string;
  @ApiProperty()
  usrLoginName!: string;
  @ApiProperty({ nullable: true })
  usrMobileNo!: string | null;
  @ApiProperty()
  usrIsActive!: boolean;
  @ApiProperty()
  usrCreatedOn!: string;
  @ApiProperty({ nullable: true })
  usrModifiedOn!: string | null;
}
