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
     */
    initializeMathJax() {
        // Make initialization completely asynchronous to not block main thread
        setTimeout(() => {
            try {
                if (this.initializationAttempted) {
                    return;
                }
                this.initializationAttempted = true;

                // Check if MathJax is already loaded
                if (window.MathJax) {
                    this.handleMathJaxReady();
                    return;
                }

                // Load MathJax if not present (asynchronously)
                this.loadMathJaxScript();
                
            } catch (error) {
                logger.warn('MathJax initialization error (non-blocking):', error);
                // Don't fail - the app works fine without MathJax
            }
        }, 100); // Small delay to let the main app initialize first
    }

    /**
     * Load MathJax script dynamically (with comprehensive error handling)
     */
    loadMathJaxScript() {
        try {
            // Set up MathJax configuration before loading
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$']],
                    displayMath: [['$$', '$$']],
                    processEscapes: true
                },
                options: {
                    ignoreHtmlClass: 'tex2jax_ignore',
                    processHtmlClass: 'tex2jax_process'
                },
                startup: {
                    ready: () => {
                        try {
                            window.MathJax.startup.defaultReady();
                            this.handleMathJaxReady();
                        } catch (error) {
                            logger.warn('MathJax startup error (non-blocking):', error);
                        }
                    }
                }
            };

            // Load MathJax script with comprehensive error handling
            const script = document.createElement('script');
            script.src = 'https://polyfill.io/v3/polyfill.min.js?features=es6';
            
            script.onload = () => {
                try {
                    const mathJaxScript = document.createElement('script');
                    mathJaxScript.id = 'MathJax-script';
                    mathJaxScript.async = true;
                    mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
                    
                    mathJaxScript.onerror = () => {
                        logger.warn('Failed to load MathJax script - app will continue without LaTeX support');
                    };
                    
                    document.head.appendChild(mathJaxScript);
                } catch (error) {
                    logger.warn('Error creating MathJax script (non-blocking):', error);
                }
            };
            
            script.onerror = () => {
                logger.warn('Failed to load MathJax polyfill - app will continue without LaTeX support');
            };
            
            document.head.appendChild(script);
            
        } catch (error) {
            logger.warn('Error in loadMathJaxScript (non-blocking):', error);
        }
    }

    /**
     * Handle MathJax ready state (with error handling)
     */
    handleMathJaxReady() {
        try {
            this.isReady = true;
            
            if (document.body) {
                document.body.classList.add('mathjax-ready');
            }
            
            window.mathJaxReady = true;
            logger.debug('MathJax ready for rendering');
        } catch (error) {
            logger.warn('Error in handleMathJaxReady (non-blocking):', error);
            // Still mark as ready to prevent blocking
            this.isReady = true;
            window.mathJaxReady = true;
        }
    }

    /**
     * Check if MathJax is available for rendering
     */
    isAvailable() {
        return this.isReady && 
               window.MathJax && 
               window.MathJax.typesetPromise && 
               typeof window.MathJax.typesetPromise === 'function';
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

            // Double-check that typesetPromise exists and is a function
            if (!window.MathJax.typesetPromise || typeof window.MathJax.typesetPromise !== 'function') {
                logger.warn('MathJax.typesetPromise not available, skipping render');
                return Promise.resolve();
            }

            this.renderingInProgress = true;
            
            // Use MathJax to render the elements with additional safety
            await window.MathJax.typesetPromise(validElements);
            
            logger.debug('MathJax rendering completed for', validElements.length, 'elements');
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