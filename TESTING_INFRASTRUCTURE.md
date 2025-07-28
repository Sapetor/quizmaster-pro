# Testing Infrastructure Documentation

## Overview

QuizMaster Pro now includes a comprehensive testing infrastructure built during Phase 2 Days 5-7. This infrastructure provides automated testing, performance benchmarking, F5 corruption simulation, and browser compatibility validation for the MathJax LaTeX rendering system.

## Components

### 1. Testing Dashboard (`testing-dashboard.js`)
- **Purpose**: Unified interface for all testing tools
- **Features**: Comprehensive test suite coordination, health monitoring, test reports
- **Global Functions**:
  - `runAllMathJaxTests(options)` - Run complete test suite
  - `quickMathJaxHealthCheck()` - Quick system health check
  - `viewTestHistory()` - View test execution history

### 2. F5 Corruption Simulator (`f5-corruption-simulator.js`)
- **Purpose**: Simulate F5 corruption scenarios for controlled testing
- **Features**: Classic F5 corruption, partial corruption, Chrome multi-tab interference
- **Global Functions**:
  - `runF5CorruptionTests()` - Run all F5 corruption scenarios
  - `runF5Scenario(scenarioId)` - Run specific corruption scenario

### 3. Performance Benchmarks (`performance-benchmarks.js`)
- **Purpose**: Measure and analyze MathJax rendering performance
- **Features**: Single/batch rendering, cache performance, complex LaTeX benchmarks
- **Global Functions**:
  - `runPerformanceBenchmarks()` - Run all performance benchmarks
  - `runBenchmark(benchmarkType)` - Run specific benchmark
  - `getPerformanceReport()` - Generate performance analysis report

### 4. Browser Test Suite (`browser-test-suite.js`)
- **Purpose**: Cross-browser compatibility testing
- **Features**: Basic functionality, browser-specific features, stress testing
- **Global Functions**:
  - `runBrowserTests()` - Run all browser compatibility tests
  - `runTestSuite(suiteId)` - Run specific test suite
  - `getBrowserInfo()` - Get detailed browser information

### 5. Integration Tests (`integration-tests.js`)
- **Purpose**: Core service integration validation
- **Features**: Service coordination testing, health monitoring validation
- **Global Functions**:
  - `runMathJaxTests()` - Run integration test suite

## Quick Start Guide

### 1. Basic Health Check
```javascript
// Open browser console and run:
const health = await quickMathJaxHealthCheck();
console.log('System Health:', health);
```

### 2. Performance Analysis
```javascript
// Run performance benchmarks:
const performance = await runPerformanceBenchmarks();
console.log('Performance Results:', performance);
```

### 3. F5 Corruption Testing
```javascript
// Test F5 corruption recovery:
const f5Results = await runF5CorruptionTests();
console.log('F5 Test Results:', f5Results);
```

### 4. Browser Compatibility Testing
```javascript
// Test cross-browser compatibility:
const browserResults = await runBrowserTests();
console.log('Browser Test Results:', browserResults);
```

### 5. Comprehensive Testing
```javascript
// Run complete test suite:
const results = await runAllMathJaxTests({
    includeIntegration: true,
    includeCorruption: true,
    includePerformance: true,
    includeBrowser: true,
    generateReport: true
});
console.log('Complete Test Results:', results);
```

## Test Scenarios

### F5 Corruption Scenarios
1. **classic_f5** - Classic F5 corruption (startup=true, document=false)
2. **partial_corruption** - Partial MathJax corruption with broken methods
3. **script_missing** - Complete MathJax script missing
4. **chrome_multitab** - Chrome multi-tab interference simulation
5. **dom_corruption** - DOM element corruption during rendering

### Performance Benchmarks
1. **single_render** - Single element rendering performance
2. **batch_render** - Multiple element batch rendering
3. **complex_latex** - Complex mathematical expression rendering
4. **fast_mode** - Fast rendering mode (live preview)
5. **cache_performance** - Cache hit vs miss performance
6. **recovery_performance** - F5 recovery performance

