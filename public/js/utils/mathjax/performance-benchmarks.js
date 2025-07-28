/**
 * MathJax Performance Benchmarking Dashboard
 * Comprehensive performance testing and analysis tools
 * 
 * Phase 2 Day 6: Performance monitoring and benchmarking
 */

import { logger } from '../../core/config.js';
import { coreCoordinator } from './core-coordinator.js';

export class PerformanceBenchmarks {
    constructor() {
        this.benchmarkHistory = [];
        this.currentBenchmark = null;
        this.benchmarkTypes = new Map();
        
        this.initializeBenchmarkTypes();
    }

    /**
     * Initialize different benchmark types
     */
    initializeBenchmarkTypes() {
        // Single element render benchmark
        this.benchmarkTypes.set('single_render', {
            name: 'Single Element Render',
            description: 'Measure time to render one LaTeX element',
            iterations: 10,
            setup: () => this.createSingleTestElement(),
            execute: (element) => coreCoordinator.render(element),
            cleanup: (element) => this.cleanupElement(element)
        });

        // Batch render benchmark
        this.benchmarkTypes.set('batch_render', {
            name: 'Batch Element Render',
            description: 'Measure time to render multiple LaTeX elements',
            iterations: 5,
            setup: () => this.createBatchTestElements(5),
            execute: (elements) => coreCoordinator.renderBatch(elements),
            cleanup: (elements) => elements.forEach(el => this.cleanupElement(el))
        });

        // Complex LaTeX benchmark
        this.benchmarkTypes.set('complex_latex', {
            name: 'Complex LaTeX Render',
            description: 'Measure time to render complex mathematical expressions',
            iterations: 8,
            setup: () => this.createComplexLatexElement(),
            execute: (element) => coreCoordinator.render(element),
            cleanup: (element) => this.cleanupElement(element)
        });

        // Fast mode benchmark
        this.benchmarkTypes.set('fast_mode', {
            name: 'Fast Mode Render',
            description: 'Measure fast rendering performance (live preview)',
            iterations: 15,
            setup: () => this.createSingleTestElement(),
            execute: (element) => coreCoordinator.renderFast(element),
            cleanup: (element) => this.cleanupElement(element)
        });

        // Cache performance benchmark
        this.benchmarkTypes.set('cache_performance', {
            name: 'Cache Hit Performance',
            description: 'Measure cache hit vs miss performance',
            iterations: 10,
            setup: () => this.createCacheTestElement(),
            execute: async (element) => {
                // First render (cache miss)
                await coreCoordinator.render(element);
                // Second render (cache hit)
                await coreCoordinator.render(element);
            },
            cleanup: (element) => this.cleanupElement(element)
        });

        // Recovery benchmark
        this.benchmarkTypes.set('recovery_performance', {
            name: 'F5 Recovery Performance',
            description: 'Measure F5 corruption recovery time',
            iterations: 3,
            setup: () => this.createRecoveryTestElement(),
            execute: async (element) => {
                // Force recovery test
                await coreCoordinator.forceRecovery(element);
            },
            cleanup: (element) => this.cleanupElement(element)
        });
    }

    /**
     * Create single test element
     */
    createSingleTestElement() {
        const element = document.createElement('div');
        element.className = 'benchmark-test-element';
        element.innerHTML = 'Benchmark: $f(x) = ax^2 + bx + c$';
        element.classList.add('tex2jax_process', 'math-ready');
        this.hideElement(element);
        document.body.appendChild(element);
        return element;
    }

    /**
     * Create batch test elements
     */
    createBatchTestElements(count) {
        const elements = [];
        const latexExpressions = [
            '$E = mc^2$',
            '$\\int_0^1 x^2 dx$',
            '$\\sum_{i=1}^n x_i$',
            '$\\frac{a}{b} = c$',
            '$\\sqrt{x^2 + y^2}$'
        ];
        
        for (let i = 0; i < count; i++) {
            const element = document.createElement('div');
            element.className = 'benchmark-batch-element';
            element.innerHTML = `Batch ${i}: ${latexExpressions[i % latexExpressions.length]}`;
            element.classList.add('tex2jax_process', 'math-ready');
            this.hideElement(element);
            document.body.appendChild(element);
            elements.push(element);
        }
        
        return elements;
    }

    /**
     * Create complex LaTeX test element
     */
    createComplexLatexElement() {
        const element = document.createElement('div');
        element.className = 'benchmark-complex-element';
        element.innerHTML = `
            Complex: $\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$ and 
            $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$ and
            $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$
        `;
        element.classList.add('tex2jax_process', 'math-ready');
        this.hideElement(element);
        document.body.appendChild(element);
        return element;
    }

