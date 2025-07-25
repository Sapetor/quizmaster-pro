/**
 * Async Storage Utility
 * Provides non-blocking storage operations to eliminate UI freezing
 */

import { errorHandler } from './error-handler.js';
import { logger } from '../core/config.js';

export class AsyncStorage {
    constructor() {
        this.workers = new Map();
        this.pendingOperations = new Map();
        this.maxConcurrentOps = 3;
        this.currentOps = 0;
    }

    /**
     * Async localStorage setItem that doesn't block UI
     * @param {string} key - Storage key
     * @param {string|object} value - Value to store
     * @returns {Promise<boolean>} Success status
     */
    async setItem(key, value) {
        return this.queueOperation('set', key, value);
    }

    /**
     * Async localStorage getItem that doesn't block UI
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if key not found
     * @returns {Promise<any>} Retrieved value
     */
    async getItem(key, defaultValue = null) {
        return this.queueOperation('get', key, defaultValue);
    }

    /**
     * Async localStorage removeItem that doesn't block UI
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} Success status
     */
    async removeItem(key) {
        return this.queueOperation('remove', key);
    }

    /**
     * Queue storage operation to prevent UI blocking
     * @param {string} operation - Operation type (get, set, remove)
     * @param {string} key - Storage key
     * @param {any} value - Value for set operations
     * @returns {Promise<any>} Operation result
     */
    async queueOperation(operation, key, value = null) {
        return new Promise((resolve, reject) => {
            const operationId = `${operation}-${key}-${Date.now()}`;
            
            // If too many operations, wait
            if (this.currentOps >= this.maxConcurrentOps) {
                setTimeout(() => {
                    this.queueOperation(operation, key, value).then(resolve).catch(reject);
                }, 10);
                return;
            }

            this.currentOps++;
            
            // Use setTimeout to make operation async and non-blocking
            setTimeout(() => {
                try {
                    let result;
                    
                    switch (operation) {
                        case 'set':
                            const serializedValue = typeof value === 'object' 
                                ? JSON.stringify(value) 
                                : value;
                            localStorage.setItem(key, serializedValue);
                            result = true;
                            break;
                            
                        case 'get':
                            const storedValue = localStorage.getItem(key);
                            if (storedValue === null) {
                                result = value; // defaultValue
                            } else {
                                try {
                                    result = JSON.parse(storedValue);
                                } catch (e) {
                                    result = storedValue; // Return as string if not JSON
                                }
                            }
                            break;
                            
                        case 'remove':
                            localStorage.removeItem(key);
                            result = true;
                            break;
                            
                        default:
                            throw new Error(`Unknown operation: ${operation}`);
                    }
                    
                    this.currentOps--;
                    resolve(result);
                    
                } catch (error) {
                    this.currentOps--;
                    errorHandler.log(error, {
                        context: 'AsyncStorage',
                        operation,
                        key,
                        operationId
                    });
                    reject(error);
                }
            }, 0); // Immediate but async execution
        });
    }

    /**
     * Batch storage operations for efficiency
     * @param {Array} operations - Array of {operation, key, value} objects
     * @returns {Promise<Array>} Array of results
     */
    async batchOperations(operations) {
        const promises = operations.map(op => 
            this.queueOperation(op.operation, op.key, op.value)
        );
        
        try {
            return await Promise.all(promises);
        } catch (error) {
            errorHandler.log(error, {
                context: 'AsyncStorage batch',
                operationCount: operations.length
            });
            throw error;
        }
    }

    /**
     * Clear all data (with confirmation for safety)
     * @param {boolean} confirmed - Must be true to proceed
     * @returns {Promise<boolean>} Success status
     */
    async clear(confirmed = false) {
        if (!confirmed) {
            throw new Error('Clear operation requires confirmation');
        }
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    localStorage.clear();
                    logger.debug('🗑️ AsyncStorage: localStorage cleared');
                    resolve(true);
                } catch (error) {
                    errorHandler.log(error, {
                        context: 'AsyncStorage clear'
                    });
                    reject(error);
                }
            }, 0);
        });
    }

    /**
     * Get storage statistics
     * @returns {Promise<object>} Storage statistics
     */
    async getStats() {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const used = JSON.stringify(localStorage).length;
                    const keys = Object.keys(localStorage);
                    
                    resolve({
                        used: used,
                        usedFormatted: `${(used / 1024).toFixed(2)} KB`,
                        keyCount: keys.length,
                        keys: keys,
                        pendingOps: this.currentOps,
                        maxOps: this.maxConcurrentOps
                    });
                } catch (error) {
                    errorHandler.log(error, {
                        context: 'AsyncStorage stats'
                    });
                    resolve({
                        used: 0,
                        usedFormatted: 'Unknown',
                        keyCount: 0,
                        keys: [],
                        pendingOps: this.currentOps,
                        maxOps: this.maxConcurrentOps
                    });
                }
            }, 0);
        });
    }

    /**
     * Check if storage is available
     * @returns {Promise<boolean>} Availability status
     */
    async isAvailable() {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const testKey = '__async_storage_test__';
                    localStorage.setItem(testKey, 'test');
                    localStorage.removeItem(testKey);
                    resolve(true);
                } catch (error) {
                    errorHandler.log(error, {
                        context: 'AsyncStorage availability check'
                    });
                    resolve(false);
                }
            }, 0);
        });
    }
}

// Export singleton instance
export const asyncStorage = new AsyncStorage();

// Convenience methods for common patterns
export const storageUtils = {
    /**
     * Save user preferences asynchronously
     * @param {object} preferences - User preferences object
     * @returns {Promise<boolean>} Success status
     */
    async savePreferences(preferences) {
        return asyncStorage.setItem('user_preferences', preferences);
    },

    /**
     * Load user preferences asynchronously
     * @param {object} defaults - Default preferences
     * @returns {Promise<object>} User preferences
     */
    async loadPreferences(defaults = {}) {
        return asyncStorage.getItem('user_preferences', defaults);
    },

    /**
     * Save game state asynchronously
     * @param {object} gameState - Current game state
     * @returns {Promise<boolean>} Success status
     */
    async saveGameState(gameState) {
        return asyncStorage.setItem('game_state', gameState);
    },

    /**
     * Load game state asynchronously
     * @returns {Promise<object|null>} Game state or null
     */
    async loadGameState() {
        return asyncStorage.getItem('game_state', null);
    }
};