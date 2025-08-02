/**
 * MathJax Cache Service
 * Handles content caching for instant F5 recovery and performance optimization
 * Extracted from MathJaxService for better modularity and testability
 */

import { logger } from '../../core/config.js';
import { errorHandler } from '../error-handler.js';

export class CacheService {
    constructor() {
        this.mathJaxCache = new Map();
        this.maxCacheSize = 50; // Prevent memory issues
    }

    /**
     * Generate cache key for MathJax content
     * Uses content-based hashing to ensure accurate cache hits
     * @param {Element} element - Element containing LaTeX
     * @returns {string} Cache key
     */
    getCacheKey(element) {
        const originalContent = element.dataset.originalContent || element.innerHTML;
        
        // Create hash-like key from content
        let hash = 0;
        for (let i = 0; i < originalContent.length; i++) {
            const char = originalContent.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return `mathjax_${Math.abs(hash)}_${originalContent.length}`;
    }

    /**
     * Get cached content for instant recovery
     * @param {string} cacheKey - Cache key to lookup
     * @returns {string|null} Cached rendered content or null if not found
     */
    getCachedContent(cacheKey) {
        return this.mathJaxCache.get(cacheKey) || null;
    }

    /**
     * Check if content exists in cache
     * @param {string} cacheKey - Cache key to check
     * @returns {boolean} True if content is cached
     */
    hasContent(cacheKey) {
        return this.mathJaxCache.has(cacheKey);
    }

    /**
     * Cache rendered MathJax content for instant F5 recovery
     * Only caches content that contains actual rendered MathJax elements
     * @param {Element} element - Element with rendered MathJax
     * @returns {boolean} True if content was cached
     */
    cacheMathJaxContent(element) {
        if (!element || !element.innerHTML) return false;
        
        try {
            const cacheKey = this.getCacheKey(element);
            const renderedContent = element.innerHTML;
            
            // Only cache if it contains actual MathJax rendered elements
            const isMathJaxContent = renderedContent.includes('mjx-') || 
                                   renderedContent.includes('MathJax') ||
                                   renderedContent.includes('mjx-container');
            
            if (isMathJaxContent) {
                this.mathJaxCache.set(cacheKey, renderedContent);
                logger.debug(`⚡ Cached MathJax content: ${cacheKey}`);
                
                // Manage cache size to prevent memory issues
                this._enforceMaxCacheSize();
                return true;
            }
            
            return false;
        } catch (error) {
            errorHandler.log(error, {
                context: 'MathJax caching',
                elementId: element.id || 'unknown'
            });
            return false;
        }
    }

    /**
     * Enforce maximum cache size by removing oldest entries
     * @private
     */
    _enforceMaxCacheSize() {
        while (this.mathJaxCache.size > this.maxCacheSize) {
            const firstKey = this.mathJaxCache.keys().next().value;
            this.mathJaxCache.delete(firstKey);
            logger.debug(`🗑️ Removed old cache entry: ${firstKey}`);
        }
    }

    /**
     * Apply cached content to element instantly
     * @param {Element} element - Element to apply cached content to
     * @param {string} cacheKey - Cache key for content lookup
     * @returns {boolean} True if cached content was applied
     */
    applyCachedContent(element, cacheKey) {
        const cachedContent = this.getCachedContent(cacheKey);
        if (cachedContent) {
            element.innerHTML = cachedContent;
            logger.debug(`⚡ Applied cached MathJax content: ${cacheKey}`);
            return true;
        }
        return false;
    }

    /**
     * Clear entire MathJax cache
     * Useful for testing or memory management
     */
    clearCache() {
        const size = this.mathJaxCache.size;
        this.mathJaxCache.clear();
        logger.debug(`🧹 Cleared MathJax cache (${size} entries removed)`);
    }

    /**
     * Get cache statistics for debugging and monitoring
     * @returns {object} Cache statistics
     */
    getStats() {
        const entries = Array.from(this.mathJaxCache.entries());
        const totalSize = entries.reduce((sum, [key, content]) => sum + content.length, 0);
        
        return {
            entryCount: this.mathJaxCache.size,
            maxSize: this.maxCacheSize,
            utilizationPercent: Math.round((this.mathJaxCache.size / this.maxCacheSize) * 100),
            totalContentSize: totalSize,
            averageContentSize: this.mathJaxCache.size > 0 ? Math.round(totalSize / this.mathJaxCache.size) : 0,
            keys: Array.from(this.mathJaxCache.keys())
        };
    }

    /**
     * Set maximum cache size
     * @param {number} maxSize - Maximum number of cache entries
     */
    setMaxCacheSize(maxSize) {
        if (maxSize > 0) {
            this.maxCacheSize = maxSize;
            this._enforceMaxCacheSize();
            logger.debug(`📏 Updated max cache size to: ${maxSize}`);
        }
    }

    /**
     * Preload cache with known content
     * Useful for testing or bulk operations
     * @param {Array} entries - Array of {key, content} objects
     */
    preloadCache(entries) {
        entries.forEach(({key, content}) => {
            this.mathJaxCache.set(key, content);
        });
        this._enforceMaxCacheSize();
        logger.debug(`📥 Preloaded ${entries.length} cache entries`);
    }
}

// Export singleton instance
export const cacheService = new CacheService();