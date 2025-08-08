/**
 * Game State UI Manager
 * Automatically manages UI visibility and layout based on game state
 * Provides immersive gameplay experience by hiding non-essential UI
 */

import { logger } from '../core/config.js';
import { dom } from './dom.js';

export class GameStateManager {
    constructor() {
        this.currentState = 'lobby';
        this.previousState = null;
        this.uiRevealTimer = null;
        this.autoHideTimer = null;
        this.gestureStartY = 0;
        this.gestureThreshold = 50; // pixels
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupGestureNavigation();
        
        logger.debug('🎮 Game State Manager initialized');
    }

    /**
     * Initialize DOM elements for state management
     */
    initializeElements() {
        this.container = document.querySelector('.container');
        this.header = document.querySelector('header');
        this.horizontalToolbar = document.querySelector('.horizontal-toolbar');
        
        // Create floating controls if they don't exist
        this.createFloatingControls();
        
        // Create UI reveal button if it doesn't exist
        this.createUIRevealButton();
    }

    /**
     * Create floating action controls for essential game functions
     */
    createFloatingControls() {
        let floatingControls = document.querySelector('.floating-controls');
        if (!floatingControls) {
            floatingControls = document.createElement('div');
            floatingControls.className = 'floating-controls';
            floatingControls.innerHTML = `
                <button class="floating-control-btn" id="floating-menu" title="Menu">
                    ☰
                </button>
                <button class="floating-control-btn" id="floating-theme" title="Toggle Theme">
                    🌙
                </button>
                <button class="floating-control-btn" id="floating-fullscreen" title="Fullscreen">
                    ⛶
                </button>
            `;
            document.body.appendChild(floatingControls);
            
            // Setup floating controls event listeners
            this.setupFloatingControlsEvents();
        }
    }

    /**
     * Create UI reveal button for quick access to hidden UI
     */
    createUIRevealButton() {
        let uiReveal = document.querySelector('.game-ui-reveal');
        if (!uiReveal) {
            uiReveal = document.createElement('div');
            uiReveal.className = 'game-ui-reveal';
            uiReveal.innerHTML = `
                <button class="floating-control-btn" id="ui-reveal-btn" title="Show UI">
                    ⬇️
                </button>
            `;
            document.body.appendChild(uiReveal);
            
            // Setup UI reveal event listener
            document.getElementById('ui-reveal-btn').addEventListener('click', () => {
                this.temporaryUIReveal();
            });
        }
    }

