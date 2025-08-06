/**
 * Game Display Manager Module  
 * Handles question display, UI rendering, and DOM manipulation
 * Extracted from game-manager.js for better separation of concerns
 */

import { translationManager, getTranslation } from '../../utils/translation-manager.js';
import { logger } from '../../core/config.js';
import { MathRenderer } from '../../utils/math-renderer.js';
import { simpleMathJaxService } from '../../utils/simple-mathjax-service.js';

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
            hostOptionsContainer: document.getElementById('answer-options')
        };
    }

    /**
     * Update question counter display
     */
    updateQuestionCounter(current, total) {
        const counterElement = document.getElementById('question-counter');
        if (counterElement) {
            counterElement.textContent = getTranslation('question_x_of_y', [current, total]);
            logger.debug('Question counter updated:', current, 'of', total);
        }
    }

    /**
     * Update player question counter
     */
    updatePlayerQuestionCounter(current, total) {
        const counterElement = document.getElementById('player-question-counter');
        if (counterElement) {
            counterElement.textContent = getTranslation('question_x_of_y', [current, total]);
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
            // Set image source with proper path handling
            if (data.image.startsWith('data:')) {
                img.src = data.image; // Data URI
            } else if (data.image.startsWith('http')) {
                img.src = data.image; // Full URL
            } else {
                // Construct proper URL from relative path
                const baseUrl = window.location.origin; // http://localhost:3000
                const imagePath = data.image.startsWith('/') ? data.image : `/${data.image}`;
                img.src = `${baseUrl}${imagePath}`;
            }
            img.alt = 'Question Image';
            
            // Add error handling for debugging
            img.onerror = () => {
                logger.warn('⚠️ Game question image failed to load:', data.image);
                logger.warn('⚠️ Attempted src:', img.src);
            };
            
            img.onload = () => {
                logger.debug('✅ Game question image loaded successfully:', data.image);
            };
            
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
     * Render MathJax for question content with enhanced F5 handling
     */
    async renderQuestionMath(element, delay = 0) {
        if (!element) return;
        
        try {
            // No delay - render immediately for faster LaTeX display
            
            // Check if element still exists in DOM
            if (!document.contains(element)) {
                logger.debug('Element removed from DOM before MathJax rendering, skipping');
                return;
            }
            
            // Use the simplified SimpleMathJaxService
            await simpleMathJaxService.render([element]);
            logger.debug('MathJax rendering completed for question');
            
        } catch (err) {
            logger.warn('MathJax question render error (non-blocking):', err);
            // Don't throw - let the game continue without LaTeX rendering
        }
    }

    /**
     * Format and display question text
     */
    displayQuestionText(element, questionText) {
        if (!element) return;
        
        element.innerHTML = this.mathRenderer.formatCodeBlocks(questionText);
        logger.debug('Question text displayed');
        
        // Render MathJax immediately after content update
        this.renderQuestionMath(element);
    }

    // Answer submission feedback now handled by original modal system in GameManager

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