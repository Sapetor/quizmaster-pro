/**
 * Question Renderer Module
 * Handles all question content rendering, answer options setup, and DOM manipulation
 * Extracted from GameManager for better separation of concerns
 */

import { translationManager, getTranslation, getTrueFalseText } from '../../utils/translation-manager.js';
import { logger, TIMING } from '../../core/config.js';
import { dom } from '../../utils/dom.js';

export class QuestionRenderer {
    constructor(displayManager, stateManager, uiManager, gameManager) {
        this.displayManager = displayManager;
        this.stateManager = stateManager;
        this.uiManager = uiManager;
        this.gameManager = gameManager; // For access to tracked event listeners
    }

    /**
     * Update host display with question content
     */
    updateHostDisplay(data, elements) {
        logger.debug('Host mode - updating display');
        
        // Clear previous question content to prevent flash during transition
        this.displayManager.clearHostQuestionContent(false); // false = no loading message during update
        
        // Switch to host game screen when new question starts
        this.uiManager.showScreen('host-game-screen');
        
        // Hide answer statistics during question
        this.hideAnswerStatistics();
        
        // Update counters using display manager
        this.displayManager.updateQuestionCounter(data.questionNumber, data.totalQuestions);
        
        // Add delay to ensure screen transition completes before MathJax rendering
        setTimeout(() => {
            // Update question content
            this.updateHostQuestionContent(data, elements.hostQuestionElement);
            
            // Update options/answers display
            this.updateHostOptionsContent(data, elements.hostOptionsContainer);
            
            // Update question image
            this.displayManager.updateQuestionImage(data, 'question-image-display');
        }, TIMING.RENDER_DELAY);
    }

    /**
     * Update host question content with LaTeX support
     */
    updateHostQuestionContent(data, hostQuestionElement) {
        if (!hostQuestionElement) {
            logger.warn('Host question element not found');
            return;
        }
        
        logger.debug('Updating host question content');
        
        // Format and display question text using display manager
        this.displayManager.displayQuestionText(hostQuestionElement, data.question);
        
        // Add question type indicator for styling
        hostQuestionElement.className = `question-display ${data.type}-question`;
        
        // Set data attributes for debugging and styling
        hostQuestionElement.setAttribute('data-question-type', data.type);
        hostQuestionElement.setAttribute('data-question-number', data.questionNumber);
        
        logger.debug('Host question content updated successfully');
    }

    /**
     * Update host options content based on question type
     */
    updateHostOptionsContent(data, hostOptionsContainer) {
        if (!hostOptionsContainer) {
            logger.warn('Host options container not found');
            return;
        }
        
        logger.debug('Updating host options content for type:', data.type);
        
        // Always clear previous content to prevent leaking between question types
        hostOptionsContainer.innerHTML = '';
        
        const hostMultipleChoice = document.getElementById('host-multiple-choice');
        
        if (data.type === 'numeric') {
            hostOptionsContainer.style.display = 'none';
            // Hide the entire "Question Alternatives" frame for numeric questions
            if (hostMultipleChoice) {
                hostMultipleChoice.classList.add('numeric-question-type');
            }
        } else {
            hostOptionsContainer.style.display = 'block';
            // Remove the numeric-question-type class for non-numeric questions
            if (hostMultipleChoice) {
                hostMultipleChoice.classList.remove('numeric-question-type');
            }
            
            if (data.type === 'true-false') {
                this.setupHostTrueFalseOptions(hostOptionsContainer);
            } else {
                this.setupHostMultipleChoiceOptions(data, hostOptionsContainer);
            }
        }
        
        // Translate any dynamic content in the options container
        translationManager.translateContainer(hostOptionsContainer);
        
        // Use GameDisplayManager for MathJax rendering - host needs more time after F5
        this.displayManager.renderQuestionMath(hostOptionsContainer, 350);
    }

    /**
     * Setup host true/false options display
     */
    setupHostTrueFalseOptions(hostOptionsContainer) {
        hostOptionsContainer.innerHTML = `
            <div class="true-false-options">
                <div class="tf-option true-btn" data-answer="true">${getTrueFalseText().true}</div>
                <div class="tf-option false-btn" data-answer="false">${getTrueFalseText().false}</div>
            </div>
        `;
        hostOptionsContainer.style.display = 'block';
        logger.debug('Host true/false options set up');
    }

