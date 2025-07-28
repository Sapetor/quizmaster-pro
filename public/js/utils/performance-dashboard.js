/**
 * Performance Dashboard UI
 * Real-time performance metrics visualization
 */

import { performanceMonitor } from './performance-monitor.js';
import { logger } from '../core/config.js';

export class PerformanceDashboard {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.updateFrequency = 2000; // Update every 2 seconds
        this.charts = {};
        
        this.init();
    }
    
    init() {
        this.createDashboardHTML();
        this.attachEventListeners();
        logger.debug('Performance Dashboard initialized');
    }
    
    createDashboardHTML() {
        const dashboardHTML = `
            <div id="performance-dashboard" class="performance-dashboard" style="display: none;">
                <div class="dashboard-header">
                    <h3>🚀 Performance Monitor</h3>
                    <div class="dashboard-controls">
                        <button id="perf-export" class="dashboard-btn">📊 Export</button>
                        <button id="perf-reset" class="dashboard-btn">🔄 Reset</button>
                        <button id="perf-close" class="dashboard-btn">✕ Close</button>
                    </div>
                </div>
                
                <div class="dashboard-content">
                    <!-- Overview Cards -->
                    <div class="metrics-overview">
                        <div class="metric-card" id="mathjax-card">
                            <div class="metric-title">MathJax Rendering</div>
                            <div class="metric-value" id="mathjax-avg">--</div>
                            <div class="metric-subtitle">Average Time</div>
                        </div>
                        
                        <div class="metric-card" id="f5-card">
                            <div class="metric-title">F5 Recovery</div>
                            <div class="metric-value" id="f5-avg">--</div>
                            <div class="metric-subtitle">Average Time</div>
                        </div>
                        
                        <div class="metric-card" id="memory-card">
                            <div class="metric-title">Memory Usage</div>
                            <div class="metric-value" id="memory-current">--</div>
                            <div class="metric-subtitle">Current Usage</div>
                        </div>
                        
                        <div class="metric-card" id="errors-card">
                            <div class="metric-title">Errors</div>
                            <div class="metric-value" id="errors-count">--</div>
                            <div class="metric-subtitle">Total Count</div>
                        </div>
                    </div>
                    
                    <!-- Detailed Metrics -->
                    <div class="dashboard-tabs">
                        <button class="tab-btn active" data-tab="mathjax">MathJax</button>
                        <button class="tab-btn" data-tab="recovery">F5 Recovery</button>
                        <button class="tab-btn" data-tab="memory">Memory</button>
                        <button class="tab-btn" data-tab="errors">Errors</button>
                        <button class="tab-btn" data-tab="optimizations">Optimizations</button>
                        <button class="tab-btn" data-tab="browser">Browser Info</button>
                    </div>
                    
                    <div class="tab-content">
                        <!-- MathJax Tab -->
                        <div id="mathjax-tab" class="tab-pane active">
                            <div class="chart-container">
                                <canvas id="mathjax-chart" width="400" height="200"></canvas>
                            </div>
                            <div class="metrics-details" id="mathjax-details">
                                <!-- MathJax details will be populated here -->
                            </div>
                        </div>
                        
                        <!-- F5 Recovery Tab -->
                        <div id="recovery-tab" class="tab-pane">
                            <div class="chart-container">
                                <canvas id="recovery-chart" width="400" height="200"></canvas>
                            </div>
                            <div class="metrics-details" id="recovery-details">
                                <!-- Recovery details will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Memory Tab -->
                        <div id="memory-tab" class="tab-pane">
                            <div class="chart-container">
                                <canvas id="memory-chart" width="400" height="200"></canvas>
                            </div>
                            <div class="metrics-details" id="memory-details">
                                <!-- Memory details will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Errors Tab -->
                        <div id="errors-tab" class="tab-pane">
                            <div class="error-list" id="error-list">
                                <!-- Error list will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Browser Optimizations Tab -->
                        <div id="optimizations-tab" class="tab-pane">
                            <div class="optimizations-content" id="optimizations-content">
                                <!-- Browser optimizations will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Browser Info Tab -->
                        <div id="browser-tab" class="tab-pane">
                            <div class="browser-info" id="browser-info">
                                <!-- Browser info will be populated here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Inject dashboard into page
        document.body.insertAdjacentHTML('beforeend', dashboardHTML);
        
        // Add CSS styles
        this.addDashboardStyles();
    }
    
    addDashboardStyles() {
        const styles = `
            <style id="performance-dashboard-styles">
                .performance-dashboard {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90vw;
                    max-width: 1000px;
                    height: 80vh;
                    background: var(--modal-bg, rgba(255, 255, 255, 0.95));
                    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(20px);
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                .dashboard-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--bg-glass, rgba(255, 255, 255, 0.1));
                }
                
                .dashboard-header h3 {
                    margin: 0;
                    color: var(--text-primary, #333);
                    font-size: 1.2rem;
                }
                
                .dashboard-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .dashboard-btn {
                    padding: 8px 16px;
                    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.2));
                    border-radius: 8px;
                    background: var(--bg-glass, rgba(255, 255, 255, 0.2));
                    color: var(--text-primary, #333);
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                }
                
                .dashboard-btn:hover {
                    background: var(--accent-primary, #2563eb);
                    color: white;
                    transform: translateY(-1px);
                }
                
                .dashboard-content {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                }
                
                .metrics-overview {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }
                
                .metric-card {
                    background: var(--card-bg, rgba(255, 255, 255, 0.8));
                    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    transition: transform 0.2s ease;
                }
                
                .metric-card:hover {
                    transform: translateY(-2px);
                }
                
                .metric-title {
                    font-size: 0.9rem;
                    color: var(--text-secondary, #666);
                    margin-bottom: 10px;
                }
                
                .metric-value {
                    font-size: 1.8rem;
                    font-weight: 600;
                    color: var(--accent-primary, #2563eb);
                    margin-bottom: 5px;
                }
                
                .metric-subtitle {
                    font-size: 0.8rem;
                    color: var(--text-secondary, #666);
                }
                
                .dashboard-tabs {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 20px;
                    border-bottom: 2px solid var(--border-color, rgba(0, 0, 0, 0.1));
                }
                
                .tab-btn {
                    padding: 10px 20px;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary, #666);
                    cursor: pointer;
                    border-radius: 8px 8px 0 0;
                    transition: all 0.2s ease;
                }
                
                .tab-btn.active {
                    background: var(--accent-primary, #2563eb);
                    color: white;
                }
                
                .tab-btn:hover:not(.active) {
                    background: var(--bg-glass, rgba(0, 0, 0, 0.05));
                }
                
                .tab-pane {
                    display: none;
                }
                
                .tab-pane.active {
                    display: block;
                }
                
                .chart-container {
                    background: var(--card-bg, rgba(255, 255, 255, 0.5));
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                
                .metrics-details {
                    background: var(--card-bg, rgba(255, 255, 255, 0.3));
                    border-radius: 8px;
                    padding: 15px;
                }
                
                .error-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .error-item {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                }
                
                .error-type {
                    font-weight: 600;
                    color: #dc2626;
                    margin-bottom: 5px;
                }
                
                .error-message {
                    font-size: 0.9rem;
                    color: var(--text-primary, #333);
                    margin-bottom: 5px;
                }
                
                .error-time {
                    font-size: 0.8rem;
                    color: var(--text-secondary, #666);
                }
                
                .browser-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 15px;
                }
                
                .info-section {
                    background: var(--card-bg, rgba(255, 255, 255, 0.3));
                    border-radius: 8px;
                    padding: 15px;
                }
                
                .info-title {
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: var(--accent-primary, #2563eb);
                }
                
                .info-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                }
                
                .info-label {
                    color: var(--text-secondary, #666);
                }
                
                .info-value {
                    color: var(--text-primary, #333);
                    font-weight: 500;
                }
                
                .optimization-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .optimization-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--card-bg, rgba(255, 255, 255, 0.5));
                    border-radius: 6px;
                    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                }
                
                .optimization-item.active {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.1);
                }
                
                .optimization-name {
                    font-size: 0.9rem;
                    color: var(--text-primary, #333);
                }
                
                .optimization-status {
                    font-size: 0.8rem;
                    font-weight: 500;
                }
                
                .recommendations-list {
                    margin-top: 10px;
                }
                
                .recommendation-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                }
                
                .recommendation-item:last-child {
                    border-bottom: none;
                }
                
                .recommendation-icon {
                    font-size: 1rem;
                }
                
                .recommendation-text {
                    font-size: 0.9rem;
                    color: var(--text-primary, #333);
                    line-height: 1.4;
                }
                
                .optimization-history {
                    margin-top: 10px;
                }
                
                .optimization-history-item {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr auto;
                    gap: 10px;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--card-bg, rgba(255, 255, 255, 0.3));
                    border-radius: 6px;
                    margin-bottom: 5px;
                }
                
                .optimization-type {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary, #333);
                }
                
                .optimization-browser {
                    font-size: 0.8rem;
                    color: var(--text-secondary, #666);
                }
                
                .optimization-time {
                    font-size: 0.8rem;
                    color: var(--text-secondary, #666);
                }
                
                .optimization-success.success {
                    color: #10b981;
                }
                
                .optimization-success.failure {
                    color: #ef4444;
                }
                
                /* Dark theme adjustments */
                [data-theme="dark"] .performance-dashboard {
                    background: var(--modal-bg, rgba(30, 41, 59, 0.95));
                    color: var(--text-primary, #f8fafc);
                }
                
                [data-theme="dark"] .metric-card,
                [data-theme="dark"] .chart-container,
                [data-theme="dark"] .metrics-details,
                [data-theme="dark"] .info-section {
                    background: var(--card-bg, rgba(255, 255, 255, 0.08));
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    attachEventListeners() {
        // Close button
        document.getElementById('perf-close').addEventListener('click', () => {
            this.hide();
        });
        
        // Export button
        document.getElementById('perf-export').addEventListener('click', () => {
            performanceMonitor.exportData();
        });
        
        // Reset button
        document.getElementById('perf-reset').addEventListener('click', () => {
            if (confirm('Reset all performance metrics?')) {
                performanceMonitor.reset();
                this.updateDashboard();
            }
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    show() {
        this.isVisible = true;
        document.getElementById('performance-dashboard').style.display = 'flex';
        this.startUpdating();
        this.updateDashboard();
        logger.debug('Performance Dashboard shown');
    }
    
    hide() {
        this.isVisible = false;
        document.getElementById('performance-dashboard').style.display = 'none';
        this.stopUpdating();
        logger.debug('Performance Dashboard hidden');
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    startUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (this.isVisible) {
                this.updateDashboard();
            }
        }, this.updateFrequency);
    }
    
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Update specific tab content
        this.updateTabContent(tabName);
    }
    
    updateDashboard() {
        const data = performanceMonitor.getDashboardData();
        
        // Update overview cards
        this.updateOverviewCards(data.stats);
        
        // Update current tab content
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        this.updateTabContent(activeTab, data);
    }
    
    updateOverviewCards(stats) {
        // MathJax card
        const mathJaxAvg = stats.mathJaxRender?.avgDuration;
        document.getElementById('mathjax-avg').textContent = 
            mathJaxAvg ? `${mathJaxAvg}ms` : '--';
        
        // F5 Recovery card
        const f5Avg = stats.f5Recovery?.avgDuration;
        document.getElementById('f5-avg').textContent = 
            f5Avg ? `${f5Avg}ms` : '--';
        
        // Memory card
        const memoryCurrent = stats.memoryUsage?.current;
        document.getElementById('memory-current').textContent = 
            memoryCurrent || '--';
        
        // Errors card
        const errorsCount = stats.errors?.count;
        document.getElementById('errors-count').textContent = 
            errorsCount || '0';
        
        // Color-code cards based on performance
        this.updateCardColors(stats);
    }
    
    updateCardColors(stats) {
        const thresholds = performanceMonitor.thresholds;
        
        // MathJax card coloring
        const mathJaxCard = document.getElementById('mathjax-card');
        const mathJaxAvg = stats.mathJaxRender?.avgDuration;
        if (mathJaxAvg) {
            if (mathJaxAvg > thresholds.mathJaxRender) {
                mathJaxCard.style.borderColor = '#ef4444';
            } else if (mathJaxAvg > thresholds.mathJaxRender * 0.7) {
                mathJaxCard.style.borderColor = '#f59e0b';
            } else {
                mathJaxCard.style.borderColor = '#10b981';
            }
        }
        
        // Similar logic for other cards...
    }
    
    updateTabContent(tabName, data) {
        switch (tabName) {
            case 'mathjax':
                this.updateMathJaxTab(data);
                break;
            case 'recovery':
                this.updateRecoveryTab(data);
                break;
            case 'memory':
                this.updateMemoryTab(data);
                break;
            case 'errors':
                this.updateErrorsTab(data);
                break;
            case 'optimizations':
                this.updateOptimizationsTab(data);
                break;
            case 'browser':
                this.updateBrowserTab(data);
                break;
        }
    }
    
    updateMathJaxTab(data) {
        const details = document.getElementById('mathjax-details');
        const stats = data.stats.mathJaxRender;
        
        if (stats) {
            details.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Total Renders:</span>
                    <span class="info-value">${stats.count}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Average Time:</span>
                    <span class="info-value">${stats.avgDuration}ms</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Min Time:</span>
                    <span class="info-value">${stats.minDuration}ms</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Max Time:</span>
                    <span class="info-value">${stats.maxDuration}ms</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Success Rate:</span>
                    <span class="info-value">${stats.successRate?.toFixed(1)}%</span>
                </div>
            `;
        } else {
            details.innerHTML = '<p>No MathJax rendering data available yet.</p>';
        }
    }
    
    updateRecoveryTab(data) {
        const details = document.getElementById('recovery-details');
        const stats = data.stats.f5Recovery;
        
        if (stats) {
            details.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Total Recoveries:</span>
                    <span class="info-value">${stats.count}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Average Time:</span>
                    <span class="info-value">${stats.avgDuration}ms</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Min Time:</span>
                    <span class="info-value">${stats.minDuration}ms</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Max Time:</span>
                    <span class="info-value">${stats.maxDuration}ms</span>
                </div>
            `;
        } else {
            details.innerHTML = '<p>No F5 recovery data available yet.</p>';
        }
    }
    
    updateMemoryTab(data) {
        const details = document.getElementById('memory-details');
        const stats = data.stats.memoryUsage;
        
        if (stats) {
            details.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Current Usage:</span>
                    <span class="info-value">${stats.current}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Peak Usage:</span>
                    <span class="info-value">${stats.peak}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Average Usage:</span>
                    <span class="info-value">${stats.average}</span>
                </div>
            `;
        } else {
            details.innerHTML = '<p>No memory usage data available yet.</p>';
        }
    }
    
    updateErrorsTab(data) {
        const errorList = document.getElementById('error-list');
        const stats = data.stats.errors;
        
        if (stats && stats.recent && stats.recent.length > 0) {
            errorList.innerHTML = stats.recent.map(error => `
                <div class="error-item">
                    <div class="error-type">${error.type}</div>
                    <div class="error-message">${error.message}</div>
                    <div class="error-time">${error.timestamp}</div>
                </div>
            `).join('');
        } else {
            errorList.innerHTML = '<p>No errors recorded. Great job! 🎉</p>';
        }
    }
    
    updateOptimizationsTab(data) {
        const optimizationsContent = document.getElementById('optimizations-content');
        
        // Get browser optimizer status if available
        let browserOptimizerStatus = null;
        if (window.browserOptimizer) {
            browserOptimizerStatus = window.browserOptimizer.getOptimizationStatus();
        }
        
        const optimizations = data.stats.browserOptimizations || [];
        
        optimizationsContent.innerHTML = `
            <div class="info-section">
                <div class="info-title">🚀 Active Optimizations</div>
                ${browserOptimizerStatus ? `
                    <div class="optimization-grid">
                        ${browserOptimizerStatus.activeOptimizations.map(opt => `
                            <div class="optimization-item active">
                                <span class="optimization-name">${opt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                <span class="optimization-status">✅ Active</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>Browser optimizer not available</p>'}
            </div>
            
            <div class="info-section">
                <div class="info-title">📊 Browser Information</div>
                ${browserOptimizerStatus ? `
                    <div class="info-item">
                        <span class="info-label">Browser:</span>
                        <span class="info-value">${browserOptimizerStatus.browserInfo.browser} ${browserOptimizerStatus.browserInfo.version}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Engine:</span>
                        <span class="info-value">${browserOptimizerStatus.browserInfo.engine}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Platform:</span>
                        <span class="info-value">${browserOptimizerStatus.browserInfo.platform}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">CPU Cores:</span>
                        <span class="info-value">${browserOptimizerStatus.browserInfo.cpuCores}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Device Memory:</span>
                        <span class="info-value">${browserOptimizerStatus.browserInfo.deviceMemory}GB</span>
                    </div>
                ` : '<p>Browser information not available</p>'}
            </div>
            
            <div class="info-section">
                <div class="info-title">💡 Recommendations</div>
                ${browserOptimizerStatus && browserOptimizerStatus.recommendations.length > 0 ? `
                    <div class="recommendations-list">
                        ${browserOptimizerStatus.recommendations.map(rec => `
                            <div class="recommendation-item">
                                <span class="recommendation-icon">💡</span>
                                <span class="recommendation-text">${rec}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>No recommendations at this time. Your browser is optimally configured! 🎉</p>'}
            </div>
            
            <div class="info-section">
                <div class="info-title">📈 Optimization History</div>
                ${optimizations.length > 0 ? `
                    <div class="optimization-history">
                        ${optimizations.slice(-10).reverse().map(opt => `
                            <div class="optimization-history-item">
                                <div class="optimization-type">${opt.type}</div>
                                <div class="optimization-browser">${opt.browser}</div>
                                <div class="optimization-time">${new Date(opt.timestamp).toLocaleTimeString()}</div>
                                <div class="optimization-success ${opt.success ? 'success' : 'failure'}">
                                    ${opt.success ? '✅' : '❌'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>No optimization history available yet.</p>'}
            </div>
        `;
    }
    
    updateBrowserTab(data) {
        const browserInfo = document.getElementById('browser-info');
        const info = data.browserInfo;
        
        browserInfo.innerHTML = `
            <div class="info-section">
                <div class="info-title">Browser</div>
                <div class="info-item">
                    <span class="info-label">User Agent:</span>
                    <span class="info-value">${info.userAgent.substring(0, 50)}...</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Platform:</span>
                    <span class="info-value">${info.platform}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Language:</span>
                    <span class="info-value">${info.language}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Online:</span>
                    <span class="info-value">${info.onLine ? 'Yes' : 'No'}</span>
                </div>
            </div>
            
            <div class="info-section">
                <div class="info-title">Hardware</div>
                <div class="info-item">
                    <span class="info-label">CPU Cores:</span>
                    <span class="info-value">${info.hardwareConcurrency}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Device Memory:</span>
                    <span class="info-value">${info.deviceMemory}GB</span>
                </div>
            </div>
            
            <div class="info-section">
                <div class="info-title">Connection</div>
                <div class="info-item">
                    <span class="info-label">Type:</span>
                    <span class="info-value">${typeof info.connection === 'object' ? info.connection.effectiveType : info.connection}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Downlink:</span>
                    <span class="info-value">${typeof info.connection === 'object' ? info.connection.downlink + ' Mbps' : 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">RTT:</span>
                    <span class="info-value">${typeof info.connection === 'object' ? info.connection.rtt + ' ms' : 'Unknown'}</span>
                </div>
            </div>
        `;
    }
}

// Create global instance
export const performanceDashboard = new PerformanceDashboard();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.performanceDashboard = performanceDashboard;
}