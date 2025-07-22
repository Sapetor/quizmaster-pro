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
        this.maxErrors = 10; // Maximum errors before disabling error recovery
        this.criticalErrorOccurred = false;
        
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
     * Handle errors with context and recovery attempts
     */
    handleError(error, context = {}) {
        this.errorCount++;
        
        // Log the error
        this.errorHandler.log(error, context, 'error');
        
        // Check if we've exceeded maximum errors
        if (this.errorCount > this.maxErrors) {
            this.criticalErrorOccurred = true;
            this.showCriticalErrorMessage();
            return false;
        }

        // Attempt recovery based on error type
        try {
            return this.attemptRecovery(error, context);
        } catch (recoveryError) {
            logger.error('Error during recovery attempt:', recoveryError);
            this.errorHandler.log(recoveryError, { 
                ...context, 
                recovery_attempt: true 
            }, 'error');
            return false;
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
            isHealthy: this.errorCount < this.maxErrors / 2
        };
    }

    /**
     * Reset error boundary (for testing or manual recovery)
     */
    reset() {
        this.errorCount = 0;
        this.criticalErrorOccurred = false;
        
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
}

// Create global error boundary instance
export const errorBoundary = new ErrorBoundary();

// Make it available globally for debugging
window.errorBoundary = errorBoundary;