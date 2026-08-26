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
exports.BranchProfileProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const report_data_provider_decorator_1 = require("../report-data-provider.decorator");
const provider_utils_1 = require("../provider.utils");
let BranchProfileProvider = class BranchProfileProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    fields() {
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
    async resolve(context) {
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
            code: (0, provider_utils_1.toText)(branch.brCode),
            name: (0, provider_utils_1.toText)(branch.brName),
            mailingName: (0, provider_utils_1.toText)(branch.brMailingName || branch.brName),
            shortName: (0, provider_utils_1.toText)(branch.brShort),
            gstin: (0, provider_utils_1.toText)(branch.brGstinNo),
            gstRegType: (0, provider_utils_1.toText)(branch.brGstRegType),
            pan: (0, provider_utils_1.toText)(branch.brPanNo),
            addressLine1: (0, provider_utils_1.toText)(branch.brAddr1),
            addressLine2: (0, provider_utils_1.toText)(branch.brAddr2),
            addressLine3: (0, provider_utils_1.toText)(branch.brAddr3),
            addressBlock: (0, provider_utils_1.joinAddress)(branch.brAddr1, branch.brAddr2, branch.brAddr3, branch.brCity, branch.brPin ? String(branch.brPin) : null),
            city: (0, provider_utils_1.toText)(branch.brCity),
            district: (0, provider_utils_1.toText)(branch.brDistrict),
            state: (0, provider_utils_1.toText)(branch.brState),
            stateCode: (0, provider_utils_1.toText)(branch.brStateCode),
            pin: branch.brPin === null ? '' : String(branch.brPin),
            landmark: (0, provider_utils_1.toText)(branch.brLandmark),
            contactPerson: (0, provider_utils_1.toText)(branch.brContactPerson),
            phone: (0, provider_utils_1.toText)(branch.brPhone),
            tel: (0, provider_utils_1.toText)(branch.brTel),
            email: (0, provider_utils_1.toText)(branch.brMail),
            billGreeting: (0, provider_utils_1.toText)(branch.brBillGreeting),
            terms: (0, provider_utils_1.toText)(branch.brTerms),
            fssai: (0, provider_utils_1.toText)(branch.brFssaiNo),
        };
    }
    sampleData() {
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
    emptyRow() {
        return Object.fromEntries(this.fields().map((field) => [field.name, '']));
    }
};
exports.BranchProfileProvider = BranchProfileProvider;
exports.BranchProfileProvider = BranchProfileProvider = __decorate([
    (0, common_1.Injectable)(),
    (0, report_data_provider_decorator_1.ReportDataProvider)('branch.profile', {
        label: 'Branch profile',
        cardinality: 'one',
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BranchProfileProvider);
//# sourceMappingURL=branch-profile.provider.js.map