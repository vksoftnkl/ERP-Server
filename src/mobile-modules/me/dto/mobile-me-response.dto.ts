import { ApiProperty } from '@nestjs/swagger';

class MobileMenuRightsDto {
  @ApiProperty({ description: 'um_can_view' }) view!: boolean;
  @ApiProperty({ description: 'um_can_create' }) create!: boolean;
  @ApiProperty({ description: 'um_can_post' }) post!: boolean;
  @ApiProperty({ description: 'um_can_cancel' }) cancel!: boolean;
  @ApiProperty({ description: 'um_can_print' }) print!: boolean;
}

class MobileMeRightsDto {
  @ApiProperty({ type: MobileMenuRightsDto, description: 'Menu 11, Sales Order' })
  '11'!: MobileMenuRightsDto;
  @ApiProperty({ type: MobileMenuRightsDto, description: 'Menu 12, Sales Bill' })
  '12'!: MobileMenuRightsDto;
  @ApiProperty({ type: MobileMenuRightsDto, description: 'Menu 99, Receipt' })
  '99'!: MobileMenuRightsDto;
}

export class MobileMeDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ example: 'VKPOS' }) loginName!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      "user_master.usr_employee_id when it names a live employee: the collector the phone's receipts carry",
  })
  employeeId!: string | null;
  @ApiProperty({ nullable: true, type: String }) employeeName!: string | null;
  @ApiProperty({
    type: MobileMeRightsDto,
    description:
      "The login's rights on the menus the phone uses, keyed by menu id as text, read from " +
      'public.user_menus as the desktop guards read them (no row = no rights; no SUPER ADMIN bypass)',
  })
  rights!: MobileMeRightsDto;
}

export class MobileMeSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileMeDto }) data!: MobileMeDto;
}
