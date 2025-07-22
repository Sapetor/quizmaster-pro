/**
 * DOM Manager - Centralized DOM element management with caching
 * Reduces redundant DOM queries and improves performance
 */

export class DOMManager {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
        this.initialized = false;
    }

    /**
     * Get element by ID with caching
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    get(id) {
        if (this.cache.has(id)) {
            const element = this.cache.get(id);
            // Check if element is still in DOM
            if (element && document.contains(element)) {
                return element;
            } else {
                // Remove stale cache entry
                this.cache.delete(id);
            }
        }

        const element = document.getElementById(id);
        if (element) {
            this.cache.set(id, element);
        }
        return element;
    }

    /**
     * Query selector with optional caching
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Context element (default: document)
     * @param {boolean} cache - Whether to cache result (default: false)
     * @returns {HTMLElement|null}
     */
    query(selector, context = document, cache = false) {
        const cacheKey = cache ? `${selector}:${context === document ? 'document' : context.id || 'element'}` : null;
        
        if (cache && cacheKey && this.cache.has(cacheKey)) {
            const element = this.cache.get(cacheKey);
            if (element && document.contains(element)) {
                return element;
            } else {
                this.cache.delete(cacheKey);
            }
        }

        const element = context.querySelector(selector);
        if (cache && cacheKey && element) {
            this.cache.set(cacheKey, element);
        }
        return element;
    }

    /**
     * Query all elements matching selector
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Context element (default: document)
     * @returns {NodeList}
     */
    queryAll(selector, context = document) {
        return context.querySelectorAll(selector);
    }

    /**
     * Get multiple elements by IDs
     * @param {string[]} ids - Array of element IDs
     * @returns {Object<string, HTMLElement>}
     */
    getMultiple(ids) {
        const elements = {};
        ids.forEach(id => {
            elements[id] = this.get(id);
        });
        return elements;
    }

    /**
     * Set element content with optional formatting
     * @param {string} id - Element ID
     * @param {string} content - Content to set
     * @param {boolean} isHTML - Whether content is HTML (default: false)
     */
    setContent(id, content, isHTML = false) {
        const element = this.get(id);
        if (element) {
            if (isHTML) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
        }
    }

    /**
     * Toggle element visibility
     * @param {string} id - Element ID
     * @param {boolean} show - Whether to show element (optional, toggles if undefined)
     */
    toggle(id, show) {
        const element = this.get(id);
        if (element) {
            if (show === undefined) {
                element.style.display = element.style.display === 'none' ? 'block' : 'none';
            } else {
                element.style.display = show ? 'block' : 'none';
            }
        }
    }

    /**
     * Common pattern: set content if element exists, with optional fallback
     * @param {string} id - Element ID
     * @param {string} content - Primary content
     * @param {string} fallback - Fallback content if primary is empty
     */
    safeSetContent(id, content, fallback = '') {
        const finalContent = content || fallback;
        if (finalContent) {
            this.setContent(id, finalContent);
        }
    }

    /**
     * Batch update multiple elements efficiently  
     * @param {Object<string, string>} updates - Object mapping element IDs to content
     */
    batchUpdate(updates) {
        for (const [id, content] of Object.entries(updates)) {
            this.setContent(id, content);
        }
    }

    /**
     * Common pattern: update element disabled state
     * @param {string} id - Element ID
     * @param {boolean} disabled - Whether element should be disabled
     */
    setDisabled(id, disabled) {
        const element = this.get(id);
        if (element) {
            element.disabled = disabled;
        }
    }

    /**
     * Add event listener with automatic cleanup
     * @param {string} id - Element ID
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(id, event, handler, options = {}) {
        const element = this.get(id);
        if (element) {
            element.addEventListener(event, handler, options);
            
            // Store for cleanup
            const key = `${id}:${event}`;
            if (!this.observers.has(key)) {
                this.observers.set(key, []);
            }
            this.observers.get(key).push({ handler, options });
        }
    }

    /**
     * Remove event listener
     * @param {string} id - Element ID
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    removeEventListener(id, event, handler) {
        const element = this.get(id);
        if (element) {
            element.removeEventListener(event, handler);
            
            // Remove from observers
            const key = `${id}:${event}`;
            if (this.observers.has(key)) {
                const listeners = this.observers.get(key);
                const index = listeners.findIndex(l => l.handler === handler);
                if (index > -1) {
                    listeners.splice(index, 1);
                    if (listeners.length === 0) {
                        this.observers.delete(key);
                    }
                }
            }
        }
    }

    /**
     * Clear all cached elements
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Clear cache for specific element
     * @param {string} id - Element ID
     */
    clearElement(id) {
        this.cache.delete(id);
    }

    /**
     * Check if element exists in DOM
     * @param {string} id - Element ID
     * @returns {boolean}
     */
    exists(id) {
        return !!this.get(id);
    }

    /**
     * Get cache statistics for debugging
     * @returns {Object}
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            observersCount: this.observers.size,
            cachedElements: Array.from(this.cache.keys())
        };
    }

    /**
     * Batch operations for better performance
     * @param {Function} operations - Function containing DOM operations
     */
    batch(operations) {
        // Disable cache during batch operations
        const originalGet = this.get;
        this.get = (id) => document.getElementById(id);
        
        try {
            operations();
        } finally {
            // Restore cache functionality
            this.get = originalGet;
        }
    }

    /**
     * Initialize common game elements (can be called on game start)
     */
    initializeGameElements() {
        const commonIds = [
            'player-question-text',
            'current-question',
            'answer-options',
            'game-pin',
            'question-counter',
            'player-question-counter',
            'answer-feedback',
            'result-display',
            'players-list',
            'host-game-screen',
            'player-game-screen',
            'lobby-screen'
        ];

        // Pre-cache common elements
        commonIds.forEach(id => this.get(id));
        this.initialized = true;
    }

    /**
     * Clean up event listeners and cache when game ends
     */
    cleanup() {
        // Remove all event listeners
        this.observers.forEach((listeners, key) => {
            const [id, event] = key.split(':');
            const element = document.getElementById(id);
            if (element) {
                listeners.forEach(({ handler }) => {
                    element.removeEventListener(event, handler);
                });
            }
        });

        this.observers.clear();
        this.clearCache();
        this.initialized = false;
    }
}

// Create singleton instance
export const domManager = new DOMManager();

// Export for direct use
export default domManager;