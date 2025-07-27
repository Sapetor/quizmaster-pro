/**
 * MathJax Core Coordinator
 * Central orchestration layer for all MathJax services
 * Provides unified API, health monitoring, and service lifecycle management
 * 
 * Phase 2 Day 3: Service coordination and integration testing
 */

import { TIMING, logger } from '../../core/config.js';
import { errorHandler } from '../error-handler.js';
import { performanceMonitor } from '../performance-monitor.js';
import { recoveryService } from './recovery-service.js';
import { cacheService } from './cache-service.js';
import { RenderService } from './render-service.js';

export class CoreCoordinator {
    constructor() {
        // Service instances
        this.recoveryService = recoveryService;
        this.cacheService = cacheService;
        this.renderService = new RenderService(cacheService, recoveryService);
        
        // Health monitoring
        this.healthMetrics = {
            totalRenders: 0,
            successfulRenders: 0,
            failedRenders: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageRenderTime: 0,
            lastError: null,
            uptime: Date.now(),
            lastHealthCheck: Date.now()
        };
        
        // Performance tracking
        this.performanceBuffer = [];
        this.maxBufferSize = 100; // Keep last 100 render times
        
        // Service status
        this.serviceStatus = {
            coordinator: 'initializing',
            recovery: 'initializing', 
            cache: 'initializing',
            render: 'initializing',
            mathJax: 'checking'
        };
        
        // Initialize coordinator
        this.initialize();
    }

    /**
     * Initialize the Core Coordinator and all services
     */
    async initialize() {
        logger.debug('🎯 Core Coordinator: Initializing MathJax service orchestration');
        
        try {
            // Initialize services in dependency order
            await this.initializeServices();
            
            // Set up health monitoring
            this.startHealthMonitoring();
            
            // Register global error handler for MathJax issues
            this.setupGlobalErrorHandling();
            
            // Mark coordinator as ready
            this.serviceStatus.coordinator = 'ready';
            
            logger.debug('✅ Core Coordinator: All services initialized and ready');
            
        } catch (error) {
            this.serviceStatus.coordinator = 'error';
            errorHandler.log(error, { context: 'Core Coordinator initialization' });
        }
    }

    /**
     * Initialize all MathJax services in proper order
     */
    async initializeServices() {
        // 1. Cache Service (no dependencies)
        try {
            // Cache service is already a singleton, just verify it's ready
            this.serviceStatus.cache = 'ready';
            logger.debug('✅ Cache Service: Ready');
        } catch (error) {
            this.serviceStatus.cache = 'error';
            throw new Error(`Cache Service initialization failed: ${error.message}`);
        }

        // 2. Recovery Service (depends on cache for MathJax state)
        try {
            // Recovery service is already a singleton, just verify it's ready
            this.serviceStatus.recovery = 'ready';
            logger.debug('✅ Recovery Service: Ready');
        } catch (error) {
            this.serviceStatus.recovery = 'error';
            throw new Error(`Recovery Service initialization failed: ${error.message}`);
        }

        // 3. Render Service (depends on cache and recovery)
        try {
            // Render service created with dependencies, verify it's ready
            if (this.renderService && typeof this.renderService.renderElement === 'function') {
                this.serviceStatus.render = 'ready';
                logger.debug('✅ Render Service: Ready');
            } else {
                throw new Error('Render Service not properly initialized');
            }
        } catch (error) {
            this.serviceStatus.render = 'error';
            throw new Error(`Render Service initialization failed: ${error.message}`);
        }

        // 4. MathJax availability check
        this.checkMathJaxStatus();
    }

    /**
     * Check MathJax library status
     */
    checkMathJaxStatus() {
        if (this.renderService.isAvailable()) {
            this.serviceStatus.mathJax = 'ready';
            logger.debug('✅ MathJax: Library ready and available');
        } else if (window.MathJax) {
            this.serviceStatus.mathJax = 'loading';
            logger.debug('🔄 MathJax: Library present but not fully ready');
            
            // Check again after a short delay
            setTimeout(() => this.checkMathJaxStatus(), 500);
        } else {
            this.serviceStatus.mathJax = 'missing';
            logger.warn('❌ MathJax: Library not found');
        }
    }

