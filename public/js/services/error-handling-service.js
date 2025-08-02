/**
 * Error Handling Service
 * Provides standardized error handling patterns across the application
 */

import { logger } from '../core/config.js';
import { translationManager } from '../utils/translation-manager.js';

export class ErrorHandlingService {
    constructor() {
        this.errorCounts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Standard error categories
     */
    static ErrorTypes = {
        NETWORK: 'network',
        VALIDATION: 'validation',
        USER_INPUT: 'user_input',
        SYSTEM: 'system',
        PERMISSION: 'permission',
        TIMEOUT: 'timeout',
        NOT_FOUND: 'not_found'
    };

    /**
     * Error severity levels
     */
    static Severity = {
        LOW: 'low',       // Minor issues, graceful degradation
        MEDIUM: 'medium', // Significant but recoverable
        HIGH: 'high',     // Major issues requiring user attention
        CRITICAL: 'critical' // System-breaking errors
    };

    /**
     * Wrap async operations with standardized error handling
     * @param {Function} operation - The async operation to wrap
     * @param {Object} options - Error handling options
     * @returns {Promise} - Result or handled error
     */
    async wrapAsyncOperation(operation, options = {}) {
        const {
            errorType = ErrorHandlingService.ErrorTypes.SYSTEM,
            severity = ErrorHandlingService.Severity.MEDIUM,
            retryable = false,
            fallback = null,
            context = 'operation',
            userMessage = null
        } = options;

        let lastError;
        const maxAttempts = retryable ? this.maxRetries : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Log the attempt
                logger.debug(`Attempt ${attempt}/${maxAttempts} failed for ${context}:`, error.message);

                // If this isn't the last attempt and it's retryable, wait and retry
                if (attempt < maxAttempts && retryable) {
                    await this.delay(this.retryDelay * attempt); // Exponential backoff
                    continue;
                }

                // This was the last attempt or not retryable
                break;
            }
        }

        // All attempts failed, handle the error
        return this.handleError(lastError, {
            errorType,
            severity,
            context,
            userMessage,
            fallback,
            attemptCount: maxAttempts
        });
    }

    /**
     * Handle errors with consistent logging and user feedback
     * @param {Error} error - The error to handle
     * @param {Object} options - Handling options
     */
    handleError(error, options = {}) {
        const {
            errorType = ErrorHandlingService.ErrorTypes.SYSTEM,
            severity = ErrorHandlingService.Severity.MEDIUM,
            context = 'unknown',
            userMessage = null,
            fallback = null,
            showToUser = true,
            attemptCount = 1
        } = options;

        // Create standardized error object
        const standardError = this.createStandardError(error, {
            errorType,
            severity,
            context,
            attemptCount
        });

        // Log based on severity
        this.logError(standardError);

        // Track error for analytics
        this.trackError(standardError);

        // Show user feedback if appropriate
        if (showToUser && severity !== ErrorHandlingService.Severity.LOW) {
            this.showUserFeedback(standardError, userMessage);
        }

        // Return fallback or throw based on severity
        if (fallback !== null) {
            logger.debug(`Using fallback for ${context}:`, fallback);
            return fallback;
        }

        if (severity === ErrorHandlingService.Severity.CRITICAL) {
            throw standardError;
        }

        return null;
    }

    /**
     * Create standardized error object
     */
    createStandardError(error, options) {
        const {
            errorType,
            severity,
            context,
            attemptCount
        } = options;

        return {
            message: error.message || 'Unknown error',
            originalError: error,
            type: errorType,
            severity,
            context,
            timestamp: Date.now(),
            attemptCount,
            stack: error.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
    }

    /**
     * Log error based on severity
     */
    logError(standardError) {
        const logMessage = `[${standardError.type.toUpperCase()}] ${standardError.context}: ${standardError.message}`;
        
        switch (standardError.severity) {
            case ErrorHandlingService.Severity.LOW:
                logger.debug(logMessage, standardError);
                break;
            case ErrorHandlingService.Severity.MEDIUM:
                logger.warn(logMessage, standardError);
                break;
            case ErrorHandlingService.Severity.HIGH:
                logger.error(logMessage, standardError);
                break;
            case ErrorHandlingService.Severity.CRITICAL:
                logger.error(`CRITICAL: ${logMessage}`, standardError);
                break;
        }
    }

    /**
     * Track errors for analytics
     */
    trackError(standardError) {
        const key = `${standardError.type}_${standardError.context}`;
        const count = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, count + 1);

        // Log if error frequency is high
        if (count > 5) {
            logger.warn(`High error frequency for ${key}: ${count} occurrences`);
        }
    }

    /**
     * Show user-friendly feedback
     */
    showUserFeedback(standardError, customMessage) {
        let userMessage = customMessage;

        if (!userMessage) {
            userMessage = this.getDefaultUserMessage(standardError);
        }

        // Use translation manager if available
        if (translationManager && translationManager.showAlert) {
            translationManager.showAlert('error', userMessage);
        } else {
            // Fallback to basic alert
            console.error('User feedback:', userMessage);
            if (typeof alert !== 'undefined') {
                alert(userMessage);
            }
        }
    }

    /**
     * Get default user message based on error type
     */
    getDefaultUserMessage(standardError) {
        const messageMap = {
            [ErrorHandlingService.ErrorTypes.NETWORK]: 'Connection error. Please check your internet connection.',
            [ErrorHandlingService.ErrorTypes.VALIDATION]: 'Please check your input and try again.',
            [ErrorHandlingService.ErrorTypes.USER_INPUT]: 'Invalid input. Please check your data.',
            [ErrorHandlingService.ErrorTypes.PERMISSION]: 'Permission denied. Please contact an administrator.',
            [ErrorHandlingService.ErrorTypes.TIMEOUT]: 'Operation timed out. Please try again.',
            [ErrorHandlingService.ErrorTypes.NOT_FOUND]: 'The requested resource was not found.',
            [ErrorHandlingService.ErrorTypes.SYSTEM]: 'An unexpected error occurred. Please try again.'
        };

        return messageMap[standardError.type] || 'An error occurred. Please try again.';
    }

    /**
     * Create error handler for specific context
     */
    createContextHandler(context, options = {}) {
        return (error) => this.handleError(error, { ...options, context });
    }

    /**
     * Create async wrapper for specific context
     */
    createAsyncWrapper(context, options = {}) {
        return (operation) => this.wrapAsyncOperation(operation, { ...options, context });
    }

    /**
     * Validation helper
     */
    validateRequired(value, fieldName) {
        if (value === null || value === undefined || value === '') {
            throw new Error(`${fieldName} is required`);
        }
        return value;
    }

    /**
     * Network request wrapper
     */
    async wrapNetworkRequest(request, options = {}) {
        return this.wrapAsyncOperation(request, {
            errorType: ErrorHandlingService.ErrorTypes.NETWORK,
            severity: ErrorHandlingService.Severity.MEDIUM,
            retryable: true,
            ...options
        });
    }

    /**
     * User input validation wrapper
     */
    wrapValidation(validator, options = {}) {
        try {
            return validator();
        } catch (error) {
            return this.handleError(error, {
                errorType: ErrorHandlingService.ErrorTypes.VALIDATION,
                severity: ErrorHandlingService.Severity.LOW,
                showToUser: true,
                ...options
            });
        }
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
            errorsByType: Object.fromEntries(this.errorCounts),
            topErrors: Array.from(this.errorCounts.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
        };
    }

    /**
     * Clear error statistics
     */
    clearStats() {
        this.errorCounts.clear();
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create singleton instance
export const errorHandler = new ErrorHandlingService();