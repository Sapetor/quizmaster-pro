/**
 * MathJax Render Service
 * Handles core LaTeX rendering operations with progressive loading UI
 * Extracted from MathJaxService for better modularity and testability
 */

import { TIMING, logger } from '../../core/config.js';
import { errorHandler } from '../error-handler.js';

export class RenderService {
    constructor(cacheService, recoveryService) {
        this.cacheService = cacheService;
        this.recoveryService = recoveryService;
        this.pendingRenders = new Set();
        this.isRecovering = false; // Will be managed by recovery service
    }

    /**
     * Check if MathJax is ready for rendering
     * @returns {boolean}
     */
    isAvailable() {
        // Primary check: typesetPromise exists
        if (window.MathJax && window.MathJax.typesetPromise) {
            return true;
        }
        
        // Fallback check: startup is complete
        if (window.MathJax && window.MathJax.startup) {
            // Check if startup promise has resolved
            const startupComplete = window.MathJax.startup.document && 
                                  window.MathJax.startup.document.state && 
                                  window.MathJax.startup.document.state() >= 8; // STATE.READY = 8
            
            if (startupComplete) {
                logger.debug('🔍 MathJax available via startup completion check');
                return true;
            }
        }
        
        return false;
    }

    /**
     * Detect if element contains LaTeX content that needs processing
     * PERFORMANCE: Early exit optimization for code snippets and plain text
     * @param {Element} element - Element to check for LaTeX content
     * @returns {boolean} True if element contains LaTeX
     */
    detectLatexContent(element) {
        const content = element.innerHTML;
        return content.includes('$$') || 
               content.includes('\\(') ||
               content.includes('\\[') ||
               content.includes('$') ||
               content.includes('\\frac') ||
               content.includes('\\sqrt') ||
               content.includes('\\sum') ||
               content.includes('\\int');
    }

