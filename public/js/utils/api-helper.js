/**
 * API Helper Module
 * Provides utilities for making API requests with proper URL handling
 */

import { logger } from '../core/config.js';

export class APIHelper {
    static getBaseUrl() {
        return `${window.location.protocol}//${window.location.host}`;
    }
    
    static getApiUrl(endpoint) {
        // Remove leading slash if present to avoid double slashes
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${this.getBaseUrl()}/${cleanEndpoint}`;
    }
    
    static async fetchAPI(endpoint, options = {}) {
        const url = this.getApiUrl(endpoint);
        logger.info(`🌐 API Request: ${url} (host: ${window.location.host})`);
        
        try {
            const response = await fetch(url, options);
            
            // Log response for debugging
            if (!response.ok) {
                logger.error(`❌ API Error: ${response.status} ${response.statusText} for ${url}`);
                logger.error(`❌ Response headers:`, Object.fromEntries(response.headers.entries()));
            } else {
                logger.info(`✅ API Success: ${response.status} for ${url}`);
            }
            
            return response;
        } catch (error) {
            logger.error(`❌ Network Error for ${url}:`, error);
            logger.error(`❌ Error details:`, {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    static async fetchAPIJSON(endpoint, options = {}) {
        const response = await this.fetchAPI(endpoint, options);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
    }
}

// Export singleton instance
export const apiHelper = new APIHelper();