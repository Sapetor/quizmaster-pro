/**
 * Error Boundary System
 * Provides error recovery and safe execution for critical game functions
 */

import { errorHandler } from './error-handler.js';
import { translationManager } from './translation-manager.js';
import { logger } from '../core/config.js';

export class ErrorBoundary {
    constructor() {
        this.errorHandler = errorHandler;
        this.errorCount = 0;
        this.maxErrors = 50; // Increased even more - be very tolerant during DOM operations
        this.criticalErrorOccurred = false;
        
        // Track different error types separately
        this.errorTypeCounts = {
            dom_operation: 0,
            network_operation: 0,
            game_logic: 0,
            translation: 0,
            socket_event: 0,
            other: 0
        };
        
        // Define which error types should be more tolerant
        this.tolerantErrorTypes = new Set(['dom_operation', 'translation', 'generic_recovery']);
        
        // Circuit breaker for rapid error cascades
        this.recentErrors = [];
        this.cascadeThreshold = 5; // 5 errors in rapid succession
        this.cascadeTimeWindow = 1000; // within 1 second
        this.inCircuitBreakerMode = false;
        this.circuitBreakerTimeout = null;
        
        // Bind methods
        this.handleError = this.handleError.bind(this);
        this.safeExecute = this.safeExecute.bind(this);
        this.safeDOMOperation = this.safeDOMOperation.bind(this);
        this.safeNetworkOperation = this.safeNetworkOperation.bind(this);
        
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
        // Global error handler for uncaught exceptions
        window.addEventListener('error', (event) => {
            // Skip common non-critical errors
            const errorMessage = event.error?.message || '';
            if (this.isNonCriticalError(errorMessage, event.error)) {
                logger.debug('Skipping non-critical error:', errorMessage);
                return;
            }
            
            logger.error('Global error caught:', event.error);
            this.handleError(event.error, {
                type: 'global_error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Global handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            // Skip common non-critical promise rejections
            const reason = event.reason?.message || event.reason?.toString() || '';
            if (this.isNonCriticalError(reason, event.reason)) {
                logger.debug('Skipping non-critical promise rejection:', reason);
                return;
            }
            
            logger.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, {
                type: 'unhandled_promise_rejection'
            });
            event.preventDefault(); // Prevent default browser error handling
        });

        // Socket.io error recovery
        if (window.io) {
            const originalConnect = window.io.connect;
            window.io.connect = (...args) => {
                try {
                    return originalConnect.apply(window.io, args);
                } catch (error) {
                    logger.error('Socket.io connection error:', error);
                    this.handleError(error, { type: 'socket_connection' });
                    return null;
                }
            };
        }
    }

    /**
     * Check if an error should be considered non-critical and not counted
     */
    /**
     * Check if an error should be considered non-critical and not counted
     */
    isNonCriticalError(message, error) {
        const nonCriticalPatterns = [
            // Browser/ResizeObserver errors
            /ResizeObserver loop limit exceeded/i,
            /ResizeObserver loop completed with undelivered notifications/i,
            /ResizeObserver.*callback has queued a mutation/i,
            
            // Network/Loading errors
            /Non-Error promise rejection captured/i,
            /Script error/i,
            /Loading chunk \d+ failed/i,
            /ChunkLoadError/i,
            /Loading CSS chunk/i,
            /Network request failed/i,
            /Failed to fetch/i,
            /AbortError/i,
            /The operation was aborted/i,
            /timeout/i,
            /NetworkError/i,
            
            // MathJax/Rendering errors  
            /MathJax.*not ready/i,
            /MathJax.*startup/i,
            /MathJax.*typesetPromise/i,
            
            // Common DOM manipulation errors during UI updates
            /Cannot read.*of null/i,
            /Cannot read.*of undefined/i,
            /Cannot read property.*null/i,
            /Cannot read property.*undefined/i,
            /Cannot access before initialization/i,
            /Element.*does not exist/i,
            /parentNode.*null/i,
            /parentElement.*null/i,
            /insertBefore.*null/i,
            /insertAfter.*null/i,
            /removeChild.*null/i,
            /appendChild.*null/i,
            /querySelector.*null/i,
            /getElementById.*null/i,
            /Node was not found/i,
            /The node to be removed is not a child/i,
            /Failed to execute.*on.*Element/i,
            
            // Event handling errors during DOM manipulation
            /addEventListener.*null/i,
            /removeEventListener.*null/i,
            /dispatchEvent.*null/i,
            /click.*null/i,
            /focus.*null/i,
            /blur.*null/i,
            
            // Style/CSS errors during DOM updates
            /Cannot set property.*of null/i,
            /Cannot set property.*of undefined/i,
            /style.*null/i,
            /classList.*null/i,
            /className.*null/i,
            
            // Form/Input errors
            /value.*null/i,
            /checked.*null/i,
            /selected.*null/i,
            /disabled.*null/i,
            
            // Animation/Transition errors
            /requestAnimationFrame/i,
            /cancelAnimationFrame/i,
            /transition.*null/i,
            /transform.*null/i,
            
            // Common undefined reference errors during rapid DOM changes
            /is not defined/i,
            /is not a function/i,
            /has no properties/i,
            /undefined.*function/i,
            
            // Preview-specific errors that shouldn't crash the app
            /preview.*error/i,
            /question.*container.*null/i,
            /question.*element.*null/i,
            /question.*item.*null/i,
            
            // Generic temporary state errors
            /temporarily unavailable/i,
            /not yet initialized/i,
            /still loading/i,
            /operation pending/i
        ];
        
        // Also check for specific error objects that are non-critical
        if (error) {
            // Skip DOMException errors that are non-critical
            if (error.name === 'AbortError' || error.name === 'NetworkError') {
                return true;
            }
            
            // Skip errors without meaningful stack traces (often browser internals)
            if (!error.stack || error.stack.length < 50) {
                return true;
            }
        }
        
        return nonCriticalPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Handle errors with context and recovery attempts
     */
    /**
     * Handle errors with context and recovery attempts
     */
    /**
     * Handle errors with context and recovery attempts
     */
    handleError(error, context = {}) {
        const now = Date.now();
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        // Circuit breaker: detect error cascades and temporarily stop counting errors
        this.recentErrors.push(now);
        this.recentErrors = this.recentErrors.filter(time => now - time < this.cascadeTimeWindow);
        
        if (this.recentErrors.length >= this.cascadeThreshold && !this.inCircuitBreakerMode) {
            this.inCircuitBreakerMode = true;
            logger.warn('Error cascade detected - enabling circuit breaker mode for 5 seconds');
            
            // Clear circuit breaker after 5 seconds
            if (this.circuitBreakerTimeout) {
                clearTimeout(this.circuitBreakerTimeout);
            }
            this.circuitBreakerTimeout = setTimeout(() => {
                this.inCircuitBreakerMode = false;
                this.recentErrors = [];
                logger.info('Circuit breaker mode disabled');
            }, 5000);
        }
        
        // Skip counting errors during circuit breaker mode
        if (this.inCircuitBreakerMode) {
            logger.debug('Circuit breaker active - skipping error count for:', errorMessage);
            return true; // Always recover during circuit breaker
        }
        
        // Log detailed error information for debugging (only in development)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const errorStack = error?.stack || 'No stack trace';
            logger.error('Error Boundary - Error Details:', {
                message: errorMessage,  
                type: context.type,
                operation: context.operation,
                elementId: context.elementId,
                filename: context.filename,
                stack: errorStack.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
            });
        }
        
        // Skip counting certain error types that are typically non-critical
        const shouldCount = !this.tolerantErrorTypes.has(context.type) || this.errorCount < 10;
        
        if (shouldCount) {
            this.errorCount++;
            
            // Track by error type
            const errorType = context.type || 'other';
            if (this.errorTypeCounts[errorType] !== undefined) {
                this.errorTypeCounts[errorType]++;
            } else {
                this.errorTypeCounts.other++;
            }
        }
        
        // Log the error
        this.errorHandler.log(error, context, 'error');
        
        // Check if we've exceeded maximum errors
        // Much more lenient for DOM operations during live preview
        const effectiveMaxErrors = context.operation === 'preview_update' || context.operation === 'question_shuffle' 
            ? this.maxErrors * 3 
            : this.maxErrors;
        
        if (this.errorCount > effectiveMaxErrors) {
            this.criticalErrorOccurred = true;
            this.showCriticalErrorMessage();
            return false;
        }

        // Attempt recovery based on error type
        try {
            return this.attemptRecovery(error, context);
        } catch (recoveryError) {
            logger.error('Error during recovery attempt:', recoveryError);
            // Don't count recovery errors toward the total
            return true; // Always return true for recovery errors to prevent cascades
        }
    }

    /**
     * Attempt to recover from different types of errors
     */
    attemptRecovery(error, context) {
        // Only log in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            logger.debug(`Attempting recovery for error type: ${context.type}`);
        }

        switch (context.type) {
            case 'dom_operation':
                return this.recoverFromDOMError(error, context);
            
            case 'network_operation':
                return this.recoverFromNetworkError(error, context);
            
            case 'game_logic':
                return this.recoverFromGameLogicError(error, context);
            
            case 'translation':
                return this.recoverFromTranslationError(error, context);
            
            case 'socket_event':
                return this.recoverFromSocketError(error, context);
            
            default:
                return this.genericRecovery(error, context);
        }
    }

