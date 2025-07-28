/**
 * MathJax Testing Dashboard
 * Unified interface for all testing and monitoring tools
 * 
 * Phase 2 Day 7: Complete testing infrastructure
 */

import { logger } from '../../core/config.js';
import { coreCoordinator } from './core-coordinator.js';
import { integrationTests } from './integration-tests.js';
import { f5CorruptionSimulator } from './f5-corruption-simulator.js';
import { performanceBenchmarks } from './performance-benchmarks.js';
import { browserTestSuite } from './browser-test-suite.js';
import { performanceDashboard } from '../performance-dashboard.js';

export class TestingDashboard {
    constructor() {
        this.testSessions = [];
        this.currentSession = null;
        this.autoTestingEnabled = false;
        this.testSchedule = new Map();
        
        this.initializeDashboard();
    }

    /**
     * Initialize testing dashboard
     */
    initializeDashboard() {
        logger.debug('🎛️ Testing Dashboard initialized');
        
        // Set up periodic health monitoring
        this.startHealthMonitoring();
        
        // Initialize test categories
        this.testCategories = {
            integration: {
                name: 'Integration Tests',
                runner: integrationTests,
                method: 'runAllTests',
                description: 'Core service integration validation'
            },
            corruption: {
                name: 'F5 Corruption Tests',
                runner: f5CorruptionSimulator,
                method: 'runAllScenarios',
                description: 'F5 corruption detection and recovery'
            },
            performance: {
                name: 'Performance Benchmarks',
                runner: performanceBenchmarks,
                method: 'runAllBenchmarks',
                description: 'Rendering performance analysis'
            },
            browser: {
                name: 'Browser Compatibility',
                runner: browserTestSuite,
                method: 'runAllTestSuites',
                description: 'Cross-browser functionality testing'
            }
        };
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        // Monitor system health every 30 seconds
        setInterval(() => {
            this.logHealthSnapshot();
        }, 30000);
        
        logger.debug('🏥 Health monitoring started');
    }

    /**
     * Log health snapshot
     */
    logHealthSnapshot() {
        const health = coreCoordinator.getHealthStatus();
        
        // Only log if there's been activity
        if (parseInt(health.performance.totalRenders) > 0) {
            logger.debug('🏥 Health Snapshot:', {
                renders: health.performance.totalRenders,
                successRate: health.performance.successRate,
                cacheHitRate: health.cache.hitRate,
                lastError: health.lastError?.message || 'none'
            });
        }
    }

    /**
     * Run comprehensive test suite
     * @param {Object} options - Test configuration options
     * @returns {Promise<Object>} Complete test results
     */
    async runComprehensiveTests(options = {}) {
        const {
            includeIntegration = true,
            includeCorruption = true,
            includePerformance = true,
            includeBrowser = true,
            generateReport = true
        } = options;

        const session = {
            id: `test_session_${Date.now()}`,
            timestamp: new Date().toISOString(),
            startTime: Date.now(),
            browserInfo: browserTestSuite.browserInfo,
            systemHealth: coreCoordinator.getHealthStatus(),
            results: {},
            summary: {},
            duration: 0
        };

        this.currentSession = session;
        logger.debug('🧪 Starting comprehensive test session:', session.id);

        try {
            // Run integration tests
            if (includeIntegration) {
                logger.debug('🔧 Running integration tests...');
                const testElement = this.createTestElement('comprehensive-integration');
                try {
                    session.results.integration = await integrationTests.runAllTests();
                } finally {
                    this.cleanupTestElement(testElement);
                }
            }

            // Run F5 corruption tests
            if (includeCorruption) {
                logger.debug('💥 Running F5 corruption tests...');
                const testElement = this.createTestElement('comprehensive-corruption');
                try {
                    session.results.corruption = await f5CorruptionSimulator.runAllScenarios(testElement);
                } finally {
                    this.cleanupTestElement(testElement);
                }
            }

            // Run performance benchmarks
            if (includePerformance) {
                logger.debug('📊 Running performance benchmarks...');
                session.results.performance = await performanceBenchmarks.runAllBenchmarks();
            }

            // Run browser compatibility tests
            if (includeBrowser) {
                logger.debug('🌐 Running browser compatibility tests...');
                session.results.browser = await browserTestSuite.runAllTestSuites();
            }

            // Generate summary
            session.duration = Date.now() - session.startTime;
            session.summary = this.generateTestSummary(session.results);
            
            // Generate report if requested
            if (generateReport) {
                session.report = this.generateTestReport(session);
            }

            session.success = true;
            logger.debug('✅ Comprehensive test session completed:', {
                sessionId: session.id,
                duration: `${session.duration}ms`,
                overallSuccess: session.summary.overallSuccessRate
            });

        } catch (error) {
            session.success = false;
            session.error = error.message;
            logger.error('❌ Comprehensive test session failed:', error);
        }

        this.testSessions.push(session);
        this.currentSession = null;
        
        return session;
    }

