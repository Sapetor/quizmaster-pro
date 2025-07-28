/**
 * F5 Corruption Simulator
 * Tool for artificially creating F5 corruption scenarios for controlled testing
 * 
 * Phase 2 Day 5: Testing infrastructure development
 */

import { logger } from '../../core/config.js';
import { coreCoordinator } from './core-coordinator.js';

export class F5CorruptionSimulator {
    constructor() {
        this.originalMathJax = null;
        this.corruptionActive = false;
        this.testScenarios = new Map();
        this.testResults = [];
        
        this.initializeScenarios();
    }

    /**
     * Initialize predefined test scenarios
     */
    initializeScenarios() {
        // Scenario 1: Classic F5 corruption
        this.testScenarios.set('classic_f5', {
            name: 'Classic F5 Corruption',
            description: 'startup=true, document=false, typesetPromise=false',
            setup: () => this.simulateClassicF5Corruption(),
            cleanup: () => this.restoreMathJax(),
            expectedRecovery: true
        });

        // Scenario 2: Partial corruption
        this.testScenarios.set('partial_corruption', {
            name: 'Partial MathJax Corruption',
            description: 'MathJax exists but methods are broken',
            setup: () => this.simulatePartialCorruption(),
            cleanup: () => this.restoreMathJax(),
            expectedRecovery: true
        });

        // Scenario 3: Script missing
        this.testScenarios.set('script_missing', {
            name: 'MathJax Script Missing',
            description: 'window.MathJax completely undefined',
            setup: () => this.simulateScriptMissing(),
            cleanup: () => this.restoreMathJax(),
            expectedRecovery: true
        });

        // Scenario 4: Chrome multi-tab interference
        this.testScenarios.set('chrome_multitab', {
            name: 'Chrome Multi-Tab Interference',
            description: 'Simulates Chrome tab conflicts',
            setup: () => this.simulateChromeMultiTab(),
            cleanup: () => this.cleanupChromeMultiTab(),
            expectedRecovery: true
        });

        // Scenario 5: DOM corruption
        this.testScenarios.set('dom_corruption', {
            name: 'DOM Element Corruption',
            description: 'Elements removed during MathJax processing',
            setup: () => this.simulateDOMCorruption(),
            cleanup: () => this.restoreMathJax(),
            expectedRecovery: false // Expected to fail gracefully
        });
    }

    /**
     * Backup current MathJax state
     */
    backupMathJax() {
        this.originalMathJax = {
            mathJax: window.MathJax,
            mathJaxReady: window.mathJaxReady,
            mathJaxLoadTime: window.mathJaxLoadTime
        };
        logger.debug('📦 MathJax state backed up for simulation');
    }

    /**
     * Restore MathJax to original state
     */
    restoreMathJax() {
        if (this.originalMathJax) {
            window.MathJax = this.originalMathJax.mathJax;
            window.mathJaxReady = this.originalMathJax.mathJaxReady;
            window.mathJaxLoadTime = this.originalMathJax.mathJaxLoadTime;
            this.corruptionActive = false;
            logger.debug('🔄 MathJax state restored from backup');
        }
    }

    /**
     * Simulate classic F5 corruption
     */
    simulateClassicF5Corruption() {
        this.backupMathJax();
        
        // Create corrupted MathJax state
        window.MathJax = {
            startup: {
                // document property missing - classic F5 corruption
            },
            // typesetPromise missing
        };
        
        delete window.mathJaxReady;
        this.corruptionActive = true;
        
        logger.debug('💥 Classic F5 corruption simulated');
        logger.debug('🔍 Corruption check:', {
            hasStartup: !!window.MathJax?.startup,
            hasDocument: !!window.MathJax?.startup?.document,
            hasTypesetPromise: !!window.MathJax?.typesetPromise
        });
    }

