"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryAction = exports.ErrorType = exports.VotingPowerType = void 0;
var VotingPowerType;
(function (VotingPowerType) {
    VotingPowerType["EQUAL"] = "equal";
    VotingPowerType["STAKE_WEIGHTED"] = "stake_weighted";
    VotingPowerType["RARITY_WEIGHTED"] = "rarity_weighted";
})(VotingPowerType || (exports.VotingPowerType = VotingPowerType = {}));
// Error Types
var ErrorType;
(function (ErrorType) {
    ErrorType["CRYPTOGRAPHIC_ERROR"] = "cryptographic_error";
    ErrorType["NETWORK_ERROR"] = "network_error";
    ErrorType["BUSINESS_LOGIC_ERROR"] = "business_logic_error";
    ErrorType["PRIVACY_ERROR"] = "privacy_error";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
// Recovery and Retry Types
var RecoveryAction;
(function (RecoveryAction) {
    RecoveryAction["RETRY_WITH_NEW_RANDOMNESS"] = "retry_with_new_randomness";
    RecoveryAction["REGENERATE_PROOF"] = "regenerate_proof";
    RecoveryAction["FALLBACK_TO_PUBLIC_MODE"] = "fallback_to_public_mode";
    RecoveryAction["ABORT_OPERATION"] = "abort_operation";
})(RecoveryAction || (exports.RecoveryAction = RecoveryAction = {}));
//# sourceMappingURL=index.js.map