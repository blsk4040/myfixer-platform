"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutingError = void 0;
class RoutingError extends Error {
    code;
    statusCode;
    constructor(code, message, statusCode = 502) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'RoutingError';
    }
}
exports.RoutingError = RoutingError;
//# sourceMappingURL=routing.types.js.map