    /**
     * Simulate partial MathJax corruption
     */
    simulatePartialCorruption() {
        this.backupMathJax();
        
        // Keep MathJax object but break methods
        if (window.MathJax) {
            window.MathJax.typesetPromise = function() {
                throw new Error('Simulated partial corruption - typesetPromise broken');
            };
            
            if (window.MathJax.startup) {
                window.MathJax.startup.document = null;
            }
        }
        
        this.corruptionActive = true;
        logger.debug('⚡ Partial MathJax corruption simulated');
    }

    /**
     * Simulate completely missing MathJax script
     */
    simulateScriptMissing() {
        this.backupMathJax();
        
        delete window.MathJax;
        delete window.mathJaxReady;
        
        this.corruptionActive = true;
        logger.debug('🚫 MathJax script missing simulated');
    }

    /**
     * Simulate Chrome multi-tab interference
     */
    simulateChromeMultiTab() {
        this.backupMathJax();
        
        // Create fake active tabs in localStorage
        const fakeActiveTabs = {
            'tab_fake_1': { isHost: true, lastSeen: Date.now() },
            'tab_fake_2': { isHost: false, lastSeen: Date.now() - 5000 }
        };
        
        localStorage.setItem('quizmaster_active_tabs', JSON.stringify(fakeActiveTabs));
        
        // Corrupt MathJax
        this.simulateClassicF5Corruption();
        
        logger.debug('🖥️ Chrome multi-tab interference simulated');
    }

    /**
     * Clean up Chrome multi-tab simulation
     */
    cleanupChromeMultiTab() {
        localStorage.removeItem('quizmaster_active_tabs');
        localStorage.removeItem('quizmaster_recovery_coordination');
        this.restoreMathJax();
        logger.debug('🧹 Chrome multi-tab simulation cleaned up');
    }

    /**
     * Simulate DOM corruption during rendering
     */
    simulateDOMCorruption() {
        this.backupMathJax();
        
        // Keep MathJax functional but simulate DOM issues
        if (window.MathJax && window.MathJax.typesetPromise) {
            const originalTypeset = window.MathJax.typesetPromise;
            window.MathJax.typesetPromise = function(elements) {
                // Simulate replaceChild error
                return Promise.reject(new Error("Cannot read properties of null (reading 'replaceChild')"));
            };
        }
        
        this.corruptionActive = true;
        logger.debug('🔗 DOM corruption simulated');
    }

    /**
     * Run a specific test scenario
     * @param {string} scenarioId - ID of scenario to run
     * @param {HTMLElement} testElement - Element to test with
     * @returns {Promise<Object>} Test result
     */
    async runScenario(scenarioId, testElement) {
        const scenario = this.testScenarios.get(scenarioId);
        if (!scenario) {
            throw new Error(`Unknown scenario: ${scenarioId}`);
        }

        const testResult = {
            scenario: scenarioId,
            name: scenario.name,
            description: scenario.description,
            startTime: Date.now(),
            success: false,
            recoveryTriggered: false,
            errorMessage: null,
            duration: 0,
            healthBefore: null,
            healthAfter: null
        };

        try {
            logger.debug(`🧪 Starting test scenario: ${scenario.name}`);
            
            // Get initial health state
            testResult.healthBefore = coreCoordinator.getHealthStatus();
            
            // Reset health metrics for clean test
            coreCoordinator.resetHealthMetrics();
            
            // Set up corruption scenario
            await scenario.setup();
            
            // Attempt to render with corrupted state
            try {
                await coreCoordinator.render(testElement);
                testResult.success = true;
            } catch (error) {
                testResult.errorMessage = error.message;
                
                // Check if recovery was attempted
                const healthAfterRender = coreCoordinator.getHealthStatus();
                testResult.recoveryTriggered = parseInt(healthAfterRender.performance.recoveryAttempts) > 0;
                
                // For scenarios expecting recovery, check if it was triggered
                if (scenario.expectedRecovery && testResult.recoveryTriggered) {
                    testResult.success = true;
                }
            }
            
            // Get final health state
            testResult.healthAfter = coreCoordinator.getHealthStatus();
            testResult.duration = Date.now() - testResult.startTime;
            
            logger.debug(`✅ Test scenario completed: ${scenario.name} (${testResult.success ? 'PASS' : 'FAIL'})`);
            
        } catch (error) {
            testResult.errorMessage = error.message;
            testResult.duration = Date.now() - testResult.startTime;
            logger.error(`❌ Test scenario failed: ${scenario.name}`, error);
        } finally {
            // Always clean up
            await scenario.cleanup();
        }

        this.testResults.push(testResult);
        return testResult;
    }