    /**
     * Create cache test element
     */
    createCacheTestElement() {
        const element = document.createElement('div');
        element.className = 'benchmark-cache-element';
        element.innerHTML = 'Cache test: $\\frac{d}{dx}[x^n] = nx^{n-1}$';
        element.classList.add('tex2jax_process', 'math-ready');
        this.hideElement(element);
        document.body.appendChild(element);
        return element;
    }

    /**
     * Create recovery test element
     */
    createRecoveryTestElement() {
        const element = document.createElement('div');
        element.className = 'benchmark-recovery-element';
        element.innerHTML = 'Recovery test: $\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\epsilon_0}$';
        element.classList.add('tex2jax_process', 'math-ready');
        this.hideElement(element);
        document.body.appendChild(element);
        return element;
    }

    /**
     * Hide element from view
     */
    hideElement(element) {
        element.style.position = 'absolute';
        element.style.top = '-1000px';
        element.style.visibility = 'hidden';
    }

    /**
     * Clean up test element
     */
    cleanupElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * Run a specific benchmark
     * @param {string} benchmarkType - Type of benchmark to run
     * @returns {Promise<Object>} Benchmark results
     */
    async runBenchmark(benchmarkType) {
        const benchmark = this.benchmarkTypes.get(benchmarkType);
        if (!benchmark) {
            throw new Error(`Unknown benchmark type: ${benchmarkType}`);
        }

        logger.debug(`📊 Starting benchmark: ${benchmark.name}`);
        
        const results = {
            type: benchmarkType,
            name: benchmark.name,
            description: benchmark.description,
            timestamp: new Date().toISOString(),
            iterations: benchmark.iterations,
            times: [],
            statistics: {},
            systemInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                mathJaxVersion: window.MathJax?.version || 'unknown',
                coreCoordinatorHealth: coreCoordinator.getHealthStatus()
            }
        };

        // Reset health metrics for clean measurement
        coreCoordinator.resetHealthMetrics();

        for (let i = 0; i < benchmark.iterations; i++) {
            let testSubject = null;
            
            try {
                // Setup
                testSubject = benchmark.setup();
                
                // Measure execution time
                const startTime = performance.now();
                await benchmark.execute(testSubject);
                const endTime = performance.now();
                
                const duration = endTime - startTime;
                results.times.push(duration);
                
                logger.debug(`  Iteration ${i + 1}/${benchmark.iterations}: ${duration.toFixed(2)}ms`);
                
                // Brief pause between iterations
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                logger.error(`Benchmark iteration ${i + 1} failed:`, error);
                results.times.push(null); // Mark as failed
            } finally {
                // Cleanup
                if (testSubject) {
                    benchmark.cleanup(testSubject);
                }
            }
        }

