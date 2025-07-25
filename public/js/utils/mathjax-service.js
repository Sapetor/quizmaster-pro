/**
 * MathJax Service - Centralized MathJax rendering and management
 * Consolidates duplicate MathJax logic from game-manager.js, quiz-manager.js, preview-manager.js
 */

import { TIMING, logger } from '../core/config.js';

export class MathJaxService {
    constructor() {
        this.isReady = false;
        this.pendingRenders = new Set();
        this.isWindows = this.detectWindows();
        this.isChrome = this.detectChrome();
        this.isRecovering = false; // Track if F5 recovery is in progress
        this.recoveryCallbacks = []; // Queue callbacks waiting for recovery
        
        // Tab isolation for Chrome multi-tab scenarios
        this.tabId = this.generateTabId();
        this.isHost = window.location.pathname.includes('host') || window.location.search.includes('host=true');
        
        logger.debug(`🎯 MathJax Service initialized for ${this.isHost ? 'HOST' : 'CLIENT'} tab: ${this.tabId}`);
        
        // Clean up tab registration on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanupTabRegistration();
        });
        
        this.initializeMathJax();
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
            logger.debug(`🧹 Cleaned up tab registration: ${this.tabId}`);
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
                logger.debug(`👑 Became recovery leader: ${this.tabId}`);
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
                    
                    // Chrome needs extra time for proper MathJax initialization after F5
                    const delay = (isWindows && isChrome) ? 250 : (isWindows ? 150 : (isChrome ? 200 : 0));
                    
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
                                this.completeProgressiveLoading(element);
                                resolve();
                            }).catch(() => {
                                this.pendingRenders.delete(element);
                                this.completeProgressiveLoading(element);
                                resolve();
                            });
                        } else {
                            this.pendingRenders.delete(element);
                            this.completeProgressiveLoading(element);
                            resolve();
                        }
                    }).catch(() => {
                        this.pendingRenders.delete(element);
                        this.completeProgressiveLoading(element);
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
            
            // Clear corrupted state
            if (this.isChrome) {
                if (window.MathJax) {
                    try {
                        if (window.MathJax.startup) {
                            window.MathJax.startup.ready = null;
                            window.MathJax.startup.input = null;
                            window.MathJax.startup.output = null;
                        }
                        if (window.MathJax.config) delete window.MathJax.config;
                    } catch (e) {
                        logger.debug('🔧 Chrome cleanup error (expected):', e.message);
                    }
                }
                if (window.gc) window.gc();
            }
            
            delete window.MathJax;
            delete window.mathJaxReady;
            
            // Restore configuration
            this.restoreMathJaxConfig(preservedConfig);
            logger.debug('🔄 Restored MathJax configuration');
            
            // Remove existing script
            const existingScript = document.getElementById('MathJax-script');
            if (existingScript) {
                existingScript.remove();
                logger.debug('🔧 Removed corrupted MathJax script');
            }
            
            // Reload script
            const mathJaxScript = document.createElement('script');
            mathJaxScript.id = 'MathJax-script';
            mathJaxScript.async = true;
            
            const cacheBuster = this.isChrome 
                ? `reload=${Date.now()}&chrome=${Math.random().toString(36).substr(2, 9)}`
                : `reload=${Date.now()}`;
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
                            this.completeProgressiveLoading(element);
                            this.isRecovering = false;
                            resolve();
                        }).catch(err => {
                            logger.error('❌ Script reload render failed:', err);
                            this.pendingRenders.delete(element);
                            this.completeProgressiveLoading(element);
                            this.isRecovering = false;
                            resolve();
                        });
                        
                        // Process queued callbacks
                        const callbacks = [...this.recoveryCallbacks];
                        this.recoveryCallbacks = [];
                        const callbackDelay = this.isChrome ? 150 : 50;
                        callbacks.forEach(callback => {
                            setTimeout(callback, callbackDelay);
                        });
                        
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
                logger.error('❌ Failed to reload MathJax script:', error);
                this.pendingRenders.delete(element);
                this.isRecovering = false;
                this.recoveryCallbacks = [];
                this.updateRecoveryStatus('failed');
                setTimeout(() => {
                    try {
                        localStorage.removeItem('quizmaster_recovery_coordination');
                    } catch (e) {
                        logger.debug('Recovery cleanup error (not critical):', e.message);
                    }
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
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @returns {Promise<void>}
     */
    async renderElement(element, timeout = TIMING.MATHJAX_TIMEOUT, maxRetries = 10) {
        return new Promise((resolve, reject) => {
            // Add progressive loading UI
            this.showProgressiveLoading(element);
            
            const attemptRender = (attempt = 1) => {
                setTimeout(() => {
                    logger.debug(`🔍 MathJax render attempt ${attempt}/${maxRetries} - Platform: ${this.isWindows ? 'Windows' : 'Other'}`);
                    logger.debug(`🔍 MathJax available: ${!!window.MathJax}, typesetPromise: ${!!window.MathJax?.typesetPromise}`);
                    const hasLatexContent = element.innerHTML.includes('$$') || 
                                        element.innerHTML.includes('\\(') ||
                                        element.innerHTML.includes('\\[') ||
                                        element.innerHTML.includes('$') ||  // Single dollar delimiters
                                        element.innerHTML.includes('\\frac') ||  // Common LaTeX commands
                                        element.innerHTML.includes('\\sqrt') ||
                                        element.innerHTML.includes('\\sum') ||
                                        element.innerHTML.includes('\\int');
                    logger.debug(`🔍 Element has LaTeX content: ${hasLatexContent}`);
                    
                    if (this.isAvailable()) {
                        // Conservative approach: Let MathJax handle its own element management
                        
                        logger.debug(`🔍 Calling MathJax.typesetPromise on element with content: ${element.innerHTML.substring(0, 200)}...`);
                        
                        window.MathJax.typesetPromise([element])
                            .then(() => {
                                logger.debug(`✅ MathJax render successful on attempt ${attempt}`);
                                this.pendingRenders.delete(element);
                                
                                // Complete progressive loading
                                this.completeProgressiveLoading(element);
                                
                                resolve();
                            })
                            .catch(error => {
                                logger.error(`❌ MathJax render error (attempt ${attempt}):`, error);
                                if (attempt < maxRetries) {
                                    logger.debug(`🔍 Retrying in ${timeout}ms...`);
                                    setTimeout(() => attemptRender(attempt + 1), TIMING.MATHJAX_RETRY_TIMEOUT);
                                } else {
                                    this.pendingRenders.delete(element);
                                    // Complete progressive loading even on error
                                    this.completeProgressiveLoading(element);
                                    reject(error);
                                }
                            });
                    } else if (attempt < maxRetries) {
                        logger.debug(`⏳ MathJax not ready (MathJax: ${!!window.MathJax}, typesetPromise: ${!!window.MathJax?.typesetPromise}), retrying in ${timeout}ms...`);
                        setTimeout(() => attemptRender(attempt + 1), TIMING.MATHJAX_RETRY_TIMEOUT);
                    } else {
                        const mathJaxExists = !!window.MathJax;
                        const typesetExists = !!window.MathJax?.typesetPromise;
                        logger.error(`❌ MathJax not fully ready after ${maxRetries} attempts - MathJax: ${mathJaxExists}, typesetPromise: ${typesetExists}`);
                        
                        // RESTORE WORKING CORRUPTION DETECTION (the F5 prevention caused infinite loops)
                        logger.debug(`🔧 EMERGENCY CHECK: MathJax=${!!window.MathJax}, startup=${!!window.MathJax?.startup}, document=${!!window.MathJax?.startup?.document}, element=${!!element}`);
                        
                        // F5 CORRUPTION DETECTION: Check for the exact corruption signature
                        // Corruption pattern: startup=true, document=false, typesetPromise=false
                        const hasStartup = !!(window.MathJax && window.MathJax.startup);
                        const hasDocument = !!(window.MathJax && window.MathJax.startup && window.MathJax.startup.document);
                        const hasTypesetPromise = !!(window.MathJax && window.MathJax.typesetPromise);
                        
                        logger.debug(`🔍 F5 CORRUPTION CHECK: startup=${hasStartup}, document=${hasDocument}, typesetPromise=${hasTypesetPromise}`);
                        
                        if (hasStartup && !hasDocument && !hasTypesetPromise) {
                            logger.debug('🚨 F5 CORRUPTION DETECTED: MathJax in corrupted state (startup=true, document=false, typesetPromise=false)');
                            
                            // Small delay to ensure DOM content is stable before recovery
                            setTimeout(() => {
                                this.handleF5Corruption(element, resolve, reject);
                            }, 100);
                            return;
                        }
                        
                        // If no corruption detected, reject with the original error
                        this.pendingRenders.delete(element);
                        this.completeProgressiveLoading(element);
                        reject(new Error(`MathJax not ready after ${maxRetries} attempts`));
                    }
                }, timeout);
            };
            
            attemptRender();
        });
    }
    
    /**
     * Handle F5 corruption recovery with DOM stability delay
     * @param {Element} element Element to render after recovery
     * @param {Function} resolve Promise resolve function
     * @param {Function} reject Promise reject function
     */
    handleF5Corruption(element, resolve, reject) {
        // Chrome F5 Recovery: Try lightweight approach first, fallback to script reload
        if (this.isChrome) {
            const hasOtherTabs = this.hasOtherActiveTabs();
            logger.debug(`🔄 CHROME F5 DETECTED: ${this.isHost ? 'HOST' : 'CLIENT'} tab recovery (Other tabs: ${hasOtherTabs})`);
            
            // Try lightweight recovery first (much faster)
            const lightweightSuccess = this.attemptLightweightRecovery(element);
            if (lightweightSuccess) {
                logger.debug('✨ Lightweight recovery successful - no script reload needed');
                lightweightSuccess.then(resolve).catch(() => {
                    logger.debug('❌ Lightweight recovery failed - falling back to script reload');
                    // Fallback to script reload if lightweight fails
                    this.performFullScriptReload(element, hasOtherTabs).then(resolve).catch(() => resolve());
                });
                return;
            }
            
            // Fallback to full script reload if lightweight isn't applicable
            logger.debug('🔧 Lightweight recovery not applicable - using script reload');
            this.performFullScriptReload(element, hasOtherTabs).then(resolve).catch(() => resolve());
            return;
        }
        
        // If already recovering, queue this render attempt
        if (this.isRecovering) {
            logger.debug('🔄 F5 recovery already in progress, queueing render attempt');
            this.recoveryCallbacks.push(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise([element]).then(() => {
                        this.pendingRenders.delete(element);
                        // Complete progressive loading after successful render
                        this.completeProgressiveLoading(element);
                        resolve();
                    }).catch(err => {
                        logger.error('❌ Queued render failed after F5 recovery:', err);
                        this.pendingRenders.delete(element);
                        // Complete progressive loading even on error
                        this.completeProgressiveLoading(element);
                        resolve();
                    });
                } else {
                    // Complete progressive loading if MathJax still not ready
                    this.completeProgressiveLoading(element);
                    resolve();
                }
            });
            return;
        }
        
        // Start recovery process for non-Chrome browsers or fallback
        this.isRecovering = true;
        
        // For non-Chrome browsers, use direct script reload
        logger.debug('🔧 Non-Chrome F5 recovery - using direct script reload');
        this.performFullScriptReload(element, false).then(resolve).catch(() => resolve());
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
                    await new Promise(resolve => setTimeout(resolve, TIMING.MATHJAX_RETRY_TIMEOUT));
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
        if (this.pendingRenders.size === 0) return;

        const elements = Array.from(this.pendingRenders);
        this.pendingRenders.clear();

        elements.forEach(element => {
            this.renderElement(element).catch(error => {
                logger.error('Failed to process pending MathJax render:', error);
            });
        });
    }

    /**
     * Check if MathJax is ready for rendering
     * @returns {boolean}
     */
    isAvailable() {
        // Primary check: typesetPromise exists
        if (window.MathJax && window.MathJax.typesetPromise) {
            return true;
        }
        
        // Fallback check: startup is complete
        if (window.MathJax && window.MathJax.startup) {
            // Check if startup promise has resolved
            const startupComplete = window.MathJax.startup.document && 
                                  window.MathJax.startup.document.state && 
                                  window.MathJax.startup.document.state() >= 8; // STATE.READY = 8
            
            if (startupComplete) {
                logger.debug('🔍 MathJax available via startup completion check');
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get MathJax status information for debugging
     * @returns {object}
     */
    getStatus() {
        return {
            isReady: this.isReady,
            mathJaxExists: !!window.MathJax,
            typesetPromiseExists: !!window.MathJax?.typesetPromise,
            pendingRenders: this.pendingRenders.size,
            startupExists: !!window.MathJax?.startup,
            tex2jaxExists: !!window.MathJax?.tex2jax,
            hubExists: !!window.MathJax?.Hub,
            isWindows: this.isWindows,
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100) + '...' // Truncated for readability
        };
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
        if (!element) return;
        
        try {
            // Add loading class for shimmer effect
            element.classList.add('mathjax-loading');
            
            // Store original content in case we need to show fallback
            if (!element.dataset.originalContent) {
                element.dataset.originalContent = element.innerHTML;
            }
            
            // For longer delays (like F5 recovery), show raw LaTeX with indication
            const fallbackTimer = setTimeout(() => {
                if (element.classList.contains('mathjax-loading')) {
                    this.showFallbackContent(element);
                }
            }, 1000); // Show fallback after 1 second delay
            
            // Store timer ID for cleanup
            element.dataset.fallbackTimer = fallbackTimer;
            
            logger.debug('⏳ Progressive loading started for element');
        } catch (e) {
            logger.debug('Progressive loading setup error (not critical):', e.message);
        }
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
                // Wrap LaTeX content with fallback styling
                const fallbackContent = originalContent.replace(
                    /\$([^$]+)\$/g, 
                    '<span class="mathjax-fallback">$1</span>'
                ).replace(
                    /\\\(([^)]+)\\\)/g,
                    '<span class="mathjax-fallback">$1</span>'
                );
                
                element.innerHTML = fallbackContent + 
                    '<div style="font-size: 0.8em; color: rgba(255,255,255,0.6); margin-top: 4px; font-style: italic;">' +
                    '⌛ Rendering mathematics...</div>';
                
                logger.debug('🗺 Showing fallback LaTeX content with loading indicator');
            }
        } catch (e) {
            logger.debug('Fallback content error (not critical):', e.message);
        }
    }

    /**
     * Complete progressive loading and show final rendered content
     * @param {Element} element Element that finished rendering
     */
    completeProgressiveLoading(element) {
        if (!element) return;
        
        try {
            // Clean up fallback timer
            if (element.dataset.fallbackTimer) {
                clearTimeout(parseInt(element.dataset.fallbackTimer));
                delete element.dataset.fallbackTimer;
            }
            
            // Restore original content if MathJax rendering failed and we still have fallback content
            if (element.dataset.originalContent && 
                (element.innerHTML.includes('⌛ Rendering mathematics') || 
                 element.innerHTML.includes('mathjax-fallback'))) {
                logger.debug('🔄 Restoring original content after failed MathJax render');
                element.innerHTML = element.dataset.originalContent;
            }
            
            // Remove loading classes
            element.classList.remove('mathjax-loading');
            element.classList.add('mathjax-ready');
            
            // Clean up stored data
            delete element.dataset.originalContent;
            
            // Remove any fallback indicators
            const indicators = element.querySelectorAll('[style*="Rendering mathematics"]');
            indicators.forEach(indicator => indicator.remove());
            
            logger.debug('✨ Progressive loading completed - MathJax ready');
        } catch (e) {
            logger.debug('Progressive loading completion error (not critical):', e.message);
        }
    }
}

// Create singleton instance
export const mathJaxService = new MathJaxService();

// Export for direct use
export default mathJaxService;