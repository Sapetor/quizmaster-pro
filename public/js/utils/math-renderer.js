/**
 * Math/LaTeX Renderer Module
 * Handles MathJax rendering and mathematical content formatting
 * 
 * EXTRACTION NOTES:
 * - Extracted from script.js lines 2742-2823, 3862-3921
 * - Includes robust MathJax integration with fallbacks and error handling
 * - Manages LaTeX rendering for quiz questions and answers
 * - Includes code block formatting for programming content
 * - Dependencies: MathJax (loaded externally)
 */

import { TIMING, logger } from '../core/config.js';

export class MathRenderer {
    constructor() {
        this.mathJaxRenderTimeout = null;
        this.processingElements = new Set();
        // Check multiple readiness indicators for maximum compatibility
        this.mathJaxReady = window.mathJaxReady || document.body.classList.contains('mathjax-ready') || false;
        
        // Listen for MathJax ready event
        if (!this.mathJaxReady) {
            document.addEventListener('mathjax-ready', () => {
                this.mathJaxReady = true;
                logger.debug('MathRenderer: MathJax is now ready');
            });
        }
    }

    /**
     * Wait for MathJax to be ready before executing callback
     * @param {Function} callback - Function to execute when MathJax is ready
     */
    waitForMathJaxReady(callback) {
        // Check both instance flag and global indicators for maximum compatibility
        if (window.MathJax && window.MathJax.typesetPromise && 
            (this.mathJaxReady || window.mathJaxReady || document.body.classList.contains('mathjax-ready'))) {
            callback();
        } else {
            // Wait with polling and event listening
            const checkReady = () => {
                if (window.MathJax && window.MathJax.typesetPromise && 
                    (this.mathJaxReady || window.mathJaxReady || document.body.classList.contains('mathjax-ready'))) {
                    this.mathJaxReady = true;
                    callback();
                } else {
                    setTimeout(checkReady, TIMING.MATHJAX_CHECK_INTERVAL);
                }
            };
            
            // Also listen for the mathjax-ready event in case we missed it
            const readyHandler = () => {
                this.mathJaxReady = true;
                document.removeEventListener('mathjax-ready', readyHandler);
                callback();
            };
            
            document.addEventListener('mathjax-ready', readyHandler);
            checkReady();
        }
    }

    /**
     * Render MathJax for a specific element
     * @param {HTMLElement} element - Element to render math content in
     */
    renderMathJax(element) {
        if (!element) return;
        
        // Add processing class to prevent flash
        element.classList.add('processing-math');
        this.processingElements.add(element);
        
        const tryRender = (attempt = 0) => {
            if (this.mathJaxReady && window.MathJax && window.MathJax.typesetPromise) {
                // Clear any existing MathJax content in the element first
                const mathJaxElements = element.querySelectorAll('.MathJax, .mjx-container');
                mathJaxElements.forEach(el => el.remove());
                
                // Use a more robust rendering approach
                MathJax.typesetPromise([element]).then(() => {
                    // Ensure proper display after rendering
                    const containers = element.querySelectorAll('.mjx-container');
                    containers.forEach(container => {
                        container.style.display = 'inline-block';
                        container.style.verticalAlign = 'middle';
                        container.classList.add('MathJax_Processed');
                        
                        // Prevent pointer events on MathJax elements to allow parent clicking
                        container.style.pointerEvents = 'none';
                    });
                    
                    // Remove processing class and show content
                    element.classList.remove('processing-math');
                    element.classList.add('math-ready');
                    this.processingElements.delete(element);
                }).catch(err => {
                    logger.warn('MathJax rendering failed:', err);
                    // Remove processing class even on error
                    element.classList.remove('processing-math');
                    element.classList.add('math-ready');
                    this.processingElements.delete(element);
                    
                    // Fallback: try global typeset if element-specific fails
                    MathJax.typesetPromise().catch(globalErr => {
                        logger.warn('Global MathJax rendering also failed:', globalErr);
                    });
                });
            } else if (attempt < 3) {
                setTimeout(() => tryRender(attempt + 1), TIMING.MATHJAX_RETRY_TIMEOUT);
            } else {
                // Silently fail after 3 attempts to reduce log spam
                element.classList.remove('processing-math');
                element.classList.add('math-ready');
                this.processingElements.delete(element);
            }
        };
        
        tryRender();
    }