### Browser Test Suites
1. **basic_functionality** - Core MathJax rendering capabilities
2. **browser_compatibility** - Browser-specific feature testing
3. **f5_recovery** - F5 recovery system testing
4. **live_preview** - Live preview system testing
5. **stress_testing** - System under load testing

## Advanced Usage

### Custom Test Configuration
```javascript
// Run selective comprehensive tests:
const customResults = await runAllMathJaxTests({
    includeIntegration: true,
    includeCorruption: false,  // Skip F5 tests
    includePerformance: true,
    includeBrowser: false,     // Skip browser tests
    generateReport: true
});
```

### Individual Benchmark Testing
```javascript
// Test specific performance aspects:
const singleRender = await runBenchmark('single_render');
const cachePerf = await runBenchmark('cache_performance');
const fastMode = await runBenchmark('fast_mode');
```

### Specific F5 Scenario Testing
```javascript
// Test individual corruption scenarios:
const classicF5 = await runF5Scenario('classic_f5');
const chromeMultiTab = await runF5Scenario('chrome_multitab');
const domCorruption = await runF5Scenario('dom_corruption');
```

### Browser-Specific Testing
```javascript
// Test specific browser capabilities:
const basicTests = await runTestSuite('basic_functionality');
const browserCompat = await runTestSuite('browser_compatibility');
const stressTests = await runTestSuite('stress_testing');
```

## Test Reports

The testing infrastructure generates comprehensive reports including:

- **Executive Summary**: Overall success rates and key metrics
- **Performance Analysis**: Rendering times, cache efficiency, memory usage
- **Browser Compatibility**: Cross-browser functionality status
- **System Health**: Real-time health monitoring and alerts
- **Recommendations**: Automated suggestions for improvements

## Validation Scripts

Two validation scripts are provided:

### 1. Infrastructure Validation (`test-infrastructure-validation.js`)
- Validates that all testing tools are properly configured
- Checks global function availability
- Runs quick functionality tests

### 2. Comprehensive Demo (`demo-testing-suite.js`)
- Demonstrates full testing infrastructure capabilities
- Runs all testing tools systematically
- Provides detailed demo results

## Usage in Development

### During Development
```javascript
// Quick health check during development:
quickMathJaxHealthCheck();

// Monitor performance impact of changes:
runBenchmark('single_render');
```

### Before Releases
```javascript
// Full validation before deployment:
runAllMathJaxTests();
```

### Debugging Issues
```javascript
// Debug F5 issues:
runF5CorruptionTests();

// Debug performance problems:
runPerformanceBenchmarks();

// Debug browser-specific issues:
runBrowserTests();
```

## Integration with Development Workflow

The testing infrastructure is automatically loaded when the application starts and is available immediately in the browser console. All tests are non-destructive and safe to run in any environment.

### Available Global Objects
- `testingDashboard` - Main testing coordination
- `f5CorruptionSimulator` - F5 corruption testing
- `browserTestSuite` - Browser compatibility testing  
- `performanceBenchmarks` - Performance analysis
- `coreCoordinator` - Core MathJax service coordination

## Best Practices

1. **Regular Health Checks**: Run `quickMathJaxHealthCheck()` regularly during development
2. **Performance Monitoring**: Monitor benchmark results when making performance-related changes
3. **F5 Testing**: Test F5 corruption scenarios when modifying MathJax initialization code
4. **Browser Testing**: Run browser tests when adding new features or fixing compatibility issues
5. **Comprehensive Testing**: Run full test suite before major releases

## Status

✅ **Phase 2 Days 5-7 COMPLETED**: All testing infrastructure is implemented and operational

- F5 Corruption Simulator: ✅ Operational
- Performance Benchmarks: ✅ Operational  
- Browser Test Suite: ✅ Operational
- Testing Dashboard: ✅ Operational
- Integration Tests: ✅ Operational

The testing infrastructure is ready for use and provides comprehensive validation of the MathJax rendering system across all scenarios and browser environments.