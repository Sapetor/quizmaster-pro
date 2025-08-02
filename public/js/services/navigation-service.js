/**
 * Navigation Service
 * Provides a centralized interface for game navigation without tight coupling
 */

import { logger } from '../core/config.js';

export class NavigationService {
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    /**
     * Navigate based on game state
     * @param {Object} gameState - Current game state
     * @param {string} targetContext - Context for navigation (e.g., 'leaderboard', 'final', 'game')
     */
    navigateBasedOnState(gameState, targetContext = 'leaderboard') {
        logger.debug('Navigation service - navigating based on state:', { gameState, targetContext });
        
        switch (targetContext) {
            case 'leaderboard':
                this.navigateToLeaderboard(gameState);
                break;
            case 'final':
                this.navigateToFinalScreen(gameState);
                break;
            case 'game':
                this.navigateToGameScreen(gameState);
                break;
            default:
                logger.warn('Unknown navigation context:', targetContext);
        }
    }

    /**
     * Navigate to appropriate leaderboard screen
     */
    navigateToLeaderboard(gameState) {
        if (gameState.isHost) {
            this.uiManager.showScreen('leaderboard-screen');
            logger.debug('Navigated to host leaderboard screen');
        } else {
            this.uiManager.showScreen('player-game-screen');
            logger.debug('Navigated to player game screen');
        }
    }

    /**
     * Navigate to appropriate final results screen
     */
    navigateToFinalScreen(gameState) {
        if (gameState.isHost) {
            this.uiManager.showScreen('leaderboard-screen');
            logger.debug('Navigated to host final results screen');
        } else {
            this.uiManager.showScreen('player-final-screen');
            logger.debug('Navigated to player final screen');
        }
    }

    /**
     * Navigate to appropriate game screen
     */
    navigateToGameScreen(gameState) {
        if (gameState.isHost) {
            this.uiManager.showScreen('host-game-screen');
            logger.debug('Navigated to host game screen');
        } else {
            this.uiManager.showScreen('player-game-screen');
            logger.debug('Navigated to player game screen');
        }
    }

    /**
     * Navigate to specific screen directly
     */
    navigateTo(screenId) {
        this.uiManager.showScreen(screenId);
        logger.debug('Direct navigation to:', screenId);
    }
}