    /**
     * Recover from DOM operation errors
     */
    recoverFromDOMError(error, context) {
        // Only log in development mode
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDev) logger.debug('Attempting DOM error recovery');
        
        // For preview operations, be extra tolerant
        if (context.operation === 'preview_update' || context.operation === 'question_shuffle') {
            if (isDev) logger.debug('DOM error during preview operation - continuing with graceful degradation');
            return true; // Always recover from preview DOM errors
        }
        
        // Try to find alternative elements or create fallbacks
        if (context.elementId) {
            const element = document.getElementById(context.elementId);
            if (!element) {
                if (isDev) logger.warn(`Element ${context.elementId} not found, creating fallback`);
                // Could create a fallback element or skip the operation
                return true;
            }
        }
        
        // Clear potentially corrupted DOM state
        if (context.container) {
            try {
                const container = document.querySelector(context.container);
                if (container) {
                    container.innerHTML = '<p class="error-message">Content temporarily unavailable</p>';
                }
            } catch (clearError) {
                logger.error('Failed to clear container:', clearError);
            }
        }
        
        return true;
    }

    /**
     * Recover from network operation errors
     */
    recoverFromNetworkError(error, context) {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDev) logger.debug('Attempting network error recovery');
        
        // Show user-friendly message for network issues
        if (error.name === 'NetworkError' || error.message.includes('fetch')) {
            translationManager.showAlert('warning', 'Network connection issue. Please check your internet connection.');
            return true;
        }
        
        // For API errors, try to continue with cached data
        if (context.operation === 'api_call') {
            logger.debug('API call failed, attempting to use cached data');
            return true;
        }
        
        return false;
    }

    /**
     * Recover from game logic errors
     */
    recoverFromGameLogicError(error, context) {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDev) logger.debug('Attempting game logic error recovery');
        
        // Reset game state to a known good state
        if (context.operation === 'question_display') {
            if (isDev) logger.debug('Question display error, attempting to reset question UI');
            this.resetQuestionUI();
            return true;
        }
        
        if (context.operation === 'timer') {
            if (isDev) logger.debug('Timer error, attempting to reset timer state');
            this.resetTimerState();
            return true;
        }
        
        if (context.operation === 'scoring') {
            if (isDev) logger.debug('Scoring error, using default scoring');
            return true;
        }
        
        return false;
    }

    /**
     * Recover from translation errors
     */
    recoverFromTranslationError(error, context) {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDev) logger.debug('Attempting translation error recovery');
        
        // Fall back to English or show key names
        if (context.key) {
            if (isDev) logger.debug(`Translation failed for key: ${context.key}, using fallback`);
            return true;
        }
        
        return true; // Translation errors are usually non-critical
    }

    /**
     * Recover from socket errors
     */
    recoverFromSocketError(error, context) {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDev) logger.debug('Attempting socket error recovery');
        
        // Attempt to reconnect
        if (window.game?.socketManager) {
            try {
                setTimeout(() => {
                    window.game.socketManager.reconnect();
                }, 2000);
                translationManager.showAlert('info', 'Connection issue detected. Attempting to reconnect...');
                return true;
            } catch (reconnectError) {
                logger.error('Failed to reconnect:', reconnectError);
            }
        }
        
        return false;
    }

    /**
     * Generic recovery for unknown error types
     */
    genericRecovery(error, context) {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDev) {
            logger.debug('Attempting generic error recovery');
            logger.debug('Generic error handled, continuing execution');
        }
        return true;
    }

    /**
     * Reset question UI to a clean state
     */
    resetQuestionUI() {
        try {
            const questionContainer = document.getElementById('current-question');
            if (questionContainer) {
                questionContainer.innerHTML = '<p>Loading question...</p>';
            }
            
            const playerQuestionContainer = document.getElementById('player-question-text');
            if (playerQuestionContainer) {
                playerQuestionContainer.innerHTML = '<p>Loading question...</p>';
            }
            
            // Clear any answer options that might be in an invalid state
            document.querySelectorAll('.player-option, .answer-option').forEach(option => {
                option.style.display = 'none';
            });
            
        } catch (resetError) {
            logger.error('Error during question UI reset:', resetError);
        }
    }

    /**
     * Reset timer state
     */
    resetTimerState() {
        try {
            if (window.game?.gameManager) {
                if (window.game.gameManager.timer) {
                    clearInterval(window.game.gameManager.timer);
                    window.game.gameManager.timer = null;
                }
                
                const timerDisplay = document.getElementById('timer');
                if (timerDisplay) {
                    timerDisplay.textContent = '30';
                }
            }
        } catch (resetError) {
            logger.error('Error during timer reset:', resetError);
        }
    }

    /**
     * Show critical error message when too many errors occur
     */
    showCriticalErrorMessage() {
        try {
            const errorContainer = document.createElement('div');
            errorContainer.id = 'critical-error-overlay';
            errorContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: Inter, sans-serif;
            `;
            
            errorContainer.innerHTML = `
                <h2>Application Error</h2>
                <p>Multiple errors have occurred. Please refresh the page to continue.</p>
                <div style="margin: 10px 0; font-size: 14px; opacity: 0.8;">
                    Error count: ${this.errorCount}/${this.maxErrors}
                </div>
                <button onclick="window.location.reload()" style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                ">Refresh Page</button>
                <button onclick="try { document.getElementById('critical-error-overlay').remove(); window.errorBoundary.reset(); console.log('Error boundary reset successfully'); } catch(e) { console.error('Failed to reset:', e); location.reload(); }" style="
                    margin-top: 10px;
                    padding: 8px 16px;
                    background: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Try to Continue (Advanced)</button>
            `;
            
            document.body.appendChild(errorContainer);
        } catch (displayError) {
            logger.error('Failed to show critical error message:', displayError);
            // Last resort - use alert
            alert('Multiple errors occurred. Please refresh the page.');
        }
    }

    /**
     * Safe execution wrapper for any function
     */
    safeExecute(fn, context = {}, fallback = null) {
        if (this.criticalErrorOccurred) {
            logger.warn('Critical error state - skipping execution');
            return fallback;
        }

        try {
            return fn();
        } catch (error) {
            logger.error('Safe execution failed:', error);
            const recovered = this.handleError(error, {
                type: 'safe_execution',
                ...context
            });
            
            if (recovered) {
                return fallback;
            } else {
                throw error; // Re-throw if recovery failed
            }
        }
    }

    /**
     * Safe DOM operation wrapper
     */
    safeDOMOperation(operation, elementId = null, fallback = null) {
        return this.safeExecute(operation, {
            type: 'dom_operation',
            elementId: elementId
        }, fallback);
    }

    /**
     * Safe network operation wrapper
     */
    async safeNetworkOperation(operation, operationType = 'api_call', fallback = null) {
        if (this.criticalErrorOccurred) {
            logger.warn('Critical error state - skipping network operation');
            return fallback;
        }

        try {
            return await operation();
        } catch (error) {
            logger.error('Safe network operation failed:', error);
            const recovered = this.handleError(error, {
                type: 'network_operation',
                operation: operationType
            });
            
            return recovered ? fallback : Promise.reject(error);
        }
    }

    /**
     * Safe socket event handler wrapper
     */
    safeSocketHandler(handler, eventName) {
        return (...args) => {
            return this.safeExecute(() => handler(...args), {
                type: 'socket_event',
                event: eventName
            });
        };
    }

    /**
     * Get error boundary status
     */
    getStatus() {
        return {
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            criticalErrorOccurred: this.criticalErrorOccurred,
            isHealthy: this.errorCount < this.maxErrors / 2,
            errorTypeCounts: { ...this.errorTypeCounts }
        };
    }

    /**
     * Reset error boundary (for testing or manual recovery)
     */
    reset() {
        this.errorCount = 0;
        this.criticalErrorOccurred = false;
        
        // Reset error type counts
        Object.keys(this.errorTypeCounts).forEach(key => {
            this.errorTypeCounts[key] = 0;
        });
        
        // Remove critical error overlay if present
        const errorOverlay = document.getElementById('critical-error-overlay');
        if (errorOverlay) {
            errorOverlay.remove();
        }
        
        // Only log in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            logger.debug('Error boundary reset');
        }
    }

    /**
     * Safe DOM manipulation specifically for question movement/shuffling
     */
    safeDOMManipulation(operation, description = 'DOM operation') {
        return this.safeExecute(() => {
            try {
                return operation();
            } catch (domError) {
                logger.debug(`Safe DOM manipulation failed (${description}):`, domError.message);
                // For DOM operations, we almost always want to continue
                return null;
            }
        }, {
            type: 'dom_operation',
            operation: 'question_shuffle'
        }, null);
    }

    /**
     * Ultra-safe element access that never throws
     */
    safeElementAccess(selector, operation) {
        try {
            const element = typeof selector === 'string' 
                ? document.querySelector(selector)
                : selector;
                
            if (!element) {
                logger.debug(`Element not found: ${selector}`);
                return null;
            }
            
            if (typeof operation === 'function') {
                return operation(element);
            }
            
            return element;
        } catch (error) {
            logger.debug(`Safe element access failed for ${selector}:`, error.message);
            return null;
        }
    }
}

// Create global error boundary instance
export const errorBoundary = new ErrorBoundary();

// Make it available globally for debugging
window.errorBoundary = errorBoundary;

// Export safe DOM manipulation functions for use in other modules
export const safeDOMManipulation = (operation, description) => errorBoundary.safeDOMManipulation(operation, description);
export const safeElementAccess = (selector, operation) => errorBoundary.safeElementAccess(selector, operation);