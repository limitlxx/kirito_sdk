"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtomicSwapStatus = exports.BridgeTransactionStatus = void 0;
var BridgeTransactionStatus;
(function (BridgeTransactionStatus) {
    BridgeTransactionStatus["PENDING"] = "pending";
    BridgeTransactionStatus["CONFIRMED"] = "confirmed";
    BridgeTransactionStatus["COMPLETED"] = "completed";
    BridgeTransactionStatus["FAILED"] = "failed";
})(BridgeTransactionStatus || (exports.BridgeTransactionStatus = BridgeTransactionStatus = {}));
var AtomicSwapStatus;
(function (AtomicSwapStatus) {
    AtomicSwapStatus["CREATED"] = "created";
    AtomicSwapStatus["LOCKED"] = "locked";
    AtomicSwapStatus["REDEEMED"] = "redeemed";
    AtomicSwapStatus["REFUNDED"] = "refunded";
})(AtomicSwapStatus || (exports.AtomicSwapStatus = AtomicSwapStatus = {}));
//# sourceMappingURL=bridge.js.map