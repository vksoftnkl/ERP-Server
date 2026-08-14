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
exports.FileLoggerService = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
let FileLoggerService = class FileLoggerService extends common_1.ConsoleLogger {
    logFilePath;
    errorLogFilePath;
    constructor(logFilePath = process.env.LOG_FILE_PATH ?? (0, node_path_1.resolve)(process.cwd(), 'logs/app.log'), errorLogFilePath = process.env.ERROR_LOG_FILE_PATH ?? (0, node_path_1.resolve)(process.cwd(), 'logs/error.log')) {
        super();
        this.logFilePath = (0, node_path_1.resolve)(logFilePath);
        this.errorLogFilePath = (0, node_path_1.resolve)(errorLogFilePath);
        this.ensureLogDirectory();
    }
    log(message, context) {
        super.log(message, context);
        this.writeLine('LOG', message, context);
    }
    error(message, stack, context) {
        super.error(message, stack, context);
        const payload = stack ? `${this.stringify(message)}\n${stack}` : message;
        this.writeLine('ERROR', payload, context, true);
    }
    warn(message, context) {
        super.warn(message, context);
        this.writeLine('WARN', message, context);
    }
    debug(message, context) {
        super.debug(message, context);
        this.writeLine('DEBUG', message, context);
    }
    verbose(message, context) {
        super.verbose(message, context);
        this.writeLine('VERBOSE', message, context);
    }
    fatal(message, context) {
        super.fatal(message, context);
        this.writeLine('FATAL', message, context, true);
    }
    ensureLogDirectory() {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.logFilePath), { recursive: true });
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.errorLogFilePath), { recursive: true });
    }
    writeLine(level, message, context, writeToErrorFile = false) {
        const timestamp = new Date().toISOString();
        const contextLabel = context ? ` [${context}]` : '';
        const line = `${timestamp} ${level}${contextLabel} ${this.stringify(message)}\n`;
        (0, node_fs_1.appendFileSync)(this.logFilePath, line, { encoding: 'utf8' });
        if (writeToErrorFile) {
            (0, node_fs_1.appendFileSync)(this.errorLogFilePath, line, { encoding: 'utf8' });
        }
    }
    stringify(message) {
        if (typeof message === 'string') {
            return message;
        }
        return (0, node_util_1.inspect)(message, { depth: 6, breakLength: Infinity, compact: true });
    }
};
exports.FileLoggerService = FileLoggerService;
exports.FileLoggerService = FileLoggerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, Object])
], FileLoggerService);
//# sourceMappingURL=file-logger.service.js.map