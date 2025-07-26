/**
 * ErrorHandler - Simple centralized error handling utility
 * Provides basic error logging and tracking without breaking existing code
 */

import { logger } from '../core/config.js';

export class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxStoredErrors = 50;
    }

    /**
     * Simple error logging that doesn't break existing code
     * @param {Error|string} error - Error object or message
     * @param {Object} context - Optional context information
     * @param {string} severity - Error severity (error, warn, info, debug)
     */
    log(error, context = {}, severity = 'error') {
        // Handle null/undefined errors gracefully
        if (!error) {
            error = new Error('Unknown error (null/undefined)');
        }
        
        // Ensure error is a proper object
        if (typeof error === 'string') {
            error = new Error(error);
        }
        
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message || error.toString() || 'Unknown error',
            stack: error.stack || null,
            context: context,
            severity: severity
        };

        // Use existing logger
        if (logger && logger[severity]) {
            logger[severity](errorInfo.message, errorInfo);
        } else {
            console[severity](errorInfo.message, errorInfo);
        }

        // Store for debugging
        this.errors.push(errorInfo);
        if (this.errors.length > this.maxStoredErrors) {
            this.errors.shift();
        }

        return errorInfo;
    }

    /**
     * Get recent errors for debugging
     * @param {number} limit - Number of recent errors to return
     * @returns {Array} Recent error information
     */
    getRecentErrors(limit = 10) {
        return this.errors.slice(-limit);
    }

    /**
     * Clear stored errors
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getStats() {
        return {
            total: this.errors.length,
            recent: this.errors.slice(-3).map(e => ({
                timestamp: e.timestamp,
                message: e.message,
                severity: e.severity
            }))
        };
    }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export for direct use
export default errorHandler;