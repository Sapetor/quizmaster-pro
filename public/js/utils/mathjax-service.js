/**
 * MathJax Service - Centralized MathJax rendering and management
 * Consolidates duplicate MathJax logic from game-manager.js, quiz-manager.js, preview-manager.js
 */

import { TIMING, logger } from '../core/config.js';

export class MathJaxService {
    constructor() {
        this.isReady = false;
        this.pendingRenders = new Set();
        this.isWindows = this.detectWindows();
        this.initializeMathJax();
    }

    /**
     * Detect if running on Windows
     * @returns {boolean}
     */
    detectWindows() {
        return navigator.platform.toLowerCase().includes('win') || 
               navigator.userAgent.toLowerCase().includes('windows');
    }

    /**
     * Initialize MathJax readiness detection
     */
    initializeMathJax() {
        if (this.isAvailable()) {
            this.isReady = true;
            logger.debug('🔍 MathJax service: MathJax already fully available with typesetPromise');
            return;
        }

        logger.debug('🔍 MathJax service: Waiting for MathJax to load...');

        // Listen for MathJax ready event
        document.addEventListener('mathjax-ready', () => {
            logger.debug('🔍 MathJax service: Received mathjax-ready event');
            this.isReady = true;
            this.processPendingRenders();
        });

        // Fallback: check periodically for MathJax with full readiness check
        const checkInterval = setInterval(() => {
            if (this.isAvailable()) {
                logger.debug('🔍 MathJax service: MathJax fully ready detected via polling (including typesetPromise)');
                this.isReady = true;
                clearInterval(checkInterval);
                this.processPendingRenders();
            }
        }, 100);

        // Clear interval after 10 seconds to prevent memory leak
        setTimeout(() => clearInterval(checkInterval), 10000); // Keep 10s for MathJax loading timeout
        
        // Make status available globally for debugging
        window.debugMathJax = () => {
            logger.debug('🔍 MathJax Debug Status:', this.getStatus());
        };
        
        // Force MathJax initialization check
        window.forceMathJaxCheck = () => {
            logger.debug('🔧 Forcing MathJax initialization check...');
            if (this.isAvailable()) {
                logger.debug('✅ MathJax is now ready!');
                this.isReady = true;
                this.processPendingRenders();
            } else {
                logger.debug('❌ MathJax still not ready');
            }
        };
    }

    /**
     * Render MathJax for a specific element with retry mechanism
     * @param {HTMLElement} element - Element to render MathJax in
     * @param {number} timeout - Delay before rendering (default: 100ms)
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @returns {Promise<void>}
     */
    async renderElement(element, timeout = TIMING.MATHJAX_TIMEOUT, maxRetries = 10) {
        return new Promise((resolve, reject) => {
            const attemptRender = (attempt = 1) => {
                setTimeout(() => {
                    logger.debug(`🔍 MathJax render attempt ${attempt}/${maxRetries} - Platform: ${this.isWindows ? 'Windows' : 'Other'}`);
                    logger.debug(`🔍 MathJax available: ${!!window.MathJax}, typesetPromise: ${!!window.MathJax?.typesetPromise}`);
                    const hasLatexContent = element.innerHTML.includes('$$') || 
                                        element.innerHTML.includes('\\(') ||
                                        element.innerHTML.includes('\\[') ||
                                        element.innerHTML.includes('$') ||  // Single dollar delimiters
                                        element.innerHTML.includes('\\frac') ||  // Common LaTeX commands
                                        element.innerHTML.includes('\\sqrt') ||
                                        element.innerHTML.includes('\\sum') ||
                                        element.innerHTML.includes('\\int');
                    logger.debug(`🔍 Element has LaTeX content: ${hasLatexContent}`);
                    
                    if (this.isAvailable()) {
                        // Conservative approach: Let MathJax handle its own element management
                        
                        logger.debug(`🔍 Calling MathJax.typesetPromise on element with content: ${element.innerHTML.substring(0, 200)}...`);
                        
                        window.MathJax.typesetPromise([element])
                            .then(() => {
                                logger.debug(`✅ MathJax render successful on attempt ${attempt}`);
                                this.pendingRenders.delete(element);
                                
                                resolve();
                            })
                            .catch(error => {
                                logger.error(`❌ MathJax render error (attempt ${attempt}):`, error);
                                if (attempt < maxRetries) {
                                    logger.debug(`🔍 Retrying in ${timeout}ms...`);
                                    setTimeout(() => attemptRender(attempt + 1), TIMING.MATHJAX_RETRY_TIMEOUT);
                                } else {
                                    this.pendingRenders.delete(element);
                                    reject(error);
                                }
                            });
                    } else if (attempt < maxRetries) {
                        logger.debug(`⏳ MathJax not ready (MathJax: ${!!window.MathJax}, typesetPromise: ${!!window.MathJax?.typesetPromise}), retrying in ${timeout}ms...`);
                        setTimeout(() => attemptRender(attempt + 1), TIMING.MATHJAX_RETRY_TIMEOUT);
                    } else {
                        const mathJaxExists = !!window.MathJax;
                        const typesetExists = !!window.MathJax?.typesetPromise;
                        logger.error(`❌ MathJax not fully ready after ${maxRetries} attempts - MathJax: ${mathJaxExists}, typesetPromise: ${typesetExists}`);
                        this.pendingRenders.delete(element);
                        resolve(); // Resolve anyway to prevent hanging
                    }
                }, timeout);
            };

            this.pendingRenders.add(element);
            attemptRender();
        });
    }

