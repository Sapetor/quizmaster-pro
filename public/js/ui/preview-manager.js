/**
 * Preview Manager Module
 * Handles live preview functionality with auto-scroll and real-time updates
 * Restored to match original monolithic functionality
 */

import { getTranslation, getOptionLetter } from '../utils/translations.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { MathJaxService } from '../utils/mathjax-service.js';
import { logger } from '../core/config.js';

export class PreviewManager {
    constructor(mathRenderer) {
        this.mathRenderer = mathRenderer || new MathRenderer();
        this.mathJaxService = new MathJaxService();
        this.currentPreviewQuestion = 0;
        this.previewListenersSet = false;
        this.splitPreviewListenersSet = false;
        this.previewMode = false;
        this.manualNavigationInProgress = false;
        this.mathJaxRenderingInProgress = false; // Prevent multiple simultaneous renders
        this.updatePreviewDebounced = this.debounce(() => this.updateSplitPreview(), 300);
        
        // Store listener references for proper cleanup
        this.listeners = {
            prevBtn: null,
            nextBtn: null,
            scrollBtn: null,
            inputHandler: null,
            changeHandler: null,
            radioHandler: null,
            checkboxHandler: null,
            trueFalseHandler: null,
            imageHandler: null
        };
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
            // initializeSplitPreview() already calls updateSplitPreview() which calls renderMathJaxForPreview()
        } else {
            // Clean up listeners first
            this.cleanupPreviewListeners();
            
            // Clear any pending timeouts to prevent glitchy behavior
            clearTimeout(this.autoScrollTimeout);
            clearTimeout(this.updatePreviewTimeout);
            
            // Stop any pending debounced updates
            if (this.updatePreviewDebounced && this.updatePreviewDebounced.cancel) {
                this.updatePreviewDebounced.cancel();
            }
            
            // Temporarily disable ALL transitions to prevent glitching
            hostContainer.style.transition = 'none';
            previewSection.style.transition = 'none';
            
            // Force a reflow to ensure transitions are disabled
            hostContainer.offsetHeight;
            
            // Hide preview and remove split-screen class simultaneously
            previewSection.style.display = 'none';
            hostContainer.classList.remove('split-screen');
            
            // Update button styling and text
            if (toggleBtn) {
                toggleBtn.classList.remove('danger');
                toggleBtn.classList.add('secondary');
                toggleBtn.textContent = getTranslation('toggle_live_preview') || 'Live Preview';
                toggleBtn.setAttribute('data-translate', 'toggle_live_preview');
            }
            
            // Re-enable transitions after layout changes are complete
            requestAnimationFrame(() => {
                setTimeout(() => {
                    hostContainer.style.transition = '';
                    previewSection.style.transition = '';
                }, 50);
            });
        }
    }

    /**
     * Initialize split preview system
     */
    initializeSplitPreview() {
        logger.debug('Initializing split preview system');
        
        // Reset preview state completely
        this.currentPreviewQuestion = 0;
        this.manualNavigationInProgress = false;
        
        // Clear any existing update timeouts
        clearTimeout(this.updatePreviewTimeout);
        clearTimeout(this.autoScrollTimeout);
        
        logger.debug('Preview state reset - currentPreviewQuestion:', this.currentPreviewQuestion);
        
        this.setupSplitPreviewEventListeners();
        this.updateSplitPreview();
        
        // Force update and MathJax rendering on a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateSplitPreview();
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
        
        // Store listener references for cleanup
        this.listeners.prevBtn = () => {
            const questionItems = document.querySelectorAll('.question-item');
            logger.debug(`Prev button clicked: current=${this.currentPreviewQuestion}, total=${questionItems.length}`);
            
            // Set manual navigation flag to prevent auto-scroll conflicts
            this.manualNavigationInProgress = true;
            
            if (this.currentPreviewQuestion > 0) {
                this.currentPreviewQuestion--;
                logger.debug(`Moving to previous question: ${this.currentPreviewQuestion}`);
                this.updateSplitPreview();
                // updateSplitPreview() already calls renderMathJaxForPreview()
            } else {
                logger.debug('Already at first question, not going back');
            }
            
            // Clear flag after a short delay
            setTimeout(() => {
                this.manualNavigationInProgress = false;
            }, 500);
        };

        this.listeners.nextBtn = () => {
            const questionItems = document.querySelectorAll('.question-item');
            const maxIndex = questionItems.length - 1;
            logger.debug(`Next button clicked: current=${this.currentPreviewQuestion}, max=${maxIndex}, total=${questionItems.length}`);
            
            // Set manual navigation flag to prevent auto-scroll conflicts
            this.manualNavigationInProgress = true;
            
            if (this.currentPreviewQuestion < maxIndex) {
                this.currentPreviewQuestion++;
                logger.debug(`Moving to next question: ${this.currentPreviewQuestion}`);
                this.updateSplitPreview();
                // updateSplitPreview() already calls renderMathJaxForPreview()
            } else {
                logger.debug('Already at last question, not advancing');
            }
            
            // Clear flag after a short delay
            setTimeout(() => {
                this.manualNavigationInProgress = false;
            }, 500);
        };

        this.listeners.scrollBtn = () => {
            this.scrollToCurrentQuestion();
        };

        if (prevBtn) {
            prevBtn.addEventListener('click', this.listeners.prevBtn);
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', this.listeners.nextBtn);
        }

        if (scrollBtn) {
            scrollBtn.addEventListener('click', this.listeners.scrollBtn);
        }

        // Real-time updates for split screen
        this.setupRealTimeSplitPreviewUpdates();
    }

    /**
     * Setup real-time preview updates for split screen
     */
    setupRealTimeSplitPreviewUpdates() {
        // Store listener references for cleanup
        this.listeners.inputHandler = (e) => {
            if (e.target.matches('.question-text, .option, .numeric-answer, .numeric-tolerance')) {
                this.updatePreviewDebounced();
                // Smart auto-scroll with debouncing to prevent jumping
                this.smartAutoScrollToEditedQuestion(e.target);
            }
        };

        this.listeners.changeHandler = (e) => {
            if (e.target.matches('.question-type, .time-input, .question-difficulty')) {
                this.updatePreviewDebounced();
            }
        };

        this.listeners.radioHandler = (e) => {
            if (e.target.matches('input[type="radio"][name^="correct-"]')) {
                this.updatePreviewDebounced();
            }
        };

        this.listeners.checkboxHandler = (e) => {
            if (e.target.matches('input[type="checkbox"][name^="multiple-correct-"]')) {
                this.updatePreviewDebounced();
            }
        };

        this.listeners.trueFalseHandler = (e) => {
            if (e.target.matches('input[type="radio"][name^="tf-"]')) {
                this.updatePreviewDebounced();
            }
        };

        this.listeners.imageHandler = (e) => {
            if (e.target.matches('.image-input')) {
                this.updatePreviewDebounced();
            }
        };

        // Add event listeners
        document.addEventListener('input', this.listeners.inputHandler);
        document.addEventListener('change', this.listeners.changeHandler);
        document.addEventListener('change', this.listeners.radioHandler);
        document.addEventListener('change', this.listeners.checkboxHandler);
        document.addEventListener('change', this.listeners.trueFalseHandler);
        document.addEventListener('change', this.listeners.imageHandler);
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
        
        // DEBUG: Log all question items and their indices
        questionItems.forEach((item, index) => {
            const questionType = item.querySelector('.question-type')?.value || 'unknown';
            const questionText = item.querySelector('.question-text')?.value?.substring(0, 30) || 'empty';
            logger.debug(`Question ${index}: type=${questionType}, text="${questionText}"`);
        });
        
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
            logger.debug('Available question items:', questionItems.length, 'DOM nodes found');
            
            // Only reset to 0 if we have questions and current index is invalid
            if (totalQuestions > 0 && questionItems.length > 0) {
                logger.debug('Resetting to question 0');
                this.currentPreviewQuestion = 0;
                const firstQuestion = questionItems[0];
                if (!firstQuestion) {
                    logger.error('First question also not found, aborting preview update');
                    return;
                }
                
                const questionData = this.extractQuestionDataForPreview(firstQuestion);
                questionData.questionNumber = 1;
                questionData.totalQuestions = totalQuestions;
                this.renderSplitQuestionPreview(questionData);
            } else {
                logger.warn('No questions available for preview');
                this.showEmptySplitPreview();
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
        logger.debug('Rendering preview for question:', {
            question: data.question?.substring(0, 50) + '...',
            type: data.type,
            questionNumber: data.questionNumber,
            totalQuestions: data.totalQuestions,
            optionsCount: data.options?.length || 0
        });
        
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
        logger.debug('Question data for rendering:', {
            questionNumber: data.questionNumber,
            type: data.type,
            hasOptions: !!data.options,
            optionsLength: data.options?.length,
            correctAnswer: data.correctAnswer,
            correctAnswers: data.correctAnswers
        });
        
        // Show appropriate answer type
        switch (data.type) {
            case 'multiple-choice':
                logger.debug('🔤 Rendering multiple choice preview');
                this.renderSplitMultipleChoicePreview(data.options, data.correctAnswer);
                break;
            case 'multiple-correct':
                logger.debug('☑️ Rendering multiple correct preview');
                this.renderSplitMultipleCorrectPreview(data.options, data.correctAnswers);
                break;
            case 'true-false':
                logger.debug('✅ Rendering true/false preview');
                this.renderSplitTrueFalsePreview(data.correctAnswer);
                break;
            case 'numeric':
                logger.debug('🔢 Rendering numeric preview');
                this.renderSplitNumericPreview();
                break;
            default:
                logger.warn('Unknown question type:', data.type);
        }
        
        // Render LaTeX in split preview with proper targeting and retry mechanism
        this.renderMathJaxForPreview();
    }

    /**
     * Render MathJax for preview content with enhanced navigation support
     */
    renderMathJaxForPreview() {
        // Prevent multiple simultaneous renders
        if (this.mathJaxRenderingInProgress) {
            logger.debug('🔒 MathJax rendering already in progress, skipping');
            return;
        }

        const previewElement = document.getElementById('preview-content-split');
        
        if (!previewElement) {
            logger.warn('Preview content element not found for MathJax rendering');
            return;
        }

        // Set rendering lock
        this.mathJaxRenderingInProgress = true;

        // Use requestAnimationFrame to ensure content is populated before rendering
        requestAnimationFrame(() => {
            // Additional timeout to ensure content is fully populated
            setTimeout(() => {
                const hasLatexContent = previewElement.innerHTML.includes('$$') || 
                                       previewElement.innerHTML.includes('\\(') ||
                                       previewElement.innerHTML.includes('\\[') ||
                                       previewElement.innerHTML.includes('$') ||  // Single dollar delimiters
                                       previewElement.innerHTML.includes('\\frac') ||  // Common LaTeX commands
                                       previewElement.innerHTML.includes('\\sqrt') ||
                                       previewElement.innerHTML.includes('\\sum') ||
                                       previewElement.innerHTML.includes('\\int');
                
                logger.debug('🔍 Preview MathJax render check:', {
                    elementFound: !!previewElement,
                    hasLatexContent: hasLatexContent,
                    contentLength: previewElement.innerHTML.length,
                    mathJaxService: !!this.mathJaxService,
                    mathJaxReady: !!window.MathJax
                });

                if (hasLatexContent && this.mathJaxService) {
                    logger.debug('🧮 Rendering MathJax for preview content');
                    
                    // Platform-specific timing - Windows needs extra time for DOM stabilization
                    const renderTimeout = this.mathJaxService.isWindows ? 400 : 100;
                    
                    // Windows-specific: Additional content stability check
                    if (this.mathJaxService.isWindows) {
                        // Wait for content to be stable before rendering
                        setTimeout(() => {
                            const contentStillHasLatex = previewElement.innerHTML.includes('$') || 
                                                       previewElement.innerHTML.includes('\\frac') ||
                                                       previewElement.innerHTML.includes('\\sqrt');
                            
                            if (contentStillHasLatex) {
                                this.mathJaxService.renderElement(previewElement, renderTimeout, 3)
                                    .then(() => {
                                        logger.debug('✅ Preview MathJax rendering completed successfully (Windows delayed)');
                                        this.mathJaxRenderingInProgress = false; // Clear rendering lock
                                    })
                                    .catch(err => {
                                        logger.warn('🔍 Preview MathJax rendering failed, trying fallback:', err);
                                        this.fallbackMathJaxRender(previewElement)
                                            .finally(() => {
                                                this.mathJaxRenderingInProgress = false; // Clear rendering lock
                                            });
                                    });
                            } else {
                                logger.debug('📝 LaTeX content disappeared during Windows delay, skipping render');
                                this.mathJaxRenderingInProgress = false; // Clear rendering lock
                            }
                        }, 100); // Additional 100ms delay for Windows content stability
                    } else {
                        // macOS and other platforms use immediate rendering
                        this.mathJaxService.renderElement(previewElement, renderTimeout, 3)
                            .then(() => {
                                logger.debug('✅ Preview MathJax rendering completed successfully');
                                this.mathJaxRenderingInProgress = false; // Clear rendering lock
                            })
                            .catch(err => {
                                logger.warn('🔍 Preview MathJax rendering failed, trying fallback:', err);
                                this.fallbackMathJaxRender(previewElement)
                                    .finally(() => {
                                        this.mathJaxRenderingInProgress = false; // Clear rendering lock
                                    });
                            });
                    }
                } else if (!hasLatexContent) {
                    logger.debug('📝 No LaTeX content found in preview, skipping MathJax rendering');
                    this.mathJaxRenderingInProgress = false; // Clear rendering lock
                } else {
                    logger.warn('🔍 MathJax service not available for preview rendering');
                    this.mathJaxRenderingInProgress = false; // Clear rendering lock
                    
                    // Try direct MathJax rendering as fallback
                    if (hasLatexContent && window.MathJax) {
                        this.fallbackMathJaxRender(previewElement);
                    }
                }
            }, 50); // Small delay to ensure content is populated
        });
    }

    /**
     * Fallback MathJax rendering for preview
     */
    fallbackMathJaxRender(element) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            logger.debug('🔄 Using fallback MathJax rendering for preview');
            
            return window.MathJax.typesetPromise([element])
                .then(() => {
                    logger.debug('✅ Fallback MathJax rendering completed');
                })
                .catch(err => {
                    logger.warn('❌ Fallback MathJax rendering also failed:', err);
                });
        } else {
            logger.warn('🚫 No MathJax rendering methods available');
            return Promise.resolve(); // Return resolved promise when no MathJax available
        }
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
            optionDiv.innerHTML = `${getOptionLetter(index)}: ${this.formatCodeBlocks(option)}`;
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
            optionDiv.innerHTML = `<input type="checkbox" ${isCorrect ? 'checked' : ''} disabled> ${getOptionLetter(index)}: ${this.formatCodeBlocks(option)}`;
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
        
        // Add a flag to prevent auto-scroll during manual navigation
        if (this.manualNavigationInProgress) {
            logger.debug('Manual navigation in progress, skipping auto-scroll');
            return;
        }
        
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
                // updateSplitPreview() already calls renderMathJaxForPreview()
            } else {
                console.log(`❌ Invalid questionIndex: ${questionIndex}, not updating preview`);
            }
        }
    }

    /**
     * Clean up preview listeners
     */
    cleanupPreviewListeners() {
        logger.debug('Cleaning up preview listeners');
        
        // Remove navigation button listeners
        const prevBtn = document.getElementById('preview-prev-split');
        const nextBtn = document.getElementById('preview-next-split');
        const scrollBtn = document.getElementById('scroll-to-question');
        
        if (prevBtn && this.listeners.prevBtn) {
            prevBtn.removeEventListener('click', this.listeners.prevBtn);
        }
        if (nextBtn && this.listeners.nextBtn) {
            nextBtn.removeEventListener('click', this.listeners.nextBtn);
        }
        if (scrollBtn && this.listeners.scrollBtn) {
            scrollBtn.removeEventListener('click', this.listeners.scrollBtn);
        }
        
        // Remove document-level listeners
        if (this.listeners.inputHandler) {
            document.removeEventListener('input', this.listeners.inputHandler);
        }
        if (this.listeners.changeHandler) {
            document.removeEventListener('change', this.listeners.changeHandler);
        }
        if (this.listeners.radioHandler) {
            document.removeEventListener('change', this.listeners.radioHandler);
        }
        if (this.listeners.checkboxHandler) {
            document.removeEventListener('change', this.listeners.checkboxHandler);
        }
        if (this.listeners.trueFalseHandler) {
            document.removeEventListener('change', this.listeners.trueFalseHandler);
        }
        if (this.listeners.imageHandler) {
            document.removeEventListener('change', this.listeners.imageHandler);
        }
        
        // Clear listener references
        this.listeners = {
            prevBtn: null,
            nextBtn: null,
            scrollBtn: null,
            inputHandler: null,
            changeHandler: null,
            radioHandler: null,
            checkboxHandler: null,
            trueFalseHandler: null,
            imageHandler: null
        };
        
        // Reset flags
        this.previewListenersSet = false;
        this.splitPreviewListenersSet = false;
        
        logger.debug('Preview listeners cleanup completed');
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
     * Legacy method for backward compatibility - now uses centralized rendering
     */
    renderMathJaxWithRetry(attempt = 0) {
        logger.debug('Legacy renderMathJaxWithRetry called, using new centralized method');
        this.renderMathJaxForPreview();
    }

    /**
     * Check if preview mode is active
     */
    isPreviewMode() {
        return this.previewMode;
    }
}