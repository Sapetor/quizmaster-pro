/**
 * MathJax Service - Centralized MathJax rendering and management
 * Consolidates duplicate MathJax logic from game-manager.js, quiz-manager.js, preview-manager.js
 */

import { TIMING, logger } from '../core/config.js';
import { domUtils } from './dom-utils.js';
import { errorHandler } from './error-handler.js';
import { recoveryService } from './mathjax/recovery-service.js';
import { cacheService } from './mathjax/cache-service.js';
import { RenderService } from './mathjax/render-service.js';
import { coreCoordinator } from './mathjax/core-coordinator.js';

export class MathJaxService {
    constructor() {
        // Initialize Core Coordinator for orchestrated service management
        this.coreCoordinator = coreCoordinator;
        
        // Initialize new modular services (delegated to core coordinator)
        this.recoveryService = coreCoordinator.recoveryService;
        this.cacheService = coreCoordinator.cacheService;
        this.renderService = coreCoordinator.renderService;
        
        // Maintain backward compatibility with existing properties
        this.isReady = false;
        this.pendingRenders = this.renderService.pendingRenders; // Delegate to render service
        this.mathJaxCache = this.cacheService.mathJaxCache; // Delegate to cache service
        
        // Delegate browser detection to recovery service
        this.isWindows = this.recoveryService.isWindows;
        this.isChrome = this.recoveryService.isChrome;
        this.isMobile = this.recoveryService.isMobile;
        
        // Delegate recovery state to recovery service  
        this.isRecovering = this.recoveryService.isRecovering;
        this.recoveryCallbacks = this.recoveryService.recoveryCallbacks;
        this.globalRecoveryLock = this.recoveryService.globalRecoveryLock;
        
        // Delegate tab management to recovery service
        this.tabId = this.recoveryService.tabId;
        this.isHost = this.recoveryService.isHost;
        
        // Sync render service recovery state with recovery service
        this.renderService.setRecoveryState(this.recoveryService.isRecovering);
        
        this.initializeMathJax();
    }

    /**
     * Detect if running on Windows
     * @returns {boolean}
     */
    detectWindows() {
        // Delegate to recovery service
        return this.recoveryService.detectWindows();
    }

    /**
     * Detect if running on Chrome/Chromium browsers
     * @returns {boolean}
     */
    detectChrome() {
        // Delegate to recovery service
        return this.recoveryService.detectChrome();
    }

