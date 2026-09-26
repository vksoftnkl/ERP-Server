import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MenuMasterErrorFieldDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class MenuMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: MenuMasterErrorFieldDto, isArray: true })
  errors!: MenuMasterErrorFieldDto[];
}

export class MenuMasterUserPermissionsDto {
  @ApiProperty({ example: false })
  canCreate!: boolean;

  @ApiProperty({ example: false })
  canEdit!: boolean;

  @ApiProperty({ example: false })
  canDelete!: boolean;

  @ApiProperty({ example: false })
  canPrint!: boolean;

  @ApiProperty({ example: false })
  canExport!: boolean;

  @ApiProperty({
    example: false,
    description:
      'The five transaction rights. Read them WITH menuVerbs: a true flag on a menu whose verbs ' +
      'do not include the verb is a stale grant, not a capability.',
  })
  canPost!: boolean;

  @ApiProperty({ example: false })
  canCancel!: boolean;

  @ApiProperty({ example: false })
  canAmend!: boolean;

  @ApiProperty({ example: false })
  canOverride!: boolean;

  @ApiProperty({ example: false })
  canRetender!: boolean;

  @ApiProperty({ example: true })
  isVisible!: boolean;

  @ApiProperty({ example: false })
  isFavourite!: boolean;

  @ApiProperty({ example: false })
  isPinned!: boolean;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class MenuMasterPayloadDto {
  @ApiProperty({ example: 1 })
  menuId!: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  menuParentId!: number | null;

  @ApiProperty({ example: '&1 Sales' })
  menuName!: string;

  @ApiPropertyOptional({ example: 'CTRL+S', nullable: true })
  menuAlias!: string | null;

  @ApiProperty({ example: true })
  menuVisibility!: boolean;

  @ApiPropertyOptional({ example: '1.00', nullable: true })
  menuPosition!: string | null;

  @ApiPropertyOptional({ nullable: true })
  menuIconLocationDesktop!: string | null;

  @ApiPropertyOptional({ nullable: true })
  menuIconLocationWeb!: string | null;

  @ApiPropertyOptional({ nullable: true })
  menuIconLocationMobile!: string | null;

  @ApiProperty({ example: false })
  menuSeparator!: boolean;

  @ApiProperty({ example: true })
  menuIsActive!: boolean;

  @ApiProperty({
    type: [String],
    example: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PRINT', 'EXPORT', 'POST', 'CANCEL', 'AMEND'],
    description:
      'What this screen can do. Render a permission cell ONLY for a verb listed here — a verb ' +
      'that is absent gets no checkbox at all, not a greyed one.',
  })
  menuVerbs!: string[];

  @ApiPropertyOptional({ type: MenuMasterUserPermissionsDto, nullable: true })
  permissions!: MenuMasterUserPermissionsDto | null;

  @ApiPropertyOptional({ type: () => [MenuMasterPayloadDto] })
  children?: MenuMasterPayloadDto[];
}

export class MenuMasterGetMetaDto {
  @ApiProperty({ example: false })
  visibleOnly!: boolean;

  @ApiProperty({ example: 9 })
  count!: number;
}

export class MenuMasterSuccessGetDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Menus fetched successfully' })
  message!: string;

  @ApiProperty({ type: MenuMasterPayloadDto, isArray: true })
  data!: MenuMasterPayloadDto[];

  @ApiProperty({ type: MenuMasterGetMetaDto })
  meta!: MenuMasterGetMetaDto;
}

export class MenuMasterUpdateVisibilityDataDto {
  @ApiProperty({ example: 1 })
  menuId!: number;

  @ApiProperty({ example: true })
  menuVisibility!: boolean;
}

export class MenuMasterSuccessUpdateVisibilityDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Menu visibility updated successfully' })
  message!: string;

  @ApiProperty({ type: [MenuMasterUpdateVisibilityDataDto] })
  data!: MenuMasterUpdateVisibilityDataDto[];
}