    /**
     * Setup event listeners for state management
     */
    setupEventListeners() {
        // Listen for game events to automatically change states
        document.addEventListener('game-state-change', (event) => {
            this.setState(event.detail.state, event.detail.options);
        });
        
        // Listen for escape key to reveal UI temporarily
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.currentState === 'playing') {
                this.temporaryUIReveal();
            }
        });
        
        // Auto-hide UI after period of inactivity during gameplay
        let inactivityTimer;
        const resetInactivityTimer = () => {
            clearTimeout(inactivityTimer);
            if (this.currentState === 'playing') {
                inactivityTimer = setTimeout(() => {
                    this.hideUI();
                }, 10000); // Hide after 10 seconds of inactivity
            }
        };
        
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('touchstart', resetInactivityTimer);
        document.addEventListener('keydown', resetInactivityTimer);
    }

    /**
     * Setup gesture navigation for mobile UI control
     */
    setupGestureNavigation() {
        let gestureElement = document.body;
        
        gestureElement.addEventListener('touchstart', (e) => {
            this.gestureStartY = e.touches[0].clientY;
        }, { passive: true });
        
        gestureElement.addEventListener('touchmove', (e) => {
            if (this.currentState !== 'playing') return;
            
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - this.gestureStartY;
            
            // Swipe down from top to reveal UI
            if (deltaY > this.gestureThreshold && this.gestureStartY < 100) {
                this.gestureUIReveal();
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Setup floating controls event listeners
     */
    setupFloatingControlsEvents() {
        const floatingMenu = document.getElementById('floating-menu');
        const floatingTheme = document.getElementById('floating-theme');
        const floatingFullscreen = document.getElementById('floating-fullscreen');
        
        if (floatingMenu) {
            floatingMenu.addEventListener('click', () => {
                this.temporaryUIReveal();
            });
        }
        
        if (floatingTheme) {
            floatingTheme.addEventListener('click', () => {
                if (window.toggleTheme) {
                    window.toggleTheme();
                }
            });
        }
        
        if (floatingFullscreen) {
            floatingFullscreen.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
    }

    /**
     * Set the current game state and apply appropriate UI changes
     * @param {string} state - The game state: 'lobby', 'editing', 'playing', 'results'
     * @param {object} options - Additional options for state transition
     */
    setState(state, options = {}) {
        if (this.currentState === state) return;
        
        logger.debug(`🎮 Game state changing: ${this.currentState} → ${state}`);
        
        this.previousState = this.currentState;
        this.currentState = state;
        
        // Remove all game state classes
        this.container.classList.remove(
            'game-state-lobby',
            'game-state-editing', 
            'game-state-playing',
            'game-state-results',
            'ui-revealed',
            'gesture-reveal',
            'show-floating-controls'
        );
        
        // Apply new state class
        this.container.classList.add(`game-state-${state}`);
        
        // Handle state-specific logic
        switch (state) {
            case 'playing':
                this.enterPlayingState(options);
                break;
            case 'lobby':
                this.enterLobbyState(options);
                break;
            case 'editing':
                this.enterEditingState(options);
                break;
            case 'results':
                this.enterResultsState(options);
                break;
        }
        
        // Dispatch state change event for other components
        document.dispatchEvent(new CustomEvent('game-ui-state-changed', {
            detail: { state, previousState: this.previousState, options }
        }));
        
        logger.debug(`🎮 Game state changed to: ${state}`);
    }

    /**
     * Enter playing state - immersive gameplay mode
     */
    enterPlayingState(options = {}) {
        // Show floating controls after a delay
        setTimeout(() => {
            this.container.classList.add('show-floating-controls');
        }, 1000);
        
        // Set up auto-hide for floating controls
        this.setupAutoHideFloatingControls();
        
        logger.debug('🎮 Entered playing state - UI minimized for immersive experience');
    }

    /**
     * Enter lobby state - full UI visibility
     */
    enterLobbyState(options = {}) {
        // Clear any auto-hide timers
        this.clearAutoHideTimers();
        
        logger.debug('🎮 Entered lobby state - full UI visibility');
    }

    /**
     * Enter editing state - enhanced UI for quiz creation
     */
    enterEditingState(options = {}) {
        // Clear any auto-hide timers
        this.clearAutoHideTimers();
        
        logger.debug('🎮 Entered editing state - enhanced UI for quiz creation');
    }

    /**
     * Enter results state - celebration-optimized UI
     */
    enterResultsState(options = {}) {
        // Clear any auto-hide timers
        this.clearAutoHideTimers();
        
        // Prepare for confetti and celebration animations
        logger.debug('🎮 Entered results state - optimized for celebration');
    }

    /**
     * Temporarily reveal UI during gameplay
     */
    temporaryUIReveal(duration = 5000) {
        if (this.currentState !== 'playing') return;
        
        this.container.classList.add('ui-revealed');
        
        // Clear existing timer
        if (this.uiRevealTimer) {
            clearTimeout(this.uiRevealTimer);
        }
        
        // Auto-hide after duration
        this.uiRevealTimer = setTimeout(() => {
            this.hideUI();
        }, duration);
        
        logger.debug('🎮 UI temporarily revealed for 5 seconds');
    }

    /**
     * Gesture-based UI reveal
     */
    gestureUIReveal() {
        if (this.currentState !== 'playing') return;
        
        this.container.classList.add('gesture-reveal');
        
        // Auto-hide after shorter duration for gestures
        setTimeout(() => {
            this.container.classList.remove('gesture-reveal');
        }, 3000);
        
        logger.debug('🎮 UI revealed via gesture');
    }

    /**
     * Hide UI (return to immersive mode)
     */
    hideUI() {
        this.container.classList.remove('ui-revealed', 'gesture-reveal');
        
        if (this.uiRevealTimer) {
            clearTimeout(this.uiRevealTimer);
            this.uiRevealTimer = null;
        }
        
        logger.debug('🎮 UI hidden - returned to immersive mode');
    }

    /**
     * Setup auto-hide for floating controls
     */
    setupAutoHideFloatingControls() {
        // Hide floating controls after inactivity
        this.autoHideTimer = setTimeout(() => {
            this.container.classList.remove('show-floating-controls');
        }, 15000); // Hide after 15 seconds
    }

    /**
     * Clear all auto-hide timers
     */
    clearAutoHideTimers() {
        if (this.uiRevealTimer) {
            clearTimeout(this.uiRevealTimer);
            this.uiRevealTimer = null;
        }
        
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen().catch(err => {
                logger.warn('🎮 Fullscreen request failed:', err);
            });
        }
    }

    /**
     * Get current game state
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * Check if UI is currently revealed
     */
    isUIRevealed() {
        return this.container.classList.contains('ui-revealed') || 
               this.container.classList.contains('gesture-reveal');
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.clearAutoHideTimers();
        // Remove event listeners would go here if we tracked them
        logger.debug('🎮 Game State Manager destroyed');
    }
}

// Create singleton instance
export const gameStateManager = new GameStateManager();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.gameStateManager = gameStateManager;
}

export default gameStateManager;