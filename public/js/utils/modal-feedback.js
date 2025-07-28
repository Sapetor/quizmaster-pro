/**
 * Modal Feedback System
 * Replaces inline feedback with modal popups to prevent scrolling issues on mobile
 */

import { logger } from '../core/config.js';
import { getTranslation } from './translation-manager.js';

export class ModalFeedback {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.feedbackIcon = null;
        this.feedbackText = null;
        this.scoreDisplay = null;
        this.currentTimer = null;
        
        this.initializeElements();
        this.setupEventListeners();
        
        logger.debug('🎭 Modal Feedback System initialized');
    }

    /**
     * Initialize DOM elements for the modal feedback
     */
    initializeElements() {
        this.overlay = document.getElementById('feedback-modal-overlay');
        this.modal = document.getElementById('feedback-modal');
        this.feedbackIcon = document.getElementById('feedback-icon');
        this.feedbackText = document.getElementById('modal-feedback-text');
        this.scoreDisplay = document.getElementById('modal-score-display');

        if (!this.overlay || !this.modal) {
            logger.error('❌ Modal feedback elements not found in DOM');
            return false;
        }

        return true;
    }

    /**
     * Setup event listeners for modal interactions
     */
    setupEventListeners() {
        if (!this.overlay) return;

        // Close modal on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.hide();
            }
        });

        // Prevent modal from closing when clicking inside the modal
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    /**
     * Show feedback modal with specified state
     * @param {boolean} isCorrect - Whether the answer was correct
     * @param {string} message - Custom feedback message
     * @param {number} score - Score to display
     * @param {number} autoDismissTime - Time in milliseconds to auto-dismiss (default: 3000)
     */
    show(isCorrect, message = null, score = null, autoDismissTime = 3000) {
        if (!this.overlay || !this.modal) {
            logger.error('❌ Cannot show modal feedback - elements not initialized');
            return;
        }

        // Clear any existing timer
        if (this.currentTimer) {
            clearTimeout(this.currentTimer);
            this.currentTimer = null;
        }

        // Set modal state
        this.modal.className = 'feedback-modal';
        this.modal.classList.add(isCorrect ? 'correct' : 'incorrect');

        // Set feedback content
        this.updateContent(isCorrect, message, score);

        // Show modal with animation
        this.overlay.classList.add('active');

        // Prevent body scrolling when modal is open
        document.body.style.overflow = 'hidden';

        // Auto-dismiss after specified time
        if (autoDismissTime > 0) {
            this.currentTimer = setTimeout(() => {
                this.hide();
            }, autoDismissTime);
        }

        logger.debug(`🎭 Modal feedback shown: ${isCorrect ? 'correct' : 'incorrect'}`);
    }

    /**
     * Update modal content based on feedback type
     * @param {boolean} isCorrect - Whether the answer was correct
     * @param {string} message - Custom feedback message
     * @param {number} score - Score to display
     */
    updateContent(isCorrect, message, score) {
        // Set feedback icon
        if (this.feedbackIcon) {
            this.feedbackIcon.textContent = isCorrect ? '✅' : '❌';
        }

        // Set feedback message
        if (this.feedbackText) {
            const feedbackMessage = message || (isCorrect 
                ? getTranslation('correct_answer') || 'Correct!'
                : getTranslation('incorrect_answer') || 'Incorrect!');
            this.feedbackText.textContent = feedbackMessage;
        }

        // Set score display
        if (this.scoreDisplay && score !== null) {
            this.scoreDisplay.textContent = `+${score}`;
            this.scoreDisplay.style.display = 'inline-block';
        } else if (this.scoreDisplay) {
            this.scoreDisplay.style.display = 'none';
        }
    }

    /**
     * Hide the feedback modal
     */
    hide() {
        if (!this.overlay) return;

        // Clear auto-dismiss timer
        if (this.currentTimer) {
            clearTimeout(this.currentTimer);
            this.currentTimer = null;
        }

        // Hide modal with animation
        this.overlay.classList.remove('active');

        // Restore body scrolling
        document.body.style.overflow = '';

        logger.debug('🎭 Modal feedback hidden');
    }

    /**
     * Show correct answer feedback
     * @param {string} message - Custom message (optional)
     * @param {number} score - Score to display (optional)
     * @param {number} autoDismissTime - Auto-dismiss time in ms (default: 3000)
     */
    showCorrect(message = null, score = null, autoDismissTime = 3000) {
        this.show(true, message, score, autoDismissTime);
    }

    /**
     * Show incorrect answer feedback
     * @param {string} message - Custom message (optional)
     * @param {number} score - Score to display (optional)
     * @param {number} autoDismissTime - Auto-dismiss time in ms (default: 3000)
     */
    showIncorrect(message = null, score = null, autoDismissTime = 3000) {
        this.show(false, message, score, autoDismissTime);
    }

    /**
     * Check if modal is currently visible
     * @returns {boolean} True if modal is visible
     */
    isVisible() {
        return this.overlay && this.overlay.classList.contains('active');
    }

    /**
     * Cleanup method to remove event listeners
     */
    destroy() {
        if (this.currentTimer) {
            clearTimeout(this.currentTimer);
            this.currentTimer = null;
        }

        // Remove event listeners would go here if we tracked them
        // For now, they're attached to DOM elements that will be cleaned up automatically

        logger.debug('🎭 Modal Feedback System destroyed');
    }
}

// Create singleton instance
export const modalFeedback = new ModalFeedback();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.modalFeedback = modalFeedback;
}

export default modalFeedback;