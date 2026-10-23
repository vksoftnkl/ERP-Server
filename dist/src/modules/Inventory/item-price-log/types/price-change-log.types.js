"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_ORIGIN = exports.PRICE_MENU_ID = exports.PRICE_CHANGE_SOURCES = exports.PRICE_CHANGE_ACTIONS = exports.PRICE_TABLES = void 0;
exports.PRICE_TABLES = ['IPM', 'IQP'];
exports.PRICE_CHANGE_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'REKEY'];
exports.PRICE_CHANGE_SOURCES = [
    'ITEM_CARD',
    'CHANGE_SELLING_PRICE',
    'QTY_PRICE',
    'BUCKET_REKEY',
    'IMPORT',
];
exports.PRICE_MENU_ID = {
    ITEM_MASTER: 29,
    CHANGE_SELLING_PRICE: 30,
    QTY_PRICE: 244,
    PRICE_CHANGE_LOG: 290,
};
exports.PRICE_ORIGIN = {
    ITEM_CARD: { source: 'ITEM_CARD', menuId: exports.PRICE_MENU_ID.ITEM_MASTER },
    CHANGE_SELLING_PRICE: {
        source: 'CHANGE_SELLING_PRICE',
        menuId: exports.PRICE_MENU_ID.CHANGE_SELLING_PRICE,
    },
    QTY_PRICE: { source: 'QTY_PRICE', menuId: exports.PRICE_MENU_ID.QTY_PRICE },
    BUCKET_REKEY: { source: 'BUCKET_REKEY', menuId: exports.PRICE_MENU_ID.ITEM_MASTER },
};
//# sourceMappingURL=price-change-log.types.js.map