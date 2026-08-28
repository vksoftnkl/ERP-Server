"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCanvasFixture = loadCanvasFixture;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function loadCanvasFixture(name) {
    return JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, `${name}.json`), 'utf8'));
}
//# sourceMappingURL=load-fixture.js.map