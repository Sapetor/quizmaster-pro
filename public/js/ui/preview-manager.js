/**
 * Preview Manager Module
 * Handles live preview functionality with auto-scroll and real-time updates
 * Restored to match original monolithic functionality
 */

import { getTranslation, getOptionLetter } from '../utils/translations.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { logger } from '../core/config.js';

export class PreviewManager {
    constructor(mathRenderer) {
        this.mathRenderer = mathRenderer || new MathRenderer();
        this.currentPreviewQuestion = 0;
        this.previewListenersSet = false;
        this.splitPreviewListenersSet = false;
        this.previewMode = false;
        this.updatePreviewDebounced = this.debounce(() => this.updateSplitPreview(), 300);
    }

    /**
     * Toggle preview mode
     */
    togglePreviewMode() {
        const toggleBtn = document.getElementById('toggle-preview');
        const previewSection = document.querySelector('.quiz-preview-section');
        const hostContainer = document.querySelector('.host-container');
        
        if (!previewSection || !hostContainer) {
            logger.warn('Preview elements not found');
            return;
        }

        this.previewMode = !this.previewMode;
        
        if (this.previewMode) {
            // Show preview
            previewSection.style.display = 'block';
            hostContainer.classList.add('split-screen');
            
            // FORCE PROPER 50/50 SPLIT RATIO
            hostContainer.style.setProperty('--split-left', '50fr');
            hostContainer.style.setProperty('--split-right', '50fr');
            logger.debug('Forced 50/50 split ratio on preview activation');
            
            // Update button styling and text
            if (toggleBtn) {
                toggleBtn.classList.remove('secondary');
                toggleBtn.classList.add('danger');
                toggleBtn.textContent = getTranslation('close_live_preview') || 'Close Live Preview';
                toggleBtn.setAttribute('data-translate', 'close_live_preview');
            }
            
            // Initialize preview
            this.initializeSplitPreview();
        } else {
            // Hide preview
            previewSection.style.display = 'none';
            hostContainer.classList.remove('split-screen');
            
            // Update button styling and text
            if (toggleBtn) {
                toggleBtn.classList.remove('danger');
                toggleBtn.classList.add('secondary');
                toggleBtn.textContent = getTranslation('toggle_live_preview') || 'Live Preview';
                toggleBtn.setAttribute('data-translate', 'toggle_live_preview');
            }
            
            // Clean up listeners
            this.cleanupPreviewListeners();
        }
    }

