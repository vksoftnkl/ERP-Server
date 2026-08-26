import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { joinAddress, toText } from '../provider.utils';

/**
 * The issuing branch.
 *
 * Distinct from company.profile because a multi-branch dealer's invoice must
 * show the BRANCH GSTIN and address — that is the registered place of business
 * the supply was made from, and printing the head-office one is a defect on the
 * face of the document.
 */
@Injectable()
@ReportDataProvider('branch.profile', {
  label: 'Branch profile',
  cardinality: 'one',
})
export class BranchProfileProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
    return [
      { name: 'code', type: 'string', label: 'Branch code' },
      { name: 'name', type: 'string', label: 'Branch name' },
      { name: 'mailingName', type: 'string', label: 'Mailing name' },
      { name: 'shortName', type: 'string', label: 'Short name' },
      { name: 'gstin', type: 'string', label: 'Branch GSTIN' },
      { name: 'gstRegType', type: 'string', label: 'GST registration type' },
      { name: 'pan', type: 'string', label: 'PAN' },
      { name: 'addressLine1', type: 'string', label: 'Address line 1' },
      { name: 'addressLine2', type: 'string', label: 'Address line 2' },
      { name: 'addressLine3', type: 'string', label: 'Address line 3' },
      { name: 'addressBlock', type: 'string', label: 'Address (one line)' },
      { name: 'city', type: 'string', label: 'City' },
      { name: 'district', type: 'string', label: 'District' },
      { name: 'state', type: 'string', label: 'State' },
      { name: 'stateCode', type: 'string', label: 'State code' },
      { name: 'pin', type: 'string', label: 'PIN code' },
      { name: 'landmark', type: 'string', label: 'Landmark' },
      { name: 'contactPerson', type: 'string', label: 'Contact person' },
      { name: 'phone', type: 'string', label: 'Phone' },
      { name: 'tel', type: 'string', label: 'Telephone' },
      { name: 'email', type: 'string', label: 'E-mail' },
      { name: 'billGreeting', type: 'string', label: 'Bill greeting' },
      { name: 'terms', type: 'string', label: 'Terms and conditions' },
      { name: 'fssai', type: 'string', label: 'FSSAI number' },
    ];
  }

  async resolve(context: ReportContext): Promise<ReportRow> {
    // A company-level report has no branch. Return blanks rather than picking
    // an arbitrary branch, which would put the wrong GSTIN on the page.
    if (!context.branchId) {
      return this.emptyRow();
    }

    const branch = await this.prisma.branchMaster.findFirst({
      where: {
        brId: context.branchId,
        brCompId: context.companyId,
        brIsDeleted: false,
      },
      select: {
        brCode: true,
        brName: true,
        brMailingName: true,
        brShort: true,
        brGstinNo: true,
        brGstRegType: true,
        brPanNo: true,
        brAddr1: true,
        brAddr2: true,
        brAddr3: true,
        brCity: true,
        brDistrict: true,
        brState: true,
        brStateCode: true,
        brPin: true,
        brLandmark: true,
        brContactPerson: true,
        brPhone: true,
        brTel: true,
        brMail: true,
        brBillGreeting: true,
        brTerms: true,
        brFssaiNo: true,
      },
    });

    if (!branch) {
      return this.emptyRow();
    }

    return {
      code: toText(branch.brCode),
      name: toText(branch.brName),
      mailingName: toText(branch.brMailingName || branch.brName),
      shortName: toText(branch.brShort),
      gstin: toText(branch.brGstinNo),
      gstRegType: toText(branch.brGstRegType),
      pan: toText(branch.brPanNo),
      addressLine1: toText(branch.brAddr1),
      addressLine2: toText(branch.brAddr2),
      addressLine3: toText(branch.brAddr3),
      addressBlock: joinAddress(
        branch.brAddr1,
        branch.brAddr2,
        branch.brAddr3,
        branch.brCity,
        branch.brPin ? String(branch.brPin) : null,
      ),
      city: toText(branch.brCity),
      district: toText(branch.brDistrict),
      state: toText(branch.brState),
      stateCode: toText(branch.brStateCode),
      pin: branch.brPin === null ? '' : String(branch.brPin),
      landmark: toText(branch.brLandmark),
      contactPerson: toText(branch.brContactPerson),
      phone: toText(branch.brPhone),
      tel: toText(branch.brTel),
      email: toText(branch.brMail),
      billGreeting: toText(branch.brBillGreeting),
      terms: toText(branch.brTerms),
      fssai: toText(branch.brFssaiNo),
    };
  }

  sampleData(): ReportRow {
    return {
      code: 'SLM',
      name: 'Salem Main Branch',
      mailingName: 'Salem Main Branch',
      shortName: 'SLM',
      gstin: '33AABCU9603R1ZM',
      gstRegType: 'REGULAR',
      pan: 'AABCU9603R',
      addressLine1: '142, Trichy Main Road',
      addressLine2: 'Near Bus Stand',
      addressLine3: '',
      addressBlock: '142, Trichy Main Road, Near Bus Stand, Salem, 636001',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      stateCode: '33',
      pin: '636001',
      landmark: 'Opposite Head Post Office',
      contactPerson: 'R. Muthu',
      phone: '9876543210',
      tel: '0427-2345678',
      email: 'salem@slvtraders.example',
      billGreeting: 'Goods once sold will not be taken back',
      terms: '1. Payment within credit period.\n2. Subject to Salem jurisdiction.',
      fssai: '12419011000123',
    };
  }

  private emptyRow(): ReportRow {
    return Object.fromEntries(this.fields().map((field) => [field.name, '']));
  }
}
