import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { ItemAttributeMasterService } from './item-attribute-master.service';
import { ItemColourErrorCode } from './types/item-attribute-master.types';

/** `inventory.item_colour_master` — `/item-colours/*`. */
@Injectable()
export class ItemColourMasterService extends ItemAttributeMasterService {
  constructor(
    prisma: PrismaService,
    auditLogService: AuditLogService,
    requestContextService: RequestContextService,
  ) {
    super(prisma, auditLogService, requestContextService, {
      table: 'item_colour_master',
      prefix: 'icl',
      label: 'colour',
      auditScreenName: 'Item Colour Master',
      restoreRoute: '/item-colours/restore',
      batchDetailColumn: 'sbd_colour_id',
      hasSizeSet: false,
      codes: ItemColourErrorCode,
    });
  }
}
