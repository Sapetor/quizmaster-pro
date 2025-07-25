/**
 * DOM Utilities for MathJax Service
 * Optimized DOM operations to replace O(n) queries with O(1) cached operations
 */

export class DOMUtils {
    constructor() {
        // Cache tracked elements for efficient cleanup
        this.trackedScripts = new Set();
        this.trackedMathJaxElements = new Set();
        this.observers = new Map();
    }

    /**
     * Find and cache MathJax script elements
     * @returns {Set} Set of tracked script elements
     */
    findMathJaxScripts() {
        // Only query DOM if cache is empty
        if (this.trackedScripts.size === 0) {
            const scripts = document.querySelectorAll('script[src*="mathjax"], script[src*="tex-mml-chtml"], script[id="MathJax-script"]');
            scripts.forEach(script => this.trackedScripts.add(script));
        }
        return this.trackedScripts;
    }

    /**
     * Find and cache MathJax-related DOM elements
     * @returns {Set} Set of tracked MathJax elements
     */
    findMathJaxElements() {
        // Only query DOM if cache is empty
        if (this.trackedMathJaxElements.size === 0) {
            const elements = document.querySelectorAll('[id^="MathJax"], [class*="MathJax"], [class*="mjx"], .mathjax-loading, .mathjax-ready');
            elements.forEach(element => this.trackedMathJaxElements.add(element));
        }
        return this.trackedMathJaxElements;
    }

    /**
     * Efficiently remove all tracked MathJax scripts
     * O(1) operation instead of O(n) DOM query
     */
    removeTrackedScripts() {
        this.trackedScripts.forEach(script => {
            try {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            } catch (error) {
                // Element might already be removed, ignore
            }
        });
        this.trackedScripts.clear();
    }

    /**
     * Efficiently remove all tracked MathJax elements
     * O(1) operation instead of O(n) DOM query
     */
    removeTrackedMathJaxElements() {
        this.trackedMathJaxElements.forEach(element => {
            try {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            } catch (error) {
                // Element might already be removed, ignore
            }
        });
        this.trackedMathJaxElements.clear();
    }

    /**
     * Create and track a new script element
     * @param {Object} config Script configuration
     * @returns {HTMLScriptElement} Created script element
     */
    createTrackedScript(config = {}) {
        const script = document.createElement('script');
        
        // Apply configuration
        script.type = config.type || 'text/javascript';
        script.async = config.async !== false; // Default to true
        if (config.id) script.id = config.id;
        if (config.src) script.src = config.src;
        
        // Track the script for efficient cleanup
        this.trackedScripts.add(script);
        
        return script;
    }

    /**
     * Track an existing DOM element for efficient cleanup
     * @param {HTMLElement} element Element to track
     * @param {string} type Type of element ('script' or 'mathjax')
     */
    trackElement(element, type = 'mathjax') {
        if (type === 'script') {
            this.trackedScripts.add(element);
        } else {
            this.trackedMathJaxElements.add(element);
        }
    }

    /**
     * Remove tracking for an element
     * @param {HTMLElement} element Element to untrack
     */
    untrackElement(element) {
        this.trackedScripts.delete(element);
        this.trackedMathJaxElements.delete(element);
    }

    /**
     * Clean up all tracked elements and observers
     * Complete O(1) cleanup instead of expensive DOM queries
     */
    cleanup() {
        try {
            // Remove all tracked scripts
            this.removeTrackedScripts();
            
            // Remove all tracked MathJax elements
            this.removeTrackedMathJaxElements();
            
            // Disconnect all observers
            this.observers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (error) {
                    // Observer might already be disconnected
                }
            });
            this.observers.clear();
            
        } catch (error) {
            console.warn('Error during DOM cleanup:', error);
        }
    }

    /**
     * Get cleanup statistics
     * @returns {Object} Cleanup statistics
     */
    getStats() {
        return {
            trackedScripts: this.trackedScripts.size,
            trackedMathJaxElements: this.trackedMathJaxElements.size,
            activeObservers: this.observers.size
        };
    }

    /**
     * Reset all caches (useful for testing)
     */
    resetCache() {
        this.trackedScripts.clear();
        this.trackedMathJaxElements.clear();
        this.observers.clear();
    }
}

// Export singleton instance for global use
export const domUtils = new DOMUtils();