    /**
     * Unified render method with health monitoring
     * @param {HTMLElement} element - Element to render
     * @param {Object} options - Render options
     * @returns {Promise<void>}
     */
    async render(element, options = {}) {
        const startTime = Date.now();
        this.healthMetrics.totalRenders++;
        
        try {
            // Be more patient during fresh app loads to avoid false positive recovery triggers
            const timeSinceLoad = Date.now() - performance.timing.navigationStart;
            const isFreshAppLoad = timeSinceLoad < 5000; // Less than 5 seconds since page load
            
            const {
                timeout = TIMING.MATHJAX_TIMEOUT,
                maxRetries = isFreshAppLoad ? 12 : 6, // More retries for fresh app loads, normal for subsequent renders
                fastMode = false,
                priority = 'normal'
            } = options;

            // Track cache status before rendering
            const cacheKey = this.cacheService.getCacheKey(element);
            const hasCachedContent = this.cacheService.mathJaxCache.has(cacheKey);
            
            if (hasCachedContent) {
                this.healthMetrics.cacheHits++;
            } else {
                this.healthMetrics.cacheMisses++;
            }

            // Delegate to render service
            await this.renderService.renderElement(element, timeout, maxRetries, fastMode);
            
            // Track successful render
            this.healthMetrics.successfulRenders++;
            this.trackRenderPerformance(Date.now() - startTime);
            
            logger.debug(`🎯 Core Coordinator: Render successful (${Date.now() - startTime}ms)`);
            
        } catch (error) {
            this.healthMetrics.failedRenders++;
            this.healthMetrics.lastError = {
                message: error.message,
                timestamp: Date.now(),
                element: element.id || element.className || 'unknown'
            };
            
            errorHandler.log(error, { 
                context: 'Core Coordinator render',
                elementId: element.id || 'unknown',
                cacheHits: this.healthMetrics.cacheHits,
                cacheMisses: this.healthMetrics.cacheMisses
            });
            
            throw error;
        }
    }

    /**
     * Fast render method for live preview contexts
     * @param {HTMLElement} element - Element to render
     * @returns {Promise<void>}
     */
    async renderFast(element) {
        return this.render(element, { fastMode: true, maxRetries: 3 });
    }

    /**
     * Batch render multiple elements
     * @param {HTMLElement[]} elements - Elements to render
     * @param {Object} options - Render options
     * @returns {Promise<void[]>}
     */
    async renderBatch(elements, options = {}) {
        const batchStartTime = Date.now();
        logger.debug(`🎯 Core Coordinator: Starting batch render of ${elements.length} elements`);
        
        const renderPromises = elements.map(element => 
            this.render(element, options).catch(error => {
                logger.warn(`Batch render failed for element: ${element.id || 'unknown'}`, error);
                return null; // Don't fail entire batch for one element
            })
        );
        
        const results = await Promise.all(renderPromises);
        const successCount = results.filter(result => result !== null).length;
        
        logger.debug(`✅ Core Coordinator: Batch render completed - ${successCount}/${elements.length} successful (${Date.now() - batchStartTime}ms)`);
        
        return results;
    }

    /**
     * Force F5 recovery for testing purposes
     * @param {HTMLElement} element - Element to recover
     * @returns {Promise<void>}
     */
    async forceRecovery(element) {
        this.healthMetrics.recoveryAttempts++;
        
        try {
            logger.debug('🔧 Core Coordinator: Forcing F5 recovery for testing');
            
            await this.recoveryService.handleF5Corruption(
                element,
                () => Promise.resolve(),
                () => Promise.reject(),
                this.cacheService.mathJaxCache,
                (el) => this.cacheService.getCacheKey(el),
                (el, success) => this.renderService.completeProgressiveLoading(el, success),
                (el) => this.cacheService.cacheMathJaxContent(el),
                this.renderService.pendingRenders
            );
            
            this.healthMetrics.successfulRecoveries++;
            logger.debug('✅ Core Coordinator: Recovery completed successfully');
            
        } catch (error) {
            errorHandler.log(error, { context: 'Core Coordinator forced recovery' });
            throw error;
        }
    }

