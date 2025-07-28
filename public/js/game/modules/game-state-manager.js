/**
 * Game State Manager Module
 * Handles game state, timers, and flow control
 * Extracted from game-manager.js for better separation of concerns
 */

import { logger } from '../../core/config.js';

export class GameStateManager {
    constructor() {
        // Game state
        this.isHost = false;
        this.playerName = '';
        this.currentQuestion = null;
        this.timer = null;
        this.gamePin = null;
        this.selectedAnswer = null;
        this.playerAnswers = new Map();
        this.gameEnded = false;
        this.resultShown = false;
    }

    /**
     * Initialize game state for new question
     */
    initializeQuestionState(data) {
        logger.debug('Initializing question state:', data);
        
        this.currentQuestion = data;
        this.selectedAnswer = null;
        this.resultShown = false;
        
        // Clear any existing timer
        this.stopTimer();
        
        // Set host/player mode based on player name
        if (this.playerName && this.playerName !== 'Host' && this.isHost !== false) {
            this.isHost = false;
            logger.debug('Setting player mode for:', this.playerName);
        }
        
        logger.debug('Game state initialized for question:', data.questionNumber);
    }

    /**
     * Start countdown timer
     */
    startTimer(duration, onTick, onComplete) {
        this.stopTimer(); // Clear any existing timer
        
        let timeLeft = duration;
        // logger.debug('Starting timer:', timeLeft, 'seconds');
        
        this.timer = setInterval(() => {
            timeLeft--;
            
            if (onTick) {
                onTick(timeLeft);
            }
            
            if (timeLeft <= 0) {
                this.stopTimer();
                if (onComplete) {
                    onComplete();
                }
            }
        }, 1000);
    }

    /**
     * Stop the current timer
     */
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            // logger.debug('Timer stopped');
        }
    }

    /**
     * Set selected answer
     */
    setSelectedAnswer(answer) {
        this.selectedAnswer = answer;
        logger.debug('Answer selected:', answer);
    }

    /**
     * Get current game state
     */
    getGameState() {
        return {
            isHost: this.isHost,
            playerName: this.playerName,
            currentQuestion: this.currentQuestion,
            selectedAnswer: this.selectedAnswer,
            gameEnded: this.gameEnded,
            resultShown: this.resultShown,
            hasTimer: !!this.timer
        };
    }

    /**
     * Set host mode
     */
    setHostMode(isHost = true) {
        this.isHost = isHost;
        logger.debug('Host mode set to:', isHost);
    }

    /**
     * Set player name
     */
    setPlayerName(name) {
        this.playerName = name;
        logger.debug('Player name set to:', name);
    }

    /**
     * Set game PIN
     */
    setGamePin(pin) {
        this.gamePin = pin;
        logger.debug('Game PIN set to:', pin);
    }

    /**
     * Mark game as ended
     */
    endGame() {
        this.gameEnded = true;
        this.stopTimer();
        logger.debug('Game ended');
    }

    /**
     * Mark result as shown
     */
    markResultShown() {
        this.resultShown = true;
        logger.debug('Result marked as shown');
    }

    /**
     * Reset game state
     */
    reset() {
        this.stopTimer();
        this.isHost = false;
        this.playerName = '';
        this.currentQuestion = null;
        this.gamePin = null;
        this.selectedAnswer = null;
        this.playerAnswers.clear();
        this.gameEnded = false;
        this.resultShown = false;
        logger.debug('Game state reset');
    }

    /**
     * Store player answer
     */
    storePlayerAnswer(playerId, answer) {
        this.playerAnswers.set(playerId, answer);
        logger.debug('Stored answer for player:', playerId, answer);
    }

    /**
     * Get player answers
     */
    getPlayerAnswers() {
        return new Map(this.playerAnswers);
    }

    /**
     * Clear player answers
     */
    clearPlayerAnswers() {
        this.playerAnswers.clear();
        logger.debug('Player answers cleared');
    }
}