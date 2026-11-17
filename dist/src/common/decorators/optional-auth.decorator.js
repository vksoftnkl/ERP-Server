"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionalAuth = exports.IS_OPTIONAL_AUTH_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
const OptionalAuth = () => (0, common_1.SetMetadata)(exports.IS_OPTIONAL_AUTH_KEY, true);
exports.OptionalAuth = OptionalAuth;
//# sourceMappingURL=optional-auth.decorator.js.map