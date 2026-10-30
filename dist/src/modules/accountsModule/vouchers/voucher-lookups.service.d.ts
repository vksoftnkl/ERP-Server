import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import type { AdjacentVoucherPayload, ChequeBooksPayload, InstrumentsPayload, LedgerBalancePayload, LedgerPickPayload, OpenBillsPayload, PartyFactsPayload, TaxRatesPayload } from './types/vouchers-api.types';
import type { AdjacentVoucherQueryDto, ChequeBooksQueryDto, InstrumentsQueryDto, LedgerBalanceQueryDto, LedgerPickQueryDto, OpenBillsQueryDto, PartyFactsQueryDto, TaxRatesQueryDto } from './dto/voucher-query.dto';
import { VoucherTypesService } from './voucher-types.service';
export declare class VoucherLookupsService {
    private readonly prisma;
    private readonly requestContext;
    private readonly types;
    constructor(prisma: PrismaService, requestContext: RequestContextService, types: VoucherTypesService);
    private get tx();
    ledgerPick(q: LedgerPickQueryDto): Promise<LedgerPickPayload>;
    ledgerBalance(q: LedgerBalanceQueryDto): Promise<LedgerBalancePayload>;
    partyFacts(q: PartyFactsQueryDto): Promise<PartyFactsPayload>;
    openBills(q: OpenBillsQueryDto): Promise<OpenBillsPayload>;
    taxRates(q: TaxRatesQueryDto): Promise<TaxRatesPayload>;
    chequeBooks(q: ChequeBooksQueryDto): Promise<ChequeBooksPayload>;
    instruments(q: InstrumentsQueryDto): Promise<InstrumentsPayload>;
    adjacent(q: AdjacentVoucherQueryDto): Promise<AdjacentVoucherPayload>;
}