    /**
     * Show progressive loading UI with shimmer effects
     * Only shows for slow renders to avoid unnecessary UI flicker
     * @param {Element} element - Element to show loading UI for
     */
    showProgressiveLoading(element) {
        if (!element) return;
        
        try {
            // Add loading class for shimmer effect
            element.classList.add('mathjax-loading');
            
            // Store original content for potential fallback
            if (!element.dataset.originalContent) {
                element.dataset.originalContent = element.innerHTML;
            }
            
            // PERFORMANCE OPTIMIZATION: Only show fallback for slow renders
            // Skip progressive loading for fast normal renders
            const isLikelyF5Recovery = this.isRecovering || 
                                     !window.MathJax?.typesetPromise ||
                                     this.recoveryService?.detectF5Corruption();
            
            if (isLikelyF5Recovery) {
                // Progressive loading enabled for slow render
                
                // Create overlay approach - doesn't modify innerHTML at all
                const overlay = document.createElement('div');
                overlay.className = 'mathjax-loading-overlay';
                overlay.innerHTML = '⌛ Rendering mathematics...';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-style: italic;
                    color: #666;
                    z-index: 10;
                    border-radius: 4px;
                `;
                
                // Make parent relative if needed
                const parentPosition = window.getComputedStyle(element).position;
                if (parentPosition === 'static') {
                    element.style.position = 'relative';
                }
                
                element.appendChild(overlay);
                element.dataset.hasLoadingOverlay = 'true';
                
                // Applied overlay without modifying innerHTML
            }
        } catch (e) {
            // Silent error handling for reduced console output
            logger.debug('Progressive loading setup error:', e.message);
        }
    }

    /**
     * Complete progressive loading UI and cleanup
     * @param {Element} element - Element to complete loading for
     * @param {boolean} renderSucceeded - Whether MathJax rendering succeeded (default: true)
     */
    completeProgressiveLoading(element, renderSucceeded = true) {
        if (!element) return;
        
        try {
            // Remove loading overlay if it exists
            if (element.dataset.hasLoadingOverlay) {
                const overlay = element.querySelector('.mathjax-loading-overlay');
                if (overlay) {
                    overlay.remove();
                }
                delete element.dataset.hasLoadingOverlay;
            }
            
            // Restore original content ONLY if rendering failed AND we modified innerHTML
            if (!renderSucceeded && element.dataset.originalContent && 
                element.innerHTML.includes('⌛ Rendering mathematics')) {
                // Only restore if innerHTML was actually modified (old fallback approach)
                element.innerHTML = element.dataset.originalContent;
            }
            
            // Remove loading classes and add ready class
            element.classList.remove('mathjax-loading');
            element.classList.add('mathjax-ready');
            
            // Clean up stored data
            delete element.dataset.originalContent;
            delete element.dataset.mathJaxOriginal;
            
            // Remove any remaining fallback indicators (old approach)
            const indicators = element.querySelectorAll('[style*="Rendering mathematics"]');
            indicators.forEach(indicator => indicator.remove());
            
        } catch (e) {
            // Silent error handling for reduced console output
            logger.debug('Progressive loading cleanup error:', e.message);
        }
    }

    /**
     * Main rendering function with retry logic and F5 recovery integration
     * @param {Element} element - Element containing LaTeX to render
     * @param {number} timeout - Timeout for each render attempt
     * @param {number} maxRetries - Maximum retry attempts (default: 8)
     * @returns {Promise<void>}
     */
    async renderElement(element, timeout = TIMING.MATHJAX_TIMEOUT, maxRetries = 8) {
        return new Promise((resolve, reject) => {
            // PERFORMANCE: Early exit for non-LaTeX content (like code snippets)
            if (!this.detectLatexContent(element)) {
                // Skip MathJax processing entirely for code snippets/plain text
                resolve();
                return;
            }

            // Add to pending renders for tracking
            this.pendingRenders.add(element);

            // Add progressive loading UI
            this.showProgressiveLoading(element);
            
            const attemptRender = (attempt = 1) => {
                // PERFORMANCE: Use shorter timeout for normal renders
                const renderTimeout = this.isRecovering ? timeout : Math.min(timeout, 50);
                
                setTimeout(() => {
                    if (this.isAvailable()) {
                        // MathJax is ready - attempt render
                        window.MathJax.typesetPromise([element])
                            .then(() => {
                                // Render successful
                                this.pendingRenders.delete(element);
                                
                                // Cache the rendered content for instant F5 recovery
                                this.cacheService.cacheMathJaxContent(element);
                                
                                // Complete progressive loading - SUCCESS
                                this.completeProgressiveLoading(element, true);
                                
                                resolve();
                            })
                            .catch(error => {
                                errorHandler.log(error, { 
                                    context: 'MathJax render', 
                                    attempt, 
                                    maxRetries,
                                    elementId: element.id || 'unknown'
                                });
                                
                                if (attempt < maxRetries) {
                                    // Progressive backoff for render retries
                                    const delay = attempt <= 3 ? TIMING.MATHJAX_RETRY_TIMEOUT : TIMING.MATHJAX_RETRY_TIMEOUT * 1.5;
                                    setTimeout(() => attemptRender(attempt + 1), delay);
                                } else {
                                    this.pendingRenders.delete(element);
                                    // Complete progressive loading - FAILURE
                                    this.completeProgressiveLoading(element, false);
                                    reject(error);
                                }
                            });
                            
                    } else if (attempt < maxRetries) {
                        // MathJax not ready yet - retry with progressive backoff
                        const delay = attempt <= 3 ? TIMING.MATHJAX_RETRY_TIMEOUT : TIMING.MATHJAX_RETRY_TIMEOUT * 1.5;
                        setTimeout(() => attemptRender(attempt + 1), delay);
                        
                    } else {
                        // Max retries reached - check for F5 corruption
                        const mathJaxExists = !!window.MathJax;
                        const typesetExists = !!window.MathJax?.typesetPromise;
                        
                        // Reduce error verbosity for normal gameplay delays
                        if (maxRetries <= 5) {
                            logger.debug(`🔄 MathJax still loading after ${maxRetries} attempts`);
                        } else {
                            logger.warn(`⚠️ MathJax not ready after ${maxRetries} attempts - MathJax: ${mathJaxExists}, typesetPromise: ${typesetExists}`);
                        }
                        
                        // Check for F5 corruption and handle recovery
                        if (this.recoveryService && this.recoveryService.detectF5Corruption()) {
                            logger.debug('🔍 F5 corruption detected - initiating recovery');
                            
                            // Small delay to ensure DOM stability before recovery
                            setTimeout(() => {
                                this.recoveryService.handleF5Corruption(
                                    element,
                                    resolve,
                                    reject,
                                    this.cacheService.mathJaxCache,
                                    (el) => this.cacheService.getCacheKey(el),
                                    (el, success) => this.completeProgressiveLoading(el, success),
                                    (el) => this.cacheService.cacheMathJaxContent(el),
                                    this.pendingRenders
                                );
                            }, 100);
                            return;
                        }
                        
                        // If no corruption detected, reject with error
                        this.pendingRenders.delete(element);
                        this.completeProgressiveLoading(element, false);
                        reject(new Error(`MathJax not ready after ${maxRetries} attempts`));
                    }
                }, renderTimeout);
            };
            
            attemptRender();
        });
    }

    /**
     * Render multiple elements in batch
     * @param {Element[]} elements - Array of elements to render
     * @param {number} timeout - Timeout for each render attempt
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Promise<void[]>} Promise that resolves when all elements are rendered
     */
    async renderElements(elements, timeout = TIMING.MATHJAX_TIMEOUT, maxRetries = 8) {
        const renderPromises = elements.map(element => 
            this.renderElement(element, timeout, maxRetries).catch(error => {
                logger.warn('Batch render failed for element:', element.id || 'unknown', error);
                return null; // Don't fail entire batch for one element
            })
        );
        
        return Promise.all(renderPromises);
    }

    /**
     * Process pending renders when MathJax becomes ready
     * Called when MathJax initialization completes
     */
    processPendingRenders() {
        if (this.pendingRenders.size === 0) return;

        const elements = Array.from(this.pendingRenders);
        this.pendingRenders.clear();

        logger.debug(`🔄 Processing ${elements.length} pending renders`);

        elements.forEach(element => {
            this.renderElement(element).catch(error => {
                logger.error('Failed to process pending MathJax render:', error);
            });
        });
    }

    /**
     * Set recovery state (coordinated with recovery service)
     * @param {boolean} isRecovering - Whether F5 recovery is in progress
     */
    setRecoveryState(isRecovering) {
        this.isRecovering = isRecovering;
    }

    /**
     * Get render service status for debugging
     * @returns {object} Render service status
     */
    getStatus() {
        return {
            pendingRenders: this.pendingRenders.size,
            isRecovering: this.isRecovering,
            mathJaxAvailable: this.isAvailable(),
            cacheStats: this.cacheService.getStats()
        };
    }

    /**
     * Clear all pending renders (useful for cleanup)
     */
    clearPendingRenders() {
        const count = this.pendingRenders.size;
        this.pendingRenders.clear();
        if (count > 0) {
            logger.debug(`🧹 Cleared ${count} pending renders`);
        }
    }
}

// Note: Export class only - instances should be created with proper dependencies
export { RenderService };