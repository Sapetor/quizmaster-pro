/**
 * MathJax Service - Centralized MathJax rendering and management
 * Consolidates duplicate MathJax logic from game-manager.js, quiz-manager.js, preview-manager.js
 */

export class MathJaxService {
    constructor() {
        this.isReady = false;
        this.pendingRenders = new Set();
        this.initializeMathJax();
    }

    /**
     * Initialize MathJax readiness detection
     */
    initializeMathJax() {
        if (window.MathJax) {
            this.isReady = true;
            return;
        }

        // Listen for MathJax ready event
        document.addEventListener('mathjax-ready', () => {
            this.isReady = true;
            this.processPendingRenders();
        });

        // Fallback: check periodically for MathJax
        const checkInterval = setInterval(() => {
            if (window.MathJax) {
                this.isReady = true;
                clearInterval(checkInterval);
                this.processPendingRenders();
            }
        }, 100);

        // Clear interval after 10 seconds to prevent memory leak
        setTimeout(() => clearInterval(checkInterval), 10000);
    }

    /**
     * Render MathJax for a specific element with retry mechanism
     * @param {HTMLElement} element - Element to render MathJax in
     * @param {number} timeout - Delay before rendering (default: 100ms)
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @returns {Promise<void>}
     */
    async renderElement(element, timeout = 100, maxRetries = 3) {
        return new Promise((resolve, reject) => {
            const attemptRender = (attempt = 1) => {
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        // Windows-specific: Clear any existing MathJax elements first
                        const existingMath = element.querySelectorAll('mjx-container');
                        existingMath.forEach(mjx => mjx.remove());
                        
                        window.MathJax.typesetPromise([element])
                            .then(() => {
                                this.pendingRenders.delete(element);
                                
                                // Windows-specific: Force a repaint after rendering
                                setTimeout(() => {
                                    element.style.visibility = 'hidden';
                                    element.offsetHeight; // Force reflow
                                    element.style.visibility = '';
                                    resolve();
                                }, 10);
                            })
                            .catch(error => {
                                console.error(`MathJax render error (attempt ${attempt}):`, error);
                                if (attempt < maxRetries) {
                                    // Increase timeout for Windows
                                    setTimeout(() => attemptRender(attempt + 1), timeout * 2);
                                } else {
                                    this.pendingRenders.delete(element);
                                    reject(error);
                                }
                            });
                    } else if (attempt < maxRetries) {
                        // Increase timeout for Windows
                        setTimeout(() => attemptRender(attempt + 1), timeout * 2);
                    } else {
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
    async renderElements(elements, timeout = 100) {
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
    async renderSelector(selector, container = document, timeout = 100) {
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
                console.warn(`MathJax render attempt ${attempt} failed:`, error);
                
                if (attempt < maxRetries) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, timeout * 2));
                }
            }
        }
        
        console.error(`MathJax rendering failed after ${maxRetries} attempts:`, lastError);
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
                console.error('Failed to process pending MathJax render:', error);
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
            hubExists: !!window.MathJax?.Hub
        };
    }

    /**
     * Legacy method for backward compatibility
     * @param {HTMLElement} element - Element to render
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void>}
     */
    async renderMathJax(element, timeout = 100) {
        return this.renderElement(element, timeout);
    }
}

// Create singleton instance
export const mathJaxService = new MathJaxService();

// Export for direct use
export default mathJaxService;