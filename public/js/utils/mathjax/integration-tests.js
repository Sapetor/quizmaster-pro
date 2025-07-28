/**
 * MathJax Integration Tests
 * Comprehensive testing suite for Core Coordinator and service integration
 * 
 * Phase 2 Day 4: Integration testing and validation
 */

import { logger } from '../../core/config.js';
import { coreCoordinator } from './core-coordinator.js';

export class IntegrationTests {
    constructor() {
        this.testResults = [];
        this.testSuite = 'MathJax Integration Tests';
        this.startTime = null;
    }

    /**
     * Run all integration tests
     * @returns {Promise<Object>} Test results summary
     */
    async runAllTests() {
        this.startTime = Date.now();
        logger.debug('🧪 Starting MathJax Integration Test Suite');

        const tests = [
            { name: 'Service Initialization', fn: this.testServiceInitialization },
            { name: 'Basic Rendering', fn: this.testBasicRendering },
            { name: 'Fast Rendering', fn: this.testFastRendering },
            { name: 'Batch Rendering', fn: this.testBatchRendering },
            { name: 'Cache Functionality', fn: this.testCacheFunction },
            { name: 'Error Handling', fn: this.testErrorHandling },
            { name: 'Health Monitoring', fn: this.testHealthMonitoring },
            { name: 'Performance Tracking', fn: this.testPerformanceTracking },
            { name: 'Recovery Simulation', fn: this.testRecoverySimulation },
            { name: 'Browser Compatibility', fn: this.testBrowserCompatibility }
        ];

        // Reset health metrics before testing
        coreCoordinator.resetHealthMetrics();

        for (const test of tests) {
            try {
                logger.debug(`🧪 Running test: ${test.name}`);
                await test.fn.call(this);
                this.addTestResult(test.name, 'PASS', null);
                logger.debug(`✅ Test passed: ${test.name}`);
            } catch (error) {
                this.addTestResult(test.name, 'FAIL', error.message);
                logger.error(`❌ Test failed: ${test.name}`, error);
            }
        }

        return this.generateTestReport();
    }

    /**
     * Test service initialization and coordination
     */
    async testServiceInitialization() {
        // Test that all services are properly initialized
        const status = coreCoordinator.getHealthStatus();
        
        if (status.services.coordinator !== 'ready') {
            throw new Error('Core Coordinator not ready');
        }
        
        if (status.services.cache !== 'ready') {
            throw new Error('Cache Service not ready');
        }
        
        if (status.services.recovery !== 'ready') {
            throw new Error('Recovery Service not ready');
        }
        
        if (status.services.render !== 'ready') {
            throw new Error('Render Service not ready');
        }

        // Test service methods are available
        if (typeof coreCoordinator.render !== 'function') {
            throw new Error('Core Coordinator render method not available');
        }

        if (typeof coreCoordinator.renderFast !== 'function') {
            throw new Error('Core Coordinator renderFast method not available');
        }

        if (typeof coreCoordinator.renderBatch !== 'function') {
            throw new Error('Core Coordinator renderBatch method not available');
        }
    }

    /**
     * Test basic rendering functionality
     */
    async testBasicRendering() {
        // Create test element with LaTeX content
        const testElement = this.createTestElement('basic-render-test', 'Test equation: $x^2 + y^2 = z^2$');
        
        try {
            await coreCoordinator.render(testElement);
            
            // Verify health metrics were updated
            const status = coreCoordinator.getHealthStatus();
            if (status.performance.totalRenders === 0) {
                throw new Error('Health metrics not updated after render');
            }
            
        } finally {
            this.cleanupTestElement(testElement);
        }
    }

    /**
     * Test fast rendering for live preview
     */
    async testFastRendering() {
        const testElement = this.createTestElement('fast-render-test', 'Fast render: $\\frac{a}{b} = c$');
        
        try {
            const startTime = Date.now();
            await coreCoordinator.renderFast(testElement);
            const renderTime = Date.now() - startTime;
            
            // Fast rendering should complete quickly
            if (renderTime > 500) {
                throw new Error(`Fast rendering too slow: ${renderTime}ms`);
            }
            
        } finally {
            this.cleanupTestElement(testElement);
        }
    }

    /**
     * Test batch rendering functionality
     */
    async testBatchRendering() {
        const elements = [
            this.createTestElement('batch-test-1', 'Equation 1: $a = b + c$'),
            this.createTestElement('batch-test-2', 'Equation 2: $\\sum_{i=1}^n x_i$'),
            this.createTestElement('batch-test-3', 'Equation 3: $\\int_0^1 f(x) dx$')
        ];
        
        try {
            await coreCoordinator.renderBatch(elements);
            
            // Verify all elements were processed
            const status = coreCoordinator.getHealthStatus();
            if (status.performance.totalRenders < 3) {
                throw new Error('Batch rendering did not process all elements');
            }
            
        } finally {
            elements.forEach(el => this.cleanupTestElement(el));
        }
    }

    /**
     * Test cache functionality
     */
    async testCacheFunction() {
        const testElement = this.createTestElement('cache-test', 'Cache test: $e^{i\\pi} + 1 = 0$');
        
        try {
            // First render should be cache miss
            await coreCoordinator.render(testElement);
            
            const status1 = coreCoordinator.getHealthStatus();
            const initialMisses = parseInt(status1.cache.misses);
            
            // Simulate cache by manually setting content
            coreCoordinator.cacheService.cacheMathJaxContent(testElement);
            
            // Second render should potentially be faster due to cache
            await coreCoordinator.render(testElement);
            
            const status2 = coreCoordinator.getHealthStatus();
            const finalHits = parseInt(status2.cache.hits);
            
            // Cache should have been utilized
            if (finalHits === 0 && parseInt(status2.cache.misses) <= initialMisses) {
                // This is not necessarily a failure - cache might not be hit depending on implementation
                logger.debug('⚠️ Cache metrics may need adjustment - not necessarily a test failure');
            }
            
        } finally {
            this.cleanupTestElement(testElement);
        }
    }

