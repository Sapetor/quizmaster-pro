/**
 * Game Display Manager Module  
 * Handles question display, UI rendering, and DOM manipulation
 * Extracted from game-manager.js for better separation of concerns
 */

import { translationManager } from '../../utils/translation-manager.js';
import { logger } from '../../core/config.js';
import { MathRenderer } from '../../utils/math-renderer.js';
import { mathJaxService } from '../../utils/mathjax-service.js';

export class GameDisplayManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.mathRenderer = new MathRenderer();
    }

    /**
     * Get question DOM elements
     */
    getQuestionElements() {
        return {
            hostQuestionElement: document.getElementById('current-question'),
            questionElement: document.getElementById('player-question-text'),
            hostOptionsContainer: document.getElementById('host-options-container')
        };
    }

    /**
     * Update question counter display
     */
    updateQuestionCounter(current, total) {
        const counterElement = document.getElementById('question-counter');
        if (counterElement) {
            counterElement.textContent = translationManager.getTranslationSync('question_x_of_y', [current, total]);
            logger.debug('Question counter updated:', current, 'of', total);
        }
    }

    /**
     * Update player question counter
     */
    updatePlayerQuestionCounter(current, total) {
        const counterElement = document.getElementById('player-question-counter');
        if (counterElement) {
            counterElement.textContent = translationManager.getTranslationSync('question_x_of_y', [current, total]);
            logger.debug('Player question counter updated:', current, 'of', total);
        }
    }

    /**
     * Update question image display for host or player
     */
    updateQuestionImage(data, containerId) {
        logger.debug(`updateQuestionImage called with containerId: ${containerId}, image: ${data.image}`);
        const imageContainer = document.getElementById(containerId);
        if (!imageContainer) {
            logger.debug(`Image container ${containerId} not found`);
            logger.debug(`Image container ${containerId} not found`);
            return;
        }
        
        if (data.image && data.image.trim()) {
            logger.debug(`Displaying image for question: ${data.image}`);
            logger.debug(`Displaying image for question: ${data.image}`);
            
            // Create or update image element
            let img = imageContainer.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.className = 'question-image';
                img.style.maxWidth = '100%';
                img.style.maxHeight = '300px';
                img.style.height = 'auto';
                img.style.borderRadius = '8px';
                img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                img.style.margin = '15px 0';
                imageContainer.appendChild(img);
            }
            
            // Set image source and alt text
            img.src = data.image.startsWith('http') ? data.image : `/${data.image}`;
            img.alt = 'Question Image';
            
            // Show the container
            imageContainer.style.display = 'block';
            logger.debug(`Image container ${containerId} shown with image: ${img.src}`);
        } else {
            // Hide the container if no image
            logger.debug(`No image for question, hiding container ${containerId}`);
            imageContainer.style.display = 'none';
            logger.debug(`No image for question, hiding container ${containerId}`);
        }
    }

    /**
     * Render MathJax for question content
     */
    async renderQuestionMath(element, delay = 100) {
        if (!element) return;
        
        try {
            await mathJaxService.renderElement(element, delay);
            logger.debug('MathJax rendering completed for question');
        } catch (err) {
            logger.error('MathJax question render error:', err);
        }
    }

    /**
     * Format and display question text
     */
    displayQuestionText(element, questionText) {
        if (!element) return;
        
        element.innerHTML = this.mathRenderer.formatCodeBlocks(questionText);
        logger.debug('Question text displayed');
        
        // Render MathJax after content update
        this.renderQuestionMath(element, 100);
    }

    /**
     * Show answer submitted feedback
     */
    showAnswerSubmitted(answer) {
        logger.debug('Showing answer submitted feedback for:', answer);
        
        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = 'answer-submitted-feedback';
        feedback.innerHTML = `
            <div class="feedback-content">
                <div class="feedback-icon">✓</div>
                <div class="feedback-text">${translationManager.getTranslationSync('answer_submitted')}</div>
                <div class="feedback-answer">${translationManager.getTranslationSync('your_answer')}: ${answer}</div>
            </div>
        `;
        
        // Style the feedback
        Object.assign(feedback.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(46, 204, 113, 0.95)',
            color: 'white',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            zIndex: '10000',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        });
        
        document.body.appendChild(feedback);
        
        // Animate in
        feedback.style.opacity = '0';
        feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
        
        requestAnimationFrame(() => {
            feedback.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            feedback.style.opacity = '1';
            feedback.style.transform = 'translate(-50%, -50%) scale(1)';
        });
        
        // Remove after delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 2000);
    }

    /**
     * Clear question display
     */
    clearQuestionDisplay() {
        const elements = this.getQuestionElements();
        
        // Clear question text
        if (elements.hostQuestionElement) {
            elements.hostQuestionElement.innerHTML = '';
        }
        if (elements.questionElement) {
            elements.questionElement.innerHTML = '';
        }
        
        // Clear options container
        if (elements.hostOptionsContainer) {
            elements.hostOptionsContainer.innerHTML = '';
        }
        
        // Hide image containers
        this.updateQuestionImage({ image: '' }, 'question-image-display');
        this.updateQuestionImage({ image: '' }, 'player-question-image');
        
        logger.debug('Question display cleared');
    }

    /**
     * Show loading state
     */
    showLoadingState(message = 'Loading...') {
        const loadingElement = document.createElement('div');
        loadingElement.id = 'game-loading';
        loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        // Style the loading element
        Object.assign(loadingElement.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '9999'
        });
        
        document.body.appendChild(loadingElement);
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const loadingElement = document.getElementById('game-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}