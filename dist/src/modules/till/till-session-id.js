"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tillSessionIdOrNull = tillSessionIdOrNull;
async function tillSessionIdOrNull(client, sessionId) {
    if (sessionId === undefined || sessionId === null) {
        return sessionId;
    }
    const session = await client.tillSession.findFirst({
        where: { tssId: sessionId, tssIsDeleted: false },
        select: { tssId: true },
    });
    return session ? sessionId : null;
}
//# sourceMappingURL=till-session-id.js.map