    /**
     * Setup host multiple choice options display
     */
    setupHostMultipleChoiceOptions(data, hostOptionsContainer) {
        hostOptionsContainer.innerHTML = `
            <div class="option-display" data-option="0"></div>
            <div class="option-display" data-option="1"></div>
            <div class="option-display" data-option="2"></div>
            <div class="option-display" data-option="3"></div>
        `;
        hostOptionsContainer.style.display = 'grid';
        const options = hostOptionsContainer.querySelectorAll('.option-display');
        
        // Reset all option styles from previous questions
        this.resetButtonStyles(options);
    
        // Populate options with content
        if (data.type === 'multiple-choice' || data.type === 'multiple-correct') {
            data.options.forEach((option, index) => {
                if (options[index]) {
                    options[index].innerHTML = `${translationManager.getOptionLetter(index)}: ${this.displayManager.mathRenderer.formatCodeBlocks(option)}`;
                    options[index].classList.add('tex2jax_process'); // Add MathJax processing class
                    options[index].style.display = 'block';
                    // Add data-multiple attribute for multiple-correct questions to get special styling
                    if (data.type === 'multiple-correct') {
                        options[index].setAttribute('data-multiple', 'true');
                    } else {
                        options[index].removeAttribute('data-multiple');
                    }
                    
                    // Apply syntax highlighting to code blocks in this option
                    this.displayManager.mathRenderer.applySyntaxHighlighting(options[index]);
                }
            });
            // Hide unused options
            for (let i = data.options.length; i < 4; i++) {
                if (options[i]) {
                    options[i].style.display = 'none';
                }
            }
        }
        
        logger.debug('Host multiple choice options set up');
    }

    /**
     * Reset button styles for options
     */
    resetButtonStyles(options) {
        options.forEach(option => {
            option.classList.remove('correct', 'incorrect', 'selected');
            option.style.background = '';
            option.style.border = '';
            option.style.transform = '';
        });
    }


    /**
     * Hide answer statistics during question display
     */
    hideAnswerStatistics() {
        const statisticsContainer = document.getElementById('answer-statistics');
        if (statisticsContainer) {
            statisticsContainer.style.display = 'none';
        }
    }

    /**
     * Update player display with question content
     */
    updatePlayerDisplay(data, elements, optionsContainer) {
        logger.debug('Player mode - updating display');
        
        // Switch to player game screen when new question starts
        this.uiManager.showScreen('player-game-screen');
        
        // Add delay to ensure screen transition completes before content update
        setTimeout(() => {
            // Use centralized client question display update
            this.displayManager.updateClientQuestionDisplay(data);
            
            // Update answer options (still specific to question renderer)
            this.updatePlayerOptions(data, optionsContainer);
        }, TIMING.RENDER_DELAY);
    }

    /**
     * Update player question content with LaTeX support
     */
    updatePlayerQuestionContent(data, questionElement) {
        if (!questionElement) {
            logger.warn('Player question element not found');
            return;
        }
        
        logger.debug('Updating player question content');
        
        // Format and display question text using display manager
        this.displayManager.displayQuestionText(questionElement, data.question);
        
        // Add subtle instruction for multiple correct questions
        if (data.type === 'multiple-correct') {
            const instruction = document.createElement('div');
            instruction.className = 'multiple-correct-instruction';
            instruction.innerHTML = `<small>💡 ${translationManager.getTranslationSync('multiple_correct_instruction')}</small>`;
            questionElement.appendChild(instruction);
        }
        
        // Add question type indicator for styling
        questionElement.className = `question-display player-question ${data.type}-question`;
        
        // Set data attributes
        questionElement.setAttribute('data-question-type', data.type);
        questionElement.setAttribute('data-question-number', data.questionNumber);
        
        logger.debug('Player question content updated successfully');
    }

    /**
     * Update player answer options based on question type
     */
    updatePlayerOptions(data, optionsContainer) {
        if (!optionsContainer) {
            logger.error('Player options container not found - critical DOM issue');
            return;
        }
        
        logger.debug('Setting up player options for type:', data.type);
        logger.debug('Options container element:', optionsContainer.tagName, optionsContainer.id, optionsContainer.className);
        
        if (data.type === 'multiple-choice') {
            this.setupPlayerMultipleChoiceOptions(data, optionsContainer);
        } else if (data.type === 'multiple-correct') {
            this.setupPlayerMultipleCorrectOptions(data, optionsContainer);
        } else if (data.type === 'true-false') {
            this.setupPlayerTrueFalseOptions(data, optionsContainer);
        } else if (data.type === 'numeric') {
            this.setupPlayerNumericOptions(data, optionsContainer);
        }
        
        // Use GameDisplayManager for MathJax rendering after options are set up
        this.displayManager.renderQuestionMath(optionsContainer, TIMING.RENDER_DELAY);
    }

    /**
     * Setup player multiple choice options
     */
    setupPlayerMultipleChoiceOptions(data, optionsContainer) {
        const existingButtons = optionsContainer.querySelectorAll('.player-option');
        
        // Debug Android DOM issues
        logger.debug(`Found ${existingButtons.length} player option buttons, need ${data.options.length}`);
        if (existingButtons.length === 0) {
            logger.error('No .player-option elements found - DOM structure missing!');
            return;
        }
        
        existingButtons.forEach((button, index) => {
            if (index < data.options.length) {
                // Ensure button exists and is valid DOM element
                if (!button || button.innerHTML === undefined) {
                    logger.error(`Button ${index} is invalid:`, button);
                    return;
                }
                
                button.innerHTML = `<span class="option-letter">${translationManager.getOptionLetter(index)}:</span> ${this.displayManager.mathRenderer.formatCodeBlocks(data.options[index])}`;
                button.setAttribute('data-answer', index.toString());
                button.classList.remove('selected', 'disabled');
                button.classList.add('tex2jax_process'); // Add MathJax processing class
                button.style.display = 'block';
                
                // Apply syntax highlighting to code blocks in this option
                this.displayManager.mathRenderer.applySyntaxHighlighting(button);
                
                // Use tracked event listeners from GameManager
                this.gameManager.addEventListenerTracked(button, 'click', () => {
                    logger.debug('Button clicked:', index);
                    this.gameManager.selectAnswer(index);
                });
            } else {
                button.style.display = 'none';
            }
        });
        
        logger.debug('Player multiple choice options set up');
    }

