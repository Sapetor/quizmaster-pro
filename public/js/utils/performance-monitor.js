/**
 * Real-time Performance Monitoring Dashboard
 * Tracks MathJax rendering, F5 recovery, and application performance metrics
 */

import { logger } from '../core/config.js';

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            mathJaxRender: [],
            f5Recovery: [],
            pageLoad: [],
            gamePerformance: [],
            memoryUsage: [],
            browserOptimizations: [],
            browserInfo: this.getBrowserInfo()
        };
        
        this.maxMetrics = 50; // Keep last 50 measurements per category
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        // Performance thresholds
        this.thresholds = {
            mathJaxRender: 1000, // 1 second
            f5Recovery: 3000,    // 3 seconds
            pageLoad: 2000,      // 2 seconds
            memoryUsage: 100     // 100MB
        };
        
        this.init();
    }
    
    init() {
        logger.debug('Performance Monitor initialized');
        this.startMemoryMonitoring();
        this.trackPageLoad();
        
        // Add global performance tracking hooks
        this.addGlobalHooks();
    }
    
    getBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            deviceMemory: navigator.deviceMemory || 'unknown',
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : 'unknown'
        };
    }
    
    // Track MathJax rendering performance
    trackMathJaxRender(elementId, startTime, endTime, success = true) {
        const duration = endTime - startTime;
        const metric = {
            timestamp: Date.now(),
            elementId,
            duration,
            success,
            isSlowRender: duration > this.thresholds.mathJaxRender
        };
        
        this.addMetric('mathJaxRender', metric);
        
        if (metric.isSlowRender) {
            logger.warn(`Slow MathJax render detected: ${duration}ms for ${elementId}`);
        }
        
        return metric;
    }
    
    // Track F5 recovery performance
    trackF5Recovery(phase, startTime, endTime, details = {}) {
        const duration = endTime - startTime;
        const metric = {
            timestamp: Date.now(),
            phase,
            duration,
            details,
            isSlowRecovery: duration > this.thresholds.f5Recovery
        };
        
        this.addMetric('f5Recovery', metric);
        
        if (metric.isSlowRecovery) {
            logger.warn(`Slow F5 recovery detected: ${duration}ms for phase ${phase}`);
        }
        
        return metric;
    }
    
    // Track page load performance
    trackPageLoad() {
        if (typeof performance !== 'undefined' && performance.timing) {
            const timing = performance.timing;
            const metric = {
                timestamp: Date.now(),
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                loadComplete: timing.loadEventEnd - timing.navigationStart,
                firstPaint: this.getFirstPaint(),
                firstContentfulPaint: this.getFirstContentfulPaint()
            };
            
            this.addMetric('pageLoad', metric);
            logger.debug('Page load performance tracked:', metric);
        }
    }
    
    getFirstPaint() {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            return firstPaint ? firstPaint.startTime : null;
        }
        return null;
    }
    
    getFirstContentfulPaint() {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            return fcp ? fcp.startTime : null;
        }
        return null;
    }
    
    // Track game performance
    trackGamePerformance(action, duration, metadata = {}) {
        const metric = {
            timestamp: Date.now(),
            action,
            duration,
            metadata
        };
        
        this.addMetric('gamePerformance', metric);
        return metric;
    }
    
    // Monitor memory usage
    startMemoryMonitoring() {
        if (typeof performance !== 'undefined' && performance.memory) {
            this.monitoringInterval = setInterval(() => {
                const memory = performance.memory;
                const metric = {
                    timestamp: Date.now(),
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit,
                    usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                    isHighUsage: (memory.usedJSHeapSize / 1024 / 1024) > this.thresholds.memoryUsage
                };
                
                this.addMetric('memoryUsage', metric);
                
                if (metric.isHighUsage) {
                    logger.warn(`High memory usage detected: ${metric.usedMB}MB`);
                }
            }, 10000); // Check every 10 seconds
        }
    }
    
    // Add global performance hooks
    addGlobalHooks() {
        // Hook into MathJax rendering if available
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.generatePerformanceReport();
            });
            
            // Hook into error events
            window.addEventListener('error', (event) => {
                this.trackError('JavaScript Error', event.error, {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            });
            
            // Hook into unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                this.trackError('Unhandled Promise Rejection', event.reason);
            });
        }
    }
    
    // Track errors
    trackError(type, error, metadata = {}) {
        const errorMetric = {
            timestamp: Date.now(),
            type,
            message: error?.message || error,
            stack: error?.stack,
            metadata
        };
        
        if (!this.metrics.errors) {
            this.metrics.errors = [];
        }
        
        this.addMetric('errors', errorMetric);
        logger.error('Performance Monitor tracked error:', errorMetric);
    }
    
    /**
     * Track browser optimization events
     * @param {string} optimizationType - Type of optimization
     * @param {Object} details - Optimization details
     */
    trackBrowserOptimization(optimizationType, details = {}) {
        const optimizationMetric = {
            timestamp: Date.now(),
            type: optimizationType,
            browser: details.browser || navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/)?.[1] || 'unknown',
            version: details.version || 'unknown',
            success: details.success !== false,
            duration: details.duration || null,
            details
        };
        
        this.addMetric('browserOptimizations', optimizationMetric);
        logger.debug('Browser optimization tracked:', optimizationMetric);
    }
    
    /**
     * Track memory cleanup events
     */
    trackMemoryCleanup() {
        this.addMetric('memoryUsage', {
            timestamp: Date.now(),
            type: 'cleanup',
            before: this.getMemoryInfo(),
            after: null // Will be set after cleanup
        });
        
        // Set after info with a slight delay
        setTimeout(() => {
            const lastEntry = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
            if (lastEntry && lastEntry.type === 'cleanup') {
                lastEntry.after = this.getMemoryInfo();
            }
        }, 100);
        
        logger.debug('Memory cleanup tracked');
    }
    
    /**
     * Get memory information
     */
    getMemoryInfo() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
    
    // Utility method to add metrics with size limits
    addMetric(category, metric) {
        if (!this.metrics[category]) {
            this.metrics[category] = [];
        }
        
        this.metrics[category].push(metric);
        
        // Keep only the most recent metrics
        if (this.metrics[category].length > this.maxMetrics) {
            this.metrics[category] = this.metrics[category].slice(-this.maxMetrics);
        }
    }
    
    // Get performance statistics
    getStats() {
        const stats = {};
        
        Object.keys(this.metrics).forEach(category => {
            if (Array.isArray(this.metrics[category]) && this.metrics[category].length > 0) {
                const data = this.metrics[category];
                
                if (category === 'mathJaxRender' || category === 'f5Recovery' || category === 'gamePerformance') {
                    const durations = data.map(item => item.duration).filter(d => d != null);
                    
                    if (durations.length > 0) {
                        stats[category] = {
                            count: data.length,
                            avgDuration: Math.round(durations.reduce((a, b) => a + b) / durations.length),
                            minDuration: Math.min(...durations),
                            maxDuration: Math.max(...durations),
                            successRate: category === 'mathJaxRender' ? 
                                (data.filter(item => item.success).length / data.length) * 100 : null
                        };
                    }
                }
                
                if (category === 'memoryUsage') {
                    const latest = data[data.length - 1];
                    stats[category] = {
                        current: `${latest.usedMB}MB`,
                        peak: `${Math.max(...data.map(item => item.usedMB))}MB`,
                        average: `${Math.round(data.reduce((sum, item) => sum + item.usedMB, 0) / data.length)}MB`
                    };
                }
                
                if (category === 'errors') {
                    stats[category] = {
                        count: data.length,
                        recent: data.slice(-5).map(error => ({
                            type: error.type,
                            message: error.message,
                            timestamp: new Date(error.timestamp).toLocaleTimeString()
                        }))
                    };
                }
            }
        });
        
        return stats;
    }
    
    // Generate performance report
    generatePerformanceReport() {
        const stats = this.getStats();
        const report = {
            timestamp: new Date().toISOString(),
            browserInfo: this.metrics.browserInfo,
            statistics: stats,
            rawMetrics: this.metrics
        };
        
        logger.info('Performance Report Generated:', report);
        return report;
    }
    
    // Get dashboard data for UI
    getDashboardData() {
        const stats = this.getStats();
        const now = Date.now();
        const recentThreshold = 5 * 60 * 1000; // 5 minutes
        
        // Get recent metrics for charts
        const recentMetrics = {};
        Object.keys(this.metrics).forEach(category => {
            if (Array.isArray(this.metrics[category])) {
                recentMetrics[category] = this.metrics[category]
                    .filter(metric => (now - metric.timestamp) < recentThreshold);
            }
        });
        
        return {
            stats,
            recentMetrics,
            browserInfo: this.metrics.browserInfo,
            isMonitoring: this.isMonitoring,
            thresholds: this.thresholds
        };
    }
    
    // Start/stop monitoring
    startMonitoring() {
        this.isMonitoring = true;
        logger.info('Performance monitoring started');
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        logger.info('Performance monitoring stopped');
    }
    
    // Reset metrics
    reset() {
        Object.keys(this.metrics).forEach(category => {
            if (Array.isArray(this.metrics[category])) {
                this.metrics[category] = [];
            }
        });
        logger.info('Performance metrics reset');
    }
    
    // Export data for analysis
    exportData() {
        const data = {
            exportTime: new Date().toISOString(),
            metrics: this.metrics,
            stats: this.getStats()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `quizmaster-performance-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logger.info('Performance data exported');
    }
}

// Create global instance
export const performanceMonitor = new PerformanceMonitor();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.performanceMonitor = performanceMonitor;
}