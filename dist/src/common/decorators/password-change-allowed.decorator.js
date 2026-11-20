"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowWhilePasswordChangeRequired = exports.PASSWORD_CHANGE_ALLOWED_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PASSWORD_CHANGE_ALLOWED_KEY = 'passwordChangeAllowed';
const AllowWhilePasswordChangeRequired = () => (0, common_1.SetMetadata)(exports.PASSWORD_CHANGE_ALLOWED_KEY, true);
exports.AllowWhilePasswordChangeRequired = AllowWhilePasswordChangeRequired;
//# sourceMappingURL=password-change-allowed.decorator.js.map