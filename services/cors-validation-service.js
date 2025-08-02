/**
 * CORS Validation Service
 * Provides robust CORS validation for local network environments
 */

const logger = console; // Will be replaced with proper logger when available

class CORSValidationService {
    constructor() {
        // Allowed origins for production
        this.allowedOrigins = new Set([
            'http://localhost:3000',
            'https://localhost:3000',
            'http://127.0.0.1:3000',
            'https://127.0.0.1:3000'
        ]);

        // IP range patterns for local networks (properly constrained)
        this.localNetworkPatterns = [
            /^http:\/\/localhost(:\d+)?$/,
            /^https:\/\/localhost(:\d+)?$/,
            /^http:\/\/127\.0\.0\.1(:\d+)?$/,
            /^https:\/\/127\.0\.0\.1(:\d+)?$/,
            /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^https:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^https:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            // Properly constrained 172.16.0.0/12 range
            /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^https:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/
        ];

        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.allowedPorts = new Set(['3000', '3001', '8080', '8000']);
    }

    /**
     * Validate if origin is allowed
     * @param {string} origin - The origin to validate
     * @returns {boolean} - Whether the origin is allowed
     */
    isOriginAllowed(origin) {
        // Allow requests with no origin (same-origin, mobile apps, etc.)
        if (!origin) {
            return true;
        }

        // Check against explicitly allowed origins
        if (this.allowedOrigins.has(origin)) {
            return true;
        }

        // In development, be more permissive
        if (this.isDevelopment) {
            return this.isLocalNetworkOrigin(origin);
        }

        // In production, only allow local network origins
        return this.isLocalNetworkOrigin(origin);
    }

    /**
     * Check if origin is from local network
     * @param {string} origin - The origin to check
     * @returns {boolean} - Whether origin is from local network
     */
    isLocalNetworkOrigin(origin) {
        try {
            const url = new URL(origin);
            
            // Validate protocol
            if (!['http:', 'https:'].includes(url.protocol)) {
                return false;
            }

            // Check against local network patterns
            for (const pattern of this.localNetworkPatterns) {
                if (pattern.test(origin)) {
                    // Additional port validation
                    if (url.port && !this.allowedPorts.has(url.port)) {
                        logger.warn(`CORS: Port ${url.port} not in allowed ports for origin: ${origin}`);
                        return false;
                    }
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('CORS: Invalid origin URL:', origin, error.message);
            return false;
        }
    }

    /**
     * Get CORS configuration for Express
     */
    getExpressCorsConfig() {
        return {
            origin: (origin, callback) => {
                if (this.isOriginAllowed(origin)) {
                    logger.debug && logger.debug(`CORS: Allowed origin: ${origin || 'same-origin'}`);
                    callback(null, true);
                } else {
                    logger.warn(`CORS: Blocked origin: ${origin}`);
                    callback(new Error(`CORS: Origin ${origin} not allowed`));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['X-Total-Count'],
            maxAge: 300 // 5 minutes
        };
    }

    /**
     * Get CORS configuration for Socket.IO
     */
    getSocketIOCorsConfig() {
        return {
            origin: (origin, callback) => {
                if (this.isOriginAllowed(origin)) {
                    logger.debug && logger.debug(`Socket.IO CORS: Allowed origin: ${origin || 'same-origin'}`);
                    callback(null, true);
                } else {
                    logger.warn(`Socket.IO CORS: Blocked origin: ${origin}`);
                    callback(new Error(`Socket.IO CORS: Origin ${origin} not allowed`));
                }
            },
            credentials: true,
            methods: ['GET', 'POST']
        };
    }

    /**
     * Add a custom allowed origin
     * @param {string} origin - Origin to allow
     */
    addAllowedOrigin(origin) {
        if (this.isValidOrigin(origin)) {
            this.allowedOrigins.add(origin);
            logger.info(`CORS: Added allowed origin: ${origin}`);
        } else {
            logger.error(`CORS: Invalid origin format: ${origin}`);
        }
    }

    /**
     * Remove an allowed origin
     * @param {string} origin - Origin to remove
     */
    removeAllowedOrigin(origin) {
        if (this.allowedOrigins.delete(origin)) {
            logger.info(`CORS: Removed allowed origin: ${origin}`);
        }
    }

    /**
     * Validate origin format
     * @param {string} origin - Origin to validate
     * @returns {boolean} - Whether origin format is valid
     */
    isValidOrigin(origin) {
        try {
            const url = new URL(origin);
            return ['http:', 'https:'].includes(url.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Get validation statistics
     */
    getStats() {
        return {
            allowedOriginsCount: this.allowedOrigins.size,
            localNetworkPatternsCount: this.localNetworkPatterns.length,
            allowedPortsCount: this.allowedPorts.size,
            isDevelopment: this.isDevelopment
        };
    }

    /**
     * Log current configuration
     */
    logConfiguration() {
        logger.info('CORS Configuration:', {
            environment: this.isDevelopment ? 'development' : 'production',
            allowedOrigins: Array.from(this.allowedOrigins),
            allowedPorts: Array.from(this.allowedPorts),
            localNetworkPatterns: this.localNetworkPatterns.length
        });
    }
}

module.exports = { CORSValidationService };