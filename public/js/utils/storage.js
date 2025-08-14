/**
 * Simple Storage Utility
 * Replaces over-engineered AsyncStorage with direct localStorage operations
 * Provides JSON serialization and simple error handling
 */

import { logger } from '../core/config.js';

export class StorageManager {
    /**
     * Store item in localStorage with JSON serialization
     */
    setItem(key, value) {
        try {
            const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            logger.error(`Storage setItem failed for key "${key}":`, error);
            return false;
        }
    }

    /**
     * Get item from localStorage with JSON parsing
     */
    getItem(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) {
                return defaultValue;
            }
            
            // Try to parse as JSON, fall back to string
            try {
                return JSON.parse(stored);
            } catch {
                return stored;
            }
        } catch (error) {
            logger.error(`Storage getItem failed for key "${key}":`, error);
            return defaultValue;
        }
    }

    /**
     * Remove item from localStorage
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            logger.error(`Storage removeItem failed for key "${key}":`, error);
            return false;
        }
    }

    /**
     * Clear all localStorage data
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            logger.error('Storage clear failed:', error);
            return false;
        }
    }

    /**
     * Check if localStorage is available
     */
    isAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get all keys in localStorage
     */
    getKeys() {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            logger.error('Storage getKeys failed:', error);
            return [];
        }
    }
}

// Create singleton instance
export const storage = new StorageManager();

// Convenience functions for common patterns
export const storageUtils = {
    /**
     * Save user preferences
     */
    savePreferences(preferences) {
        return storage.setItem('user_preferences', preferences);
    },

    /**
     * Load user preferences
     */
    loadPreferences(defaults = {}) {
        return storage.getItem('user_preferences', defaults);
    },

    /**
     * Save game state
     */
    saveGameState(gameState) {
        return storage.setItem('game_state', gameState);
    },

    /**
     * Load game state
     */
    loadGameState() {
        return storage.getItem('game_state', null);
    }
};

export default storage;