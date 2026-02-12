"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryAction = exports.ErrorType = exports.AuctionState = exports.SignalType = exports.VotingPowerType = exports.ProposalType = void 0;
// Governance Types
var ProposalType;
(function (ProposalType) {
    ProposalType["BINARY"] = "binary";
    ProposalType["MULTIPLE_CHOICE"] = "multiple_choice";
    ProposalType["WEIGHTED"] = "weighted";
    ProposalType["RANKED_CHOICE"] = "ranked_choice";
    ProposalType["QUADRATIC"] = "quadratic"; // Quadratic voting
})(ProposalType || (exports.ProposalType = ProposalType = {}));
var VotingPowerType;
(function (VotingPowerType) {
    VotingPowerType["EQUAL"] = "equal";
    VotingPowerType["STAKE_WEIGHTED"] = "stake_weighted";
    VotingPowerType["RARITY_WEIGHTED"] = "rarity_weighted";
})(VotingPowerType || (exports.VotingPowerType = VotingPowerType = {}));
var SignalType;
(function (SignalType) {
    SignalType["YIELD_STRATEGY"] = "yield_strategy";
    SignalType["REVEAL_TIMING"] = "reveal_timing";
    SignalType["COLLECTION_DECISION"] = "collection_decision";
    SignalType["PARAMETER_ADJUSTMENT"] = "parameter_adjustment";
    SignalType["CUSTOM"] = "custom";
})(SignalType || (exports.SignalType = SignalType = {}));
var AuctionState;
(function (AuctionState) {
    AuctionState["CREATED"] = "created";
    AuctionState["COMMITMENT_PHASE"] = "commitment_phase";
    AuctionState["REVEAL_PHASE"] = "reveal_phase";
    AuctionState["FINALIZED"] = "finalized";
    AuctionState["CANCELLED"] = "cancelled";
})(AuctionState || (exports.AuctionState = AuctionState = {}));
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