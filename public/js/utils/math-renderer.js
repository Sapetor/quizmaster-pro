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
import { coreCoordinator } from './mathjax/core-coordinator.js';

export class MathRenderer {
    constructor() {
        this.mathJaxRenderTimeout = null;
        this.processingElements = new Set();
        // Delegate to Core Coordinator for MathJax readiness
        this.mathJaxReady = false;
        
        // Initialize with Core Coordinator
        this.coreCoordinator = coreCoordinator;
        
        logger.debug('🔄 MathRenderer: Delegating to Core Coordinator system');
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
    async renderMathJax(element) {
        if (!element) return;
        
        try {
            // Delegate to Core Coordinator for consistent, efficient rendering
            await this.coreCoordinator.render(element);
            
            // Ensure proper display styling after rendering
            const containers = element.querySelectorAll('.mjx-container');
            containers.forEach(container => {
                container.style.display = 'inline-block';
                container.style.verticalAlign = 'middle';
                container.classList.add('MathJax_Processed');
                
                // Prevent pointer events on MathJax elements to allow parent clicking
                container.style.pointerEvents = 'none';
            });
            
        } catch (err) {
            logger.warn('MathJax rendering failed via Core Coordinator:', err);
        }
    }

    /**
     * Render MathJax globally with debouncing for performance
     */
    async renderMathJaxGlobal() {
        if (this.mathJaxRenderTimeout) {
            clearTimeout(this.mathJaxRenderTimeout);
        }
        
        try {
            // Find all elements with math content
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
            
            const mathElements = Array.from(elementsWithMath).filter(el => 
                el.textContent.includes('$') || el.innerHTML.includes('$')
            );
            
            if (mathElements.length === 0) {
                logger.debug('🧮 No elements with LaTeX found for global rendering');
                return;
            }
            
            logger.debug('🧮 Global MathJax rendering for', mathElements.length, 'elements');
            
            // Delegate to Core Coordinator for batch rendering
            await this.coreCoordinator.renderBatch(mathElements);
            
            logger.debug('✅ Global MathJax rendering completed via Core Coordinator');
            
        } catch (err) {
            logger.error('❌ Global MathJax rendering failed:', err);
        }
    }

    /**
     * Render MathJax only for editor elements (quiz builder) - prevents game element contamination
     */
    async renderMathJaxForEditor() {
        if (this.mathJaxRenderTimeout) {
            clearTimeout(this.mathJaxRenderTimeout);
        }
        
        try {
            // Only target editor elements, NEVER game elements
            const editorElements = document.querySelectorAll([
                '[data-has-math]',
                '.question-text',               // Editor question inputs
                '#preview-question-text-split', // Preview area
                '#preview-answer-area-split',   // Preview answers
                '.preview-content',             // Preview content
                '.preview-content-split'        // Split preview
            ].join(', '));
            
            const elementsWithMath = Array.from(editorElements).filter(el => 
                el.textContent.includes('$') || el.innerHTML.includes('$')
            );
            
            if (elementsWithMath.length === 0) {
                logger.debug('🧮 No editor elements with LaTeX found');
                return;
            }
            
            logger.debug('🧮 Editor MathJax rendering for', elementsWithMath.length, 'elements (avoiding game elements)');
            
            // Delegate to Core Coordinator for consistent processing
            await this.coreCoordinator.renderBatch(elementsWithMath, { fastMode: true });
            
            logger.debug('✅ Editor MathJax rendering completed via Core Coordinator');
            
        } catch (err) {
            logger.error('❌ Editor MathJax rendering failed:', err);
        }
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