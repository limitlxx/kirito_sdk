import { ErrorType, KiritoError, RecoveryAction, RetryStrategy } from '../types';
/**
 * Error Handler Interface
 * Handles different types of errors and recovery strategies
 */
export interface ErrorHandler {
    /**
     * Handle cryptographic errors (invalid proofs, encryption failures)
     */
    handleCryptographicError(error: CryptoError): Promise<RecoveryAction>;
    /**
     * Handle network errors (RPC failures, timeouts)
     */
    handleNetworkError(error: NetworkError): Promise<RetryStrategy>;
    /**
     * Handle business logic errors (invalid amounts, unauthorized operations)
     */
    handleBusinessLogicError(error: BusinessError): Promise<UserAction>;
    /**
     * Handle privacy errors (proof verification failures, nullifier reuse)
     */
    handlePrivacyError(error: PrivacyError): Promise<SecurityAction>;
    /**
     * Create standardized error
     */
    createError(type: ErrorType, code: string, message: string, details?: any): KiritoError;
    /**
     * Log error with context
     */
    logError(error: KiritoError, context?: any): void;
}
export interface CryptoError extends KiritoError {
    type: ErrorType.CRYPTOGRAPHIC_ERROR;
    cryptoDetails: {
        operation: string;
        algorithm?: string;
        keyId?: string;
    };
}
export interface NetworkError extends KiritoError {
    type: ErrorType.NETWORK_ERROR;
    networkDetails: {
        endpoint: string;
        statusCode?: number;
        timeout?: number;
    };
}
export interface BusinessError extends KiritoError {
    type: ErrorType.BUSINESS_LOGIC_ERROR;
    businessDetails: {
        operation: string;
        invalidInput?: any;
        constraints?: string[];
    };
}
export interface PrivacyError extends KiritoError {
    type: ErrorType.PRIVACY_ERROR;
    privacyDetails: {
        protocol: string;
        proofType?: string;
        nullifier?: string;
    };
}
export interface UserAction {
    type: 'user_input_required' | 'retry_with_changes' | 'abort';
    message: string;
    suggestedActions?: string[];
}
export interface SecurityAction {
    type: 'regenerate_keys' | 'reset_nullifiers' | 'audit_required';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
}
//# sourceMappingURL=error-handler.d.ts.map