    /**
     * Initialize split preview system
     */
    initializeSplitPreview() {
        logger.debug('Initializing split preview system');
        this.currentPreviewQuestion = 0;
        this.setupSplitPreviewEventListeners();
        this.updateSplitPreview();
        
        // Force update and MathJax rendering on a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateSplitPreview();
            // Force MathJax rendering on initialization
            setTimeout(() => {
                const previewElement = document.getElementById('preview-content-split');
                if (previewElement && window.MathJax && window.MathJax.typesetPromise) {
                    console.log('🧮 Force rendering MathJax on preview initialization');
                    window.MathJax.typesetPromise([previewElement]).catch(err => {
                        console.warn('Initial MathJax rendering failed:', err);
                    });
                }
            }, 300);
        }, 100);
    }

    /**
     * Setup event listeners for split preview
     */
    setupSplitPreviewEventListeners() {
        // Only set up listeners once
        if (this.splitPreviewListenersSet) {
            logger.debug('Split preview listeners already set, skipping');
            return;
        }
        this.splitPreviewListenersSet = true;
        logger.debug('Setting up split preview event listeners');

        // Navigation buttons for split screen
        const prevBtn = document.getElementById('preview-prev-split');
        const nextBtn = document.getElementById('preview-next-split');
        const scrollBtn = document.getElementById('scroll-to-question');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                logger.debug(`Prev button clicked: current=${this.currentPreviewQuestion}`);
                if (this.currentPreviewQuestion > 0) {
                    this.currentPreviewQuestion--;
                    logger.debug(`Moving to previous question: ${this.currentPreviewQuestion}`);
                    this.updateSplitPreview();
                } else {
                    logger.debug('Already at first question, not going back');
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const questionItems = document.querySelectorAll('.question-item');
                const maxIndex = questionItems.length - 1;
                logger.debug(`Next button clicked: current=${this.currentPreviewQuestion}, max=${maxIndex}, total=${questionItems.length}`);
                if (this.currentPreviewQuestion < maxIndex) {
                    this.currentPreviewQuestion++;
                    logger.debug(`Moving to next question: ${this.currentPreviewQuestion}`);
                    this.updateSplitPreview();
                } else {
                    logger.debug('Already at last question, not advancing');
                }
            });
        }

        if (scrollBtn) {
            scrollBtn.addEventListener('click', () => {
                this.scrollToCurrentQuestion();
            });
        }

        // Real-time updates for split screen
        this.setupRealTimeSplitPreviewUpdates();
    }

    /**
     * Setup real-time preview updates for split screen
     */
    setupRealTimeSplitPreviewUpdates() {
        // Question text changes
        document.addEventListener('input', (e) => {
            if (e.target.matches('.question-text, .option, .numeric-answer, .numeric-tolerance')) {
                this.updatePreviewDebounced();
                // Smart auto-scroll with debouncing to prevent jumping
                this.smartAutoScrollToEditedQuestion(e.target);
            }
        });

        // DISABLED AUTO-SCROLL ON FOCUS TO PREVENT JUMPING
        // document.addEventListener('focus', (e) => {
        //     if (e.target.matches('.question-text, .option, .numeric-answer, .numeric-tolerance')) {
        //         this.autoScrollToEditedQuestion(e.target);
        //     }
        // }, true);

        // Question type changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.question-type, .time-input, .question-difficulty')) {
                this.updatePreviewDebounced();
            }
        });

        // Option changes (for multiple choice)
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="radio"][name^="correct-"]')) {
                this.updatePreviewDebounced();
            }
        });

        // Multiple correct answers
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"][name^="multiple-correct-"]')) {
                this.updatePreviewDebounced();
            }
        });

        // True/false selection
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="radio"][name^="tf-"]')) {
                this.updatePreviewDebounced();
            }
        });

        // Image uploads
        document.addEventListener('change', (e) => {
            if (e.target.matches('.image-input')) {
                this.updatePreviewDebounced();
            }
        });
    }

    /**
     * Update split preview
     */
    updateSplitPreview() {
        const questionItems = document.querySelectorAll('.question-item');
        const totalQuestions = questionItems.length;
        
        // ULTRA DEBUG: Track who called updateSplitPreview
        const stack = new Error().stack;
        const caller = stack.split('\n')[2]?.trim() || 'unknown';
        logger.debug(`UPDATE SPLIT PREVIEW: total=${totalQuestions}, current=${this.currentPreviewQuestion}, caller=${caller}`);
        
        if (totalQuestions === 0) {
            this.showEmptySplitPreview();
            return;
        }

        // Update navigation
        this.updateSplitPreviewNavigation(totalQuestions);
        
        // Validate and clamp currentPreviewQuestion to valid range
        if (this.currentPreviewQuestion < 0) {
            logger.warn(`currentPreviewQuestion was negative (${this.currentPreviewQuestion}), resetting to 0`);
            this.currentPreviewQuestion = 0;
        }
        if (this.currentPreviewQuestion >= totalQuestions) {
            logger.warn(`currentPreviewQuestion was too high (${this.currentPreviewQuestion}), clamping to ${totalQuestions - 1}`);
            this.currentPreviewQuestion = totalQuestions - 1;
        }
        
        // Get current question data
        const currentQuestion = questionItems[this.currentPreviewQuestion];
        if (!currentQuestion) {
            logger.error(`Current question not found at index ${this.currentPreviewQuestion}, total questions: ${totalQuestions}`);
            // Only reset to 0 if we have questions and current index is invalid
            if (totalQuestions > 0) {
                logger.debug('Resetting to question 0');
                this.currentPreviewQuestion = 0;
                const firstQuestion = questionItems[0];
                if (!firstQuestion) return;
                
                const questionData = this.extractQuestionDataForPreview(firstQuestion);
                questionData.questionNumber = 1;
                questionData.totalQuestions = totalQuestions;
                this.renderSplitQuestionPreview(questionData);
            }
            return;
        }

        const questionData = this.extractQuestionDataForPreview(currentQuestion);
        questionData.questionNumber = this.currentPreviewQuestion + 1;
        questionData.totalQuestions = totalQuestions;
        this.renderSplitQuestionPreview(questionData);
    }

    /**
     * Update split preview navigation
     */
    updateSplitPreviewNavigation(totalQuestions) {
        const counterSplit = document.getElementById('preview-question-counter-split');
        const prevBtn = document.getElementById('preview-prev-split');
        const nextBtn = document.getElementById('preview-next-split');
        
        if (counterSplit) {
            counterSplit.textContent = `${getTranslation('question')} ${this.currentPreviewQuestion + 1} ${getTranslation('of')} ${totalQuestions}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPreviewQuestion === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPreviewQuestion >= totalQuestions - 1;
        }
    }

    /**
     * Show empty split preview
     */
    showEmptySplitPreview() {
        const previewText = document.getElementById('preview-question-text-split');
        const counterDisplay = document.getElementById('preview-question-counter-display-split');
        const counterSplit = document.getElementById('preview-question-counter-split');
        
        if (previewText) {
            previewText.textContent = getTranslation('no_questions_to_preview') || 'No questions to preview';
        }
        if (counterDisplay) {
            counterDisplay.textContent = `${getTranslation('question')} 0 ${getTranslation('of')} 0`;
        }
        if (counterSplit) {
            counterSplit.textContent = `${getTranslation('question')} 0 ${getTranslation('of')} 0`;
        }
        
        // Hide all answer areas
        document.querySelectorAll('#preview-answer-area-split .preview-answer-type').forEach(type => {
            type.style.display = 'none';
        });
    }

    /**
     * Extract question data for preview from DOM element
     */
    extractQuestionDataForPreview(questionItem) {
        logger.debug('Extracting data from question item:', questionItem);
        
        const questionText = questionItem.querySelector('.question-text')?.value?.trim() || getTranslation('enter_question_preview') || 'Enter question text...';
        const questionType = questionItem.querySelector('.question-type')?.value || 'multiple-choice';
        const imageElement = questionItem.querySelector('.question-image');
        const imageUrl = imageElement ? imageElement.dataset.url || '' : '';
        
        logger.debug('Question text:', questionText);
        logger.debug('Question type:', questionType);
        
        let options = [];
        let correctAnswer = null;
        let correctAnswers = [];
        
        switch (questionType) {
            case 'multiple-choice':
                // Try multiple selectors to find options - but filter out empty ones
                const mcOptions = questionItem.querySelectorAll('.multiple-choice-options .option, .option');
                options = Array.from(mcOptions)
                    .map(opt => opt.value?.trim())
                    .filter(opt => opt && opt !== '' && opt !== 'Option text')  // Filter out empty/placeholder options
                    .slice(0, 6); // Limit to max 6 options
                
                const correctRadio = questionItem.querySelector('input[type="radio"][name^="correct-"]:checked');
                if (correctRadio) {
                    correctAnswer = parseInt(correctRadio.value);
                }
                logger.debug('MC options found:', options.length, options);
                logger.debug('MC correct answer:', correctAnswer);
                break;
                
            case 'multiple-correct':
                const mcorrOptions = questionItem.querySelectorAll('.multiple-correct-options .option, .option');
                options = Array.from(mcorrOptions)
                    .map(opt => opt.value?.trim())
                    .filter(opt => opt && opt !== '' && opt !== 'Option text')  // Filter out empty/placeholder options
                    .slice(0, 6); // Limit to max 6 options
                
                const correctCheckboxes = questionItem.querySelectorAll('input[type="checkbox"][name^="multiple-correct-"]:checked');
                correctAnswers = Array.from(correctCheckboxes).map(cb => parseInt(cb.value));
                logger.debug('Multiple correct options:', options);
                logger.debug('Multiple correct answers:', correctAnswers);
                break;
                
            case 'true-false':
                const tfCorrectRadio = questionItem.querySelector('input[type="radio"][name^="tf-"]:checked');
                if (tfCorrectRadio) {
                    correctAnswer = tfCorrectRadio.value === 'true';
                }
                logger.debug('True/false correct answer:', correctAnswer);
                break;
                
            case 'numeric':
                const numericAnswer = questionItem.querySelector('.numeric-answer')?.value;
                if (numericAnswer) {
                    correctAnswer = parseFloat(numericAnswer);
                }
                logger.debug('Numeric correct answer:', correctAnswer);
                break;
        }
        
        const extractedData = {
            question: questionText,
            type: questionType,
            image: imageUrl,
            options: options,
            correctAnswer: correctAnswer,
            correctAnswers: correctAnswers
        };
        
        logger.debug('Extracted question data:', extractedData);
        return extractedData;
    }

    /**
     * Render split question preview
     */
    renderSplitQuestionPreview(data) {
        console.log('Rendering preview for question:', data);
        
        // Update question counter and text
        const counterDisplay = document.getElementById('preview-question-counter-display-split');
        if (counterDisplay) {
            counterDisplay.textContent = `${getTranslation('question')} ${data.questionNumber} ${getTranslation('of')} ${data.totalQuestions}`;
        }
        
        const previewElement = document.getElementById('preview-question-text-split');
        if (previewElement) {
            previewElement.innerHTML = this.formatCodeBlocks(data.question);
            previewElement.dataset.hasContent = 'true'; // Mark as having dynamic content
            logger.debug('Updated preview question text:', data.question);
        }
        
        // Handle image
        const imageDisplay = document.getElementById('preview-question-image-split');
        const img = document.getElementById('preview-question-img-split');
        if (data.image && imageDisplay && img) {
            img.src = data.image;
            imageDisplay.style.display = 'block';
        } else if (imageDisplay) {
            imageDisplay.style.display = 'none';
        }
        
        // ULTRA ROBUST CLEARING: Hide all answer types and reset all states
        logger.debug('CLEARING ALL ANSWER TYPES for question type:', data.type);
        
        // First, explicitly hide each specific answer type container
        const answerContainers = [
            'preview-multiple-choice-split',
            'preview-multiple-correct-split', 
            'preview-true-false-split',
            'preview-numeric-split'
        ];
        
        answerContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'none';
                logger.debug(`Hidden container: ${containerId}`);
            }
        });
        
        // Additional clearing of all preview answer types
        document.querySelectorAll('#preview-answer-area-split .preview-answer-type').forEach(type => {
            type.style.display = 'none';
            
            // Clear dynamic content completely
            const playerOptions = type.querySelector('.player-options');
            if (playerOptions) {
                playerOptions.innerHTML = '';
            }
            
            const checkboxOptions = type.querySelector('.player-checkbox-options');
            if (checkboxOptions) {
                checkboxOptions.innerHTML = '';
            }
            
            // SPECIFICALLY reset True/False buttons
            const tfContainer = type.querySelector('.true-false-options');
            if (tfContainer) {
                const tfButtons = tfContainer.querySelectorAll('.tf-option');
                tfButtons.forEach(btn => {
                    btn.classList.remove('correct-preview', 'selected', 'active');
                    btn.style.display = '';
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                    btn.style.fontWeight = '';
                    btn.style.border = '';
                });
                logger.debug(`Reset ${tfButtons.length} True/False buttons`);
            }
            
            // Reset input fields
            const inputs = type.querySelectorAll('input');
            inputs.forEach(input => {
                input.value = '';
                input.placeholder = '';
            });
        });
        
        logger.debug('Rendering answer type:', data.type, 'with options:', data.options);
        
        // Show appropriate answer type
        switch (data.type) {
            case 'multiple-choice':
                this.renderSplitMultipleChoicePreview(data.options, data.correctAnswer);
                break;
            case 'multiple-correct':
                this.renderSplitMultipleCorrectPreview(data.options, data.correctAnswers);
                break;
            case 'true-false':
                this.renderSplitTrueFalsePreview(data.correctAnswer);
                break;
            case 'numeric':
                this.renderSplitNumericPreview();
                break;
        }
        
        // Render LaTeX in split preview with proper targeting and retry mechanism
        this.renderMathJaxWithRetry();
    }

    /**
     * Render split multiple choice preview
     */
    renderSplitMultipleChoicePreview(options, correctAnswer) {
        logger.debug('Rendering multiple choice with options:', options, 'correct:', correctAnswer);
        
        const container = document.getElementById('preview-multiple-choice-split');
        if (!container) {
            logger.warn('Multiple choice preview container not found');
            return;
        }
        
        // Ensure other containers are hidden
        document.getElementById('preview-true-false-split').style.display = 'none';
        document.getElementById('preview-multiple-correct-split').style.display = 'none';
        document.getElementById('preview-numeric-split').style.display = 'none';
        
        container.style.display = 'block';
        
        const optionsContainer = container.querySelector('.player-options');
        if (!optionsContainer) {
            logger.warn('Player options container not found in multiple choice preview');
            return;
        }
        
        // Clear existing options
        optionsContainer.innerHTML = '';
        
        // Add new options - only non-empty ones
        options.forEach((option, index) => {
            // Skip empty or placeholder options
            if (!option || option.trim() === '' || option === 'Option text') {
                return;
            }
            
            const isCorrect = index === correctAnswer;
            const optionDiv = document.createElement('div');
            optionDiv.className = `player-option preview-option ${isCorrect ? 'correct-preview' : ''}`;
            optionDiv.setAttribute('data-option', index);
            optionDiv.innerHTML = `${getOptionLetter(index)}: ${option}`;
            optionsContainer.appendChild(optionDiv);
            
            logger.debug(`Added option ${index}: ${option} (${isCorrect ? 'correct' : 'incorrect'})`);
        });
    }

    /**
     * Render split multiple correct preview
     */
    renderSplitMultipleCorrectPreview(options, correctAnswers) {
        logger.debug('Rendering multiple correct with options:', options, 'correct:', correctAnswers);
        
        // Ensure other containers are hidden
        document.getElementById('preview-true-false-split').style.display = 'none';
        document.getElementById('preview-multiple-choice-split').style.display = 'none';
        document.getElementById('preview-numeric-split').style.display = 'none';
        
        document.getElementById('preview-multiple-correct-split').style.display = 'block';
        
        const optionsContainer = document.querySelector('#preview-multiple-correct-split .player-checkbox-options');
        if (!optionsContainer) return;
        
        optionsContainer.innerHTML = '';
        
        options.forEach((option, index) => {
            const isCorrect = correctAnswers.includes(index);
            const optionDiv = document.createElement('div');
            optionDiv.className = `checkbox-option preview-checkbox ${isCorrect ? 'correct-preview' : ''}`;
            optionDiv.setAttribute('data-option', index);
            optionDiv.innerHTML = `<input type="checkbox" ${isCorrect ? 'checked' : ''} disabled> ${getOptionLetter(index)}: ${option}`;
            optionsContainer.appendChild(optionDiv);
        });
    }

    /**
     * Render split true/false preview
     */
    renderSplitTrueFalsePreview(correctAnswer) {
        logger.debug('Rendering True/False preview, correct answer:', correctAnswer);
        
        // Explicitly ensure ONLY True/False container is shown
        const tfContainer = document.getElementById('preview-true-false-split');
        if (!tfContainer) {
            logger.error('True/False container not found!');
            return;
        }
        
        // Ensure other containers are hidden
        document.getElementById('preview-multiple-choice-split').style.display = 'none';
        document.getElementById('preview-multiple-correct-split').style.display = 'none';
        document.getElementById('preview-numeric-split').style.display = 'none';
        
        // Show True/False container
        tfContainer.style.display = 'block';
        
        const trueOption = tfContainer.querySelector('.tf-option[data-option="true"]');
        const falseOption = tfContainer.querySelector('.tf-option[data-option="false"]');
        
        if (trueOption && falseOption) {
            // Reset all styles first
            trueOption.className = 'tf-option preview-tf';
            falseOption.className = 'tf-option preview-tf';
            
            // Apply correct answer styling
            if (correctAnswer === true) {
                trueOption.classList.add('correct-preview');
            }
            if (correctAnswer === false) {
                falseOption.classList.add('correct-preview');
            }
            
            trueOption.textContent = `${getOptionLetter(0)}: ${getTranslation('true')}`;
            falseOption.textContent = `${getOptionLetter(1)}: ${getTranslation('false')}`;
            
            console.log('✅ True/False buttons updated successfully');
        } else {
            console.error('❌ True/False option buttons not found!');
        }
    }

    /**
     * Render split numeric preview
     */
    renderSplitNumericPreview() {
        console.log('🔢 Rendering numeric preview');
        
        // Ensure other containers are hidden
        document.getElementById('preview-true-false-split').style.display = 'none';
        document.getElementById('preview-multiple-choice-split').style.display = 'none';
        document.getElementById('preview-multiple-correct-split').style.display = 'none';
        
        document.getElementById('preview-numeric-split').style.display = 'block';
        
        const input = document.getElementById('preview-numeric-input-split');
        if (input) {
            input.placeholder = getTranslation('enter_answer') || 'Enter your answer';
        }
    }

    /**
     * Format code blocks for display
     */
    formatCodeBlocks(text) {
        if (!text) return '';
        
        // Simple code block formatting
        return text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                  .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    /**
     * Scroll to current question in editor
     */
    scrollToCurrentQuestion() {
        const questionItems = document.querySelectorAll('.question-item');
        const targetQuestion = questionItems[this.currentPreviewQuestion];
        
        if (targetQuestion) {
            targetQuestion.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
            
            // Add a brief highlight effect
            targetQuestion.style.background = 'rgba(255, 215, 0, 0.2)';
            targetQuestion.style.transform = 'scale(1.02)';
            
            setTimeout(() => {
                targetQuestion.style.background = '';
                targetQuestion.style.transform = '';
            }, 1500);
        }
    }

    /**
     * Update preview (alias for updateSplitPreview)
     */
    updatePreview() {
        this.updateSplitPreview();
    }

    /**
     * Smart auto-scroll preview to edited question (debounced)
     */
    smartAutoScrollToEditedQuestion(inputElement) {
        // Only work when split preview is active
        if (!this.previewMode) return;
        
        // Debounce to prevent rapid jumping
        clearTimeout(this.autoScrollTimeout);
        this.autoScrollTimeout = setTimeout(() => {
            this.autoScrollToEditedQuestion(inputElement);
        }, 200); // Wait 200ms after user stops typing
    }

    /**
     * Auto-scroll preview to edited question
     */
    autoScrollToEditedQuestion(inputElement) {
        // Only work when split preview is active
        if (!this.previewMode) return;
        
        // Find which question this input belongs to
        const questionItem = inputElement.closest('.question-item');
        if (!questionItem) return;
        
        // Find the index of this question
        const questionItems = Array.from(document.querySelectorAll('.question-item'));
        const questionIndex = questionItems.indexOf(questionItem);
        
        console.log(`📝 Auto-scroll triggered: questionIndex=${questionIndex}, current=${this.currentPreviewQuestion}, total=${questionItems.length}`);
        
        if (questionIndex !== -1 && questionIndex !== this.currentPreviewQuestion) {
            // Validate the index before updating
            if (questionIndex >= 0 && questionIndex < questionItems.length) {
                console.log(`🎯 Auto-scrolling preview from question ${this.currentPreviewQuestion + 1} to ${questionIndex + 1}`);
                this.currentPreviewQuestion = questionIndex;
                this.updateSplitPreview();
            } else {
                console.log(`❌ Invalid questionIndex: ${questionIndex}, not updating preview`);
            }
        }
    }

    /**
     * Clean up preview listeners
     */
    cleanupPreviewListeners() {
        this.previewListenersSet = false;
        this.splitPreviewListenersSet = false;
        // Note: In a real implementation, you'd want to remove specific listeners
        // For now, we'll just reset the flags
    }

    /**
     * Debounce utility function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Render MathJax with retry mechanism
     */
    renderMathJaxWithRetry(attempt = 0) {
        const maxAttempts = 3;
        const previewElement = document.getElementById('preview-content-split');
        
        if (!previewElement) {
            if (attempt < maxAttempts) {
                setTimeout(() => this.renderMathJaxWithRetry(attempt + 1), 100);
            }
            return;
        }

        logger.debug(`MathJax attempt ${attempt + 1}/${maxAttempts + 1}`);
        
        if (this.mathRenderer && this.mathRenderer.renderMathJax) {
            logger.debug('Using MathRenderer.renderMathJax with preview element');
            this.mathRenderer.renderMathJax(previewElement);
        } else if (window.MathJax && window.MathJax.typesetPromise) {
            logger.debug('Using global MathJax.typesetPromise on preview element');
            window.MathJax.typesetPromise([previewElement]).then(() => {
                logger.debug('MathJax rendering completed for preview');
            }).catch((err) => {
                logger.warn('MathJax rendering error in preview:', err);
                if (attempt < maxAttempts) {
                    setTimeout(() => this.renderMathJaxWithRetry(attempt + 1), 300);
                }
            });
        } else if (window.MathJax && window.MathJax.Hub) {
            logger.debug('Using MathJax v2 Hub.Queue');
            window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, previewElement]);
        } else {
            logger.debug('No MathJax available, retrying...');
            if (attempt < maxAttempts) {
                setTimeout(() => this.renderMathJaxWithRetry(attempt + 1), 200);
            }
        }
    }

    /**
     * Check if preview mode is active
     */
    isPreviewMode() {
        return this.previewMode;
    }
}