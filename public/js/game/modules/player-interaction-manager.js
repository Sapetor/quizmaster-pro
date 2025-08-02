/**
 * Player Interaction Manager Module
 * Handles answer selection, input handling, and player-specific interactions
 * Extracted from game-manager.js for better separation of concerns
 */

import { translationManager, getTranslation, getTrueFalseText } from '../../utils/translation-manager.js';
import { logger } from '../../core/config.js';

export class PlayerInteractionManager {
    constructor(gameStateManager, gameDisplayManager, soundManager, socketManager) {
        this.gameStateManager = gameStateManager;
        this.gameDisplayManager = gameDisplayManager;
        this.soundManager = soundManager;
        this.socketManager = socketManager;
        
        // Bind methods to maintain context
        this.selectAnswer = this.selectAnswer.bind(this);
        this.submitMultipleCorrectAnswer = this.submitMultipleCorrectAnswer.bind(this);
        this.submitNumericAnswer = this.submitNumericAnswer.bind(this);
    }

    /**
     * Handle answer selection for multiple choice
     */
    selectAnswer(answer) {
        const gameState = this.gameStateManager.getGameState();
        
        if (gameState.isHost || gameState.resultShown) {
            logger.debug('Ignoring answer selection - host mode or result already shown');
            return;
        }

        this.gameStateManager.setSelectedAnswer(answer);
        this.highlightSelectedAnswer(answer);
        
        // Auto-submit for multiple choice and true-false
        if (gameState.currentQuestion && 
            (gameState.currentQuestion.type === 'multiple-choice' || gameState.currentQuestion.type === 'true-false')) {
            this.submitAnswer(answer);
        }
        
        logger.debug('Answer selected:', answer);
    }

