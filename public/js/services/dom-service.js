/**
 * DOM Service
 * Centralized DOM manipulation service to reduce coupling between modules and direct DOM access
 */

import { logger } from '../core/config.js';

export class DOMService {
    constructor() {
        this.elementCache = new Map();
        this.querySelectorCache = new Map();
    }

    /**
     * Get element by ID with caching
     */
    getElementById(id) {
        if (!this.elementCache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.elementCache.set(id, element);
            }
            return element;
        }
        return this.elementCache.get(id);
    }

    /**
     * Query selector with caching for performance
     */
    querySelector(selector) {
        if (!this.querySelectorCache.has(selector)) {
            const element = document.querySelector(selector);
            if (element) {
                this.querySelectorCache.set(selector, element);
            }
            return element;
        }
        return this.querySelectorCache.get(selector);
    }

    /**
     * Query all elements (not cached due to dynamic nature)
     */
    querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Update element content safely
     */
    updateContent(elementId, content, isHTML = false) {
        const element = this.getElementById(elementId);
        if (element) {
            if (isHTML) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
            logger.debug(`Updated content for ${elementId}`);
            return true;
        }
        logger.warn(`Element not found: ${elementId}`);
        return false;
    }

    /**
     * Update element style
     */
    updateStyle(elementId, property, value) {
        const element = this.getElementById(elementId);
        if (element) {
            element.style[property] = value;
            return true;
        }
        logger.warn(`Element not found for style update: ${elementId}`);
        return false;
    }

    /**
     * Show/hide element
     */
    setVisibility(elementId, visible) {
        return this.updateStyle(elementId, 'display', visible ? 'block' : 'none');
    }

    /**
     * Add class to element
     */
    addClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.add(className);
            return true;
        }
        logger.warn(`Element not found for class addition: ${elementId}`);
        return false;
    }

    /**
     * Remove class from element
     */
    removeClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.remove(className);
            return true;
        }
        logger.warn(`Element not found for class removal: ${elementId}`);
        return false;
    }

    /**
     * Toggle class on element
     */
    toggleClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
            return true;
        }
        logger.warn(`Element not found for class toggle: ${elementId}`);
        return false;
    }

    /**
     * Set element attribute
     */
    setAttribute(elementId, attribute, value) {
        const element = this.getElementById(elementId);
        if (element) {
            element.setAttribute(attribute, value);
            return true;
        }
        logger.warn(`Element not found for attribute setting: ${elementId}`);
        return false;
    }

    /**
     * Get element attribute
     */
    getAttribute(elementId, attribute) {
        const element = this.getElementById(elementId);
        if (element) {
            return element.getAttribute(attribute);
        }
        logger.warn(`Element not found for attribute getting: ${elementId}`);
        return null;
    }

    /**
     * Clear element content
     */
    clearContent(elementId) {
        const element = this.getElementById(elementId);
        if (element) {
            element.innerHTML = '';
            logger.debug(`Cleared content for ${elementId}`);
            return true;
        }
        logger.warn(`Element not found for content clearing: ${elementId}`);
        return false;
    }

    /**
     * Clear element cache (useful when DOM structure changes)
     */
    clearCache() {
        this.elementCache.clear();
        this.querySelectorCache.clear();
        logger.debug('DOM service cache cleared');
    }

    /**
     * Batch operations for better performance
     */
    batchOperations(operations) {
        const results = [];
        operations.forEach(op => {
            try {
                switch (op.type) {
                    case 'updateContent':
                        results.push(this.updateContent(op.elementId, op.content, op.isHTML));
                        break;
                    case 'updateStyle':
                        results.push(this.updateStyle(op.elementId, op.property, op.value));
                        break;
                    case 'setVisibility':
                        results.push(this.setVisibility(op.elementId, op.visible));
                        break;
                    case 'addClass':
                        results.push(this.addClass(op.elementId, op.className));
                        break;
                    case 'removeClass':
                        results.push(this.removeClass(op.elementId, op.className));
                        break;
                    default:
                        logger.warn('Unknown batch operation type:', op.type);
                        results.push(false);
                }
            } catch (error) {
                logger.error('Error in batch operation:', error);
                results.push(false);
            }
        });
        return results;
    }
}

// Create singleton instance
export const domService = new DOMService();