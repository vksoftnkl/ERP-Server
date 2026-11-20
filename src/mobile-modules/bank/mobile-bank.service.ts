import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { resolveMobileDevice } from '../common/mobile-scope';
import type { MobileBankListQueryDto } from './dto/mobile-bank.dto';
import type { MobileBank, MobileBankList } from './types/mobile-bank-api.types';

/**
 * GET /mobile/banks/list: the banks a phone cheque can be drawn on, for its
 * Bank dropdown (kept on the phone for offline use). The rows of the desktop's
 * bank popup (grid 111, "POPUP - BANKS"): fixed.bank_master, active and not
 * deleted, by name. The name is what the phone sends as tdBankName, as the
 * desktop stores it: td_bank_name is a varchar, not a key.
 */
@Injectable()
export class MobileBankService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: MobileBankListQueryDto): Promise<MobileBankList> {
    await resolveMobileDevice(this.prisma, query.deviceUid);
    const items = await this.prisma.$queryRaw<MobileBank[]>`
      SELECT b.bnk_id::text AS "bankId", btrim(b.bnk_name) AS name,
             NULLIF(btrim(b.bnk_short_name), '') AS "shortName"
        FROM fixed.bank_master b
       WHERE b.bnk_is_active = true
         AND b.bnk_is_deleted = false
         AND btrim(b.bnk_name) <> ''
       ORDER BY lower(btrim(b.bnk_name)), b.bnk_id`;
    return { items, total: items.length };
  }
}
