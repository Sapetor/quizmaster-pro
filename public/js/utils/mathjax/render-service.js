/**
 * MathJax Render Service
 * Handles core LaTeX rendering operations with progressive loading UI
 * Extracted from MathJaxService for better modularity and testability
 */

import { TIMING, logger } from '../../core/config.js';
import { errorHandler } from '../error-handler.js';
// Removed performance monitoring import - keeping service lightweight

export class RenderService {
    constructor(cacheService, recoveryService) {
        this.cacheService = cacheService;
        this.recoveryService = recoveryService;
        this.pendingRenders = new Set();
        this.isRecovering = false; // Will be managed by recovery service
        this.renderDebounce = new Map(); // Debounce map for rapid render prevention
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
               content.includes('\\int') ||
               content.includes('\\lim') ||
               content.includes('\\alpha') ||
               content.includes('\\beta') ||
               content.includes('\\gamma') ||
               content.includes('\\delta') ||
               content.includes('\\theta') ||
               content.includes('\\pi') ||
               content.includes('\\sin') ||
               content.includes('\\cos') ||
               content.includes('\\tan') ||
               content.includes('\\log') ||
               content.includes('\\ln');
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
     * @param {boolean} fastMode - Skip delays for immediate rendering (preview contexts)
     * @returns {Promise<void>}
     */
    async renderElement(element, timeout = TIMING.MATHJAX_TIMEOUT, maxRetries = 8, fastMode = false) {
        const startTime = Date.now();
        const elementId = element.id || element.className || 'unknown';
        
        return new Promise((resolve, reject) => {
            // PERFORMANCE: Early exit for non-LaTeX content (like code snippets)
            if (!this.detectLatexContent(element)) {
                // Skip MathJax processing entirely for code snippets/plain text
                resolve();
                return;
            }

            // Debounce rapid renders on the same element (for live preview)
            const now = Date.now();
            const currentContent = element.innerHTML;
            const contentHash = currentContent.substring(0, 50); // First 50 chars for content fingerprint
            const debounceKey = `${elementId}_${contentHash}`;
            const lastRender = this.renderDebounce.get(debounceKey);
            
            // Only debounce if this is truly rapid successive rendering of identical content
            // CRITICAL FIX: Exclude preview contexts from debouncing to prevent F5 invisibility issues
            const isPreviewContext = elementId.includes('preview') || elementId.includes('split');
            const isRapidIdenticalRender = fastMode && !isPreviewContext && lastRender && 
                                         (now - lastRender) < 50 && // Reduced from 150ms to 50ms
                                         element.classList.contains('mathjax-ready') &&
                                         element.innerHTML === currentContent; // Ensure content is actually identical
            
            if (isRapidIdenticalRender) {
                logger.debug(`🚫 Debouncing rapid identical render for element: ${elementId} (last render: ${now - lastRender}ms ago)`);
                resolve(); // Skip this render to prevent conflicts
                return;
            }
            
            this.renderDebounce.set(debounceKey, now);
            
            // Clean up old debounce entries (older than 5 seconds)
            for (const [key, time] of this.renderDebounce.entries()) {
                if (now - time > 5000) {
                    this.renderDebounce.delete(key);
                }
            }

            // Add to pending renders for tracking
            this.pendingRenders.add(element);

            // Add progressive loading UI
            this.showProgressiveLoading(element);
            
            const attemptRender = (attempt = 1) => {
                // PERFORMANCE: Use shorter timeout for normal renders, zero for fast mode
                // Mobile devices need longer initial timeouts for first render
                const isMobile = this.recoveryService.isMobile;
                const isChrome = this.recoveryService.isChrome;
                
                let baseTimeout = fastMode ? 0 : (this.isRecovering ? timeout : Math.min(timeout, 50));
                
                // Apply mobile-specific timeout adjustments for initial render
                if (!fastMode && isMobile && isChrome) {
                    baseTimeout = Math.max(baseTimeout, 200); // Mobile Chrome needs minimum 200ms
                    logger.debug('📱 Applying mobile Chrome LaTeX optimization: 200ms timeout');
                } else if (!fastMode && isMobile) {
                    baseTimeout = Math.max(baseTimeout, 150); // Other mobile browsers need minimum 150ms
                    logger.debug('📱 Applying mobile LaTeX optimization: 150ms timeout');
                } else if (!fastMode && isChrome) {
                    // SIMPLE FIX: Reduce desktop Chrome timeout for faster LaTeX sequence rendering
                    baseTimeout = Math.max(baseTimeout, 25); // Reduced from 75ms to 25ms for faster host rendering
                    logger.debug('🖥️ Applying desktop Chrome LaTeX optimization: 25ms timeout');
                }
                
                const renderTimeout = baseTimeout;
                
                const executeRender = () => {
                    // DOM stability check - ensure element is still in DOM and valid
                    if (!element || !element.parentNode || !document.contains(element)) {
                        logger.debug('Element removed from DOM during render, skipping');
                        this.pendingRenders.delete(element);
                        this.completeProgressiveLoading(element, false);
                        resolve();
                        return;
                    }
                    
                    if (this.isAvailable()) {
                        // MathJax is ready - attempt render with DOM error protection
                        try {
                            window.MathJax.typesetPromise([element])
                                .then(() => {
                                    // Render successful
                                    // Render successful - verify element still exists
                                    if (element && element.parentNode && document.contains(element)) {
                                        this.pendingRenders.delete(element);
                                        
                                        // Cache the rendered content for instant F5 recovery
                                        this.cacheService.cacheMathJaxContent(element);
                                        
                                        // Complete progressive loading - SUCCESS
                                        this.completeProgressiveLoading(element, true);
                                    }
                                    
                                    // Successful render
                                    resolve();
                                })
                                .catch(error => {
                                // Check if this is a DOM manipulation error due to element removal
                                const isDOMError = error.message && (
                                    error.message.includes('replaceChild') ||
                                    error.message.includes('removeChild') ||
                                    error.message.includes('insertBefore') ||
                                    error.message.includes('Cannot read properties of null')
                                );
                                
                                // Check if element is still in DOM
                                const elementInDOM = element && element.parentNode && document.contains(element);
                                
                                if (isDOMError && !elementInDOM) {
                                    // Element was removed during rendering - this is expected in live preview
                                    logger.debug('🔄 Element removed during MathJax rendering (expected in live preview)', {
                                        elementId: element.id || 'unknown',
                                        error: error.message.substring(0, 50) + '...'
                                    });
                                    
                                    this.pendingRenders.delete(element);
                                    // Don't log as error - this is expected behavior
                                    resolve(); // Resolve successfully since element removal is intentional
                                    return;
                                }
                                
                                // Log actual errors (not DOM removal)
                                errorHandler.log(error, { 
                                    context: 'MathJax render', 
                                    attempt, 
                                    maxRetries,
                                    elementId: element.id || 'unknown',
                                    elementInDOM
                                });
                                
                                if (attempt < maxRetries && elementInDOM) {
                                    // Only retry if element is still in DOM
                                    // Mobile devices need longer delays between retry attempts
                                    const isMobile = this.recoveryService.isMobile;
                                    const isChrome = this.recoveryService.isChrome;
                                    
                                    let baseDelay = attempt <= 3 ? TIMING.MATHJAX_TIMEOUT : TIMING.MATHJAX_TIMEOUT * 1.5;
                                    
                                    // Apply mobile-specific delay multipliers
                                    if (isMobile && isChrome) {
                                        baseDelay *= 2.0; // Mobile Chrome needs significant delay (reduced from 2.5)
                                    } else if (isMobile) {
                                        baseDelay *= 1.8; // Other mobile browsers need extra delay (reduced from 2.0)
                                    } else if (isChrome) {
                                        // SIMPLE FIX: Further reduce desktop Chrome retry delay for faster sequence rendering
                                        baseDelay *= 0.8; // Desktop Chrome gets faster retries (reduced from 1.1)
                                    }
                                    
                                    setTimeout(() => attemptRender(attempt + 1), baseDelay);
                                } else {
                                    this.pendingRenders.delete(element);
                                    // Complete progressive loading - FAILURE
                                    this.completeProgressiveLoading(element, false);
                                    
                                    // Failed render
                                    reject(error);
                                }
                            });
                        } catch (domError) {
                            // Handle DOM errors like replaceChild failures gracefully
                            if (domError.message.includes('replaceChild') || 
                                domError.message.includes('removeChild') ||
                                domError.message.includes('Cannot read properties of null')) {
                                // DOM manipulation error - likely F5 corruption
                                logger.debug('🚫 DOM error detected, checking for F5 corruption');
                                this.pendingRenders.delete(element);
                                this.completeProgressiveLoading(element, false);
                                
                                // If this is F5 corruption, trigger recovery immediately
                                if (this.recoveryService && this.recoveryService.detectF5Corruption()) {
                                    logger.debug('🔍 F5 corruption detected via DOM error - triggering immediate recovery');
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
                                    }, 50);
                                    return;
                                }
                                
                                resolve();
                            } else {
                                // Other errors - retry or fail
                                throw domError;
                            }
                        }
                            
                    } else if (attempt < maxRetries) {
                        // MathJax not ready yet - check for early recovery or continue retrying
                        const isMobile = this.recoveryService.isMobile;
                        const isChrome = this.recoveryService.isChrome;
                        const mathJaxExists = !!window.MathJax;
                        const typesetExists = !!window.MathJax?.typesetPromise;
                        
                        // Check for early recovery conditions before continuing retries
                        // Be more patient during fresh app loads to avoid false positive recovery triggers
                        const timeSinceLoad = Date.now() - performance.timing.navigationStart;
                        const isFreshAppLoad = timeSinceLoad < 5000; // Less than 5 seconds since page load
                        
                        const earlyMobileRecovery = isMobile && (attempt >= (isFreshAppLoad ? 10 : 6)) && mathJaxExists && !typesetExists;
                        // CONSERVATIVE FIX: Increase desktop Chrome early recovery threshold further for fresh app loads
                        const earlyDesktopRecovery = !isMobile && isChrome && (attempt >= (isFreshAppLoad ? 12 : 8)) && mathJaxExists && !typesetExists;
                        const shouldTriggerEarlyRecovery = earlyMobileRecovery || earlyDesktopRecovery;
                        
                        if (shouldTriggerEarlyRecovery && this.recoveryService && this.recoveryService.detectF5Corruption()) {
                            const recoveryType = earlyDesktopRecovery ? 'Desktop Chrome (early)' : 'Mobile (early)';
                            logger.warn(`🔍 ${recoveryType} F5 corruption detected at attempt ${attempt} - initiating early recovery`);
                            
                            // Trigger early recovery
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
                            }, 50);
                            return;
                        }
                        
                        // Continue retrying with progressive backoff
                        let delay = attempt <= 3 ? TIMING.MATHJAX_TIMEOUT : TIMING.MATHJAX_TIMEOUT * 1.5;
                        
                        // Apply mobile-specific delay multipliers for loading delays
                        if (isMobile && isChrome) {
                            delay *= 2.5; // Mobile Chrome needs more time to load MathJax (reduced from 3.0)
                        } else if (isMobile) {
                            delay *= 2.0; // Other mobile browsers need extra loading time (reduced from 2.5)
                        } else if (isChrome) {
                            // SIMPLE FIX: Further reduce desktop Chrome loading delay for faster sequence rendering
                            delay *= 0.9; // Desktop Chrome gets faster loading (reduced from 1.1)
                        }
                        
                        setTimeout(() => attemptRender(attempt + 1), delay);
                        
                    } else {
                        // Max retries reached - check for F5 corruption
                        const mathJaxExists = !!window.MathJax;
                        const typesetExists = !!window.MathJax?.typesetPromise;
                        
                        // Mobile devices are more aggressive about triggering recovery (but only for clear corruption)
                        const isMobile = this.recoveryService.isMobile;
                        const isChrome = this.recoveryService.isChrome;
                        
                        // Mobile gets earlier recovery only if corruption is likely, desktop gets early recovery for clear corruption
                        // Be more patient during fresh app loads to avoid false positive recovery triggers
                        const timeSinceLoad = Date.now() - performance.timing.navigationStart;
                        const isFreshAppLoad = timeSinceLoad < 5000; // Less than 5 seconds since page load
                        
                        const earlyMobileRecovery = isMobile && (attempt >= (isFreshAppLoad ? 10 : 6)) && mathJaxExists && !typesetExists;
                        // CONSERVATIVE FIX: Increase desktop Chrome recovery threshold further for fresh app loads
                        const earlyDesktopRecovery = !isMobile && isChrome && (attempt >= (isFreshAppLoad ? 12 : 8)) && mathJaxExists && !typesetExists;
                        const normalDesktopRecovery = !isMobile && (attempt >= maxRetries);
                        const shouldTriggerRecovery = earlyMobileRecovery || earlyDesktopRecovery || normalDesktopRecovery;
                        
                        // Debug logging for threshold analysis
                        if (!shouldTriggerRecovery && attempt >= 6) {
                            logger.debug(`🔧 ${isMobile ? 'Mobile' : 'Desktop'} waiting: attempt ${attempt}/${maxRetries}, mathJax: ${mathJaxExists}, typesetPromise: ${typesetExists}`);
                        }
                        
                        if (shouldTriggerRecovery) {
                            const recoveryType = earlyDesktopRecovery ? 'Desktop Chrome (early)' : 
                                               earlyMobileRecovery ? 'Mobile (early)' : 
                                               'Desktop (normal)';
                            logger.warn(`⚠️ ${recoveryType} MathJax not ready after ${attempt} attempts - MathJax: ${mathJaxExists}, typesetPromise: ${typesetExists}`);
                        } else {
                            logger.debug(`🔄 MathJax still loading after ${attempt} attempts (mobile: ${isMobile})`);
                        }
                        
                        // Check for F5 corruption and handle recovery (mobile gets earlier recovery)
                        if (shouldTriggerRecovery && this.recoveryService && this.recoveryService.detectF5Corruption()) {
                            const recoveryType = earlyDesktopRecovery ? 'Desktop Chrome (early)' : 
                                               earlyMobileRecovery ? 'Mobile (early)' : 
                                               'Desktop (normal)';
                            logger.warn(`🔍 ${recoveryType} F5 corruption detected - initiating recovery`);
                            
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
                        reject(new Error(`${isMobile ? 'Mobile' : 'Desktop'} MathJax not ready after ${attempt} attempts`));
                    }
                };
                
                // Execute immediately for fast mode, otherwise use timeout
                if (fastMode) {
                    executeRender();
                } else {
                    setTimeout(executeRender, renderTimeout);
                }
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