    /**
     * Generate test summary from results
     */
    generateTestSummary(results) {
        const summary = {
            categories: {},
            totals: {
                tests: 0,
                passed: 0,
                failed: 0
            },
            overallSuccessRate: '0%'
        };

        // Integration tests summary
        if (results.integration) {
            const passed = results.integration.results.filter(r => r.status === 'PASS').length;
            const total = results.integration.results.length;
            summary.categories.integration = {
                passed,
                total,
                successRate: `${((passed / total) * 100).toFixed(2)}%`
            };
            summary.totals.tests += total;
            summary.totals.passed += passed;
            summary.totals.failed += (total - passed);
        }

        // Corruption tests summary
        if (results.corruption) {
            const passed = results.corruption.results.filter(r => r.success).length;
            const total = results.corruption.results.length;
            summary.categories.corruption = {
                passed,
                total,
                successRate: `${((passed / total) * 100).toFixed(2)}%`
            };
            summary.totals.tests += total;
            summary.totals.passed += passed;
            summary.totals.failed += (total - passed);
        }

        // Performance benchmarks summary
        if (results.performance) {
            const successful = results.performance.results.filter(r => !r.error).length;
            const total = results.performance.results.length;
            summary.categories.performance = {
                passed: successful,
                total,
                successRate: `${((successful / total) * 100).toFixed(2)}%`
            };
            summary.totals.tests += total;
            summary.totals.passed += successful;
            summary.totals.failed += (total - successful);
        }

        // Browser tests summary
        if (results.browser) {
            const passed = results.browser.summary.totalPassed;
            const total = results.browser.summary.totalTests;
            summary.categories.browser = {
                passed,
                total,
                successRate: results.browser.summary.overallSuccessRate
            };
            summary.totals.tests += total;
            summary.totals.passed += passed;
            summary.totals.failed += (total - passed);
        }

        // Calculate overall success rate
        if (summary.totals.tests > 0) {
            summary.overallSuccessRate = `${((summary.totals.passed / summary.totals.tests) * 100).toFixed(2)}%`;
        }

        return summary;
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport(session) {
        const report = {
            sessionInfo: {
                id: session.id,
                timestamp: session.timestamp,
                duration: `${session.duration}ms`,
                browserInfo: session.browserInfo
            },
            executiveSummary: {
                overallSuccessRate: session.summary.overallSuccessRate,
                totalTests: session.summary.totals.tests,
                totalPassed: session.summary.totals.passed,
                totalFailed: session.summary.totals.failed,
                systemHealth: session.systemHealth
            },
            categoryResults: session.summary.categories,
            recommendations: [],
            systemAnalysis: this.analyzeSystemPerformance(session),
            issuesSummary: this.identifyIssues(session)
        };

        // Generate recommendations
        report.recommendations = this.generateRecommendations(session);

        return report;
    }

    /**
     * Analyze system performance from test results
     */
    analyzeSystemPerformance(session) {
        const analysis = {
            renderingPerformance: 'unknown',
            corruptionRecovery: 'unknown',
            browserCompatibility: 'unknown',
            memoryUsage: 'unknown',
            cacheEfficiency: 'unknown'
        };

        // Analyze performance benchmarks
        if (session.results.performance) {
            const avgRenderTime = session.results.performance.results
                .filter(r => r.statistics?.mean)
                .reduce((sum, r) => sum + r.statistics.mean, 0) / 
                session.results.performance.results.filter(r => r.statistics?.mean).length;

            if (avgRenderTime < 50) analysis.renderingPerformance = 'excellent';
            else if (avgRenderTime < 100) analysis.renderingPerformance = 'good';
            else if (avgRenderTime < 200) analysis.renderingPerformance = 'fair';
            else analysis.renderingPerformance = 'poor';
        }

        // Analyze corruption recovery
        if (session.results.corruption) {
            const recoverySuccessRate = parseFloat(session.results.corruption.summary.successRate);
            if (recoverySuccessRate >= 90) analysis.corruptionRecovery = 'excellent';
            else if (recoverySuccessRate >= 75) analysis.corruptionRecovery = 'good';
            else if (recoverySuccessRate >= 50) analysis.corruptionRecovery = 'fair';
            else analysis.corruptionRecovery = 'poor';
        }

        // Analyze browser compatibility
        if (session.results.browser) {
            const browserSuccessRate = parseFloat(session.results.browser.summary.overallSuccessRate);
            if (browserSuccessRate >= 95) analysis.browserCompatibility = 'excellent';
            else if (browserSuccessRate >= 85) analysis.browserCompatibility = 'good';
            else if (browserSuccessRate >= 70) analysis.browserCompatibility = 'fair';
            else analysis.browserCompatibility = 'poor';
        }

        return analysis;
    }

    /**
     * Identify issues from test results
     */
    identifyIssues(session) {
        const issues = {
            critical: [],
            warnings: [],
            info: []
        };

        // Check for critical failures
        if (session.summary.totals.failed > session.summary.totals.passed) {
            issues.critical.push('More tests failed than passed - system may be unstable');
        }

        // Check success rates
        if (parseFloat(session.summary.overallSuccessRate) < 70) {
            issues.critical.push('Overall success rate below 70% - needs immediate attention');
        } else if (parseFloat(session.summary.overallSuccessRate) < 85) {
            issues.warnings.push('Success rate below 85% - consider optimization');
        }

        // Check for performance issues
        if (session.results.performance) {
            const slowBenchmarks = session.results.performance.results.filter(
                r => r.statistics?.mean && r.statistics.mean > 200
            );
            if (slowBenchmarks.length > 0) {
                issues.warnings.push(`${slowBenchmarks.length} benchmarks exceed 200ms - performance optimization needed`);
            }
        }

        return issues;
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations(session) {
        const recommendations = [];

        // Performance recommendations
        if (session.results.performance) {
            const avgTime = session.results.performance.results
                .filter(r => r.statistics?.mean)
                .reduce((sum, r) => sum + r.statistics.mean, 0) / 
                session.results.performance.results.filter(r => r.statistics?.mean).length;

            if (avgTime > 100) {
                recommendations.push({
                    priority: 'high',
                    category: 'performance',
                    issue: 'Slow rendering performance',
                    recommendation: 'Consider implementing additional caching or optimizing MathJax configuration'
                });
            }
        }

        // Browser compatibility recommendations
        if (session.results.browser) {
            const browserSuccessRate = parseFloat(session.results.browser.summary.overallSuccessRate);
            if (browserSuccessRate < 90) {
                recommendations.push({
                    priority: 'medium',
                    category: 'compatibility',
                    issue: 'Browser compatibility issues detected',
                    recommendation: 'Review browser-specific code paths and add fallbacks where needed'
                });
            }
        }

        // System health recommendations
        const currentHealth = coreCoordinator.getHealthStatus();
        if (parseInt(currentHealth.performance.successRate) < 95) {
            recommendations.push({
                priority: 'medium',
                category: 'reliability',
                issue: 'Success rate below optimal',
                recommendation: 'Investigate error patterns and improve error handling'
            });
        }

        return recommendations;
    }

    /**
     * Quick health check
     * @returns {Object} Quick system health assessment
     */
    async quickHealthCheck() {
        logger.debug('🔍 Running quick health check...');
        
        const health = {
            timestamp: new Date().toISOString(),
            coordinator: coreCoordinator.getHealthStatus(),
            quickTests: {}
        };

        // Quick render test
        const testElement = this.createTestElement('health-check');
        try {
            const startTime = performance.now();
            await coreCoordinator.renderFast(testElement);
            health.quickTests.renderTime = performance.now() - startTime;
            health.quickTests.renderSuccess = true;
        } catch (error) {
            health.quickTests.renderSuccess = false;
            health.quickTests.renderError = error.message;
        } finally {
            this.cleanupTestElement(testElement);
        }

        // Check corruption detection
        try {
            health.quickTests.corruptionDetection = f5CorruptionSimulator.recoveryService?.detectF5Corruption() || false;
        } catch (error) {
            health.quickTests.corruptionDetection = false;
        }

        logger.debug('✅ Quick health check completed');
        return health;
    }

    /**
     * Helper methods
     */
    createTestElement(id) {
        const element = document.createElement('div');
        element.id = `test-dashboard-${id}`;
        element.innerHTML = `Dashboard test: $\\alpha \\beta \\gamma$`;
        element.classList.add('tex2jax_process', 'math-ready');
        element.style.position = 'absolute';
        element.style.top = '-1000px';
        document.body.appendChild(element);
        return element;
    }

    cleanupTestElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * Get test session history
     */
    getTestHistory() {
        return this.testSessions;
    }

    /**
     * Get current session status
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Clear test history
     */
    clearTestHistory() {
        this.testSessions = [];
        logger.debug('🧹 Test history cleared');
    }
}

// Create singleton instance
export const testingDashboard = new TestingDashboard();

// Make available globally for browser console
if (typeof window !== 'undefined') {
    window.testingDashboard = testingDashboard;
    
    // Comprehensive test runner
    window.runAllMathJaxTests = async (options) => {
        logger.debug('🎛️ Running comprehensive MathJax test suite...');
        const results = await testingDashboard.runComprehensiveTests(options);
        console.log('🎛️ Comprehensive Test Results:', results);
        if (results.report) {
            console.log('📊 Test Report:', results.report);
        }
        return results;
    };
    
    // Quick health check
    window.quickMathJaxHealthCheck = async () => {
        const health = await testingDashboard.quickHealthCheck();
        console.log('🔍 Quick Health Check:', health);
        return health;
    };
    
    // Test history viewer
    window.viewTestHistory = () => {
        const history = testingDashboard.getTestHistory();
        console.table(history.map(session => ({
            id: session.id,
            timestamp: session.timestamp,
            duration: session.duration + 'ms',
            successRate: session.summary?.overallSuccessRate || 'N/A',
            totalTests: session.summary?.totals?.tests || 0
        })));
        return history;
    };
    
    // Performance dashboard access
    window.showPerformanceDashboard = () => {
        performanceDashboard.show();
        console.log('Performance dashboard opened. Press Ctrl+Shift+P to toggle anytime.');
    };
    
    window.perf = window.performanceMonitor; // Shortcut for console access
}

export default testingDashboard;