    /**
     * Get comprehensive health status
     * @returns {Object} Health status and metrics
     */
    getHealthStatus() {
        const uptime = Date.now() - this.healthMetrics.uptime;
        const successRate = this.healthMetrics.totalRenders > 0 
            ? (this.healthMetrics.successfulRenders / this.healthMetrics.totalRenders * 100).toFixed(2)
            : 0;
        const recoveryRate = this.healthMetrics.recoveryAttempts > 0
            ? (this.healthMetrics.successfulRecoveries / this.healthMetrics.recoveryAttempts * 100).toFixed(2)
            : 0;
        const cacheHitRate = (this.healthMetrics.cacheHits + this.healthMetrics.cacheMisses) > 0
            ? (this.healthMetrics.cacheHits / (this.healthMetrics.cacheHits + this.healthMetrics.cacheMisses) * 100).toFixed(2)
            : 0;

        return {
            coordinator: {
                status: 'ready',
                uptime: `${Math.floor(uptime / 1000)}s`,
                lastCheck: new Date(this.healthMetrics.lastHealthCheck).toLocaleTimeString()
            },
            services: this.serviceStatus,
            performance: {
                totalRenders: this.healthMetrics.totalRenders,
                successRate: `${successRate}%`,
                averageRenderTime: `${this.healthMetrics.averageRenderTime.toFixed(2)}ms`,
                recoveryAttempts: this.healthMetrics.recoveryAttempts,
                recoverySuccessRate: `${recoveryRate}%`
            },
            cache: {
                hitRate: `${cacheHitRate}%`,
                hits: this.healthMetrics.cacheHits,
                misses: this.healthMetrics.cacheMisses,
                size: this.cacheService.mathJaxCache.size
            },
            lastError: this.healthMetrics.lastError,
            recentPerformance: this.getRecentPerformanceStats()
        };
    }

    /**
     * Track render performance
     * @param {number} renderTime - Time taken for render in ms
     */
    trackRenderPerformance(renderTime) {
        this.performanceBuffer.push(renderTime);
        
        // Keep buffer size manageable
        if (this.performanceBuffer.length > this.maxBufferSize) {
            this.performanceBuffer.shift();
        }
        
        // Update average
        this.healthMetrics.averageRenderTime = 
            this.performanceBuffer.reduce((sum, time) => sum + time, 0) / this.performanceBuffer.length;
    }

    /**
     * Get recent performance statistics
     * @returns {Object} Performance stats
     */
    getRecentPerformanceStats() {
        if (this.performanceBuffer.length === 0) return null;
        
        const sorted = [...this.performanceBuffer].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        return {
            samples: this.performanceBuffer.length,
            min: `${min.toFixed(2)}ms`,
            max: `${max.toFixed(2)}ms`,
            median: `${median.toFixed(2)}ms`,
            p95: `${p95.toFixed(2)}ms`,
            average: `${this.healthMetrics.averageRenderTime.toFixed(2)}ms`
        };
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        // Update health metrics every 30 seconds
        setInterval(() => {
            this.healthMetrics.lastHealthCheck = Date.now();
            this.checkMathJaxStatus();
            
            // Log health summary periodically
            if (this.healthMetrics.totalRenders > 0) {
                const status = this.getHealthStatus();
                logger.debug('🏥 Health Summary:', {
                    renders: status.performance.totalRenders,
                    successRate: status.performance.successRate,
                    avgTime: status.performance.averageRenderTime,
                    cacheHitRate: status.cache.hitRate
                });
            }
        }, 30000);

        logger.debug('🏥 Core Coordinator: Health monitoring started');
    }