        // Calculate statistics
        const validTimes = results.times.filter(t => t !== null);
        if (validTimes.length > 0) {
            const sorted = validTimes.sort((a, b) => a - b);
            results.statistics = {
                min: sorted[0],
                max: sorted[sorted.length - 1],
                mean: validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length,
                median: sorted[Math.floor(sorted.length / 2)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                standardDeviation: this.calculateStandardDeviation(validTimes),
                successRate: `${((validTimes.length / benchmark.iterations) * 100).toFixed(2)}%`
            };
        }

        // Add health metrics after benchmark
        results.healthAfter = coreCoordinator.getHealthStatus();

        this.benchmarkHistory.push(results);
        
        logger.debug(`✅ Benchmark completed: ${benchmark.name}`);
        logger.debug(`📊 Results: ${results.statistics.mean?.toFixed(2)}ms avg, ${results.statistics.successRate} success`);
        
        return results;
    }

    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const squaredDifferences = values.map(v => Math.pow(v - mean, 2));
        const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Run all benchmarks
     * @returns {Promise<Object>} Complete benchmark results
     */
    async runAllBenchmarks() {
        const startTime = Date.now();
        const results = [];
        
        logger.debug('📊 Starting comprehensive performance benchmark suite');
        
        for (const [benchmarkType, benchmark] of this.benchmarkTypes) {
            try {
                const result = await this.runBenchmark(benchmarkType);
                results.push(result);
                
                // Longer pause between different benchmark types
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                logger.error(`❌ Benchmark ${benchmarkType} crashed:`, error);
                results.push({
                    type: benchmarkType,
                    name: benchmark.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        const totalDuration = Date.now() - startTime;
        
        const summary = {
            timestamp: new Date().toISOString(),
            totalDuration: `${totalDuration}ms`,
            summary: {
                total: results.length,
                successful: results.filter(r => !r.error).length,
                failed: results.filter(r => r.error).length
            },
            results,
            systemSnapshot: {
                coreCoordinatorHealth: coreCoordinator.getHealthStatus(),
                browser: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                }
            }
        };
        
        logger.debug('📊 Performance Benchmark Suite Results:', {
            total: summary.summary.total,
            successful: summary.summary.successful,
            failed: summary.summary.failed,
            duration: summary.totalDuration
        });
        
        return summary;
    }

    /**
     * Compare benchmark results over time
     * @param {string} benchmarkType - Type of benchmark to compare
     * @param {number} limit - Number of recent results to compare
     * @returns {Object} Comparison analysis
     */
    compareBenchmarks(benchmarkType, limit = 5) {
        const typeResults = this.benchmarkHistory
            .filter(r => r.type === benchmarkType)
            .slice(-limit);
            
        if (typeResults.length < 2) {
            return { error: 'Not enough data for comparison' };
        }
        
        const comparison = {
            benchmarkType,
            timeRange: {
                from: typeResults[0].timestamp,
                to: typeResults[typeResults.length - 1].timestamp
            },
            trends: {
                meanTimes: typeResults.map(r => r.statistics.mean),
                successRates: typeResults.map(r => parseFloat(r.statistics.successRate)),
                improvements: []
            }
        };
        
        // Calculate trends
        const firstMean = comparison.trends.meanTimes[0];
        const lastMean = comparison.trends.meanTimes[comparison.trends.meanTimes.length - 1];
        const improvement = ((firstMean - lastMean) / firstMean * 100);
        
        comparison.trends.improvements.push({
            metric: 'meanTime',
            change: `${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`,
            direction: improvement > 0 ? 'improved' : 'degraded'
        });
        
        return comparison;
    }

    /**
     * Generate performance report
     * @returns {Object} Comprehensive performance report
     */
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalBenchmarks: this.benchmarkHistory.length,
            benchmarkTypes: Array.from(this.benchmarkTypes.keys()),
            summary: {},
            trends: {},
            recommendations: []
        };
        
        // Summary statistics
        for (const benchmarkType of this.benchmarkTypes.keys()) {
            const typeResults = this.benchmarkHistory.filter(r => r.type === benchmarkType);
            if (typeResults.length > 0) {
                const latestResult = typeResults[typeResults.length - 1];
                report.summary[benchmarkType] = {
                    latestMean: latestResult.statistics?.mean,
                    latestSuccessRate: latestResult.statistics?.successRate,
                    runsCount: typeResults.length
                };
            }
        }
        
        // Generate recommendations
        if (report.summary.single_render?.latestMean > 100) {
            report.recommendations.push('Single element rendering is slow (>100ms) - consider optimization');
        }
        
        if (report.summary.fast_mode?.latestMean > 50) {
            report.recommendations.push('Fast mode rendering could be improved for better live preview performance');
        }
        
        return report;
    }

    /**
     * Get benchmark history
     */
    getBenchmarkHistory() {
        return this.benchmarkHistory;
    }

    /**
     * Clear benchmark history
     */
    clearBenchmarkHistory() {
        this.benchmarkHistory = [];
        logger.debug('🧹 Benchmark history cleared');
    }
}

// Create singleton instance
export const performanceBenchmarks = new PerformanceBenchmarks();

// Make available globally for browser console testing
if (typeof window !== 'undefined') {
    window.performanceBenchmarks = performanceBenchmarks;
    
    // Global benchmark runner
    window.runPerformanceBenchmarks = async () => {
        logger.debug('📊 Running performance benchmarks from console...');
        const results = await performanceBenchmarks.runAllBenchmarks();
        console.table(results.results.map(r => ({
            benchmark: r.name,
            mean: r.statistics?.mean?.toFixed(2) + 'ms' || 'failed',
            successRate: r.statistics?.successRate || 'N/A'
        })));
        console.log('📊 Full Benchmark Report:', results);
        return results;
    };
    
    // Individual benchmark runner
    window.runBenchmark = async (benchmarkType) => {
        const result = await performanceBenchmarks.runBenchmark(benchmarkType);
        console.log(`📊 ${result.name} Results:`, result.statistics);
        return result;
    };
    
    // Performance report generator
    window.getPerformanceReport = () => {
        const report = performanceBenchmarks.generatePerformanceReport();
        console.log('📊 Performance Report:', report);
        return report;
    };
}

export default performanceBenchmarks;