    /**
     * Generate unique tab identifier for multi-tab isolation
     * @returns {string}
     */
    generateTabId() {
        return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if other tabs might be affected by MathJax script reloading
     * @returns {boolean}
     */
    hasOtherActiveTabs() {
        // In Chrome, check if there are other QuizMaster tabs open
        // This is a heuristic based on localStorage usage patterns
        try {
            const activeTabsKey = 'quizmaster_active_tabs';
            const activeTabs = JSON.parse(localStorage.getItem(activeTabsKey) || '{}');
            const now = Date.now();
            
            // Clean up old tab entries (older than 30 seconds)
            Object.keys(activeTabs).forEach(tabId => {
                if (now - activeTabs[tabId].lastSeen > 30000) {
                    delete activeTabs[tabId];
                }
            });
            
            // Register this tab
            activeTabs[this.tabId] = {
                isHost: this.isHost,
                lastSeen: now
            };
            
            localStorage.setItem(activeTabsKey, JSON.stringify(activeTabs));
            
            // Return true if there are other active tabs
            const otherTabs = Object.keys(activeTabs).filter(id => id !== this.tabId);
            return otherTabs.length > 0;
        } catch (e) {
            logger.debug('Tab detection error (not critical):', e.message);
            return false;
        }
    }

    /**
     * Clean up tab registration on page unload
     */
    cleanupTabRegistration() {
        try {
            const activeTabsKey = 'quizmaster_active_tabs';
            const activeTabs = JSON.parse(localStorage.getItem(activeTabsKey) || '{}');
            delete activeTabs[this.tabId];
            localStorage.setItem(activeTabsKey, JSON.stringify(activeTabs));
            // Tab cleanup complete
        } catch (e) {
            logger.debug('Tab cleanup error (not critical):', e.message);
        }
    }

    /**
     * Coordinate multi-tab recovery to prevent interference
     * @returns {string} 'leader' or 'follower'
     */
    coordinateMultiTabRecovery() {
        try {
            const recoveryKey = 'quizmaster_recovery_coordination';
            const coordination = JSON.parse(localStorage.getItem(recoveryKey) || '{}');
            const now = Date.now();
            
            // Clean up old coordination entries (older than 30 seconds)
            if (coordination.timestamp && (now - coordination.timestamp > 30000)) {
                localStorage.removeItem(recoveryKey);
                coordination = {};
            }
            
            // If no active recovery, become the leader
            if (!coordination.leaderId || !coordination.timestamp) {
                const newCoordination = {
                    leaderId: this.tabId,
                    timestamp: now,
                    status: 'in_progress'
                };
                localStorage.setItem(recoveryKey, JSON.stringify(newCoordination));
                // Recovery leader assigned
                return 'leader';
            }
            
            // If this tab is already the leader, continue as leader
            if (coordination.leaderId === this.tabId) {
                return 'leader';
            }
            
            // Otherwise, follow the existing leader
            logger.debug(`👥 Following recovery leader: ${coordination.leaderId}`);
            return 'follower';
            
        } catch (e) {
            logger.debug('Recovery coordination error (fallback to leader):', e.message);
            return 'leader'; // Fallback to leader if coordination fails
        }
    }

    /**
     * Perform script reload and notify other tabs
     */
    async performScriptReload(element) {
        return new Promise((resolve) => {
            // Notify start of recovery
            this.updateRecoveryStatus('reloading');
            
            // Continue with the existing script reload logic
            // (The rest of the recovery logic will follow this)
        });
    }

    /**
     * Update recovery status for other tabs
     */
    updateRecoveryStatus(status) {
        try {
            const recoveryKey = 'quizmaster_recovery_coordination';
            const coordination = JSON.parse(localStorage.getItem(recoveryKey) || '{}');
            coordination.status = status;
            coordination.timestamp = Date.now();
            localStorage.setItem(recoveryKey, JSON.stringify(coordination));
            logger.debug(`🗺 Recovery status updated: ${status}`);
        } catch (e) {
            logger.debug('Recovery status update error (not critical):', e.message);
        }
    }

    /**
     * Preserve MathJax configuration before clearing state
     * @returns {Object} Preserved configuration
     */
    preserveMathJaxConfig() {
        const defaultConfig = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                packages: {'[+]': ['ams', 'newcommand', 'configmacros']},
                processEscapes: true,
                processEnvironments: true,
                tags: 'none',
                autoload: {
                    color: [],
                    colorv2: ['color']
                }
            },
            chtml: {
                scale: 1,
                minScale: 0.5,
                matchFontHeight: false,
                displayAlign: 'center',
                displayIndent: '0em',
                fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
            },
            startup: {
                ready: () => {
                    logger.debug('🔄 MathJax configuration restored and ready');
                    if (window.MathJax && typeof window.MathJax.startup.defaultReady === 'function') {
                        window.MathJax.startup.defaultReady();
                    }
                    
                    // Mark as ready for our application
                    window.mathJaxReady = true;
                    
                    // Browser and platform-specific delays
                    const isWindows = navigator.platform.toLowerCase().includes('win') || 
                                    navigator.userAgent.toLowerCase().includes('windows');
                    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini/.test(navigator.userAgent) ||
                                   (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) ||
                                   window.innerWidth <= 768;
                    
                    // Mobile devices need longer delays due to slower processing
                    // Desktop Chrome needs delays for proper initialization
                    let delay = 0;
                    if (isMobile && isChrome) {
                        delay = 400; // Mobile Chrome needs significant delay
                    } else if (isMobile) {
                        delay = 300; // Other mobile browsers need some delay
                    } else if (isWindows && isChrome) {
                        delay = 150; // Desktop Chrome on Windows
                    } else if (isChrome) {
                        delay = 100; // Desktop Chrome on other platforms
                    } else if (isWindows) {
                        delay = 100; // Windows other browsers
                    }
                    
                    setTimeout(() => {
                        // FOUC Prevention: Add ready class and remove loading
                        document.body.classList.remove('loading');
                        document.body.classList.add('mathjax-ready');
                        
                        // Dispatch custom event for modules that need to know
                        document.dispatchEvent(new CustomEvent('mathjax-ready'));
                    }, delay);
                }
            }
        };
        
