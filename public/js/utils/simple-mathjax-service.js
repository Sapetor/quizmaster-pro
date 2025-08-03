/**
 * Simple MathJax Service
 * Replaces the over-engineered MathJax system with a clean, focused implementation
 * For local network quiz applications - no need for complex recovery mechanisms
 */

import { logger } from '../core/config.js';

export class SimpleMathJaxService {
    constructor() {
        this.isReady = false;
        this.renderingInProgress = false;
        this.initializationAttempted = false;
        
        // Simple cache for rendered content (optional optimization)
        this.renderCache = new Map();
        
        this.initializeMathJax();
    }

    /**
     * Initialize MathJax - simple and clean (non-blocking)
     * FIXED: No longer loads MathJax script since it's loaded in index.html
     */
    initializeMathJax() {
        // Make initialization completely asynchronous to not block main thread
        setTimeout(() => {
            try {
                if (this.initializationAttempted) {
                    return;
                }
                this.initializationAttempted = true;

                // Check if MathJax is already loaded (from index.html)
                if (window.MathJax && window.MathJax.startup) {
                    this.handleMathJaxReady();
                    return;
                }

                // Listen for MathJax ready event from index.html configuration
                document.addEventListener('mathjax-ready', () => {
                    this.handleMathJaxReady();
                });
                
            } catch (error) {
                logger.warn('MathJax initialization error (non-blocking):', error);
                // Don't fail - the app works fine without MathJax
            }
        }, 100); // Small delay to let the main app initialize first
    }

    /**
     * Handle MathJax ready state (with error handling)
     */
    handleMathJaxReady() {
        this.isReady = true;
        if (document.body) {
            document.body.classList.add('mathjax-ready');
        }
        
        // Validate MathJax functionality
        if (window.MathJax && window.MathJax.typesetPromise) {
            logger.debug('MathJax ready for rendering with typesetPromise support');
        } else if (window.MathJax) {
            logger.warn('MathJax loaded but missing typesetPromise - rendering may fail silently');
        } else {
            logger.error('MathJax object missing despite ready event');
            this.isReady = false;
        }
    }

    /**
     * Check if MathJax is available for rendering
     */
    isAvailable() {
        return this.isReady && window.MathJax;
    }

    /**
     * Render LaTeX in specified elements
     * @param {Element|Element[]} elements - Element(s) to render
     * @returns {Promise} Rendering promise
     */
    async render(elements) {
        // Always return a resolved promise to prevent blocking
        try {
            if (!elements) {
                return Promise.resolve();
            }

            // Normalize to array
            const elementArray = Array.isArray(elements) ? elements : [elements];
            
            // Filter out invalid elements
            const validElements = elementArray.filter(el => el && el.nodeType === Node.ELEMENT_NODE);
            
            if (validElements.length === 0) {
                return Promise.resolve();
            }

            // If MathJax isn't available, just resolve - don't block execution
            if (!this.isAvailable()) {
                logger.debug('MathJax not available, skipping render');
                return Promise.resolve();
            }

            this.renderingInProgress = true;
            
            // Simple MathJax rendering with better error detection
            if (window.MathJax.typesetPromise) {
                logger.debug(`Rendering MathJax for ${validElements.length} elements`);
                await window.MathJax.typesetPromise(validElements);
                logger.debug('MathJax rendering completed successfully');
            } else {
                logger.error('MathJax.typesetPromise not available - rendering failed');
            }
            
            return Promise.resolve();
            
        } catch (error) {
            logger.warn('MathJax rendering error (non-blocking):', error);
            return Promise.resolve(); // Always resolve - never reject to prevent app breakage
        } finally {
            this.renderingInProgress = false;
        }
    }

    /**
     * Render LaTeX in entire document or container
     * @param {Element} container - Container to render (optional, defaults to document)
     */
    async renderAll(container = document) {
        try {
            if (!container || !container.querySelectorAll) {
                return Promise.resolve();
            }
            
            const elements = container.querySelectorAll('.tex2jax_process, [data-latex="true"]');
            if (elements.length > 0) {
                return this.render(Array.from(elements));
            }
            return Promise.resolve();
        } catch (error) {
            logger.warn('renderAll error (non-blocking):', error);
            return Promise.resolve();
        }
    }

    /**
     * Check if text contains LaTeX
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    hasLatex(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        
        // Check for common LaTeX patterns
        return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\[a-zA-Z]+/.test(text);
    }

    /**
     * Clear render cache (for memory management)
     */
    clearCache() {
        this.renderCache.clear();
        logger.debug('MathJax render cache cleared');
    }

    /**
     * Get service status for debugging
     */
    getStatus() {
        return {
            isReady: this.isReady,
            isAvailable: this.isAvailable(),
            renderingInProgress: this.renderingInProgress,
            cacheSize: this.renderCache.size
        };
    }
}

// Create singleton instance
export const simpleMathJaxService = new SimpleMathJaxService();

// Backward compatibility - expose as window global if needed
if (typeof window !== 'undefined') {
    window.simpleMathJaxService = simpleMathJaxService;
}