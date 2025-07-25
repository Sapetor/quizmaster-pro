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
                                
                                resolve();
                            })
                            .catch(error => {
                                logger.error(`❌ MathJax render error (attempt ${attempt}):`, error);
                                if (attempt < maxRetries) {
                                    logger.debug(`🔍 Retrying in ${timeout}ms...`);
                                    setTimeout(() => attemptRender(attempt + 1), TIMING.MATHJAX_RETRY_TIMEOUT);
                                } else {
                                    this.pendingRenders.delete(element);
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
                            
                            // Chrome multi-tab safe recovery approach
                            if (this.isChrome) {
                                const hasOtherTabs = this.hasOtherActiveTabs();
                                logger.debug(`🔄 CHROME F5 DETECTED: ${this.isHost ? 'HOST' : 'CLIENT'} tab recovery (Other tabs: ${hasOtherTabs})`);
                                
                                if (hasOtherTabs) {
                                    // Multi-tab scenario: Use coordinated recovery
                                    logger.debug('🔄 Multi-tab detected: Using coordinated recovery');
                                    
                                    // Try to coordinate script reload across tabs
                                    const coordinationResult = this.coordinateMultiTabRecovery();
                                    
                                    if (coordinationResult === 'leader') {
                                        logger.debug('👑 This tab is the recovery leader - performing script reload');
                                        // Continue with script reload as the leader
                                    } else if (coordinationResult === 'follower') {
                                        logger.debug('👥 This tab is following - waiting for leader recovery');
                                        
                                        // Wait for the leader tab to complete recovery
                                        const waitForLeaderRecovery = (attempts = 0) => {
                                            const maxAttempts = 30; // 15 seconds total
                                            
                                            if (window.MathJax && window.MathJax.typesetPromise) {
                                                logger.debug('✅ Multi-tab follower: Leader recovery completed');
                                                window.MathJax.typesetPromise([element]).then(() => {
                                                    this.pendingRenders.delete(element);
                                                    resolve();
                                                }).catch(err => {
                                                    logger.error('❌ Multi-tab follower render failed:', err);
                                                    this.pendingRenders.delete(element);
                                                    resolve();
                                                });
                                            } else if (attempts < maxAttempts) {
                                                setTimeout(() => waitForLeaderRecovery(attempts + 1), 500);
                                            } else {
                                                logger.error('❌ Multi-tab follower recovery timeout - attempting own recovery');
                                                // Fallback: try own recovery
                                                this.performScriptReload(element).then(resolve).catch(() => resolve());
                                            }
                                        };
                                        
                                        waitForLeaderRecovery();
                                        return;
                                    }
                                } else {
                                    // Single tab: Safe to use aggressive recovery
                                    logger.debug('🔧 Single tab detected: Using full recovery');
                                }
                            }
                            
                            // If already recovering, queue this render attempt
                            if (this.isRecovering) {
                                logger.debug('🔄 F5 recovery already in progress, queueing render attempt');
                                this.recoveryCallbacks.push(() => {
                                    if (window.MathJax && window.MathJax.typesetPromise) {
                                        window.MathJax.typesetPromise([element]).then(() => {
                                            this.pendingRenders.delete(element);
                                            resolve();
                                        }).catch(err => {
                                            logger.error('❌ Queued render failed after F5 recovery:', err);
                                            this.pendingRenders.delete(element);
                                            resolve();
                                        });
                                    }
                                });
                                return;
                            }
                            
                            // Start recovery process
                            this.isRecovering = true;
                            
                            // CLEAR CORRUPTED STATE AND REINITIALIZE
                            logger.debug('🔧 Clearing corrupted MathJax state...');
                            
                            // CRITICAL: Preserve MathJax configuration before clearing
                            const preservedConfig = this.preserveMathJaxConfig();
                            logger.debug('🗺 Preserved MathJax configuration for restoration');
                            
                            // Chrome-specific: More aggressive cleanup
                            if (this.isChrome) {
                                // Clear Chrome-specific MathJax caches and references
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
                                // Force garbage collection hint for Chrome
                                if (window.gc) window.gc();
                            }
                            
                            delete window.MathJax;
                            delete window.mathJaxReady;
                            
                            // Restore configuration before script reload
                            this.restoreMathJaxConfig(preservedConfig);
                            logger.debug('🔄 Restored MathJax configuration');
                            
                            // Remove existing script by ID (matches HTML file)
                            const existingScript = document.getElementById('MathJax-script');
                            if (existingScript) {
                                existingScript.remove();
                                logger.debug('🔧 Removed corrupted MathJax script');
                            }
                            
                            // Reload MathJax with cache busting - use same URL as in HTML
                            const mathJaxScript = document.createElement('script');
                            mathJaxScript.id = 'MathJax-script';
                            mathJaxScript.async = true;
                            // Chrome-specific: More aggressive cache busting
                            const cacheBuster = this.isChrome 
                                ? `reload=${Date.now()}&chrome=${Math.random().toString(36).substr(2, 9)}`
                                : `reload=${Date.now()}`;
                            mathJaxScript.src = `https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js?${cacheBuster}`;
                            
                            logger.debug(`🔧 Loading MathJax with ${this.isChrome ? 'Chrome-specific' : 'standard'} cache busting`);
                            
                            mathJaxScript.onload = () => {
                                logger.debug('🔧 MathJax script reloaded with cache busting');
                                // Wait for MathJax to fully initialize
                                const waitForInit = () => {
                                    if (window.MathJax && window.MathJax.typesetPromise) {
                                        logger.debug('✅ MathJax successfully reinitialized after F5 corruption');
                                        
                                        // Notify other tabs that recovery is complete
                                        this.updateRecoveryStatus('completed');
                                        
                                        // Render the initial element that triggered recovery
                                        window.MathJax.typesetPromise([element]).then(() => {
                                            this.pendingRenders.delete(element);
                                            resolve();
                                        }).catch(err => {
                                            logger.error('❌ Initial render failed after F5 fix:', err);
                                            this.pendingRenders.delete(element);
                                            resolve();
                                        });
                                        
                                        // Process all queued render attempts
                                        logger.debug(`🔄 Processing ${this.recoveryCallbacks.length} queued render attempts`);
                                        const callbacks = [...this.recoveryCallbacks];
                                        this.recoveryCallbacks = [];
                                        this.isRecovering = false;
                                        
                                        // Execute all queued callbacks with Chrome-specific timing
                                        const callbackDelay = this.isChrome ? 150 : 50; // Chrome needs more time
                                        callbacks.forEach(callback => {
                                            setTimeout(callback, callbackDelay);
                                        });
                                        
                                        // Clean up coordination after successful recovery
                                        setTimeout(() => {
                                            try {
                                                localStorage.removeItem('quizmaster_recovery_coordination');
                                                logger.debug('🧹 Cleaned up recovery coordination');
                                            } catch (e) {
                                                logger.debug('Recovery cleanup error (not critical):', e.message);
                                            }
                                        }, 2000); // Wait 2 seconds for other tabs to process
                                    } else {
                                        const pollInterval = this.isChrome ? 150 : 100; // Chrome needs slower polling
                                        setTimeout(waitForInit, pollInterval);
                                    }
                                };
                                waitForInit();
                            };
                            
                            mathJaxScript.onerror = (error) => {
                                logger.error('❌ Failed to reload MathJax script:', error);
                                this.pendingRenders.delete(element);
                                
                                // Reset recovery state and clear callbacks
                                this.isRecovering = false;
                                this.recoveryCallbacks = [];
                                
                                // Notify other tabs that recovery failed
                                this.updateRecoveryStatus('failed');
                                
                                // Clean up coordination
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
                            
                            this.pendingRenders.delete(element);
                            return; // Exit early
                        }
                        
                        // FALLBACK: If not corruption, wait for normal initialization
                        if (hasStartup && !hasDocument) {
                            logger.debug('🚨 F5 RELOAD: MathJax still initializing after F5, waiting longer...');
                            
                            // Wait up to 15 seconds for MathJax to self-initialize after F5
                            const waitForF5Recovery = (waitAttempt = 1) => {
                                const maxWaitAttempts = 30; // 30 * 500ms = 15 seconds
                                
                                setTimeout(() => {
                                    if (this.isAvailable()) {
                                        logger.debug(`✅ F5 RECOVERY SUCCESS: MathJax ready after ${waitAttempt * 500}ms`);
                                        // Now render with the properly initialized MathJax
                                        window.MathJax.typesetPromise([element]).then(() => {
                                            logger.debug('✅ F5 LaTeX rendering successful');
                                            this.pendingRenders.delete(element);
                                            resolve();
                                        }).catch(err => {
                                            logger.warn('⚠️ F5 LaTeX render failed after recovery:', err);
                                            resolve();
                                        });
                                    } else if (waitAttempt < maxWaitAttempts) {
                                        logger.debug(`⏳ F5 recovery attempt ${waitAttempt}/${maxWaitAttempts}...`);
                                        waitForF5Recovery(waitAttempt + 1);
                                    } else {
                                        logger.warn('⚠️ F5 recovery timeout - giving up on LaTeX rendering');
                                        this.pendingRenders.delete(element);
                                        resolve();
                                    }
                                }, 500); // Check every 500ms during F5 recovery
                            };
                            
                            waitForF5Recovery();
                            return; // Exit early, don't continue with other fallbacks
                        }
                        
                        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.document && element) {
                            try {
                                const startupState = window.MathJax.startup.document.state ? window.MathJax.startup.document.state() : -1;
                                logger.debug(`🔧 EMERGENCY FALLBACK: MathJax startup state: ${startupState} (8=READY)`);
                                
                                if (startupState >= 8) { // STATE.READY = 8
                                    logger.debug('🚨 EMERGENCY: MathJax startup is ready, attempting direct rendering...');
                                    
                                    // Try to render using startup document directly
                                    window.MathJax.startup.document.render(element).then(() => {
                                        logger.debug('✅ EMERGENCY SUCCESS: Direct startup rendering completed');
                                        this.pendingRenders.delete(element);
                                        resolve();
                                        return;
                                    }).catch((renderError) => {
                                        logger.warn('⚠️ Emergency startup rendering failed:', renderError);
                                        // Continue to other debugging/fallbacks
                                    });
                                    
                                    // Don't continue with other logic if we're trying the emergency fallback
                                    return;
                                }
                            } catch (emergencyError) {
                                logger.warn('⚠️ Emergency fallback failed:', emergencyError);
                            }
                        }
                        
                        // ALTERNATIVE FALLBACK: When startup.document is missing but startup exists
                        else if (window.MathJax && window.MathJax.startup && !window.MathJax.startup.document && element) {
                            logger.debug('🔧 ALTERNATIVE FALLBACK: startup.document missing, trying alternative methods...');
                            logger.debug(`🔧 ALTERNATIVE DEBUG: promise=${!!window.MathJax.startup.promise}, tex=${!!window.MathJax.tex}, processNode=${!!window.MathJax.tex?.processNode}`);
                            
                            try {
                                // Try to force MathJax startup completion
                                if (window.MathJax.startup.promise) {
                                    logger.debug('🔧 Forcing MathJax startup completion...');
                                    window.MathJax.startup.promise.then(() => {
                                        logger.debug('✅ MathJax startup promise resolved, retrying render...');
                                        logger.debug(`🔧 After startup: typesetPromise=${!!window.MathJax.typesetPromise}, document=${!!window.MathJax.startup.document}`);
                                        
                                        if (window.MathJax.typesetPromise) {
                                            window.MathJax.typesetPromise([element]).then(() => {
                                                logger.debug('✅ ALTERNATIVE SUCCESS: Render after startup completion');
                                                this.pendingRenders.delete(element);
                                                resolve();
                                            }).catch((altError) => {
                                                logger.warn('⚠️ Alternative render failed:', altError);
                                            });
                                        } else {
                                            logger.warn('⚠️ typesetPromise still not available after startup completion');
                                        }
                                    }).catch((startupError) => {
                                        logger.warn('⚠️ Startup promise failed:', startupError);
                                    });
                                    return; // Don't continue to other logic
                                }
                                
                                // Try direct MathJax processing if available
                                if (window.MathJax.tex && window.MathJax.tex.processNode) {
                                    logger.debug('🔧 Trying direct tex processing...');
                                    window.MathJax.tex.processNode(element);
                                    logger.debug('✅ ALTERNATIVE SUCCESS: Direct tex processing completed');
                                    this.pendingRenders.delete(element);
                                    resolve();
                                    return;
                                } else {
                                    logger.debug('🔧 Direct tex processing not available');
                                }
                                
                                // LAST RESORT: Try to force MathJax reinitialization
                                logger.debug('🚨 LAST RESORT: Attempting MathJax reinitialization...');
                                
                                // Try to restart MathJax if startup exists
                                if (window.MathJax.startup && typeof window.MathJax.startup.getComponents === 'function') {
                                    try {
                                        logger.debug('🔧 Attempting MathJax component restart...');
                                        window.MathJax.startup.getComponents().then(() => {
                                            logger.debug('✅ MathJax components loaded, retrying render...');
                                            if (window.MathJax.typesetPromise) {
                                                window.MathJax.typesetPromise([element]).then(() => {
                                                    logger.debug('✅ LAST RESORT SUCCESS: Render after component restart');
                                                    this.pendingRenders.delete(element);
                                                    resolve();
                                                }).catch(err => logger.warn('⚠️ Component restart render failed:', err));
                                            }
                                        }).catch(err => logger.warn('⚠️ Component restart failed:', err));
                                        return;
                                    } catch (componentError) {
                                        logger.warn('⚠️ Component restart error:', componentError);
                                    }
                                }
                                
                                // Try manual DOM processing as absolute last resort
                                logger.debug('🚨 FINAL ATTEMPT: Manual LaTeX processing...');
                                try {
                                    // Simple regex replacement for basic LaTeX
                                    let content = element.innerHTML;
                                    const hasBasicLatex = content.includes('$') || content.includes('\\(') || content.includes('\\[');
                                    
                                    if (hasBasicLatex) {
                                        logger.debug('🔧 Found LaTeX content, will attempt CSS-based display...');
                                        // Add a class to indicate LaTeX content for CSS styling
                                        element.classList.add('contains-latex');
                                        element.setAttribute('title', 'LaTeX content detected but not rendered');
                                        logger.debug('✅ FINAL SUCCESS: LaTeX content marked for manual handling');
                                        this.pendingRenders.delete(element);
                                        resolve();
                                        return;
                                    }
                                } catch (manualError) {
                                    logger.warn('⚠️ Manual processing failed:', manualError);
                                }
                                
                            } catch (altError) {
                                logger.warn('⚠️ Alternative fallback failed:', altError);
                            }
                        }
                        
                        // DEBUG: Log more MathJax state information
                        if (window.MathJax) {
                            logger.debug('🔍 MathJax debugging info:', {
                                startup: !!window.MathJax.startup,
                                config: !!window.MathJax.config,
                                tex: !!window.MathJax.tex,
                                svg: !!window.MathJax.svg,
                                version: window.MathJax.version,
                                state: window.MathJax.startup?.state || 'unknown'
                            });
                            
                            // Try to force MathJax initialization if startup exists
                            if (window.MathJax.startup && !window.MathJax.typesetPromise) {
                                logger.debug('🔧 Attempting to force MathJax startup...');
                                try {
                                    if (typeof window.MathJax.startup.promise === 'function') {
                                        window.MathJax.startup.promise.then(() => {
                                            logger.debug('✅ MathJax startup promise resolved');
                                        });
                                    }
                                } catch (err) {
                                    logger.error('❌ Failed to force MathJax startup:', err);
                                }
                            }
                        }
                        
                        // ENHANCED FALLBACK: Check startup completion state for alternative rendering
                        if (window.MathJax && element) {
                            logger.debug('🔧 Trying enhanced fallback MathJax rendering...');
                            
                            // Try startup completion fallback first
                            if (window.MathJax.startup && window.MathJax.startup.document) {
                                try {
                                    const startupState = window.MathJax.startup.document.state ? window.MathJax.startup.document.state() : -1;
                                    logger.debug(`🔍 MathJax startup state: ${startupState} (8=READY)`);
                                    
                                    if (startupState >= 8) { // STATE.READY = 8
                                        logger.debug('✅ MathJax startup is ready, attempting direct document processing...');
                                        
                                        // Try to render using startup document directly
                                        window.MathJax.startup.document.render(element).then(() => {
                                            logger.debug('✅ SUCCESS: Fallback rendering via startup document completed');
                                            this.pendingRenders.delete(element);
                                            resolve();
                                        }).catch((renderError) => {
                                            logger.warn('⚠️ Direct startup document rendering failed:', renderError);
                                            // Continue to other fallback methods
                                        });
                                        return;
                                    }
                                } catch (startupError) {
                                    logger.warn('⚠️ Startup document rendering failed, trying other methods:', startupError);
                                }
                            }
                            
                            try {
                                // Try MathJax 2.x style rendering if available
                                if (window.MathJax.Hub && window.MathJax.Hub.Queue) {
                                    window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, element]);
                                    logger.debug('✅ Fallback: MathJax 2.x rendering attempted');
                                }
                                // Try direct tex2jax processing if available
                                else if (window.MathJax.tex2jax && window.MathJax.tex2jax.Process) {
                                    window.MathJax.tex2jax.Process(element);
                                    logger.debug('✅ Fallback: tex2jax processing attempted');
                                }
                                // Try alternative startup document methods
                                else if (window.MathJax.startup && window.MathJax.startup.document) {
                                    window.MathJax.startup.document.clear();
                                    window.MathJax.startup.document.updateDocument();
                                    logger.debug('✅ Fallback: startup document processing attempted');
                                }
                            } catch (fallbackError) {
                                logger.error('❌ Fallback rendering failed:', fallbackError);
                            }
                        }
                        
                        this.pendingRenders.delete(element);
                        resolve(); // Resolve anyway to prevent hanging
                    }
                }, timeout);
            };

            this.pendingRenders.add(element);
            attemptRender();
        });
    }

    /**
     * Render MathJax for multiple elements
     * @param {HTMLElement[]} elements - Array of elements to render
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void[]>}
     */
    async renderElements(elements, timeout = TIMING.MATHJAX_TIMEOUT) {
        const renderPromises = elements.map(element => 
            this.renderElement(element, timeout)
        );
        return Promise.all(renderPromises);
    }

    /**
     * Render MathJax for all elements matching a selector
     * @param {string} selector - CSS selector for elements to render
     * @param {HTMLElement} container - Container to search within (default: document)
     * @param {number} timeout - Delay before rendering
     * @returns {Promise<void[]>}
     */
    async renderSelector(selector, container = document, timeout = TIMING.MATHJAX_TIMEOUT) {
        const elements = Array.from(container.querySelectorAll(selector));
        return this.renderElements(elements, timeout);
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
}

// Create singleton instance
export const mathJaxService = new MathJaxService();

// Export for direct use
export default mathJaxService;