    /**
     * Setup player multiple correct options (checkboxes)
     */
    setupPlayerMultipleCorrectOptions(data, optionsContainer) {
        const checkboxes = optionsContainer.querySelectorAll('.option-checkbox');
        const checkboxLabels = optionsContainer.querySelectorAll('.checkbox-option');
        
        checkboxes.forEach(cb => cb.checked = false);
        checkboxLabels.forEach((label, index) => {
            if (data.options && data.options[index]) {
                const formattedOption = this.displayManager.mathRenderer.formatCodeBlocks(data.options[index]);
                label.innerHTML = `<input type="checkbox" class="option-checkbox"> ${translationManager.getOptionLetter(index)}: ${formattedOption}`;
                label.setAttribute('data-option', index);
                
                // Apply syntax highlighting to code blocks in this option
                this.displayManager.mathRenderer.applySyntaxHighlighting(label);
            } else {
                label.style.display = 'none';
            }
        });
        
        logger.debug('Player multiple correct options set up');
    }

    /**
     * Setup player true/false options
     */
    setupPlayerTrueFalseOptions(data, optionsContainer) {
        const buttons = optionsContainer.querySelectorAll('.tf-option');
        buttons.forEach((button, index) => {
            button.classList.remove('selected', 'disabled');
            button.setAttribute('data-answer', index.toString());
            
            // Use tracked event listeners from GameManager
            this.gameManager.addEventListenerTracked(button, 'click', () => {
                logger.debug('True/False button clicked:', index);
                // Convert index to boolean: 0 = true, 1 = false
                const booleanAnswer = index === 0;
                logger.debug('Converting T/F index', index, 'to boolean:', booleanAnswer);
                this.gameManager.selectAnswer(booleanAnswer);
            });
        });
        
        logger.debug('Player true/false options set up');
    }

    /**
     * Setup player numeric input options
     */
    setupPlayerNumericOptions(data, optionsContainer) {
        const input = optionsContainer.querySelector('#numeric-answer-input');
        const submitButton = optionsContainer.querySelector('#submit-numeric');
        
        if (input) {
            input.value = '';
            input.disabled = false;
            input.placeholder = getTranslation('enter_numeric_answer');
            
            // Remove old listeners and add new ones
            input.replaceWith(input.cloneNode(true));
            const newInput = optionsContainer.querySelector('#numeric-answer-input');
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.gameManager.submitNumericAnswer();
                }
            });
        }
        
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = getTranslation('submit');
            
            // Use tracked event listeners from GameManager
            this.gameManager.addEventListenerTracked(submitButton, 'click', () => {
                this.gameManager.submitNumericAnswer();
            });
        }
        
        logger.debug('Player numeric options set up');
    }

    /**
     * Clear all question content and reset display state
     */
    clearQuestionContent() {
        logger.debug('Clearing question content');
        
        // Use display manager to clear question display
        this.displayManager.clearQuestionDisplay();
        
        // Clear any multiple correct instructions
        document.querySelectorAll('.multiple-correct-instruction').forEach(instruction => {
            instruction.remove();
        });
        
        // Clear any additional question-specific content
        this.clearAnswerSelections();
        this.resetOptionStyles();
        
        logger.debug('Question content cleared');
    }

    /**
     * Clear any selected answers and reset selection state
     */
    clearAnswerSelections() {
        // Clear multiple choice selections
        document.querySelectorAll('.player-option.selected').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Clear checkbox selections
        document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Clear numeric input
        const numericInput = document.querySelector('input[type="number"]');
        if (numericInput) {
            numericInput.value = '';
        }
        
        // Clear true/false selections
        document.querySelectorAll('.tf-option.selected').forEach(option => {
            option.classList.remove('selected');
        });
    }

    /**
     * Reset all option styles to default state
     */
    resetOptionStyles() {
        // Reset all player options
        document.querySelectorAll('.player-option').forEach(option => {
            option.classList.remove('selected', 'correct', 'incorrect');
            option.style.background = '';
            option.style.border = '';
            option.style.transform = '';
        });
        
        // Reset checkbox options
        document.querySelectorAll('.checkbox-option').forEach(option => {
            option.classList.remove('selected', 'correct', 'incorrect');
        });
        
        // Reset true/false options
        document.querySelectorAll('.tf-option').forEach(option => {
            option.classList.remove('selected', 'correct', 'incorrect');
            option.style.background = '';
            option.style.border = '';
        });
        
        // Reset host option displays
        document.querySelectorAll('.option-display').forEach(option => {
            option.classList.remove('correct', 'incorrect');
            option.style.display = 'block';
        });
    }
}