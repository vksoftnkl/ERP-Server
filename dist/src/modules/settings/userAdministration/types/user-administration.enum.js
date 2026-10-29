"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAdminErrorCode = exports.UserType = void 0;
var UserType;
(function (UserType) {
    UserType["SUPER_ADMIN"] = "SUPER ADMIN";
    UserType["ADMIN"] = "ADMIN";
    UserType["HO_FINANCE"] = "HO FINANCE";
    UserType["AREA_MANAGER"] = "AREA MANAGER";
    UserType["STORE_MANAGER"] = "STORE MANAGER";
    UserType["CASH_OFFICE"] = "CASH OFFICE";
    UserType["SUPERVISOR"] = "SUPERVISOR";
    UserType["USER"] = "USER";
    UserType["CASHIER"] = "CASHIER";
    UserType["VIEWER"] = "VIEWER";
    UserType["SYSTEM"] = "SYSTEM";
})(UserType || (exports.UserType = UserType = {}));
var UserAdminErrorCode;
(function (UserAdminErrorCode) {
    UserAdminErrorCode["ROLE_RESERVED"] = "USER_ROLE_RESERVED";
    UserAdminErrorCode["NOT_FOUND"] = "USER_NOT_FOUND";
    UserAdminErrorCode["PASSWORD_REQUIRED"] = "USER_PASSWORD_REQUIRED";
    UserAdminErrorCode["MENU_INVALID"] = "USER_MENU_INVALID";
    UserAdminErrorCode["LOGIN_NAME_TAKEN"] = "USER_LOGIN_NAME_TAKEN";
    UserAdminErrorCode["EMPLOYEE_NOT_FOUND"] = "USER_EMPLOYEE_NOT_FOUND";
    UserAdminErrorCode["EMPLOYEE_OTHER_COMPANY"] = "USER_EMPLOYEE_OTHER_COMPANY";
    UserAdminErrorCode["EMPLOYEE_INACTIVE"] = "USER_EMPLOYEE_INACTIVE";
    UserAdminErrorCode["EMPLOYEE_LINKED"] = "USER_EMPLOYEE_LINKED";
})(UserAdminErrorCode || (exports.UserAdminErrorCode = UserAdminErrorCode = {}));
//# sourceMappingURL=user-administration.enum.js.map