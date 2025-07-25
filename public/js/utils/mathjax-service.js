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
        setTimeout(() => clearInterval(checkInterval), 10000); // Keep 10s for MathJax loading timeout
        
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
                        
                        // DETECT F5 CORRUPTION: startup=true but document=false indicates corrupted state
                        if (window.MathJax && window.MathJax.startup && !window.MathJax.startup.document) {
                            logger.debug('🚨 CORRUPTION DETECTED: MathJax in corrupted F5 state - forcing reinitialization...');
                            
                            try {
                                // Clear the corrupted MathJax object completely
                                delete window.MathJax;
                                
                                // Force reload MathJax script to get clean state
                                const mathJaxScript = document.querySelector('script[src*="mathjax"]');
                                if (mathJaxScript) {
                                    logger.debug('🔧 Removing and reloading MathJax script...');
                                    
                                    // Remove old script
                                    mathJaxScript.remove();
                                    
                                    // Create new script with cache busting
                                    const newScript = document.createElement('script');
                                    newScript.src = mathJaxScript.src + '?reload=' + Date.now();
                                    newScript.async = true;
                                    
                                    // Wait for new MathJax to load
                                    newScript.onload = () => {
                                        logger.debug('✅ MathJax reloaded successfully');
                                        
                                        // Set up a listener for when new MathJax is ready
                                        const checkNewMathJax = setInterval(() => {
                                            if (window.MathJax && window.MathJax.typesetPromise) {
                                                logger.debug('✅ CORRUPTION FIX SUCCESS: New MathJax is ready');
                                                clearInterval(checkNewMathJax);
                                                
                                                // Now try rendering with the fresh MathJax
                                                window.MathJax.typesetPromise([element]).then(() => {
                                                    logger.debug('✅ REINITIALIZATION SUCCESS: LaTeX rendered with fresh MathJax');
                                                    this.pendingRenders.delete(element);
                                                    resolve();
                                                }).catch(err => {
                                                    logger.warn('⚠️ Fresh MathJax render failed:', err);
                                                    resolve();
                                                });
                                            }
                                        }, 100);
                                        
                                        // Timeout after 3 seconds
                                        setTimeout(() => {
                                            clearInterval(checkNewMathJax);
                                            logger.debug('🔧 Fresh MathJax initialization complete');
                                            resolve();
                                        }, 3000);
                                    };
                                    
                                    newScript.onerror = () => {
                                        logger.error('❌ Failed to reload MathJax script');
                                        resolve();
                                    };
                                    
                                    // Add new script to document
                                    document.head.appendChild(newScript);
                                    return; // Exit early, don't continue with other fallbacks
                                } else {
                                    logger.warn('⚠️ Could not find MathJax script to reload');
                                }
                                
                            } catch (reinitError) {
                                logger.error('❌ MathJax reinitialization failed:', reinitError);
                            }
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