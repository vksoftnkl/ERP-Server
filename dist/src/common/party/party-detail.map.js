"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTY_REQUIRED_FIELDS = exports.PARTY_DETAIL_FIELDS = void 0;
exports.roleKeyOf = roleKeyOf;
exports.PARTY_DETAIL_FIELDS = [
    { cus: 'cusShort', sup: 'supShort', led: 'ledShort', max: 50 },
    { cus: 'cusAddr1', sup: 'supAddr1', led: 'ledAddr1', max: 200 },
    { cus: 'cusAddr2', sup: 'supAddr2', led: 'ledAddr2', max: 200 },
    { cus: 'cusAddr3', sup: 'supAddr3', led: 'ledAddr3', max: 200 },
    { cus: 'cusCity', sup: 'supCity', led: 'ledCity', max: 100 },
    { cus: 'cusDistrict', sup: 'supDistrict', led: 'ledDistrict', max: 100 },
    { cus: 'cusCountry', sup: 'supCountry', led: 'ledCountry', max: 60 },
    { cus: 'cusPin', sup: 'supPincode', led: 'ledPin', max: 10 },
    { cus: 'cusTel', sup: 'supTel', led: 'ledTel', max: 20 },
    { cus: 'cusPhone1', sup: 'supPhone', led: 'ledPhone1', max: 20 },
    { cus: 'cusPhone2', sup: null, led: 'ledPhone2', max: 20 },
    { cus: 'cusWhatsappNo', sup: 'supWhatsappNo', led: 'ledWhatsappNo', max: 20 },
    { cus: 'cusEmail', sup: 'supMailId', led: 'ledEmail', max: 120 },
    { cus: 'cusContactPerson', sup: null, led: 'ledContactPerson', max: 150 },
    { cus: 'cusAadharNo', sup: null, led: 'ledAadharNo', max: 12 },
    { cus: 'cusGstNo', sup: 'supGstNo', led: 'ledGstinNo', max: 15 },
    { cus: 'cusPanNo', sup: 'supPanNo', led: 'ledPanNo', max: 10 },
    { cus: 'cusEcommerceGstin', sup: null, led: 'ledEcommerceGstin', max: 15 },
    { cus: 'cusRegionName', sup: 'supRegionName', led: 'ledRegionName', max: 200 },
    { cus: 'cusRegionAddr1', sup: 'supRegionAddr1', led: 'ledRegionAddr1', max: 200 },
    { cus: 'cusRegionAddr2', sup: 'supRegionAddr2', led: 'ledRegionAddr2', max: 200 },
    { cus: 'cusRegionAddr3', sup: 'supRegionAddr3', led: 'ledRegionAddr3', max: 200 },
    { cus: 'cusRegionCity', sup: 'supRegionCity', led: 'ledRegionCity', max: 100 },
    { cus: 'cusRegionDistrict', sup: 'supRegionDistrict', led: 'ledRegionDistrict', max: 100 },
    { cus: 'cusRegionStateName', sup: 'supRegionStateName', led: 'ledRegionStateName', max: 100 },
    { cus: 'cusRegionCountry', sup: 'supRegionCountry', led: 'ledRegionCountry', max: 60 },
    { cus: 'cusCompanyId', sup: 'supCompanyId', led: 'ledCompanyId', max: null },
    { cus: 'cusBranchId', sup: 'supBranchId', led: 'ledBranchId', max: null },
];
exports.PARTY_REQUIRED_FIELDS = [
    { cus: 'cusName', sup: 'supName', led: 'ledName', max: 200 },
    { cus: 'cusStateName', sup: 'supStateName', led: 'ledStateName', max: 100 },
    { cus: 'cusStateCode', sup: 'supStateCode', led: 'ledStateCode', max: 2 },
];
function roleKeyOf(field, role) {
    return role === 'CUSTOMER' ? field.cus : field.sup;
}
//# sourceMappingURL=party-detail.map.js.map