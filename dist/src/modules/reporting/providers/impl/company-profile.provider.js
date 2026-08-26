"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyProfileProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const report_data_provider_decorator_1 = require("../report-data-provider.decorator");
const provider_utils_1 = require("../provider.utils");
let CompanyProfileProvider = class CompanyProfileProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    fields() {
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
    async resolve(context) {
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
            return this.emptyRow();
        }
        return {
            code: (0, provider_utils_1.toText)(company.compCode),
            name: (0, provider_utils_1.toText)(company.compName),
            legalName: (0, provider_utils_1.toText)(company.compLegalName || company.compName),
            shortName: (0, provider_utils_1.toText)(company.compShort),
            gstin: (0, provider_utils_1.toText)(company.compGstinNo),
            gstRegType: (0, provider_utils_1.toText)(company.compGstRegType),
            pan: (0, provider_utils_1.toText)(company.compPanNo),
            tan: (0, provider_utils_1.toText)(company.compTanNo),
            cin: (0, provider_utils_1.toText)(company.compCinNo),
            fssai: (0, provider_utils_1.toText)(company.compFssaiNo),
            drugLicenseNo: (0, provider_utils_1.toText)(company.compDrugLicenseNo),
            addressLine1: (0, provider_utils_1.toText)(company.compAddr1),
            addressLine2: (0, provider_utils_1.toText)(company.compAddr2),
            addressLine3: (0, provider_utils_1.toText)(company.compAddr3),
            addressBlock: (0, provider_utils_1.joinAddress)(company.compAddr1, company.compAddr2, company.compAddr3, company.compCity, company.compPin ? String(company.compPin) : null),
            city: (0, provider_utils_1.toText)(company.compCity),
            district: (0, provider_utils_1.toText)(company.compDistrict),
            state: (0, provider_utils_1.toText)(company.compState),
            stateCode: (0, provider_utils_1.toText)(company.compStateCode),
            pin: company.compPin === null ? '' : String(company.compPin),
            country: (0, provider_utils_1.toText)(company.compCountry),
            phone: (0, provider_utils_1.toText)(company.compPhone),
            tel: (0, provider_utils_1.toText)(company.compTel),
            email: (0, provider_utils_1.toText)(company.compMail),
            website: (0, provider_utils_1.toText)(company.compWebsiteName),
            currencyCode: (0, provider_utils_1.toText)(company.compCurrencyCode),
            currencySymbol: (0, provider_utils_1.toText)(company.compCurrencySymbol || '₹'),
            billGreeting: (0, provider_utils_1.toText)(company.compBillGreeting),
            authorisedSignatory: (0, provider_utils_1.toText)(company.compAuthorizeSignature),
            gstApplicable: company.compGstApplicable,
            einvoiceApplicable: company.compEinvoiceApplicable,
            ewayApplicable: company.compEwayApplicable,
            finYearFrom: (0, provider_utils_1.toDateOnly)(company.compFinYearFrom),
            finYearTo: (0, provider_utils_1.toDateOnly)(company.compFinYearTo),
        };
    }
    sampleData() {
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
    emptyRow() {
        return Object.fromEntries(this.fields().map((field) => [
            field.name,
            field.type === 'boolean' ? false : field.type === 'number' ? 0 : '',
        ]));
    }
};
exports.CompanyProfileProvider = CompanyProfileProvider;
exports.CompanyProfileProvider = CompanyProfileProvider = __decorate([
    (0, common_1.Injectable)(),
    (0, report_data_provider_decorator_1.ReportDataProvider)('company.profile', {
        label: 'Company profile',
        cardinality: 'one',
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompanyProfileProvider);
//# sourceMappingURL=company-profile.provider.js.map