    /**
     * Highlight the selected answer visually
     */
    highlightSelectedAnswer(answer) {
        logger.debug('Highlighting selected answer:', answer);
        
        // Remove previous selections
        document.querySelectorAll('.player-option, .tf-option').forEach(option => {
            option.classList.remove('selected');
            option.style.background = '';
            option.style.border = '';
            option.style.transform = '';
        });
        
        // Highlight current selection with subtle border
        const selectedOption = document.querySelector(`[data-answer="${answer}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
            selectedOption.style.border = '3px solid var(--color-primary-500)';
            selectedOption.style.transition = 'all 0.2s ease';
            
            // Play selection sound
            if (this.soundManager && this.soundManager.soundsEnabled) {
                this.soundManager.playEnhancedSound(800, 0.1, 'sine', 0.1);
            }
            
            logger.debug('Answer highlighted successfully');
        }
    }

    /**
     * Submit multiple correct answer
     */
    submitMultipleCorrectAnswer() {
        const selectedCheckboxes = document.querySelectorAll('.option-checkbox:checked');
        const selectedAnswers = Array.from(selectedCheckboxes).map(cb => {
            // Get the data-option from the parent .checkbox-option element
            const parentLabel = cb.closest('.checkbox-option');
            return parseInt(parentLabel.getAttribute('data-option'));
        });
        
        if (selectedAnswers.length === 0) {
            this.showError(getTranslation('please_select_at_least_one'));
            return;
        }
        
        logger.debug('Submitting multiple correct answers:', selectedAnswers);
        this.submitAnswer(selectedAnswers);
    }

    /**
     * Submit numeric answer
     */
    submitNumericAnswer() {
        const numericInput = document.getElementById('numeric-answer-input');
        if (!numericInput) {
            logger.error('Numeric input not found');
            return;
        }
        
        const answer = parseFloat(numericInput.value);
        if (isNaN(answer)) {
            this.showError(getTranslation('please_enter_valid_number'));
            return;
        }
        
        logger.debug('Submitting numeric answer:', answer);
        this.submitAnswer(answer);
    }

    /**
     * Submit answer to server
     */
    submitAnswer(answer) {
        const gameState = this.gameStateManager.getGameState();
        
        if (gameState.isHost || gameState.answerSubmitted) {
            logger.debug('Cannot submit answer - host mode or answer already submitted');
            return;
        }

        if (!this.socketManager) {
            logger.error('Socket manager not available for answer submission');
            return;
        }

        logger.debug('Submitting answer:', answer);
        
        // Mark answer as submitted to prevent double submission
        this.gameStateManager.markAnswerSubmitted();
        
        // Store answer locally
        this.gameStateManager.storePlayerAnswer(gameState.playerName, answer);
        
        // Send to server
        this.socketManager.submitAnswer(answer);
        
        // Feedback will be shown by the socket event response (original system)
        
        // Play submission sound
        if (this.soundManager && this.soundManager.soundsEnabled) {
            this.soundManager.playEnhancedSound(1000, 0.2, 'sine', 0.15);
        }
    }

    /**
     * Format answer for display
     */
    formatAnswerForDisplay(answer) {
        const gameState = this.gameStateManager.getGameState();
        const questionType = gameState.currentQuestion?.type;
        
        if (questionType === 'multiple-choice') {
            return `${translationManager.getOptionLetter(answer)}: ${gameState.currentQuestion?.options?.[answer] || answer}`;
        } else if (questionType === 'multiple-correct') {
            return Array.isArray(answer) 
                ? answer.map(a => `${translationManager.getOptionLetter(a)}: ${gameState.currentQuestion?.options?.[a] || a}`).join(', ')
                : answer;
        } else if (questionType === 'true-false') {
            const tfText = getTrueFalseText(); return answer === true || answer === 'true' ? tfText.true : tfText.false;
        } else {
            return answer.toString();
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        logger.error('Player interaction error:', message);
        
        // Create error element
        const errorElement = document.createElement('div');
        errorElement.className = 'player-error-message';
        errorElement.innerHTML = `
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <div class="error-text">${message}</div>
            </div>
        `;
        
        // Style the error
        Object.assign(errorElement.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '15px 25px',
            borderRadius: '8px',
            zIndex: '10000',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
        });
        
        document.body.appendChild(errorElement);
        
        // Remove after delay
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 3000);
    }

    /**
     * Setup event listeners for player interactions
     */
    setupEventListeners() {
        // Multiple choice option clicks
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('player-option')) {
                const answer = parseInt(event.target.dataset.answer);
                if (!isNaN(answer)) {
                    this.selectAnswer(answer);
                }
            }
        });
        
        // True/false option clicks
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('tf-option')) {
                const answer = event.target.dataset.answer === 'true';
                this.selectAnswer(answer);
            }
        });
        
        // Multiple correct submit button
        const mcSubmitBtn = document.getElementById('submit-multiple-correct');
        if (mcSubmitBtn) {
            mcSubmitBtn.addEventListener('click', this.submitMultipleCorrectAnswer);
        }
        
        // Numeric submit button
        const numericSubmitBtn = document.getElementById('submit-numeric');
        if (numericSubmitBtn) {
            numericSubmitBtn.addEventListener('click', this.submitNumericAnswer);
        }
        
        // Enter key for numeric input
        const numericInput = document.getElementById('numeric-answer-input');
        if (numericInput) {
            numericInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.submitNumericAnswer();
                }
            });
        }
        
        logger.debug('Player interaction event listeners setup');
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        // Remove specific event listeners
        const mcSubmitBtn = document.getElementById('submit-multiple-correct');
        if (mcSubmitBtn) {
            mcSubmitBtn.removeEventListener('click', this.submitMultipleCorrectAnswer);
        }
        
        const numericSubmitBtn = document.getElementById('submit-numeric');
        if (numericSubmitBtn) {
            numericSubmitBtn.removeEventListener('click', this.submitNumericAnswer);
        }
        
        logger.debug('Player interaction event listeners removed');
    }

    /**
     * Reset player interaction state
     */
    reset() {
        // Clear selections and all styling - comprehensive approach
        document.querySelectorAll('.player-option, .tf-option, .checkbox-option input, .checkbox-option, .player-checkbox-option').forEach(element => {
            // Remove all possible state classes
            element.classList.remove('selected', 'correct', 'incorrect', 'true-btn', 'false-btn');
            
            if (element.type === 'checkbox') {
                element.checked = false;
            }
            
            // Clear all possible inline style attributes that might cause highlighting/transforms
            element.style.cssText = ''; // Nuclear option - clears ALL inline styles
            
            // Force remove any lingering transform/animation effects by setting them explicitly to defaults
            element.style.transform = 'none';
            element.style.animation = 'none';
            element.style.filter = 'none';
            element.style.transition = 'none';
        });
        
        // Also clear any data-answer elements that might have styling
        document.querySelectorAll('[data-answer]').forEach(element => {
            element.classList.remove('selected', 'correct', 'incorrect');
            element.style.cssText = ''; // Nuclear option - clears ALL inline styles
            element.style.transform = 'none';
            element.style.animation = 'none';
            element.style.filter = 'none';
            element.style.transition = 'none';
        });
        
        // Clear any elements with option-display class (host side)
        document.querySelectorAll('.option-display').forEach(element => {
            element.classList.remove('selected', 'correct', 'incorrect');
            element.style.cssText = '';
            element.style.transform = 'none';
            element.style.animation = 'none';
            element.style.filter = 'none';
        });
        
        // Clear numeric input
        const numericInput = document.getElementById('numeric-answer-input');
        if (numericInput) {
            numericInput.value = '';
        }
        
        // Force a repaint to ensure styles are cleared
        if (typeof window !== 'undefined') {
            // Trigger reflow to ensure all styling changes take effect
            document.body.offsetHeight;
        }
        
        logger.debug('Player interaction state reset - all highlighting, transforms, and animations cleared');
    }
}