    /**
     * Run all test scenarios
     * @param {HTMLElement} testElement - Element to test with
     * @returns {Promise<Object>} Complete test results
     */
    async runAllScenarios(testElement) {
        const startTime = Date.now();
        const results = [];
        
        logger.debug('🧪 Starting F5 corruption simulation test suite');
        
        for (const [scenarioId, scenario] of this.testScenarios) {
            try {
                const result = await this.runScenario(scenarioId, testElement);
                results.push(result);
                
                // Brief pause between tests
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                logger.error(`❌ Scenario ${scenarioId} crashed:`, error);
                results.push({
                    scenario: scenarioId,
                    name: scenario.name,
                    success: false,
                    errorMessage: error.message,
                    duration: 0
                });
            }
        }
        
        const totalDuration = Date.now() - startTime;
        const passedTests = results.filter(r => r.success).length;
        const failedTests = results.filter(r => !r.success).length;
        
        const summary = {
            timestamp: new Date().toISOString(),
            totalDuration: `${totalDuration}ms`,
            summary: {
                total: results.length,
                passed: passedTests,
                failed: failedTests,
                successRate: `${((passedTests / results.length) * 100).toFixed(2)}%`
            },
            results,
            healthSnapshot: coreCoordinator.getHealthStatus()
        };
        
        logger.debug('📊 F5 Corruption Test Suite Results:', {
            total: summary.summary.total,
            passed: summary.summary.passed,
            failed: summary.summary.failed,
            successRate: summary.summary.successRate,
            duration: summary.totalDuration
        });
        
        return summary;
    }

    /**
     * Create test element with LaTeX content
     * @returns {HTMLElement} Test element
     */
    createTestElement() {
        const element = document.createElement('div');
        element.id = 'f5-corruption-test-element';
        element.innerHTML = 'Test LaTeX: $E = mc^2$ and $\\int_0^1 x^2 dx = \\frac{1}{3}$';
        element.classList.add('tex2jax_process', 'math-ready');
        element.style.position = 'absolute';
        element.style.top = '-1000px'; // Hide from view
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
     * Get test history
     * @returns {Array} Array of test results
     */
    getTestHistory() {
        return this.testResults;
    }

    /**
     * Clear test history
     */
    clearTestHistory() {
        this.testResults = [];
        logger.debug('🧹 Test history cleared');
    }
}

// Create singleton instance
export const f5CorruptionSimulator = new F5CorruptionSimulator();

// Make available globally for browser console testing
if (typeof window !== 'undefined') {
    window.f5CorruptionSimulator = f5CorruptionSimulator;
    
    // Global test runner function
    window.runF5CorruptionTests = async () => {
        logger.debug('🧪 Running F5 corruption tests from console...');
        const testElement = f5CorruptionSimulator.createTestElement();
        
        try {
            const results = await f5CorruptionSimulator.runAllScenarios(testElement);
            console.table(results.results);
            console.log('📊 Full Test Report:', results);
            return results;
        } finally {
            f5CorruptionSimulator.cleanupTestElement(testElement);
        }
    };
    
    // Individual scenario runner
    window.runF5Scenario = async (scenarioId) => {
        const testElement = f5CorruptionSimulator.createTestElement();
        
        try {
            const result = await f5CorruptionSimulator.runScenario(scenarioId, testElement);
            console.log(`🧪 Scenario Result:`, result);
            return result;
        } finally {
            f5CorruptionSimulator.cleanupTestElement(testElement);
        }
    };
}

export default f5CorruptionSimulator;