    /**
     * Render MathJax globally with debouncing for performance
     */
    renderMathJaxGlobal() {
        if (this.mathJaxRenderTimeout) {
            clearTimeout(this.mathJaxRenderTimeout);
        }
        
        // Wait for MathJax to be ready, especially important after page reload
        this.waitForMathJaxReady(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                // Add processing class to elements with math content
                const elementsWithMath = document.querySelectorAll([
                    '[data-has-math]',
                    '.question-text',
                    '#current-question',
                    '#player-question-text',
                    '.player-option',
                    '.option-display',
                    '#preview-question-text-split',
                    '#preview-answer-area-split',
                    '.preview-content',
                    '.preview-content-split'
                ].join(', '));
                
                elementsWithMath.forEach(el => {
                    if (el.textContent.includes('$') || el.innerHTML.includes('$')) {
                        el.classList.add('processing-math');
                        this.processingElements.add(el);
                    }
                });
                
                logger.debug('🧮 Global MathJax rendering for', elementsWithMath.length, 'elements');
                
                window.MathJax.typesetPromise(elementsWithMath).then(() => {
                    logger.debug('✅ Global MathJax rendering completed');
                    
                    // Remove processing classes
                    elementsWithMath.forEach(el => {
                        el.classList.remove('processing-math');
                        el.classList.add('math-ready');
                        this.processingElements.delete(el);
                    });
                }).catch(err => {
                    logger.error('❌ Global MathJax rendering failed:', err);
                    elementsWithMath.forEach(el => {
                        el.classList.remove('processing-math');
                        this.processingElements.delete(el);
                    });
                });
            }
        });
    }

    /**
     * Render MathJax only for editor elements (quiz builder) - prevents game element contamination
     */
    renderMathJaxForEditor() {
        if (this.mathJaxRenderTimeout) {
            clearTimeout(this.mathJaxRenderTimeout);
        }
        
        // Wait for MathJax to be ready, especially important after page reload
        this.waitForMathJaxReady(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                // Only target editor elements, NEVER game elements
                const editorElements = document.querySelectorAll([
                    '[data-has-math]',
                    '.question-text',               // Editor question inputs
                    '#preview-question-text-split', // Preview area
                    '#preview-answer-area-split',   // Preview answers
                    '.preview-content',             // Preview content
                    '.preview-content-split'        // Split preview
                ].join(', '));
                
                editorElements.forEach(el => {
                    if (el.textContent.includes('$') || el.innerHTML.includes('$')) {
                        el.classList.add('processing-math');
                        this.processingElements.add(el);
                    }
                });
                
                logger.debug('🧮 Editor MathJax rendering for', editorElements.length, 'elements (avoiding game elements)');
                
                window.MathJax.typesetPromise(editorElements).then(() => {
                    logger.debug('✅ Editor MathJax rendering completed');
                    
                    // Remove processing classes
                    editorElements.forEach(el => {
                        el.classList.remove('processing-math');
                        el.classList.add('math-ready');
                        this.processingElements.delete(el);
                    });
                }).catch(err => {
                    logger.error('❌ Editor MathJax rendering failed:', err);
                    editorElements.forEach(el => {
                        el.classList.remove('processing-math');
                        this.processingElements.delete(el);
                    });
                });
            }
        });
    }

    /**
     * Format code blocks in text content
     * @param {string} text - Text containing code blocks
     * @returns {string} - Formatted text with HTML code blocks
     */
    formatCodeBlocks(text) {
        if (!text) return text;
        
        // Convert code blocks (```language ... ```)
        text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, language, code) => {
            const lang = language || 'text';
            const trimmedCode = code.trim();
            return `<pre><code class="language-${lang}">${this.escapeHtml(trimmedCode)}</code></pre>`;
        });
        
        // Convert inline code (`code`)
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        return text;
    }

    /**
     * Escape HTML entities in text
     * @param {string} text - Text to escape
     * @returns {string} - HTML-escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Process both code formatting and MathJax rendering for an element
     * @param {HTMLElement} element - Element to process
     */
    processContentFormatting(element) {
        if (!element) return;
        
        // First, format code blocks
        element.innerHTML = this.formatCodeBlocks(element.innerHTML);
        
        // Then render MathJax
        this.renderMathJax(element);
    }

    /**
     * Check if MathJax is available and ready
     * @returns {boolean} - Whether MathJax is ready
     */
    isMathJaxReady() {
        return window.MathJax && window.MathJax.typesetPromise;
    }

    /**
     * Wait for MathJax to be ready
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<boolean>} - Resolves when MathJax is ready
     */
    waitForMathJax(timeout = TIMING.MATH_RENDERER_TIMEOUT) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkReady = () => {
                if (this.isMathJaxReady()) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    resolve(false);
                } else {
                    setTimeout(checkReady, TIMING.DOM_UPDATE_DELAY);
                }
            };
            checkReady();
        });
    }

    /**
     * Clean up any processing timeouts and states
     */
    cleanup() {
        if (this.mathJaxRenderTimeout) {
            clearTimeout(this.mathJaxRenderTimeout);
            this.mathJaxRenderTimeout = null;
        }
        
        // Remove processing classes from any stuck elements
        this.processingElements.forEach(element => {
            element.classList.remove('processing-math');
            element.classList.add('math-ready');
        });
        this.processingElements.clear();
    }

    /**
     * Force re-render all math content on the page
     */
    forceRerender() {
        // Remove all existing MathJax content
        document.querySelectorAll('.mjx-container, .MathJax').forEach(el => el.remove());
        
        // Remove ready classes to force re-processing
        document.querySelectorAll('.math-ready').forEach(el => {
            el.classList.remove('math-ready');
        });
        
        // Re-render everything
        this.renderMathJaxGlobal();
    }
}