"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IST_CLOCK_SQL_FORMAT = void 0;
exports.istClockText = istClockText;
exports.IST_CLOCK_SQL_FORMAT = 'DD-MM-YYYY HH12:MI AM';
function istClockText(instant) {
    const date = instant instanceof Date ? instant : new Date(instant);
    if (Number.isNaN(date.getTime())) {
        return String(instant);
    }
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const p = (type) => parts.find((x) => x.type === type)?.value ?? '';
    const hour = Number(p('hour')) % 24;
    const h12 = String(hour % 12 || 12).padStart(2, '0');
    return `${p('day')}-${p('month')}-${p('year')} ${h12}:${p('minute')} ${hour < 12 ? 'AM' : 'PM'}`;
}
//# sourceMappingURL=ist-clock.util.js.map