import { Injectable } from '@nestjs/common';
import { TillPrintService, type TillPrintDoc } from '../../../../till/services/till-print.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { requireDocument } from './provider.utils';

/**
 * Notes 117 §7 — the till's print documents (purposes TILL_SESSION_Z,
 * TILL_SESSION_X, TILL_DAY_Z). The rows come from TillPrintService, built on
 * the very payloads /till/sessions/get and /till/days/get answer with, so a
 * print shows what the screen does: a live blind session printed by its own
 * cashier has no expected figure. docId = tss_id / tbd_id, accYear = the
 * document's own year. The field names are listed in src/modules/till/README.md
 * ("Printing"): a provider dataset has no field list in the designer.
 */
function docOf(request: ProviderRequest, code: string): TillPrintDoc {
  const { docId, accYear } = requireDocument(request, code);
  return {
    companyId: request.context.companyId,
    docId,
    accYear,
    userId: request.context.userId,
  };
}

@Injectable()
export class TillSessionHeaderProvider implements PrintDataProvider {
  readonly code = 'till.session.header';
  readonly label = 'Till session — header (Z / X)';
  readonly cardinality = 'one' as const;
  constructor(private readonly till: TillPrintService) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return this.till.sessionHeader(docOf(request, this.code));
  }
}

@Injectable()
export class TillSessionTendersProvider implements PrintDataProvider {
  readonly code = 'till.session.tenders';
  readonly label = 'Till session — tenders';
  readonly cardinality = 'many' as const;
  constructor(private readonly till: TillPrintService) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.till.sessionTenders(docOf(request, this.code))).slice(0, request.rowLimit);
  }
}

@Injectable()
export class TillSessionMovementsProvider implements PrintDataProvider {
  readonly code = 'till.session.movements';
  readonly label = 'Till session — movements';
  readonly cardinality = 'many' as const;
  constructor(private readonly till: TillPrintService) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.till.sessionMovements(docOf(request, this.code))).slice(0, request.rowLimit);
  }
}

@Injectable()
export class TillDayHeaderProvider implements PrintDataProvider {
  readonly code = 'till.day.header';
  readonly label = 'Business day — header (day X / store Z)';
  readonly cardinality = 'one' as const;
  constructor(private readonly till: TillPrintService) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return this.till.dayHeader(docOf(request, this.code));
  }
}

@Injectable()
export class TillDaySessionsProvider implements PrintDataProvider {
  readonly code = 'till.day.sessions';
  readonly label = 'Business day — sessions';
  readonly cardinality = 'many' as const;
  constructor(private readonly till: TillPrintService) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.till.daySessions(docOf(request, this.code))).slice(0, request.rowLimit);
  }
}

@Injectable()
export class TillDayTendersProvider implements PrintDataProvider {
  readonly code = 'till.day.tenders';
  readonly label = 'Business day — tenders';
  readonly cardinality = 'many' as const;
  constructor(private readonly till: TillPrintService) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.till.dayTenders(docOf(request, this.code))).slice(0, request.rowLimit);
  }
}

/** The six, for print-render.module.ts's explicit registry. */
export const TILL_PRINT_PROVIDERS = [
  TillSessionHeaderProvider,
  TillSessionTendersProvider,
  TillSessionMovementsProvider,
  TillDayHeaderProvider,
  TillDaySessionsProvider,
  TillDayTendersProvider,
] as const;
