/**
 * Testing Infrastructure Validation Script
 * 
 * This script validates that all testing tools are properly configured
 * and would work correctly in a browser environment.
 * 
 * Run this in the browser console after loading the application:
 * 
 * 1. Copy and paste this entire script into browser console
 * 2. Run: validateTestingInfrastructure()
 * 3. Check results for any issues
 */

async function validateTestingInfrastructure() {
    console.log('🎛️ TESTING INFRASTRUCTURE VALIDATION');
    console.log('=====================================');
    
    const results = {
        globalFunctions: {},
        moduleAvailability: {},
        quickTests: {},
        overallStatus: 'unknown'
    };
    
    // Check global testing functions availability
    console.log('\n📋 Checking Global Testing Functions...');
    
    const expectedGlobalFunctions = [
        'runAllMathJaxTests',
        'quickMathJaxHealthCheck', 
        'viewTestHistory',
        'runF5CorruptionTests',
        'runF5Scenario',
        'runBrowserTests',
        'runTestSuite',
        'getBrowserInfo',
        'runPerformanceBenchmarks',
        'runBenchmark',
        'getPerformanceReport'
    ];
    
    for (const functionName of expectedGlobalFunctions) {
        const available = typeof window[functionName] === 'function';
        results.globalFunctions[functionName] = available;
        console.log(`  ${available ? '✅' : '❌'} ${functionName}`);
    }
    
    // Check module instances availability
    console.log('\n🧩 Checking Module Instances...');
    
    const expectedModules = [
        'testingDashboard',
        'f5CorruptionSimulator', 
        'browserTestSuite',
        'performanceBenchmarks',
        'coreCoordinator'
    ];
    
    for (const moduleName of expectedModules) {
        const available = typeof window[moduleName] === 'object' && window[moduleName] !== null;
        results.moduleAvailability[moduleName] = available;
        console.log(`  ${available ? '✅' : '❌'} ${moduleName}`);
    }
    
    // Quick functionality tests
    console.log('\n⚡ Running Quick Functionality Tests...');
    
    try {
        // Test 1: Browser info detection
        const browserInfo = window.getBrowserInfo?.();
        results.quickTests.browserInfo = !!browserInfo?.userAgent;
        console.log(`  ${results.quickTests.browserInfo ? '✅' : '❌'} Browser Info Detection`);
        
        // Test 2: Performance report generation
        const perfReport = window.getPerformanceReport?.();
        results.quickTests.performanceReport = !!perfReport?.timestamp;
        console.log(`  ${results.quickTests.performanceReport ? '✅' : '❌'} Performance Report Generation`);
        
        // Test 3: Health check
        const healthCheck = await window.quickMathJaxHealthCheck?.();
        results.quickTests.healthCheck = !!healthCheck?.timestamp;
        console.log(`  ${results.quickTests.healthCheck ? '✅' : '❌'} Quick Health Check`);
        
    } catch (error) {
        console.error('❌ Error during quick tests:', error);
        results.quickTests.error = error.message;
    }
    
    // Calculate overall status
    const globalFunctionsPassed = Object.values(results.globalFunctions).filter(Boolean).length;
    const modulesPassed = Object.values(results.moduleAvailability).filter(Boolean).length;
    const quickTestsPassed = Object.values(results.quickTests).filter(v => v === true).length;
    
    const totalChecks = expectedGlobalFunctions.length + expectedModules.length + 3;
    const totalPassed = globalFunctionsPassed + modulesPassed + quickTestsPassed;
    
    const successRate = ((totalPassed / totalChecks) * 100).toFixed(2);
    
    if (successRate >= 90) results.overallStatus = 'excellent';
    else if (successRate >= 75) results.overallStatus = 'good';
    else if (successRate >= 50) results.overallStatus = 'fair';
    else results.overallStatus = 'poor';
    
    // Final report
    console.log('\n📊 VALIDATION RESULTS');
    console.log('====================');
    console.log(`Overall Status: ${results.overallStatus.toUpperCase()}`);
    console.log(`Success Rate: ${successRate}% (${totalPassed}/${totalChecks})`);
    console.log(`Global Functions: ${globalFunctionsPassed}/${expectedGlobalFunctions.length}`);
    console.log(`Module Instances: ${modulesPassed}/${expectedModules.length}`);
    console.log(`Quick Tests: ${quickTestsPassed}/3`);
    
    if (results.overallStatus === 'excellent') {
        console.log('\n🎉 Testing infrastructure is ready for use!');
        console.log('\n🚀 Try these commands:');
        console.log('   runAllMathJaxTests()       - Comprehensive test suite');
        console.log('   runPerformanceBenchmarks() - Performance analysis');
        console.log('   runF5CorruptionTests()     - F5 corruption testing');
        console.log('   runBrowserTests()          - Browser compatibility tests');
        console.log('   quickMathJaxHealthCheck()  - Quick system health check');
    } else {
        console.log('\n⚠️ Some issues detected with testing infrastructure');
        console.log('Check the results above for specific problems');
    }
    
    return results;
}

// Auto-run validation if script is loaded
console.log('🎛️ Testing Infrastructure Validation Script Loaded');
console.log('Run validateTestingInfrastructure() to validate the testing tools');