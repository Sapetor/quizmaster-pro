/**
 * Simple MathJax Service
 * Minimal implementation for reliable LaTeX rendering
 */

import { logger } from '../core/config.js';

export class SimpleMathJaxService {
    constructor() {
        this.isReady = false;
        this.renderingInProgress = false;
        this.initializationAttempted = false;
        
        // Simple cache for rendered content
        this.renderCache = new Map();
        
        this.initializeMathJax();
    }

    /**
     * Initialize MathJax
     */
    initializeMathJax() {
        setTimeout(() => {
            try {
                if (this.initializationAttempted) {
                    return;
                }
                this.initializationAttempted = true;

                // Check if MathJax is already ready
                if (window.mathJaxReady && window.MathJax && window.MathJax.typesetPromise) {
                    this.handleMathJaxReady();
                    return;
                }

                // Listen for mathjax-ready event from HTML config
                document.addEventListener('mathjax-ready', () => {
                    if (!this.isReady) {
                        this.handleMathJaxReady();
                    }
                });
                
                // Simple timeout fallback
                setTimeout(() => {
                    if (!this.isReady && document.body) {
                        document.body.classList.add('mathjax-ready');
                    }
                }, 3000);
                
            } catch (error) {
                logger.error('MathJax initialization error:', error);
            }
        }, 100);
    }

    /**
     * Handle MathJax ready state
     */
    handleMathJaxReady() {
        this.isReady = true;
        if (document.body) {
            document.body.classList.add('mathjax-ready');
        }
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            logger.debug('MathJax ready for rendering');
        } else {
            logger.warn('MathJax loaded but typesetPromise not available');
        }
    }

    /**
     * Check if MathJax is available
     */
    isAvailable() {
        return this.isReady && window.MathJax && window.MathJax.typesetPromise;
    }

    /**
     * Render LaTeX in specified elements
     */
    async render(elements) {
        try {
            if (!elements) {
                return Promise.resolve();
            }

            const elementArray = Array.isArray(elements) ? elements : [elements];
            const validElements = elementArray.filter(el => el && el.nodeType === Node.ELEMENT_NODE);
            
            if (validElements.length === 0) {
                return Promise.resolve();
            }

            if (!this.isAvailable()) {
                logger.debug('MathJax not available, content will show without LaTeX rendering');
                return Promise.resolve();
            }

            // Clear previous typeset data
            if (window.MathJax.typesetClear) {
                window.MathJax.typesetClear(validElements);
            }

            this.renderingInProgress = true;
            
            if (window.MathJax.typesetPromise) {
                logger.debug(`Rendering MathJax for ${validElements.length} elements`);
                await window.MathJax.typesetPromise(validElements);
                logger.debug('MathJax rendering completed');
            }
            
            return Promise.resolve();
            
        } catch (error) {
            logger.warn('MathJax rendering error (non-blocking):', error);
            return Promise.resolve();
        } finally {
            this.renderingInProgress = false;
        }
    }

    /**
     * Wait for MathJax to become available
     */
    async waitForMathJax(timeout = 1000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkReady = () => {
                if (this.isAvailable()) {
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime >= timeout) {
                    resolve(false);
                    return;
                }
                
                setTimeout(checkReady, 50);
            };
            
            checkReady();
        });
    }

    /**
     * Render LaTeX in entire document or container
     */
    async renderAll(container = document) {
        try {
            if (!container || !container.querySelectorAll) {
                return Promise.resolve();
            }
            
            const elements = container.querySelectorAll('.tex2jax_process, [data-latex="true"]');
            if (elements.length > 0) {
                logger.debug(`renderAll: processing ${elements.length} elements`);
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
     */
    hasLatex(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\[a-zA-Z]+/.test(text);
    }

    /**
     * Clear render cache
     */
    clearCache() {
        this.renderCache.clear();
        logger.debug('MathJax render cache cleared');
    }

    /**
     * Get service status
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

// Backward compatibility
if (typeof window !== 'undefined') {
    window.simpleMathJaxService = simpleMathJaxService;
}