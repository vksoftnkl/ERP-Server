import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AccountLedgerMastersService } from 'src/modules/accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { PUR, purConflict, purNotFound, purRefuse } from '../common/purchase.errors';
import { D, jsonSafe } from '../common/purchase-doc.helpers';

/**
 * Purchase agents (MST-05, menu 28 "Agents Master"). An agent IS a ledger, like a supplier:
 * pur_agent.pag_id = acc_ledger_master.led_id (fk_pag_ledger). Create provisions the ledger
 * under Sundry Creditors (his commission is owed to him) and the agent row in one transaction;
 * a rename renames the ledger — the agent's name is the ledger's, never edited apart.
 * Deactivate switches both off; nothing is deleted (a PO / bill may name the agent).
 */
export const AGENT_MENU_ID = 28;
/** accounts.acc_group_master "Sundry Creditors" (shared) — the parent of Suppliers. */
const AGENT_LEDGER_GROUP_ID = '019eee86-f34b-7d73-8a79-f5c6f036439a';

const trimOrNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export class SaveAgentDto {
  @ApiPropertyOptional({ description: 'Present = update that agent (= its ledger id).' }) @IsOptional() @IsUUID() pagId?: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) code?: string;
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) alias?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) mobile1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) mobile2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addr1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addr2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) pincode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) panNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) gstin?: string;
  @ApiPropertyOptional({ description: 'Commission % the agent usually earns (charged as a purchase charge).' })
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultCommPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class AgentRefDto {
  @ApiProperty() @IsUUID() pagId!: string;
}
export class AgentActiveDto extends AgentRefDto {
  @ApiProperty() @IsBoolean() active!: boolean;
}