    /**
     * Render MathJax for multiple elements
     * @param {HTMLElement[]} elements - Array of elements to render
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void[]>}
     */
    async renderElements(elements, timeout = TIMING.MATHJAX_TIMEOUT) {
        const renderPromises = elements.map(element => 
            this.renderElement(element, timeout)
        );
        return Promise.all(renderPromises);
    }

    /**
     * Render MathJax for all elements matching a selector
     * @param {string} selector - CSS selector for elements to render
     * @param {HTMLElement} container - Container to search within (default: document)
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void[]>}
     */
    async renderSelector(selector, container = document, timeout = TIMING.MATHJAX_TIMEOUT) {
        const elements = Array.from(container.querySelectorAll(selector));
        return this.renderElements(elements, timeout);
    }

    /**
     * Render MathJax with enhanced retry mechanism (for complex scenarios)
     * @param {HTMLElement} element - Element to render
     * @param {number} baseTimeout - Base timeout between attempts
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Promise<void>}
     */
    async renderWithRetry(element, baseTimeout = 100, maxRetries = 5) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const timeout = baseTimeout * attempt; // Exponential backoff
                await this.renderElement(element, timeout, 1);
                return; // Success
            } catch (error) {
                lastError = error;
                logger.warn(`MathJax render attempt ${attempt} failed:`, error);
                
                if (attempt < maxRetries) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, TIMING.MATHJAX_RETRY_TIMEOUT));
                }
            }
        }
        
        logger.error(`MathJax rendering failed after ${maxRetries} attempts:`, lastError);
        throw lastError;
    }

    /**
     * Process pending renders when MathJax becomes ready
     */
    processPendingRenders() {
        if (this.pendingRenders.size === 0) return;

        const elements = Array.from(this.pendingRenders);
        this.pendingRenders.clear();

        elements.forEach(element => {
            this.renderElement(element).catch(error => {
                logger.error('Failed to process pending MathJax render:', error);
            });
        });
    }

    /**
     * Check if MathJax is ready for rendering
     * @returns {boolean}
     */
    isAvailable() {
        return !!(window.MathJax && window.MathJax.typesetPromise);
    }

    /**
     * Get MathJax status information for debugging
     * @returns {object}
     */
    getStatus() {
        return {
            isReady: this.isReady,
            mathJaxExists: !!window.MathJax,
            typesetPromiseExists: !!window.MathJax?.typesetPromise,
            pendingRenders: this.pendingRenders.size,
            startupExists: !!window.MathJax?.startup,
            tex2jaxExists: !!window.MathJax?.tex2jax,
            hubExists: !!window.MathJax?.Hub,
            isWindows: this.isWindows,
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100) + '...' // Truncated for readability
        };
    }

    /**
     * Legacy method for backward compatibility
     * @param {HTMLElement} element - Element to render
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void>}
     */
    async renderMathJax(element, timeout = TIMING.MATHJAX_TIMEOUT) {
        return this.renderElement(element, timeout);
    }
}

// Create singleton instance
export const mathJaxService = new MathJaxService();

// Export for direct use
export default mathJaxService;