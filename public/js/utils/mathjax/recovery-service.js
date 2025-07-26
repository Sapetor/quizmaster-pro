/**
 * MathJax Recovery Service
 * Handles F5 corruption detection, Chrome multi-tab isolation, and script reloading
 * Extracted from MathJaxService for better modularity and testability
 */

import { TIMING, logger } from '../../core/config.js';
import { domUtils } from '../dom-utils.js';
import { errorHandler } from '../error-handler.js';

export class RecoveryService {
    constructor() {
        // Browser detection
        this.isWindows = this.detectWindows();
        this.isChrome = this.detectChrome();
        
        // Tab isolation for Chrome multi-tab scenarios
        this.tabId = this.generateTabId();
        this.isHost = window.location.pathname.includes('host') || window.location.search.includes('host=true');
        
        // Recovery state management
        this.isRecovering = false;
        this.recoveryCallbacks = [];
        this.globalRecoveryLock = false;
        
        // Clean up tab registration on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanupTabRegistration();
        });
    }

    /**
     * Detect if running on Windows
     * @returns {boolean}
     */
    detectWindows() {
        return navigator.platform.toLowerCase().includes('win') || 
               navigator.userAgent.toLowerCase().includes('windows');
    }

    /**
     * Detect if running on Chrome/Chromium browsers
     * @returns {boolean}
     */
    detectChrome() {
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const isChromium = window.chrome && window.chrome.runtime;
        const isEdge = /Edg/.test(navigator.userAgent);
        return (isChrome || isChromium) && !isEdge;
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
        } catch (e) {
            logger.debug('Tab cleanup error (not critical):', e.message);
        }
    }

    /**
     * Coordinate recovery across multiple Chrome tabs
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
            }
            
            // If no existing coordination, become the leader
            if (!coordination.leader) {
                coordination.leader = this.tabId;
                coordination.timestamp = now;
                coordination.status = 'leading';
                localStorage.setItem(recoveryKey, JSON.stringify(coordination));
                logger.debug('👑 Became multi-tab recovery leader');
                return 'leader';
            }
            
            // If already the leader, continue leading
            if (coordination.leader === this.tabId) {
                return 'leader';
            }
            
            // Otherwise, become a follower
            logger.debug('👥 Following existing recovery leader');
            return 'follower';
        } catch (e) {
            logger.debug('Multi-tab coordination error, defaulting to leader:', e.message);
            return 'leader';
        }
    }

    /**
     * Update recovery status for multi-tab coordination
     * @param {string} status - Recovery status (reloading, completed, failed)
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
     * Preserve MathJax configuration before script reload
     * @returns {object} Preserved configuration
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
            svg: {
                fontCache: 'global'
            },
            startup: {
                ready: () => {
                    window.MathJax.startup.defaultReady();
                    window.mathJaxReady = true;
                    logger.debug('🔄 MathJax configuration restored and ready');
                }
            }
        };

        // Try to preserve existing config
        if (window.MathJax && window.MathJax.tex) {
            try {
                return {
                    ...defaultConfig,
                    tex: {
                        ...defaultConfig.tex,
                        ...window.MathJax.tex
                    }
                };
            } catch (e) {
                logger.debug('Config preservation error, using default:', e.message);
            }
        }

        return defaultConfig;
    }

    /**
     * Restore MathJax configuration after cleanup
     * @param {object} config - Configuration to restore
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
     * Perform full MathJax script reload with recovery coordination
     * @param {HTMLElement} element - Element to render after recovery
     * @param {boolean} hasOtherTabs - Whether other tabs are active
     * @param {Function} completeProgressiveLoading - Callback to complete loading UI
     * @param {Set} pendingRenders - Set of pending renders to clean up
     * @returns {Promise}
     */
    performFullScriptReload(element, hasOtherTabs, completeProgressiveLoading, pendingRenders) {
        return new Promise((resolve) => {
            if (hasOtherTabs) {
                // Multi-tab coordination logic
                const coordinationResult = this.coordinateMultiTabRecovery();
                
                if (coordinationResult === 'follower') {
                    logger.debug('👥 Multi-tab follower - waiting for leader script reload');
                    this.waitForLeaderRecovery().then(() => {
                        if (window.MathJax && window.MathJax.typesetPromise) {
                            window.MathJax.typesetPromise([element]).then(() => {
                                pendingRenders.delete(element);
                                completeProgressiveLoading(element, true);
                                resolve();
                            }).catch(() => {
                                pendingRenders.delete(element);
                                completeProgressiveLoading(element, false);
                                resolve();
                            });
                        } else {
                            pendingRenders.delete(element);
                            completeProgressiveLoading(element, false);
                            resolve();
                        }
                    }).catch(() => {
                        pendingRenders.delete(element);
                        completeProgressiveLoading(element, false);
                        resolve();
                    });
                    return;
                }
            }
            
            // Perform the actual script reload
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
                            pendingRenders.delete(element);
                            completeProgressiveLoading(element, true);
                            this.isRecovering = false;
                            resolve();
                        }).catch(err => {
                            logger.error('❌ Script reload render failed:', err);
                            pendingRenders.delete(element);
                            completeProgressiveLoading(element, false);
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
                pendingRenders.delete(element);
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
     * Handle F5 corruption recovery with cache-first approach
     * @param {HTMLElement} element - Element to render after recovery
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     * @param {Map} mathJaxCache - Cache for instant recovery
     * @param {Function} getCacheKey - Function to generate cache keys
     * @param {Function} completeProgressiveLoading - Callback to complete loading UI
     * @param {Function} cacheMathJaxContent - Function to cache rendered content
     * @param {Set} pendingRenders - Set of pending renders to clean up
     */
    handleF5Corruption(element, resolve, reject, mathJaxCache, getCacheKey, completeProgressiveLoading, cacheMathJaxContent, pendingRenders) {
        // Try instant cache recovery first
        const cacheKey = getCacheKey(element);
        if (mathJaxCache.has(cacheKey)) {
            logger.debug('⚡ Using cached MathJax content for instant F5 recovery');
            const cachedContent = mathJaxCache.get(cacheKey);
            element.innerHTML = cachedContent;
            pendingRenders.delete(element);
            completeProgressiveLoading(element, true);
            resolve();
            return;
        }
        
        // Prevent duplicate recovery attempts
        if (this.globalRecoveryLock) {
            logger.debug('🔒 Recovery already in progress globally, queueing request');
            this.recoveryCallbacks.push(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise([element]).then(() => {
                        pendingRenders.delete(element);
                        cacheMathJaxContent(element);
                        completeProgressiveLoading(element, true);
                        resolve();
                    }).catch(() => {
                        pendingRenders.delete(element);
                        completeProgressiveLoading(element, false);
                        resolve();
                    });
                } else {
                    completeProgressiveLoading(element, false);
                    resolve();
                }
            });
            return;
        }
        
        // Set global lock
        this.globalRecoveryLock = true;
        
        // Chrome F5 Recovery: Direct script reload for reliability
        if (this.isChrome) {
            const hasOtherTabs = this.hasOtherActiveTabs();
            logger.debug(`🔄 F5 recovery: ${this.isHost ? 'HOST' : 'CLIENT'} (${hasOtherTabs ? 'multi-tab' : 'single-tab'})`);
            this.performFullScriptReload(element, hasOtherTabs, completeProgressiveLoading, pendingRenders).then(resolve).catch(() => resolve());
            return;
        }
        
        // If already recovering, queue this render attempt
        if (this.isRecovering) {
            logger.debug('🔄 F5 recovery already in progress, queueing render attempt');
            this.recoveryCallbacks.push(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise([element]).then(() => {
                        pendingRenders.delete(element);
                        cacheMathJaxContent(element);
                        completeProgressiveLoading(element, true);
                        resolve();
                    }).catch(err => {
                        errorHandler.log(err, {
                            context: 'Queued render after F5 recovery',
                            elementId: element.id || 'unknown'
                        });
                        pendingRenders.delete(element);
                        completeProgressiveLoading(element, false);
                        resolve();
                    });
                } else {
                    completeProgressiveLoading(element, false);
                    resolve();
                }
            });
            return;
        }
        
        // Start recovery process for non-Chrome browsers or fallback
        this.isRecovering = true;
        
        // For non-Chrome browsers, use direct script reload
        logger.debug('🔧 Non-Chrome F5 recovery - using direct script reload');
        this.performFullScriptReload(element, false, completeProgressiveLoading, pendingRenders).then(resolve).catch(() => resolve());
    }

    /**
     * Detect F5 corruption signature
     * @returns {boolean} True if F5 corruption is detected
     */
    detectF5Corruption() {
        // F5 CORRUPTION DETECTION: Check for the exact corruption signature
        // Corruption pattern: startup=true, document=false, typesetPromise=false
        const hasStartup = !!(window.MathJax && window.MathJax.startup);
        const hasDocument = !!(window.MathJax && window.MathJax.startup && window.MathJax.startup.document);
        const hasTypesetPromise = !!(window.MathJax && window.MathJax.typesetPromise);
        
        return hasStartup && !hasDocument && !hasTypesetPromise;
    }

    /**
     * Get recovery service status for debugging
     * @returns {object} Recovery service status
     */
    getStatus() {
        return {
            isRecovering: this.isRecovering,
            globalRecoveryLock: this.globalRecoveryLock,
            queuedCallbacks: this.recoveryCallbacks.length,
            isChrome: this.isChrome,
            isWindows: this.isWindows,
            tabId: this.tabId,
            isHost: this.isHost,
            hasOtherTabs: this.hasOtherActiveTabs()
        };
    }
}

// Export singleton instance
export const recoveryService = new RecoveryService();