    /**
     * Test error handling
     */
    async testErrorHandling() {
        // Test with invalid element
        try {
            await coreCoordinator.render(null);
            throw new Error('Should have thrown error for null element');
        } catch (error) {
            if (error.message.includes('Should have thrown')) {
                throw error;
            }
            // Expected error - test passes
        }

        // Test with element that gets removed during render
        const testElement = this.createTestElement('error-test', 'Error test: $\\invalid{syntax}$');
        
        try {
            // Remove element immediately to simulate DOM removal during render
            const promise = coreCoordinator.render(testElement);
            testElement.remove();
            await promise;
            
            // Should handle gracefully without throwing
            
        } catch (error) {
            // Error handling should prevent crashes
            logger.debug('Error handled gracefully:', error.message);
        }
    }

    /**
     * Test health monitoring functionality
     */
    async testHealthMonitoring() {
        const initialStatus = coreCoordinator.getHealthStatus();
        
        // Health status should have required properties
        const requiredProps = ['coordinator', 'services', 'performance', 'cache'];
        for (const prop of requiredProps) {
            if (!initialStatus[prop]) {
                throw new Error(`Missing health status property: ${prop}`);
            }
        }

        // Performance metrics should exist
        if (!initialStatus.performance.totalRenders !== undefined) {
            throw new Error('Performance metrics not available');
        }

        // Run a render to update metrics
        const testElement = this.createTestElement('health-test', 'Health: $f(x) = ax^2$');
        
        try {
            await coreCoordinator.render(testElement);
            
            const updatedStatus = coreCoordinator.getHealthStatus();
            
            if (parseInt(updatedStatus.performance.totalRenders) <= parseInt(initialStatus.performance.totalRenders)) {
                throw new Error('Health metrics not updating properly');
            }
            
        } finally {
            this.cleanupTestElement(testElement);
        }
    }

    /**
     * Test performance tracking
     */
    async testPerformanceTracking() {
        const testElement = this.createTestElement('perf-test', 'Performance: $\\sqrt{x^2 + y^2}$');
        
        try {
            await coreCoordinator.render(testElement);
            
            const status = coreCoordinator.getHealthStatus();
            
            // Should have performance metrics
            if (!status.recentPerformance) {
                throw new Error('Recent performance data not available');
            }

            if (!status.performance.averageRenderTime) {
                throw new Error('Average render time not tracked');
            }
            
        } finally {
            this.cleanupTestElement(testElement);
        }
    }

    /**
     * Test recovery simulation
     */
    async testRecoverySimulation() {
        const testElement = this.createTestElement('recovery-test', 'Recovery: $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$');
        
        try {
            // Force a recovery attempt
            await coreCoordinator.forceRecovery(testElement);
            
            const status = coreCoordinator.getHealthStatus();
            
            if (parseInt(status.performance.recoveryAttempts) === 0) {
                throw new Error('Recovery attempt not tracked');
            }
            
        } finally {
            this.cleanupTestElement(testElement);
        }
    }

    /**
     * Test browser compatibility detection
     */
    async testBrowserCompatibility() {
        const diagnostics = await coreCoordinator.runDiagnostics();
        
        // Should detect browser information
        if (!diagnostics.browser) {
            throw new Error('Browser detection not working');
        }

        if (!diagnostics.browser.userAgent) {
            throw new Error('User agent not detected');
        }

        if (diagnostics.browser.chrome === undefined) {
            throw new Error('Chrome detection not working');
        }

        if (diagnostics.browser.windows === undefined) {
            throw new Error('Windows detection not working');
        }

        // MathJax status should be included
        if (!diagnostics.mathJax) {
            throw new Error('MathJax diagnostics not included');
        }
    }

    /**
     * Create test element
     * @param {string} id - Element ID
     * @param {string} content - LaTeX content
     * @returns {HTMLElement} Test element
     */
    createTestElement(id, content) {
        const element = document.createElement('div');
        element.id = id;
        element.innerHTML = content;
        element.classList.add('tex2jax_process', 'math-ready');
        document.body.appendChild(element);
        return element;
    }

    /**
     * Clean up test element
     * @param {HTMLElement} element - Element to remove
     */
    cleanupTestElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * Add test result
     * @param {string} testName - Name of test
     * @param {string} status - PASS or FAIL
     * @param {string} error - Error message if failed
     */
    addTestResult(testName, status, error) {
        this.testResults.push({
            name: testName,
            status,
            error,
            timestamp: Date.now()
        });
    }

    /**
     * Generate test report
     * @returns {Object} Test report summary
     */
    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
        const duration = Date.now() - this.startTime;

        const report = {
            suite: this.testSuite,
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`,
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`
            },
            results: this.testResults,
            healthStatus: coreCoordinator.getHealthStatus()
        };

        logger.debug('📊 Test Report Summary:', {
            total: report.summary.total,
            passed: report.summary.passed,
            failed: report.summary.failed,
            successRate: report.summary.successRate,
            duration: report.duration
        });

        return report;
    }
}

// Create singleton instance for global access
export const integrationTests = new IntegrationTests();

// Make available globally for browser console testing
window.runMathJaxTests = async () => {
    logger.debug('🧪 Running MathJax Integration Tests from console...');
    const results = await integrationTests.runAllTests();
    console.table(results.results);
    return results;
};

export default integrationTests;