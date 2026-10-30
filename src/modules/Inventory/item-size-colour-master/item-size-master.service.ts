import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { ItemAttributeMasterService } from './item-attribute-master.service';
import { ItemSizeErrorCode } from './types/item-attribute-master.types';

/** `inventory.item_size_master` — `/item-sizes/*`. */
@Injectable()
export class ItemSizeMasterService extends ItemAttributeMasterService {
  constructor(
    prisma: PrismaService,
    auditLogService: AuditLogService,
    requestContextService: RequestContextService,
  ) {
    super(prisma, auditLogService, requestContextService, {
      table: 'item_size_master',
      prefix: 'isz',
      label: 'size',
      auditScreenName: 'Item Size Master',
      restoreRoute: '/item-sizes/restore',
      batchDetailColumn: 'sbd_size_id',
      hasSizeSet: true,
      codes: ItemSizeErrorCode,
    });
  }
}
