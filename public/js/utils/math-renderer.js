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

export class MathRenderer {
    constructor() {
        this.mathJaxRenderTimeout = null;
        this.processingElements = new Set();
        this.mathJaxReady = window.mathJaxReady || false;
        
        // Listen for MathJax ready event
        if (!this.mathJaxReady) {
            document.addEventListener('mathjax-ready', () => {
                this.mathJaxReady = true;
                console.log('MathRenderer: MathJax is now ready');
            });
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
                    console.warn('MathJax rendering failed:', err);
                    // Remove processing class even on error
                    element.classList.remove('processing-math');
                    element.classList.add('math-ready');
                    this.processingElements.delete(element);
                    
                    // Fallback: try global typeset if element-specific fails
                    MathJax.typesetPromise().catch(globalErr => {
                        console.warn('Global MathJax rendering also failed:', globalErr);
                    });
                });
            } else if (attempt < 3) {
                setTimeout(() => tryRender(attempt + 1), 200);
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
        
        this.mathJaxRenderTimeout = setTimeout(() => {
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
                
                // Use requestAnimationFrame to avoid blocking UI interactions
                requestAnimationFrame(() => {
                    // Clear existing MathJax processed content before re-rendering
                    document.querySelectorAll('.MathJax_Processing').forEach(el => {
                        el.classList.remove('MathJax_Processing');
                    });
                    
                    window.MathJax.typesetPromise().then(() => {
                        // Post-processing to ensure proper display
                        document.querySelectorAll('.mjx-container').forEach(container => {
                            container.style.display = 'inline-block';
                            container.style.verticalAlign = 'middle';
                            container.classList.add('MathJax_Processed');
                            
                            // Prevent pointer events on MathJax elements
                            container.style.pointerEvents = 'none';
                            
                            // Ensure LaTeX content is properly sized
                            if (container.closest('.player-option, .tf-option, .checkbox-option')) {
                                container.style.fontSize = '0.9em';
                                container.style.maxWidth = '100%';
                            }
                        });
                        
                        // Remove processing classes and show content
                        elementsWithMath.forEach(el => {
                            el.classList.remove('processing-math');
                            el.classList.add('math-ready');
                            this.processingElements.delete(el);
                        });
                    }).catch(err => {
                        console.warn('MathJax rendering failed:', err);
                        // Remove processing classes even on error
                        elementsWithMath.forEach(el => {
                            el.classList.remove('processing-math');
                            el.classList.add('math-ready');
                            this.processingElements.delete(el);
                        });
                    });
                });
            }
        }, 100); // Debounce delay
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
    waitForMathJax(timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkReady = () => {
                if (this.isMathJaxReady()) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    resolve(false);
                } else {
                    setTimeout(checkReady, 100);
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