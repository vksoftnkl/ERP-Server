import { Injectable, NotFoundException } from '@nestjs/common';
import { HsnMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { GetHsnCodeMasterQueryDto } from './dto/get-hsn-code-master-query.dto';
import {
  HsnCodeMasterGetMeta,
  HsnCodeMasterPayload,
} from './types/hsn-code-master-api.types';

type HsnCodeRecord = Pick<
  HsnMaster,
  | 'hsnId'
  | 'hsnCode'
  | 'hsnName'
  | 'hsnDescription'
  | 'hsnIsService'
  | 'hsnUqc'
  | 'hsnIsActive'
  | 'hsnRateOfTax'
>;

@Injectable()
export class HsnCodeMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    queryDto: GetHsnCodeMasterQueryDto,
  ): Promise<{ items: HsnCodeMasterPayload[]; meta: HsnCodeMasterGetMeta }> {
    const activeOnly = queryDto.activeOnly ?? true;
    const normalizedHsnCode = queryDto.hsnCode?.trim();

    const where: Prisma.HsnMasterWhereInput = {};
    if (queryDto.hsnId !== undefined) {
      where.hsnId = queryDto.hsnId;
    }
    if (normalizedHsnCode) {
      where.hsnCode = {
        equals: normalizedHsnCode,
        mode: 'insensitive',
      };
    }
    if (activeOnly) {
      where.hsnIsActive = true;
    }

    const records = await this.prisma.hsnMaster.findMany({
      where,
      orderBy: [{ hsnCode: 'asc' }, { hsnId: 'asc' }],
      select: {
        hsnId: true,
        hsnCode: true,
        hsnName: true,
        hsnDescription: true,
        hsnIsService: true,
        hsnUqc: true,
        hsnIsActive: true,
        hsnRateOfTax: true,
      },
    });

    if ((queryDto.hsnId !== undefined || normalizedHsnCode) && records.length === 0) {
      throw new NotFoundException(
        `HSN code not found for filters hsnId=${queryDto.hsnId ?? 'NA'}, hsnCode=${normalizedHsnCode ?? 'NA'}`,
      );
    }

    const items = records.map((record) => this.toPayload(record));

    return {
      items,
      meta: {
        hsnId: queryDto.hsnId,
        hsnCode: normalizedHsnCode,
        activeOnly,
        count: items.length,
      },
    };
  }

  private toPayload(record: HsnCodeRecord): HsnCodeMasterPayload {
    return {
      hsnId: record.hsnId,
      hsnCode: record.hsnCode,
      hsnName: record.hsnName,
      hsnDescription: record.hsnDescription,
      hsnIsService: record.hsnIsService,
      hsnUqc: record.hsnUqc,
      hsnIsActive: record.hsnIsActive,
      hsnRateOfTax: Number(record.hsnRateOfTax),
    };
  }
}