        try {
            // Try to preserve existing config if available
            if (window.MathJax && typeof window.MathJax === 'object') {
                const preserved = {
                    tex: window.MathJax.tex || defaultConfig.tex,
                    chtml: window.MathJax.chtml || defaultConfig.chtml,
                    startup: defaultConfig.startup // Always use our startup config
                };
                logger.debug('🗺 Preserved existing MathJax configuration');
                return preserved;
            }
        } catch (e) {
            logger.debug('🗺 Error preserving config, using default:', e.message);
        }
        
        return defaultConfig;
    }

    /**
     * Restore MathJax configuration after clearing state
     * @param {Object} config Preserved configuration
     */
    restoreMathJaxConfig(config) {
        try {
            window.MathJax = config;
            logger.debug('🔄 MathJax configuration restored with delimiters:', {
                inlineMath: config.tex.inlineMath,
                displayMath: config.tex.displayMath
            });
        } catch (e) {
            logger.error('❌ Failed to restore MathJax configuration:', e);
            // Fallback: set minimal working config
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']]
                }
            };
        }
    }

    /**
     * Attempt lightweight recovery without script reload (much faster)
     * @param {Element} element Element to render
     * @returns {Promise|null} Promise if recovery attempted, null if not applicable
     */
    attemptLightweightRecovery(element) {
        try {
            // Check if we can recover by recreating MathJax internals without script reload
            if (window.MathJax && window.MathJax.startup && !window.MathJax.startup.document) {
                logger.debug('✨ Attempting lightweight F5 recovery');
                
                return new Promise((resolve, reject) => {
                    try {
                        // Try to manually trigger MathJax startup completion
                        if (window.MathJax.startup.getComponents) {
                            window.MathJax.startup.getComponents();
                        }
                        
                        // For F5 corruption, lightweight recovery often fails - go straight to script reload
                        logger.debug('❌ F5 corruption detected - lightweight recovery skipped, using script reload for reliability');
                        reject(new Error('F5 corruption requires script reload'));
                    } catch (e) {
                        logger.debug('❌ Lightweight recovery error:', e.message);
                        reject(e);
                    }
                });
            }
        } catch (e) {
            logger.debug('❌ Lightweight recovery check failed:', e.message);
        }
        
        return null; // Lightweight recovery not applicable
    }

    /**
     * Perform full script reload recovery (slower but reliable)
     * @param {Element} element Element to render
     * @param {boolean} hasOtherTabs Whether other tabs are active
     * @returns {Promise}
     */
    performFullScriptReload(element, hasOtherTabs) {
        return new Promise((resolve) => {
            if (hasOtherTabs) {
                // Multi-tab coordination logic
                const coordinationResult = this.coordinateMultiTabRecovery();
                
                if (coordinationResult === 'follower') {
                    logger.debug('👥 Multi-tab follower - waiting for leader script reload');
                    this.waitForLeaderRecovery().then(() => {
                        if (window.MathJax && window.MathJax.typesetPromise) {
                            window.MathJax.typesetPromise([element]).then(() => {
                                this.pendingRenders.delete(element);
                                this.completeProgressiveLoading(element, true);
                                resolve();
                            }).catch(() => {
                                this.pendingRenders.delete(element);
                                this.completeProgressiveLoading(element, false);
                                resolve();
                            });
                        } else {
                            this.pendingRenders.delete(element);
                            this.completeProgressiveLoading(element, false);
                            resolve();
                        }
                    }).catch(() => {
                        this.pendingRenders.delete(element);
                        this.completeProgressiveLoading(element, false);
                        resolve();
                    });
                    return;
                }
            }
            
            // Perform the actual script reload (restore the full logic)
            logger.debug('🔧 Performing full script reload recovery');
            
            // Set recovery state
            this.isRecovering = true;
            
            // Preserve and restore configuration
            const preservedConfig = this.preserveMathJaxConfig();
            logger.debug('🗺 Preserved MathJax configuration for restoration');
            
            // Clear corrupted state more thoroughly
            if (this.isChrome) {
                if (window.MathJax) {
                    try {
                        // Clear all MathJax internals to prevent Package conflicts
                        if (window.MathJax.startup) {
                            window.MathJax.startup.ready = null;
                            window.MathJax.startup.input = null;
                            window.MathJax.startup.output = null;
                            window.MathJax.startup.document = null;
                        }
                        if (window.MathJax.config) delete window.MathJax.config;
                        if (window.MathJax.loader) delete window.MathJax.loader;
                        if (window.MathJax._.mathjax) delete window.MathJax._.mathjax;
                    } catch (e) {
                        // Expected during cleanup
                    }
                }
                if (window.gc) window.gc();
            }
            
            // Complete MathJax cleanup
            delete window.MathJax;
            delete window.mathJaxReady;
            delete window.MathJax_;
            
            // Restore configuration
            this.restoreMathJaxConfig(preservedConfig);
            logger.debug('🔄 Restored MathJax configuration');
            
            // Remove existing scripts using DOM utilities for efficiency
            domUtils.removeTrackedScripts();
            
            // Also remove any scripts that might not be tracked yet
            const existingScript = document.getElementById('MathJax-script');
            if (existingScript) {
                existingScript.remove();
                logger.debug('🔧 Removed corrupted MathJax script');
            }
            
            // Reload script using DOM utilities for tracking
            const mathJaxScript = domUtils.createTrackedScript({
                id: 'MathJax-script',
                async: true
            });
            
            // Use stronger cache busting to prevent Package conflicts
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            const cacheBuster = this.isChrome 
                ? `v=${timestamp}&chrome=${random}&clean=1`
                : `v=${timestamp}&clean=1`;
            mathJaxScript.src = `https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js?${cacheBuster}`;
            
            logger.debug(`🔧 Loading MathJax with ${this.isChrome ? 'Chrome-specific' : 'standard'} cache busting`);
            
            mathJaxScript.onload = () => {
                logger.debug('🔧 MathJax script reloaded with cache busting');
                
                const waitForInit = () => {
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        logger.debug('✅ MathJax successfully reinitialized after F5 corruption');
                        
                        // Notify other tabs that recovery is complete
                        this.updateRecoveryStatus('completed');
                        
                        // Render the element
                        window.MathJax.typesetPromise([element]).then(() => {
                            this.pendingRenders.delete(element);
                            this.completeProgressiveLoading(element, true);
                            this.isRecovering = false;
                            resolve();
                        }).catch(err => {
                            logger.error('❌ Script reload render failed:', err);
                            this.pendingRenders.delete(element);
                            this.completeProgressiveLoading(element, false);
                            this.isRecovering = false;
                            resolve();
                        });
                        
                        // Process queued callbacks
                        const callbacks = [...this.recoveryCallbacks];
                        this.recoveryCallbacks = [];
                        const callbackDelay = this.isChrome ? 100 : 30;
                        callbacks.forEach(callback => {
                            setTimeout(callback, callbackDelay);
                        });
                        
                        // Release global lock immediately after callbacks
                        setTimeout(() => {
                            this.globalRecoveryLock = false;
                        }, 50);
                        
                        // Cleanup coordination
                        setTimeout(() => {
                            try {
                                localStorage.removeItem('quizmaster_recovery_coordination');
                                logger.debug('🧹 Cleaned up recovery coordination');
                            } catch (e) {
                                logger.debug('Recovery cleanup error (not critical):', e.message);
                            }
                        }, 2000);
                    } else {
                        const pollInterval = this.isChrome ? 150 : 100;
                        setTimeout(waitForInit, pollInterval);
                    }
                };
                waitForInit();
            };
            
            mathJaxScript.onerror = (error) => {
                errorHandler.log(error, {
                    context: 'MathJax script reload',
                    src: mathJaxScript.src,
                    critical: true
                });
                this.pendingRenders.delete(element);
                this.isRecovering = false;
                this.recoveryCallbacks = [];
                this.updateRecoveryStatus('failed');
                setTimeout(() => {
                    try {
                        localStorage.removeItem('quizmaster_recovery_coordination');
                    } catch (e) {
                        // Silent cleanup error
                    }
                    // Release global lock on error
                    this.globalRecoveryLock = false;
                }, 1000);
                resolve();
            };
            
            document.head.appendChild(mathJaxScript);
        });
    }

    /**
     * Wait for leader tab to complete recovery
     * @returns {Promise}
     */
    waitForLeaderRecovery() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 30; // 15 seconds
            let attempts = 0;
            
            const checkRecovery = () => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkRecovery, 500);
                } else {
                    reject(new Error('Leader recovery timeout'));
                }
            };
            
            checkRecovery();
        });
    }

    /**
     * Initialize MathJax readiness detection
     */
    initializeMathJax() {
        // Set load time for F5 corruption detection timing
        if (!window.mathJaxLoadTime) {
            window.mathJaxLoadTime = Date.now();
        }
        
        // Mobile-specific early corruption detection after refresh
        // Only run on mobile devices and only if there are clear corruption signs
        if (this.isMobile && window.MathJax) {
            const hasStartup = !!(window.MathJax && window.MathJax.startup);
            const hasDocument = !!(window.MathJax && window.MathJax.startup && window.MathJax.startup.document);
            const hasTypesetPromise = !!(window.MathJax && window.MathJax.typesetPromise);
            
            // Only trigger early recovery for clear mobile corruption patterns
            const clearMobileCorruption = (hasStartup && !hasDocument && !hasTypesetPromise) || // Classic corruption
                                        (hasStartup && !hasTypesetPromise && (Date.now() - performance.timing.navigationStart > 2000)); // Slow mobile loading
            
            if (clearMobileCorruption) {
                logger.warn('🚨 Early mobile corruption detected during initialization - triggering immediate recovery');
                // Force immediate recovery without waiting for render attempts
                setTimeout(() => {
                    this.recoveryService.handleF5Corruption(
                        document.body, // Use body as placeholder element
                        () => {
                            logger.info('✅ Early mobile recovery completed');
                            this.isReady = true;
                        },
                        () => logger.error('❌ Early mobile recovery failed'),
                        this.cacheService.mathJaxCache,
                        () => 'early_recovery',
                        () => {},
                        () => {},
                        this.renderService.pendingRenders
                    );
                }, 50); // Faster trigger for mobile
                return;
            }
        }
        
        if (this.isAvailable()) {
            this.isReady = true;
            logger.debug('🔍 MathJax service: MathJax already fully available with typesetPromise');
            return;
        }

        logger.debug('🔍 MathJax service: Waiting for MathJax to load...');

        // Listen for MathJax ready event
        document.addEventListener('mathjax-ready', () => {
            logger.debug('🔍 MathJax service: Received mathjax-ready event');
            this.isReady = true;
            this.processPendingRenders();
        });

        // Fallback: check periodically for MathJax with full readiness check
        const checkInterval = setInterval(() => {
            if (this.isAvailable()) {
                logger.debug('🔍 MathJax service: MathJax fully ready detected via polling (including typesetPromise)');
                this.isReady = true;
                clearInterval(checkInterval);
                this.processPendingRenders();
            }
        }, 100);

        // Clear interval after 10 seconds to prevent memory leak
        setTimeout(() => clearInterval(checkInterval), TIMING.MATHJAX_LOADING_TIMEOUT);
        
        // Make status available globally for debugging
        window.debugMathJax = () => {
            logger.debug('🔍 MathJax Debug Status:', this.getStatus());
        };
        
        // Enhanced debugging with Core Coordinator
        window.mathJaxHealth = async () => {
            const health = await this.getHealthReport();
            logger.debug('🏥 MathJax Health Report:', health);
            return health;
        };
        
        // Reset health metrics
        window.resetMathJaxHealth = () => {
            this.resetHealthMetrics();
            logger.debug('🔄 MathJax health metrics reset');
        };
        
        // Force recovery test
        window.testMathJaxRecovery = async (elementId = 'preview-content-split') => {
            const element = document.getElementById(elementId);
            if (element) {
                logger.debug('🔧 Testing MathJax recovery...');
                await this.testRecovery(element);
                logger.debug('✅ Recovery test completed');
            } else {
                logger.error(`❌ Element '${elementId}' not found for recovery test`);
            }
        };
        
        // Force MathJax initialization check
        window.forceMathJaxCheck = () => {
            logger.debug('🔧 Forcing MathJax initialization check...');
            if (this.isAvailable()) {
                logger.debug('✅ MathJax is now ready!');
                this.isReady = true;
                this.processPendingRenders();
            } else {
                logger.debug('❌ MathJax still not ready');
            }
        };
    }

    /**
     * Render MathJax for a specific element with retry mechanism
     * @param {HTMLElement} element - Element to render MathJax in
     * @param {number} timeout - Delay before rendering (default: 100ms)
     * @param {number} maxRetries - Maximum retry attempts (default: 8)
     * @param {boolean} fastMode - Skip delays for immediate rendering (preview contexts)
     * @returns {Promise<void>}
     */
    async renderElement(element, timeout = TIMING.MATHJAX_TIMEOUT, maxRetries = 8, fastMode = false) {
        // Delegate to Core Coordinator for orchestrated rendering with health monitoring
        return this.coreCoordinator.render(element, { timeout, maxRetries, fastMode });
    }

    /**
     * Fast render method optimized for live preview contexts
     * Skips delays and timeouts for immediate rendering
     * @param {HTMLElement} element - Element to render MathJax in
     * @returns {Promise<void>}
     */
    async renderElementFast(element) {
        // Delegate to Core Coordinator for fast rendering with monitoring
        return this.coreCoordinator.renderFast(element);
    }
    
    /**
     * Handle F5 corruption recovery with DOM stability delay
     * @param {Element} element Element to render after recovery
     * @param {Function} resolve Promise resolve function
     * @param {Function} reject Promise reject function
     */
    handleF5Corruption(element, resolve, reject) {
        // Delegate to recovery service
        return this.recoveryService.handleF5Corruption(
            element,
            resolve,
            reject,
            this.cacheService.mathJaxCache,
            (el) => this.cacheService.getCacheKey(el),
            (el, success) => this.renderService.completeProgressiveLoading(el, success),
            (el) => this.cacheService.cacheMathJaxContent(el),
            this.renderService.pendingRenders
        );
    }

    /**
     * Render MathJax with enhanced retry mechanism (for complex scenarios)
     * @param {HTMLElement} element - Element to render
     * @param {number} baseTimeout - Base timeout between attempts
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Promise<void>}
     */
    async renderWithRetry(element, baseTimeout = 100, maxRetries = 5) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const timeout = baseTimeout * attempt; // Exponential backoff
                await this.renderElement(element, timeout, 1);
                return; // Success
            } catch (error) {
                lastError = error;
                logger.warn(`MathJax render attempt ${attempt} failed:`, error);
                
                if (attempt < maxRetries) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, TIMING.MATHJAX_TIMEOUT));
                }
            }
        }
        
        logger.error(`MathJax rendering failed after ${maxRetries} attempts:`, lastError);
        throw lastError;
    }

    /**
     * Process pending renders when MathJax becomes ready
     */
    processPendingRenders() {
        // Delegate to render service
        return this.renderService.processPendingRenders();
    }

    /**
     * Check if MathJax is ready for rendering
     * @returns {boolean}
     */
    isAvailable() {
        // Delegate to render service
        return this.renderService.isAvailable();
    }

    /**
     * Get MathJax status information for debugging
     * @returns {object}
     */
    getStatus() {
        // Combine legacy status with Core Coordinator health data
        const coordinatorHealth = this.coreCoordinator.getHealthStatus();
        
        return {
            // Legacy status for backward compatibility
            isReady: this.isReady,
            mathJaxExists: !!window.MathJax,
            typesetPromiseExists: !!window.MathJax?.typesetPromise,
            pendingRenders: this.pendingRenders.size,
            startupExists: !!window.MathJax?.startup,
            tex2jaxExists: !!window.MathJax?.tex2jax,
            hubExists: !!window.MathJax?.Hub,
            isWindows: this.isWindows,
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100) + '...',
            
            // Enhanced status from Core Coordinator
            coordinator: coordinatorHealth.coordinator,
            services: coordinatorHealth.services,
            performance: coordinatorHealth.performance,
            cache: coordinatorHealth.cache,
            lastError: coordinatorHealth.lastError,
            recentPerformance: coordinatorHealth.recentPerformance
        };
    }

    /**
     * Get comprehensive health report
     * @returns {Promise<object>} Complete health and diagnostic data
     */
    async getHealthReport() {
        return this.coreCoordinator.runDiagnostics();
    }

    /**
     * Reset health metrics (useful for testing)
     */
    resetHealthMetrics() {
        this.coreCoordinator.resetHealthMetrics();
    }

    /**
     * Force F5 recovery for testing purposes
     * @param {HTMLElement} element - Element to test recovery with
     * @returns {Promise<void>}
     */
    async testRecovery(element) {
        return this.coreCoordinator.forceRecovery(element);
    }

    /**
     * Legacy method for backward compatibility
     * @param {HTMLElement} element - Element to render
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void>}
     */
    async renderMathJax(element, timeout = TIMING.MATHJAX_TIMEOUT) {
        return this.renderElement(element, timeout);
    }

    /**
     * Show progressive loading UI while MathJax renders
     * @param {Element} element Element being rendered
     */
    showProgressiveLoading(element) {
        // Delegate to render service
        return this.renderService.showProgressiveLoading(element);
    }

    /**
     * Show fallback content with indication that LaTeX is loading
     * @param {Element} element Element being rendered
     */
    showFallbackContent(element) {
        if (!element || !element.classList.contains('mathjax-loading')) return;
        
        try {
            const originalContent = element.dataset.originalContent || element.innerHTML;
            
            // Check if content has LaTeX
            const hasLatex = originalContent.includes('$') || 
                           originalContent.includes('\\(') || 
                           originalContent.includes('\\[');
            
            if (hasLatex) {
                // CRITICAL FIX: ONLY use visual overlay approach - no innerHTML modification
                // Store original content for MathJax rendering (but don't modify innerHTML)
                if (!element.dataset.mathJaxOriginal) {
                    element.dataset.mathJaxOriginal = originalContent;
                }
                
                // Create loading overlay WITHOUT modifying innerHTML
                const overlay = document.createElement('div');
                overlay.className = 'mathjax-loading-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    color: rgba(255,255,255,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85em;
                    font-style: italic;
                    z-index: 1000;
                    border-radius: 4px;
                    backdrop-filter: blur(1px);
                `;
                overlay.innerHTML = '⌛ Rendering mathematics...';
                
                // Make element container relative for overlay positioning
                const originalPosition = element.style.position;
                if (!originalPosition || originalPosition === 'static') {
                    element.style.position = 'relative';
                }
                
                element.appendChild(overlay);
                element.dataset.hasLoadingOverlay = 'true';
                
                // Applied overlay without modifying innerHTML
            }
        } catch (e) {
            // Silent error handling for reduced console output
        }
    }

    /**
     * Complete progressive loading and show final rendered content
     * @param {Element} element Element that finished rendering
     * @param {boolean} renderSucceeded Whether MathJax rendering succeeded (default: true)
     */
    completeProgressiveLoading(element, renderSucceeded = true) {
        // Delegate to render service
        return this.renderService.completeProgressiveLoading(element, renderSucceeded);
    }

    /**
     * Generate cache key for MathJax content
     * @param {Element} element - Element containing LaTeX
     * @returns {string} Cache key
     */
    getCacheKey(element) {
        // Delegate to cache service
        return this.cacheService.getCacheKey(element);
    }

    /**
     * Cache rendered MathJax content for instant F5 recovery
     * @param {Element} element - Element with rendered MathJax
     */
    cacheMathJaxContent(element) {
        // Delegate to cache service
        return this.cacheService.cacheMathJaxContent(element);
    }

    /**
     * Clear MathJax cache (useful for testing or memory management)
     */
    clearCache() {
        // Delegate to cache service
        return this.cacheService.clearCache();
    }
}

// Create singleton instance
export const mathJaxService = new MathJaxService();

// Export for direct use
export default mathJaxService;