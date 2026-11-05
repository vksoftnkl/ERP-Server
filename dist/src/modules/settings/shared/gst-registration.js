"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GST_REG_TYPES = void 0;
exports.checkGstin = checkGstin;
exports.GST_REG_TYPES = ['REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ'];
const GSTIN_PATTERN = /^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
function checkGstin(gstin, stateCode, pan, fields) {
    const result = { errors: [], panFromGstin: null };
    if (!gstin) {
        return result;
    }
    if (!GSTIN_PATTERN.test(gstin)) {
        result.errors.push({
            field: fields.gstin,
            message: `${fields.gstin} must be 15 letters or digits: a 2-digit state code, the 10-character PAN, then 3 more`,
        });
        return result;
    }
    const gstinState = gstin.slice(0, 2);
    if (gstinState !== stateCode) {
        result.errors.push({
            field: fields.gstin,
            message: `GSTIN ${gstin} is registered in state ${gstinState}, but ${fields.stateCode} is ${stateCode}`,
        });
    }
    const gstinPan = gstin.slice(2, 12);
    if (PAN_PATTERN.test(gstinPan)) {
        if (!pan) {
            result.panFromGstin = gstinPan;
        }
        else if (pan !== gstinPan) {
            result.errors.push({
                field: fields.pan,
                message: `${fields.pan} ${pan} does not match the PAN in GSTIN ${gstin} (${gstinPan})`,
            });
        }
    }
    return result;
}
//# sourceMappingURL=gst-registration.js.map