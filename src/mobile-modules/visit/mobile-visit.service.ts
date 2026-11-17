import { Injectable } from '@nestjs/common';
import { Prisma, type CustomerVisit } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  isUniqueConstraintError,
  resolveActor,
  throwBadRequest,
  throwConflict,
  throwNotFound,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import { MobileErrorCode } from '../common/mobile-error-codes';
import {
  assertMobileCompany,
  lockMobileClientUuid,
  requireMobileBranch,
  resolveMobileDevice,
  type MobileReadClient,
} from '../common/mobile-scope';
import { CreateMobileVisitDto } from './dto/mobile-visit.dto';
import type { MobileVisitCreateResult } from './types/mobile-visit-api.types';

type StoredVisit = Pick<CustomerVisit, 'cvId' | 'cvClientUuid' | 'cvVisitAt' | 'cvCustId'>;

/** A coordinate as the numeric column takes it: from its text, so no float noise. */
function decimalOrNull(value: number | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined ? null : new Prisma.Decimal(value.toString());
}

/** Check-ins from the phone into sales.customer_visit. Insert-only; safe to resend. */
@Injectable()
export class MobileVisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async create(dto: CreateMobileVisitDto): Promise<MobileVisitCreateResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockMobileClientUuid(tx, 'visit', dto.cvCompanyId, dto.cvClientUuid);
        const stored = await this.findByClientUuid(tx, dto.cvCompanyId, dto.cvClientUuid);
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
        this.assertPositionPair(dto);
        await assertMobileCompany(tx, dto.cvCompanyId, 'cvCompanyId');
        const device = await resolveMobileDevice(tx, dto.deviceUid);
        const branchId = await requireMobileBranch(tx, dto.cvCompanyId, device.devBranchId);
        await this.assertCustomer(tx, dto.cvCustId);
        await this.assertSalesman(tx, dto.cvSalesmanId);
        const userId = this.requestContextService.getUserId();
        const created = await tx.customerVisit.create({
          data: {
            cvCompanyId: dto.cvCompanyId,
            cvBranchId: branchId,
            cvDeviceId: device.devId,
            cvCustId: dto.cvCustId,
            cvSalesmanId: dto.cvSalesmanId,
            cvUserId: userId,
            cvReasonCode: dto.cvReasonCode,
            cvRemarks: dto.cvRemarks ?? null,
            cvLatitude: decimalOrNull(dto.cvLatitude),
            cvLongitude: decimalOrNull(dto.cvLongitude),
            cvGpsAccuracy: decimalOrNull(dto.cvGpsAccuracy),
            cvVisitAt: new Date(dto.cvVisitAt),
            cvClientUuid: dto.cvClientUuid,
            cvCreatedBy: resolveActor(null, userId),
          },
          select: { cvId: true, cvClientUuid: true, cvVisitAt: true, cvCustId: true },
        });
        return this.answer(created, false);
      });
    } catch (error: unknown) {
      // Backstop only (ux_cv_client_uuid): the lock serialises resends.
      if (isUniqueConstraintError(error)) {
        const stored = await this.findByClientUuid(this.prisma, dto.cvCompanyId, dto.cvClientUuid);
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
      }
      throw error;
    }
  }

  /** ck_cv_position, as a coded 400 rather than a raw 23514. */
  private assertPositionPair(dto: CreateMobileVisitDto): void {
    const hasLat = dto.cvLatitude !== null && dto.cvLatitude !== undefined;
    const hasLng = dto.cvLongitude !== null && dto.cvLongitude !== undefined;
    if (hasLat !== hasLng) {
      throwBadRequest<ModuleErrorDetail>('Validation failed', [
        {
          field: hasLat ? 'cvLongitude' : 'cvLatitude',
          message: 'Send cvLatitude and cvLongitude together, or neither.',
          code: MobileErrorCode.VISIT_POSITION_INCOMPLETE,
        },
      ]);
    }
  }

  /** A live customer; an inactive one still takes a visit that happened. */
  private async assertCustomer(client: MobileReadClient, cusId: string): Promise<void> {
    const [row] = await client.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok FROM sales.customers c
       WHERE c.cus_id = ${cusId}::uuid AND c.cus_is_deleted = false`;
    if (!row) {
      throwNotFound<ModuleErrorDetail>(
        'Customer not found',
        'cvCustId',
        `No customer ${cusId}`,
        MobileErrorCode.VISIT_CUSTOMER_NOT_FOUND,
      );
    }
  }

  /** A live employee (employee_master), as so_salesman_id names one. */
  private async assertSalesman(client: MobileReadClient, empId: string): Promise<void> {
    const [row] = await client.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok FROM public.employee_master e
       WHERE e.emp_id = ${empId}::uuid AND e.emp_is_deleted = false`;
    if (!row) {
      throwNotFound<ModuleErrorDetail>(
        'Salesman not found',
        'cvSalesmanId',
        `No employee ${empId}`,
        MobileErrorCode.VISIT_SALESMAN_NOT_FOUND,
      );
    }
  }

  private async findByClientUuid(
    client: Pick<Prisma.TransactionClient, 'customerVisit'>,
    companyId: string,
    clientUuid: string,
  ): Promise<StoredVisit | null> {
    return client.customerVisit.findUnique({
      where: { cvCompanyId_cvClientUuid: { cvCompanyId: companyId, cvClientUuid: clientUuid } },
      select: { cvId: true, cvClientUuid: true, cvVisitAt: true, cvCustId: true },
    });
  }

  /** A resend answers the stored row; the same uuid on another customer is a phone bug: 409. */
  private resendAnswer(stored: StoredVisit, dto: CreateMobileVisitDto): MobileVisitCreateResult {
    if (stored.cvCustId !== dto.cvCustId) {
      throwConflict<ModuleErrorDetail>('Visit id already used', [
        {
          field: 'cvClientUuid',
          message: `cvClientUuid ${dto.cvClientUuid} already names a visit to another customer.`,
          code: MobileErrorCode.CLIENT_UUID_REUSED,
        },
      ]);
    }
    return this.answer(stored, true);
  }

  private answer(row: StoredVisit, duplicate: boolean): MobileVisitCreateResult {
    return {
      cvId: row.cvId,
      cvClientUuid: row.cvClientUuid,
      cvVisitAt: row.cvVisitAt.toISOString(),
      duplicate,
    };
  }
}
