import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { joinAddress, toDateOnly, toText } from '../provider.utils';

/**
 * The letterhead block: who is issuing the document.
 *
 * Scoped to ctx.companyId and nothing else — a template cannot ask for another
 * company's profile because it cannot express the request.
 */
@Injectable()
@ReportDataProvider('company.profile', {
  label: 'Company profile',
  cardinality: 'one',
})
export class CompanyProfileProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
    return [
      { name: 'code', type: 'string', label: 'Company code' },
      { name: 'name', type: 'string', label: 'Company name' },
      { name: 'legalName', type: 'string', label: 'Legal name' },
      { name: 'shortName', type: 'string', label: 'Short name' },
      { name: 'gstin', type: 'string', label: 'GSTIN' },
      { name: 'gstRegType', type: 'string', label: 'GST registration type' },
      { name: 'pan', type: 'string', label: 'PAN' },
      { name: 'tan', type: 'string', label: 'TAN' },
      { name: 'cin', type: 'string', label: 'CIN' },
      { name: 'fssai', type: 'string', label: 'FSSAI number' },
      { name: 'drugLicenseNo', type: 'string', label: 'Drug licence number' },
      { name: 'addressLine1', type: 'string', label: 'Address line 1' },
      { name: 'addressLine2', type: 'string', label: 'Address line 2' },
      { name: 'addressLine3', type: 'string', label: 'Address line 3' },
      { name: 'addressBlock', type: 'string', label: 'Address (one line)' },
      { name: 'city', type: 'string', label: 'City' },
      { name: 'district', type: 'string', label: 'District' },
      { name: 'state', type: 'string', label: 'State' },
      { name: 'stateCode', type: 'string', label: 'State code' },
      { name: 'pin', type: 'string', label: 'PIN code' },
      { name: 'country', type: 'string', label: 'Country' },
      { name: 'phone', type: 'string', label: 'Phone' },
      { name: 'tel', type: 'string', label: 'Telephone' },
      { name: 'email', type: 'string', label: 'E-mail' },
      { name: 'website', type: 'string', label: 'Website' },
      { name: 'currencyCode', type: 'string', label: 'Currency code' },
      { name: 'currencySymbol', type: 'string', label: 'Currency symbol' },
      { name: 'billGreeting', type: 'string', label: 'Bill greeting' },
      { name: 'authorisedSignatory', type: 'string', label: 'Authorised signatory' },
      { name: 'gstApplicable', type: 'boolean', label: 'GST applicable' },
      { name: 'einvoiceApplicable', type: 'boolean', label: 'E-invoice applicable' },
      { name: 'ewayApplicable', type: 'boolean', label: 'E-way bill applicable' },
      { name: 'finYearFrom', type: 'date', label: 'Financial year from', format: 'dd-MM-yyyy' },
      { name: 'finYearTo', type: 'date', label: 'Financial year to', format: 'dd-MM-yyyy' },
    ];
  }

  async resolve(context: ReportContext): Promise<ReportRow> {
    const company = await this.prisma.company.findFirst({
      where: { compId: context.companyId, compIsDeleted: false },
      select: {
        compCode: true,
        compName: true,
        compLegalName: true,
        compShort: true,
        compGstinNo: true,
        compGstRegType: true,
        compPanNo: true,
        compTanNo: true,
        compCinNo: true,
        compFssaiNo: true,
        compDrugLicenseNo: true,
        compAddr1: true,
        compAddr2: true,
        compAddr3: true,
        compCity: true,
        compDistrict: true,
        compState: true,
        compStateCode: true,
        compPin: true,
        compCountry: true,
        compPhone: true,
        compTel: true,
        compMail: true,
        compWebsiteName: true,
        compCurrencyCode: true,
        compCurrencySymbol: true,
        compBillGreeting: true,
        compAuthorizeSignature: true,
        compGstApplicable: true,
        compEinvoiceApplicable: true,
        compEwayApplicable: true,
        compFinYearFrom: true,
        compFinYearTo: true,
      },
    });

    if (!company) {
      // Return the empty shape rather than throwing. A missing company row on a
      // document that exists is a data problem, and blanking the letterhead is
      // a better failure than refusing to print the invoice at all.
      return this.emptyRow();
    }

    return {
      code: toText(company.compCode),
      name: toText(company.compName),
      legalName: toText(company.compLegalName || company.compName),
      shortName: toText(company.compShort),
      gstin: toText(company.compGstinNo),
      gstRegType: toText(company.compGstRegType),
      pan: toText(company.compPanNo),
      tan: toText(company.compTanNo),
      cin: toText(company.compCinNo),
      fssai: toText(company.compFssaiNo),
      drugLicenseNo: toText(company.compDrugLicenseNo),
      addressLine1: toText(company.compAddr1),
      addressLine2: toText(company.compAddr2),
      addressLine3: toText(company.compAddr3),
      addressBlock: joinAddress(
        company.compAddr1,
        company.compAddr2,
        company.compAddr3,
        company.compCity,
        company.compPin ? String(company.compPin) : null,
      ),
      city: toText(company.compCity),
      district: toText(company.compDistrict),
      state: toText(company.compState),
      stateCode: toText(company.compStateCode),
      pin: company.compPin === null ? '' : String(company.compPin),
      country: toText(company.compCountry),
      phone: toText(company.compPhone),
      tel: toText(company.compTel),
      email: toText(company.compMail),
      website: toText(company.compWebsiteName),
      currencyCode: toText(company.compCurrencyCode),
      currencySymbol: toText(company.compCurrencySymbol || '₹'),
      billGreeting: toText(company.compBillGreeting),
      authorisedSignatory: toText(company.compAuthorizeSignature),
      gstApplicable: company.compGstApplicable,
      einvoiceApplicable: company.compEinvoiceApplicable,
      ewayApplicable: company.compEwayApplicable,
      finYearFrom: toDateOnly(company.compFinYearFrom),
      finYearTo: toDateOnly(company.compFinYearTo),
    };
  }

  sampleData(): ReportRow {
    return {
      code: 'VKN',
      name: 'Sri Lakshmi Venkateswara Traders',
      legalName: 'Sri Lakshmi Venkateswara Traders',
      shortName: 'SLV Traders',
      gstin: '33AABCU9603R1ZM',
      gstRegType: 'REGULAR',
      pan: 'AABCU9603R',
      tan: 'CHEU12345B',
      cin: '',
      fssai: '12419011000123',
      drugLicenseNo: '',
      addressLine1: '142, Trichy Main Road',
      addressLine2: 'Near Bus Stand',
      addressLine3: '',
      addressBlock: '142, Trichy Main Road, Near Bus Stand, Salem, 636001',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      stateCode: '33',
      pin: '636001',
      country: 'India',
      phone: '9876543210',
      tel: '0427-2345678',
      email: 'accounts@slvtraders.example',
      website: 'www.slvtraders.example',
      currencyCode: 'INR',
      currencySymbol: '₹',
      billGreeting: 'Thank you for your business',
      authorisedSignatory: 'For Sri Lakshmi Venkateswara Traders',
      gstApplicable: true,
      einvoiceApplicable: true,
      ewayApplicable: true,
      finYearFrom: '2026-04-01',
      finYearTo: '2027-03-31',
    };
  }

  private emptyRow(): ReportRow {
    return Object.fromEntries(
      this.fields().map((field) => [
        field.name,
        field.type === 'boolean' ? false : field.type === 'number' ? 0 : '',
      ]),
    );
  }
}
