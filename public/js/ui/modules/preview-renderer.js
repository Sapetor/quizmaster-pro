/**
 * Preview Renderer Module
 * Handles all rendering logic for preview questions, answer types, and MathJax
 * Extracted from PreviewManager for better separation of concerns
 */

import { translationManager } from '../../utils/translation-manager.js';
import { simpleMathJaxService } from '../../utils/simple-mathjax-service.js';
import { logger } from '../../core/config.js';

export class PreviewRenderer {
    constructor() {
        this.mathJaxService = simpleMathJaxService;
        this.mathJaxRenderingInProgress = false;
    }

    /**
     * Render a complete question preview
     */
    renderSplitQuestionPreview(data) {
        logger.debug('Rendering split question preview:', data);
        
        // Clear previous content and reset states
        this.clearAllSplitAnswerTypes();
        
        // Render question text
        this.renderSplitQuestionText(data.question);
        
        // Render answer type
        this.renderSplitAnswerType(data);
        
        // Update counter
        this.updateSplitQuestionCounter(data.questionNumber, data.totalQuestions);
        
        // Handle image if present
        if (data.image) {
            this.handleSplitQuestionImage(data.image);
        }
    }

    /**
     * Render question text with LaTeX support
     */
    renderSplitQuestionText(questionText) {
        const previewElement = document.getElementById('preview-question-text-split');
        
        if (!previewElement) {
            logger.warn('Preview question text element not found');
            return;
        }
        
        if (questionText) {
            this.renderSplitTextWithLatex(previewElement, questionText);
        } else {
            previewElement.innerHTML = '<em>No question text</em>';
        }
    }

    /**
     * Render text with LaTeX support and fallback handling
     */
    renderSplitTextWithLatex(element, text) {
        if (!element || !text) {
            logger.warn('Invalid element or text for LaTeX rendering');
            return;
        }
        
        // Clear previous content
        element.innerHTML = '';
        element.style.opacity = '0';
        element.style.display = 'block';
        
        // Format code blocks first
        const formattedContent = this.formatCodeBlocks(text);
        
        // Set content first
        element.innerHTML = formattedContent;
        element.style.opacity = '0';
        element.style.display = 'block';
        
        // Check for LaTeX content
        const hasLatex = this.mathJaxService.hasLatex(formattedContent);
        
        if (hasLatex) {
            logger.debug('LaTeX content detected, rendering with MathJax');
            element.classList.add('tex2jax_process');
            
            // Use simplified MathJax service
            this.mathJaxService.render([element]).then(() => {
                element.style.opacity = '1';
                logger.debug('MathJax rendering completed successfully');
            }).catch(error => {
                logger.warn('MathJax rendering failed, showing fallback:', error);
                this.showSplitFallbackText(element);
            });
            
        } else {
            // No LaTeX, show directly
            element.style.opacity = '1';
            logger.debug('Plain text rendering completed');
        }
    }

    /**
     * Show fallback text when MathJax fails
     */
    showSplitFallbackText(element) {
        if (element) {
            element.innerHTML = element.innerHTML.replace(/\$\$([^$]+)\$\$/g, '[$1]').replace(/\$([^$]+)\$/g, '[$1]');
            element.style.opacity = '1';
            logger.debug('Fallback text displayed');
        }
    }

    /**
     * Handle question image display
     */
    handleSplitQuestionImage(imageData) {
        const imageDisplay = document.getElementById('preview-question-image-split');
        const img = imageDisplay?.querySelector('img');
        
        if (imageData && imageDisplay && img) {
            imageDisplay.style.display = 'block';
            this.setupSplitImageHandlers(img, imageDisplay, imageData);
            this.setSplitImageSource(img, imageData);
        }
    }

    /**
     * Setup image event handlers
     */
    setupSplitImageHandlers(img, imageDisplay, imageData) {
        img.onload = () => {
            logger.debug('Preview image loaded successfully');
            imageDisplay.classList.remove('loading');
        };
        
        img.onerror = () => {
            this.showSplitImageError(imageDisplay, imageData);
        };
    }

    /**
     * Set image source with data URI or path handling
     */
    setSplitImageSource(img, imageData) {
        if (imageData.startsWith('data:')) {
            img.src = imageData;
        } else {
            img.src = `/uploads/${imageData}`;
        }
    }

    /**
     * Show image error state
     */
    showSplitImageError(imageDisplay, imageData) {
        logger.error('Failed to load preview image:', imageData);
        
        let errorMsg = imageDisplay.querySelector('.image-error');
        if (!errorMsg) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'image-error';
            errorMsg.innerHTML = `
                <div class="error-icon">🖼️</div>
                <div class="error-text">Image failed to load</div>
                <div class="error-details">Check if the image file exists</div>
            `;
            imageDisplay.appendChild(errorMsg);
        }
        
