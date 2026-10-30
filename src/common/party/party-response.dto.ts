import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Swagger shapes of the party master rules P1 answers (customers + suppliers). */
export class PartySyncDto {
  @ApiProperty({ enum: ['CUSTOMER', 'SUPPLIER'], nullable: true, description: 'The other role on the same ledger, when live.' })
  otherRole!: 'CUSTOMER' | 'SUPPLIER' | null;

  @ApiProperty({ description: 'The other role row was written (a synced value differed).' })
  otherRoleUpdated!: boolean;

  @ApiProperty({ type: String, isArray: true, example: ['supAddr1', 'supPhone'], description: "The other role's own keys that changed." })
  fields!: string[];
}

export class PartyDeleteBalanceDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiPropertyOptional({ nullable: true })
  companyName!: string | null;

  @ApiProperty({ example: '1250.00', description: 'Always positive, 2 decimals; the side is drCr.' })
  amount!: string;

  @ApiProperty({ enum: ['DR', 'CR'] })
  drCr!: 'DR' | 'CR';
}

export class PartyDeleteWarningsDto {
  @ApiProperty({ description: 'Unposted drafts naming the party (they cannot be posted after the delete).' })
  draftDocs!: number;

  @ApiProperty({ description: 'Bills with a pending amount (allowed when the balance nets to 0).' })
  openBills!: number;

  @ApiProperty({ description: 'Cheques HELD / DEPOSITED that post on clearing.' })
  chequesInHand!: number;
}

export class PartyUserWordingDto {
  @ApiProperty() title!: string;
  @ApiProperty() line!: string;
  @ApiProperty() todo!: string;
}

export class PartyRefusalDto {
  @ApiProperty() field!: string;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ type: PartyUserWordingDto, description: 'Plain words with the real figures.' })
  user?: PartyUserWordingDto;
}

export class PartyDeleteCheckDto {
  @ApiProperty({ format: 'uuid' }) partyId!: string;
  @ApiProperty({ enum: ['CUSTOMER', 'SUPPLIER'] }) role!: 'CUSTOMER' | 'SUPPLIER';
  @ApiProperty() otherRoleLive!: boolean;
  @ApiProperty() ledgerWouldBeDeleted!: boolean;
  @ApiProperty() canDelete!: boolean;
  @ApiPropertyOptional({ nullable: true, example: 'CUSTOMER_HAS_BALANCE' }) refusalCode!: string | null;
  @ApiProperty({ type: PartyDeleteBalanceDto, isArray: true }) balances!: PartyDeleteBalanceDto[];
  @ApiProperty({ type: PartyDeleteWarningsDto }) warnings!: PartyDeleteWarningsDto;
  @ApiProperty({ type: PartyRefusalDto, isArray: true, description: 'What DELETE would refuse with.' })
  refusals!: PartyRefusalDto[];
}

export class PartyDeleteCheckSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: PartyDeleteCheckDto }) data!: PartyDeleteCheckDto;
}
