"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTargetScope = resolveTargetScope;
function resolveTargetScope(requested, rowScope, branchId) {
    if (requested === 'CHAIN') {
        if (rowScope === 'BRANCH') {
            return {
                targetScope: 'BRANCH',
                targetBranchId: branchId,
                expected: 'UPDATE',
                createsBranchOverride: false,
                switchIgnored: true,
                reason: 'This row is already a branch override, so All branches updates the override in place. ' +
                    'The chain row is not created or changed, and no other branch moves.',
            };
        }
        return {
            targetScope: 'CHAIN',
            targetBranchId: null,
            expected: rowScope === 'CHAIN' ? 'UPDATE' : 'INSERT',
            createsBranchOverride: false,
            switchIgnored: false,
            reason: rowScope === 'CHAIN'
                ? 'The chain row is updated. Every branch without its own override moves with it.'
                : 'A chain row is created. Every branch without its own override will read it.',
        };
    }
    if (rowScope === 'CHAIN') {
        return {
            targetScope: 'BRANCH',
            targetBranchId: branchId,
            expected: 'INSERT',
            createsBranchOverride: true,
            switchIgnored: false,
            reason: 'A branch override is created for this branch. The chain row is left untouched and ' +
                'every other branch keeps reading it.',
        };
    }
    return {
        targetScope: 'BRANCH',
        targetBranchId: branchId,
        expected: rowScope === 'BRANCH' ? 'UPDATE' : 'INSERT',
        createsBranchOverride: false,
        switchIgnored: false,
        reason: rowScope === 'BRANCH'
            ? "This branch's own row is updated. No other branch is affected."
            : 'A row is created for this branch. No other branch is affected.',
    };
}
//# sourceMappingURL=selling-price-scope.helper.js.map