        imageDisplay.classList.remove('loading');
        this.logSplitImageError(imageData, imageDisplay, imageDisplay.querySelector('img'));
    }

    /**
     * Log detailed image error information
     */
    logSplitImageError(imageData, imageDisplay, img) {
        logger.error('Image Error Details:', {
            imageData: imageData ? imageData.substring(0, 100) + '...' : 'null',
            imageDisplay: !!imageDisplay,
            img: !!img,
            imgSrc: img?.src || 'not set'
        });
    }

    /**
     * Clear all answer type displays and images
     */
    clearAllSplitAnswerTypes() {
        this.resetSplitAnswerStates();
        
        // Hide all answer containers
        const containerIds = [
            'preview-multiple-choice-split',
            'preview-multiple-correct-split', 
            'preview-true-false-split',
            'preview-numeric-split'
        ];
        
        this.hideSplitAnswerContainers(containerIds);
        
        // Clear and hide question image
        this.clearSplitQuestionImage();
    }

    /**
     * Clear and hide question image
     */
    clearSplitQuestionImage() {
        const imageDisplay = document.getElementById('preview-question-image-split');
        const img = imageDisplay?.querySelector('img');
        
        if (imageDisplay) {
            imageDisplay.style.display = 'none';
            imageDisplay.classList.remove('loading');
        }
        
        if (img) {
            img.src = '';
            img.onload = null;
            img.onerror = null;
        }
        
        // Remove any error messages
        const errorMsg = imageDisplay?.querySelector('.image-error');
        if (errorMsg) {
            errorMsg.remove();
        }
        
        logger.debug('Question image cleared and hidden');
    }

    /**
     * Hide specified answer containers
     */
    hideSplitAnswerContainers(containerIds) {
        containerIds.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.style.display = 'none';
            }
        });
    }

    /**
     * Reset answer states and clear content
     */
    resetSplitAnswerStates() {
        // Clear multiple choice content
        this.clearSplitAnswerContent('multiple-choice');
        
        // Clear multiple correct content  
        this.clearSplitAnswerContent('multiple-correct');
        
        // Reset true/false buttons
        this.resetSplitTrueFalseButtons('true-false');
        
        // Clear numeric input
        this.resetSplitInputFields('numeric');
    }

    /**
     * Clear answer content for specific type
     */
    clearSplitAnswerContent(type) {
        const playerOptions = document.querySelector(`#preview-${type}-split .player-options`);
        if (playerOptions) {
            playerOptions.innerHTML = '';
        }
        
        const checkboxOptions = document.querySelector(`#preview-${type}-split .player-checkbox-options`);
        if (checkboxOptions) {
            checkboxOptions.innerHTML = '';
        }
    }

    /**
     * Reset true/false button states
     */
    resetSplitTrueFalseButtons(type) {
        const tfContainer = document.getElementById(`preview-${type}-split`);
        if (tfContainer) {
            const buttons = tfContainer.querySelectorAll('.tf-option');
            buttons.forEach(button => {
                button.classList.remove('correct', 'selected');
                button.style.background = '';
                button.style.border = '';
                button.style.transform = '';
            });
        }
    }

    /**
     * Reset input fields
     */
    resetSplitInputFields(type) {
        const input = document.querySelector(`#preview-${type}-split input`);
        if (input) {
            input.value = '';
        }
    }

    /**
     * Render appropriate answer type based on question data
     */
    renderSplitAnswerType(data) {
        // Hide all containers first
        this.clearAllSplitAnswerTypes();
        
        // Show and populate the correct container
        switch (data.type) {
            case 'multiple-choice':
                document.getElementById('preview-multiple-choice-split').style.display = 'block';
                this.renderSplitMultipleChoicePreview(data.options, data.correctAnswer);
                break;
                
            case 'multiple-correct':
                document.getElementById('preview-multiple-correct-split').style.display = 'block';
                this.renderSplitMultipleCorrectPreview(data.options, data.correctAnswers);
                break;
                
            case 'true-false':
                document.getElementById('preview-true-false-split').style.display = 'block';
                this.renderSplitTrueFalsePreview(data.correctAnswer);
                break;
                
            case 'numeric':
                document.getElementById('preview-numeric-split').style.display = 'block';
                this.renderSplitNumericPreview();
                break;
        }
    }

    /**
     * Render multiple choice options preview
     */
    renderSplitMultipleChoicePreview(options, correctAnswer) {
        const container = document.getElementById('preview-multiple-choice-split');
        const optionsContainer = container?.querySelector('.player-options');
        
        if (!container || !optionsContainer) {
            logger.warn('Multiple choice preview containers not found');
            return;
        }
        
        optionsContainer.innerHTML = '';
        
        if (!options || options.length === 0) {
            optionsContainer.innerHTML = '<p><em>No options defined</em></p>';
            return;
        }
        
        options.forEach((option, index) => {
            if (!option || option.trim() === '' || option === 'Option text') {
                return;
            }
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'player-option preview-option';
            optionDiv.setAttribute('data-option', index);
            
            // Add correct answer styling
            if (index === correctAnswer) {
                optionDiv.classList.add('correct');
            }
            
            const optionLetter = translationManager.getOptionLetter(index);
            const hasLatex = this.hasLatexContent(option);
            const formattedContent = `${optionLetter}: ${this.formatCodeBlocks(option)}`;
            
            this.renderOptionWithLatex(optionDiv, formattedContent, optionsContainer, hasLatex);
        });
    }

    /**
     * Render multiple correct options preview
     */
    renderSplitMultipleCorrectPreview(options, correctAnswers) {
        const container = document.getElementById('preview-multiple-correct-split');
        const optionsContainer = container?.querySelector('.player-checkbox-options');
        
        if (!container || !optionsContainer) {
            logger.warn('Multiple correct preview containers not found');
            return;
        }
        
        optionsContainer.innerHTML = '';
        
        logger.debug('Multiple correct preview data:', { options, correctAnswers });
        
        if (!options || options.length === 0) {
            optionsContainer.innerHTML = '<p><em>No options defined</em></p>';
            return;
        }
        
        options.forEach((option, index) => {
            if (!option || option.trim() === '' || option === 'Option text') {
                return;
            }
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'checkbox-option preview-checkbox';
            optionDiv.setAttribute('data-option', index);
            
            const isCorrect = correctAnswers && correctAnswers.includes(index);
            
            // Add correct answer styling
            if (isCorrect) {
                optionDiv.classList.add('correct-preview');
            }
            
            const optionLetter = translationManager.getOptionLetter(index);
            const hasLatex = this.hasLatexContent(option);
            const formattedContent = `<input type="checkbox" ${isCorrect ? 'checked' : ''} disabled> ${optionLetter}: ${this.formatCodeBlocks(option)}`;
            
            this.renderOptionWithLatex(optionDiv, formattedContent, optionsContainer, hasLatex);
        });
    }

    /**
     * Render true/false preview
     */
    renderSplitTrueFalsePreview(correctAnswer) {
        const container = document.getElementById('preview-true-false-split');
        const tfContainer = container?.querySelector('.true-false-options');
        
        if (!container || !tfContainer) {
            logger.warn('True/false preview containers not found');
            return;
        }
        
        const trueOption = tfContainer.querySelector('.tf-option[data-answer="true"]');
        const falseOption = tfContainer.querySelector('.tf-option[data-answer="false"]');
        
        if (trueOption && falseOption) {
            // Reset styles
            [trueOption, falseOption].forEach(option => {
                option.classList.remove('correct');
            });
            
            // Mark correct answer
            if (correctAnswer === true) {
                trueOption.classList.add('correct');
            }
            if (correctAnswer === false) {
                falseOption.classList.add('correct');
            }
        }
    }

    /**
     * Render numeric input preview
     */
    renderSplitNumericPreview() {
        const container = document.getElementById('preview-numeric-split');
        const input = container?.querySelector('input');
        
        if (input) {
            input.placeholder = 'Enter numeric answer...';
            input.disabled = true;
        }
    }

    /**
     * Update question counter display
     */
    updateSplitQuestionCounter(questionNumber, totalQuestions) {
        const counterDisplay = document.getElementById('preview-question-counter-split');
        if (counterDisplay) {
            counterDisplay.textContent = `${questionNumber}/${totalQuestions}`;
        }
    }

    /**
     * Check if text contains LaTeX expressions (delegated to service)
     */
    hasLatexContent(text) {
        return this.mathJaxService.hasLatex(text);
    }

    /**
     * Render option with LaTeX support
     */
    renderOptionWithLatex(optionDiv, formattedContent, container, hasLatex) {
        if (hasLatex) {
            this.renderLatexOption(optionDiv, formattedContent, container);
        } else {
            this.renderPlainOption(optionDiv, formattedContent, container);
        }
    }

    /**
     * Render option with LaTeX content
     */
    renderLatexOption(optionDiv, formattedContent, container) {
        optionDiv.innerHTML = formattedContent;
        optionDiv.classList.add('tex2jax_process');
        optionDiv.style.opacity = '0';
        
        container.appendChild(optionDiv);
        
        // Use simplified MathJax service for option rendering
        this.mathJaxService.render([optionDiv]).then(() => {
            optionDiv.style.opacity = '1';
            logger.debug('Option MathJax rendering completed');
        }).catch(error => {
            logger.warn('MathJax option rendering error:', error);
            optionDiv.style.opacity = '1'; // Show anyway
        });
    }

    /**
     * Render plain text option
     */
    renderPlainOption(optionDiv, formattedContent, container) {
        optionDiv.innerHTML = formattedContent;
        optionDiv.style.opacity = '1';
        container.appendChild(optionDiv);
    }


    /**
     * Format code blocks in text
     */
    formatCodeBlocks(text) {
        if (!text) return '';
        
        // Replace code blocks with styled spans
        return text
            .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    /**
     * Render MathJax for preview elements (simplified)
     */
    renderMathJaxForPreview() {
        if (this.mathJaxRenderingInProgress) {
            logger.debug('MathJax rendering already in progress, skipping');
            return;
        }
        
        this.mathJaxRenderingInProgress = true;
        
        try {
            // Use simplified service to render all preview elements
            this.mathJaxService.renderAll(document.querySelector('.preview-content-split')).finally(() => {
                this.mathJaxRenderingInProgress = false;
            });
        } catch (error) {
            logger.warn('Preview MathJax rendering error:', error);
            this.mathJaxRenderingInProgress = false;
        }
    }
}