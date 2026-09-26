"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStream = void 0;
const node_stream_1 = require("node:stream");
const toStream = (bytes) => node_stream_1.Readable.from([bytes]);
exports.toStream = toStream;
//# sourceMappingURL=renderer.types.js.map