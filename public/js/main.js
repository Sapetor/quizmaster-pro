/**
 * QuizMaster Pro Application Entry Point
 * Initializes the modular application
 */

import { QuizGame } from './core/app.js';
import { translationManager } from './utils/translation-manager.js';
import { errorBoundary } from './utils/error-boundary.js';
import { TIMING, logger } from './core/config.js';
import './utils/globals.js'; // Import globals to make them available

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    logger.debug('QuizMaster Pro - Initializing modular application...');
    
    // FOUC Prevention: Apply saved font size immediately (should already be done in HTML head)
    const savedFontSize = localStorage.getItem('globalFontSize') || 'medium';
    if (window.setGlobalFontSize) {
        window.setGlobalFontSize(savedFontSize);
    }
    
    await errorBoundary.safeNetworkOperation(async () => {
        // Initialize translation manager first
        const savedLanguage = localStorage.getItem('language') || 'en';
        logger.debug('Initializing translation manager with language:', savedLanguage);
        
        const success = await translationManager.initialize(savedLanguage);
        if (success) {
            logger.debug('Translation manager initialized successfully');
            
            // Translate the page after initialization
            translationManager.translatePage();
            logger.debug('Page translated with language:', savedLanguage);
            
            // Log memory savings
            const memoryInfo = translationManager.getMemoryInfo();
            logger.debug('Translation memory info:', memoryInfo);
        } else {
            logger.error('Failed to initialize translation manager');
        }
        
        // Initialize the main application
        window.game = new QuizGame();
        logger.debug('QuizGame instance created successfully');
        
        // FOUC Prevention: Remove loading class from body after initialization
        document.body.classList.remove('loading');
        
        // Make sure theme toggle is available globally
        window.toggleTheme = () => {
            logger.debug('Global theme toggle called');
            if (window.game && window.game.toggleTheme) {
                window.game.toggleTheme();
            } else {
                logger.debug('window.game.toggleTheme not available');
            }
        };
        
        // Apply saved theme immediately
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        
        // Update theme toggle icon to match current theme
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️'; // Moon for dark, sun for light
        }
        
        logger.debug('Applied theme:', savedTheme);
        
        // Initialize global font size after DOM is ready
        setTimeout(() => {
            errorBoundary.safeDOMOperation(() => {
                const savedFontSize = localStorage.getItem('globalFontSize') || 'medium';
                logger.debug('Setting global font size to:', savedFontSize);
                if (window.setGlobalFontSize) {
                    window.setGlobalFontSize(savedFontSize);
                    logger.debug('Global font size initialized successfully');
                } else {
                    logger.warn('setGlobalFontSize function not available yet');
                }
            }, 'font-size-init');
        }, TIMING.MATHJAX_RETRY_TIMEOUT);
        
        logger.debug('QuizMaster Pro - Application initialized successfully');
    }, 'app_initialization', () => {
        logger.error('Failed to initialize application');
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h2>Application Error</h2><p>Failed to initialize QuizMaster Pro. Please refresh the page.</p></div>';
    });
});

// Global cleanup on page unload
window.addEventListener('beforeunload', () => {
    logger.debug('Page unloading - performing cleanup...');
    try {
        if (window.game && typeof window.game.cleanup === 'function') {
            window.game.cleanup();
        }
        if (window.game?.gameManager && typeof window.game.gameManager.cleanup === 'function') {
            window.game.gameManager.cleanup();
        }
        if (window.game?.quizManager && typeof window.game.quizManager.cleanup === 'function') {
            window.game.quizManager.cleanup();
        }
        logger.debug('Global cleanup completed');
    } catch (error) {
        logger.error('Error during global cleanup:', error);
    }
});

// Also handle visibility change (tab switching, minimizing)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        logger.debug('Page hidden - performing partial cleanup...');
        try {
            if (window.game?.gameManager && typeof window.game.gameManager.clearTimerTracked === 'function' && window.game.gameManager.timer) {
                // Clear main game timer to prevent unnecessary ticking when page is hidden
                window.game.gameManager.clearTimerTracked(window.game.gameManager.timer);
                window.game.gameManager.timer = null;
                logger.debug('Main game timer cleared while page hidden');
            }
        } catch (error) {
            logger.error('Error during partial cleanup:', error);
        }
    }
});