@Injectable()
export class PurchaseAgentService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService,
              private readonly ledgers: AccountLedgerMastersService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }

  async save(dto: SaveAgentDto) {
    const actor = this.actor();
    const name = dto.name.replace(/\s+/g, ' ').trim();
    if (!name) purRefuse('Give the agent a name.', PUR.QTY_INVALID, 'name');
    const gstin = trimOrNull(dto.gstin)?.toUpperCase() ?? null;
    if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) purRefuse('GSTIN is 15 characters, starting with the 2-digit state code.', PUR.QTY_INVALID, 'gstin');
    const pan = trimOrNull(dto.panNo)?.toUpperCase() ?? null;
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) purRefuse('PAN is 10 characters: 5 letters, 4 digits, a letter.', PUR.QTY_INVALID, 'panNo');
    const id = await this.prisma.$transaction(async (tx) => {
      const [dup] = await tx.$queryRaw<{ pag_id: string }[]>`
        SELECT pag_id FROM purchase.pur_agent
         WHERE upper(pag_name) = upper(${name}) AND NOT pag_is_deleted
           AND (pag_company_id IS NULL OR pag_company_id = ${dto.companyId}::uuid)
           AND (${dto.pagId ?? null}::uuid IS NULL OR pag_id <> ${dto.pagId ?? null}::uuid) LIMIT 1`;
      if (dup) purConflict(`An agent named "${name}" already exists.`, 'PUR_AGENT_NAME_EXISTS', 'name');
      const data = {
        pagCompanyId: dto.companyId, pagCode: trimOrNull(dto.code), pagName: name, pagAlias: trimOrNull(dto.alias),
        pagMobile1: trimOrNull(dto.mobile1), pagMobile2: trimOrNull(dto.mobile2), pagAddr1: trimOrNull(dto.addr1), pagAddr2: trimOrNull(dto.addr2),
        pagCity: trimOrNull(dto.city), pagDistrict: trimOrNull(dto.district), pagState: trimOrNull(dto.state), pagPincode: trimOrNull(dto.pincode),
        pagPanNo: pan, pagGstin: gstin, pagDefaultCommPct: dto.defaultCommPct === undefined || dto.defaultCommPct === null ? null : D(dto.defaultCommPct),
        pagRemarks: trimOrNull(dto.remarks), pagIsActive: dto.isActive ?? true,
      };
      if (!dto.pagId) {
        // the ledger first: its id is the agent's
        const ledger = await this.ledgers.createLedgerWithinTx({
          ledGroupId: AGENT_LEDGER_GROUP_ID, ledName: name, ledCompanyId: dto.companyId,
          ledPhone1: data.pagMobile1, ledPhone2: data.pagMobile2, ledIsBillByBill: true,
        } as never, tx);
        const ledId = (ledger as unknown as { ledId: string }).ledId;
        await tx.purAgent.create({ data: { pagId: ledId, ...data, pagCreatedBy: actor } });
        return ledId;
      }
      const cur = await tx.purAgent.findFirst({ where: { pagId: dto.pagId, pagIsDeleted: false } });
      if (!cur) purNotFound(`Agent ${dto.pagId} not found`);
      await tx.purAgent.update({ where: { pagId: dto.pagId }, data: { ...data, pagModifiedBy: actor, pagModifiedOn: new Date() } });
      // the name and phones live on the ledger too — one name, never two
      const led = await tx.accLedgerMaster.findFirst({ where: { ledId: dto.pagId, ledIsDeleted: false }, select: { ledGroupId: true } });
      if (led) {
        await this.ledgers.updateLedgerWithinTx({
          ledId: dto.pagId, ledGroupId: led.ledGroupId, ledName: name, ledCompanyId: dto.companyId,
          ledPhone1: data.pagMobile1, ledPhone2: data.pagMobile2, ledIsActive: data.pagIsActive,
        } as never, tx);
      }
      return dto.pagId;
    }, { timeout: 30000, maxWait: 10000 });
    return this.get(id);
  }

  async setActive(dto: AgentActiveDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.purAgent.findFirst({ where: { pagId: dto.pagId, pagIsDeleted: false } });
      if (!cur) purNotFound(`Agent ${dto.pagId} not found`);
      await tx.purAgent.update({ where: { pagId: dto.pagId }, data: { pagIsActive: dto.active, pagModifiedBy: actor, pagModifiedOn: new Date() } });
      await tx.accLedgerMaster.updateMany({ where: { ledId: dto.pagId, ledIsDeleted: false }, data: { ledIsActive: dto.active, ledModifiedBy: actor, ledModifiedOn: new Date() } });
    });
    return this.get(dto.pagId);
  }

  async get(pagId: string) {
    const [row] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT a.*, l.led_name, g.acc_group_name AS ledger_group,
             (SELECT count(*) FROM purchase.pur_order o WHERE o.po_agent_id = a.pag_id AND NOT o.po_is_deleted) AS po_count,
             (SELECT count(*) FROM purchase.pur_invoice p WHERE p.pi_agent_id = a.pag_id AND NOT p.pi_is_deleted) AS bill_count
        FROM purchase.pur_agent a
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = a.pag_id
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE a.pag_id = ${pagId}::uuid AND NOT a.pag_is_deleted`;
    if (!row) purNotFound(`Agent ${pagId} not found`);
    return jsonSafe(row);
  }
}

@ApiTags('Purchase — Agents')
@ApiBearerAuth()
@Controller('purchase/agents')
export class PurchaseAgentController {
  constructor(private readonly service: PurchaseAgentService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: AGENT_MENU_ID, right, codePrefix: 'AGT', action });
  }
  @Post('save') @Version(API_VERSION)
  @ApiOperation({ summary: 'Create an agent (and his ledger under Sundry Creditors, one id) or update one (the ledger is renamed with him).' })
  async save(@Body() dto: SaveAgentDto) {
    await this.right(dto.pagId ? 'edit' : 'create', 'save an agent');
    const data = await this.service.save(dto);
    return { success: true, message: `Agent ${String((data as Record<string, unknown>).pag_name)} saved`, data };
  }
  @Post('active') @Version(API_VERSION) @ApiOperation({ summary: 'Switch an agent (and his ledger) on or off.' })
  async active(@Body() dto: AgentActiveDto) {
    await this.right('edit', 'switch an agent on or off');
    const data = await this.service.setActive(dto);
    return { success: true, message: dto.active ? 'Agent reactivated' : 'Agent deactivated', data };
  }
  @Get('get') @Version(API_VERSION) @ApiOperation({ summary: 'One agent with his ledger and how many POs / bills name him.' })
  async get(@Query() q: AgentRefDto) {
    await this.right('view', 'open an agent');
    return { success: true, message: 'Agent fetched', data: await this.service.get(q.pagId) };
  }
}