    /**
     * Setup global error handling for MathJax issues
     */
    setupGlobalErrorHandling() {
        // Capture MathJax errors globally
        const originalConsoleError = console.error;
        console.error = (...args) => {
            if (args.some(arg => 
                typeof arg === 'string' && 
                (arg.includes('MathJax') || arg.includes('mathjax') || arg.includes('replaceChild'))
            )) {
                this.healthMetrics.lastError = {
                    message: args.join(' '),
                    timestamp: Date.now(),
                    source: 'console.error'
                };
            }
            originalConsoleError.apply(console, args);
        };

        logger.debug('🛡️ Core Coordinator: Global error handling enabled');
    }

    /**
     * Reset health metrics (useful for testing)
     */
    resetHealthMetrics() {
        this.healthMetrics = {
            totalRenders: 0,
            successfulRenders: 0,
            failedRenders: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageRenderTime: 0,
            lastError: null,
            uptime: Date.now(),
            lastHealthCheck: Date.now()
        };
        this.performanceBuffer = [];
        logger.debug('🔄 Core Coordinator: Health metrics reset');
    }

    /**
     * Run diagnostic tests
     * @returns {Promise<Object>} Diagnostic results
     */
    async runDiagnostics() {
        logger.debug('🔍 Core Coordinator: Running comprehensive diagnostics');
        
        const diagnostics = {
            timestamp: Date.now(),
            services: {},
            mathJax: {},
            performance: {},
            browser: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                chrome: this.recoveryService.isChrome,
                windows: this.recoveryService.isWindows
            }
        };

        // Test each service
        try {
            diagnostics.services.cache = {
                status: 'ok',
                size: this.cacheService.mathJaxCache.size,
                methods: ['getCacheKey', 'cacheMathJaxContent', 'clearCache'].every(
                    method => typeof this.cacheService[method] === 'function'
                )
            };
        } catch (error) {
            diagnostics.services.cache = { status: 'error', error: error.message };
        }

        try {
            diagnostics.services.recovery = {
                status: 'ok',
                corruption: this.recoveryService.detectF5Corruption(),
                methods: ['handleF5Corruption', 'detectF5Corruption'].every(
                    method => typeof this.recoveryService[method] === 'function'
                )
            };
        } catch (error) {
            diagnostics.services.recovery = { status: 'error', error: error.message };
        }

        try {
            diagnostics.services.render = {
                status: 'ok',
                available: this.renderService.isAvailable(),
                pending: this.renderService.pendingRenders.size,
                methods: ['renderElement', 'isAvailable'].every(
                    method => typeof this.renderService[method] === 'function'
                )
            };
        } catch (error) {
            diagnostics.services.render = { status: 'error', error: error.message };
        }

        // Test MathJax
        diagnostics.mathJax = {
            exists: !!window.MathJax,
            typesetPromise: !!window.MathJax?.typesetPromise,
            startup: !!window.MathJax?.startup,
            document: !!window.MathJax?.startup?.document,
            ready: !!window.mathJaxReady
        };

        // Performance metrics
        diagnostics.performance = this.getRecentPerformanceStats();

        logger.debug('✅ Core Coordinator: Diagnostics completed', diagnostics);
        return diagnostics;
    }
}

// Create singleton instance
export const coreCoordinator = new CoreCoordinator();

// Make available globally for debugging and testing
if (typeof window !== 'undefined') {
    window.mathJaxCoordinator = coreCoordinator;
    
    // Global health check function
    window.checkMathJaxHealth = () => {
        const health = coreCoordinator.getHealthStatus();
        console.log('🏥 MathJax Health Status:');
        console.table(health.services);
        console.log('📊 Performance:', health.performance);
        console.log('💾 Cache:', health.cache);
        if (health.lastError) {
            console.warn('⚠️ Last Error:', health.lastError);
        }
        return health;
    };
}

// Export for direct use
export default coreCoordinator;