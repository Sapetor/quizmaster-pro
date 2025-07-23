/**
 * Preview Manager Module
 * Handles live preview functionality with auto-scroll and real-time updates
 * Restored to match original monolithic functionality
 */

import { translationManager } from '../utils/translation-manager.js';
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
        this.updatePreviewDebounced = this.debounce(() => this.updateSplitPreview(), 150);
        
        // Drag functionality state
        this.isDragging = false;
        this.dragStartX = 0;
        this.initialSplitRatio = 50;
        this.dragTooltip = null;
        
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
            imageHandler: null,
            // Drag handlers
            dragStart: null,
            dragMove: null,
            dragEnd: null
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
            
            // Show resize handle
            const resizeHandle = document.getElementById('split-resize-handle');
            if (resizeHandle) {
                resizeHandle.style.display = 'flex';
            }
            
            // SET DEFAULT 70/30 SPLIT RATIO (EDITOR/PREVIEW)
            hostContainer.style.setProperty('--split-left', '70fr');
            hostContainer.style.setProperty('--split-right', '30fr');
            logger.debug('Set default 70/30 split ratio on preview activation');
            
            // Position the drag handle at 70%
            this.updateDragHandlePosition(70);
            
            // Update button styling and text
            if (toggleBtn) {
                toggleBtn.classList.remove('secondary');
                toggleBtn.classList.add('danger');
                toggleBtn.textContent = translationManager.getTranslationSync('close_live_preview') || 'Close Live Preview';
                toggleBtn.setAttribute('data-translate', 'close_live_preview');
            }
            
            // Initialize preview with async support
            this.initializeSplitPreview().catch(error => {
                logger.warn('Preview initialization error:', error);
                // Fallback to synchronous initialization
                this.setupSplitPreviewEventListeners();
                this.updateSplitPreview();
            });
            // initializeSplitPreview() already calls updateSplitPreview() which calls renderMathJaxForPreview()
            
            // Initialize drag functionality
            this.initializeDragFunctionality();
            
            // Load saved font size preference
            this.loadSavedFontSize();
        } else {
            // Clean up listeners first
            this.cleanupPreviewListeners();
            this.cleanupDragFunctionality();
            
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
            
            // Hide resize handle
            const resizeHandle = document.getElementById('split-resize-handle');
            if (resizeHandle) {
                resizeHandle.style.display = 'none';
            }
            
            // Update button styling and text
            if (toggleBtn) {
                toggleBtn.classList.remove('danger');
                toggleBtn.classList.add('secondary');
                toggleBtn.textContent = translationManager.getTranslationSync('toggle_live_preview') || 'Live Preview';
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
    async initializeSplitPreview() {
        logger.debug('Initializing split preview system');
        
        // Reset preview state completely
        this.currentPreviewQuestion = 0;
        this.manualNavigationInProgress = false;
        
        // Clear any existing update timeouts
        clearTimeout(this.updatePreviewTimeout);
        clearTimeout(this.autoScrollTimeout);
        
        logger.debug('Preview state reset - currentPreviewQuestion:', this.currentPreviewQuestion);
        
        // Ensure translation manager is ready before setting up preview
        if (translationManager && !translationManager.loadedTranslations.has(translationManager.currentLanguage)) {
            logger.debug('Waiting for translation manager to be ready...');
            try {
                await translationManager.ensureLanguageLoaded(translationManager.currentLanguage);
                logger.debug('Translation manager ready for preview');
            } catch (error) {
                logger.warn('Translation manager not ready, using fallbacks:', error);
            }
        }
        
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

        // Navigation buttons for split screen
        const prevBtn = document.getElementById('preview-prev-split');
        const nextBtn = document.getElementById('preview-next-split');
        const scrollBtn = document.getElementById('scroll-to-question');
        
        logger.debug('🔘 Preview navigation buttons found:', {
            prevBtn: !!prevBtn,
            nextBtn: !!nextBtn,
            scrollBtn: !!scrollBtn
        });
        
        // Store listener references for cleanup
        this.listeners.prevBtn = () => {
            const questionItems = document.querySelectorAll('.question-item');
            logger.debug(`Prev button clicked: current=${this.currentPreviewQuestion}, total=${questionItems.length}`);
            
            // Set manual navigation flag to prevent auto-scroll conflicts
            this.manualNavigationInProgress = true;
            
            if (this.currentPreviewQuestion > 0) {
                this.currentPreviewQuestion--;
                this.updateSplitPreview();
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
                this.updateSplitPreview();
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
            logger.debug('✅ Prev button listener attached');
        } else {
            logger.warn('⚠️ Prev button not found - navigation may not work');
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', this.listeners.nextBtn);
            logger.debug('✅ Next button listener attached');
        } else {
            logger.warn('⚠️ Next button not found - navigation may not work');
        }

        if (scrollBtn) {
            scrollBtn.addEventListener('click', this.listeners.scrollBtn);
            logger.debug('✅ Scroll button listener attached');
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
        // Only update if preview mode is active
        if (!this.previewMode) {
            logger.debug('Preview mode not active, skipping updateSplitPreview');
            return;
        }
        
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
        
        logger.debug(`🔍 QUESTION RETRIEVAL:`, {
            requestedIndex: this.currentPreviewQuestion,
            totalItems: questionItems.length,
            foundQuestion: !!currentQuestion,
            className: currentQuestion?.className || 'none'
        });
        
        if (!currentQuestion) {
            logger.error(`❌ Current question not found at index ${this.currentPreviewQuestion}, total questions: ${totalQuestions}`);
            logger.debug('📋 Available question items:', questionItems.length, 'DOM nodes found');
            
            // Only reset to 0 if we have questions and current index is invalid
            if (totalQuestions > 0 && questionItems.length > 0) {
                logger.debug('🔄 Resetting to question 0');
                this.currentPreviewQuestion = 0;
                const firstQuestion = questionItems[0];
                if (!firstQuestion) {
                    logger.error('❌ First question also not found, aborting preview update');
                    return;
                }
                
                const questionData = this.extractQuestionDataForPreview(firstQuestion);
                questionData.questionNumber = 1;
                questionData.totalQuestions = totalQuestions;
                this.renderSplitQuestionPreview(questionData);
            } else {
                logger.warn('📭 No questions available for preview');
                this.showEmptySplitPreview();
            }
            return;
        }

        const questionData = this.extractQuestionDataForPreview(currentQuestion);
        questionData.questionNumber = this.currentPreviewQuestion + 1;
        questionData.totalQuestions = totalQuestions;
        
        logger.debug(`📊 EXTRACTED DATA FOR Q${questionData.questionNumber}:`, {
            hasQuestion: !!questionData.question,
            questionLength: questionData.question?.length || 0,
            questionPreview: questionData.question?.substring(0, 50) + '...' || 'empty',
            type: questionData.type,
            hasOptions: !!questionData.options,
            optionsCount: questionData.options?.length || 0
        });
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
            counterSplit.textContent = `${translationManager.getTranslationSync('question')} ${this.currentPreviewQuestion + 1} ${translationManager.getTranslationSync('of')} ${totalQuestions}`;
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
            previewText.textContent = translationManager.getTranslationSync('no_questions_to_preview') || 'No questions to preview';
        }
        if (counterDisplay) {
            counterDisplay.textContent = `${translationManager.getTranslationSync('question')} 0 ${translationManager.getTranslationSync('of')} 0`;
        }
        if (counterSplit) {
            counterSplit.textContent = `${translationManager.getTranslationSync('question')} 0 ${translationManager.getTranslationSync('of')} 0`;
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
        
        const questionText = questionItem.querySelector('.question-text')?.value?.trim() || translationManager.getTranslationSync('enter_question_preview') || 'Enter question text...';
        const questionType = questionItem.querySelector('.question-type')?.value || 'multiple-choice';
        const imageElement = questionItem.querySelector('.question-image');
        const imageUrl = imageElement ? imageElement.dataset.url || '' : '';
        
        logger.debug('Question text:', questionText);
        logger.debug('Question type:', questionType);
        logger.debug('Image URL:', imageUrl);
        
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
            counterDisplay.textContent = `${translationManager.getTranslationSync('question')} ${data.questionNumber} ${translationManager.getTranslationSync('of')} ${data.totalQuestions}`;
        }
        
        const previewElement = document.getElementById('preview-question-text-split');
        logger.debug('🔍 Preview element found:', !!previewElement, 'Question data:', !!data.question);
        
        if (!previewElement) {
            logger.error('❌ Preview question text element not found! DOM structure may be incorrect.');
            return;
        }
        
        if (data.question) {
            // FOUC Prevention: Detect LaTeX content
            const hasLatex = data.question && (data.question.includes('$') || data.question.includes('\\(') || 
                            data.question.includes('\\[') || data.question.includes('\\frac') ||
                            data.question.includes('\\sqrt') || data.question.includes('\\sum'));
            
            const formattedContent = this.formatCodeBlocks(data.question);
            
            if (hasLatex) {
                // Hide content during LaTeX processing to prevent blinking
                previewElement.style.opacity = '0';
                previewElement.classList.add('tex2jax_process');
                previewElement.innerHTML = formattedContent;
                
                // Show content after MathJax processing completes
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        window.MathJax.typesetPromise([previewElement])
                            .then(() => {
                                previewElement.style.opacity = '1';
                            })
                            .catch(() => {
                                previewElement.style.opacity = '1'; // Show even if MathJax fails
                            });
                    } else {
                        previewElement.style.opacity = '1'; // Show if no MathJax
                    }
                }, 50);
            } else {
                // No LaTeX, show immediately
                previewElement.style.opacity = '1';
                previewElement.innerHTML = formattedContent;
            }
            
            previewElement.dataset.hasContent = 'true';
        } else {
            // Show fallback text when no question data
            previewElement.style.opacity = '1';
            previewElement.innerHTML = translationManager.getTranslationSync('enter_question_preview') || 'Enter question text to see preview...';
            previewElement.dataset.hasContent = 'false';
            logger.debug('🔤 Showing fallback text for empty question');
        }
        
        // Handle image with data URI fix
        const imageDisplay = document.getElementById('preview-question-image-split');
        const img = document.getElementById('preview-question-img-split');
        if (data.image && imageDisplay && img) {
            // Check if it's a data URI (starts with data:)
            if (data.image.startsWith('data:')) {
                img.src = data.image;
                logger.debug('📸 Set preview image: data URI (length:', data.image.length, ')');
            } else {
                // Regular URL - ensure it has proper path
                const imageSrc = data.image.startsWith('/') ? data.image : `/${data.image}`;
                img.src = imageSrc;
                logger.debug('📸 Set preview image: URL', imageSrc);
            }
            imageDisplay.style.display = 'block';
        } else if (data.image) {
            // Image data exists but elements not found
            logger.warn('⚠️ Image data exists but preview elements not found:', {
                hasImage: !!data.image,
                imageType: data.image?.startsWith?.('data:') ? 'data-uri' : 'url',
                hasDisplay: !!imageDisplay,
                hasImg: !!img
            });
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
        
        // LaTeX rendering is now handled individually for each element to prevent blinking
    }

    /**
     * Render MathJax for preview content with enhanced navigation support
     */
    renderMathJaxForPreview() {
        const previewElement = document.getElementById('preview-content-split');
        
        if (!previewElement) return;

        // Wait for MathJax to be ready, especially important after page reload
        this.waitForMathJaxReady(() => {
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise([previewElement]).catch(() => {
                    logger.debug('Preview MathJax rendering failed, using fallback');
                });
            }
        });
    }

    /**
     * Wait for MathJax to be ready before executing callback
     */
    waitForMathJaxReady(callback) {
        if (window.MathJax && window.MathJax.typesetPromise && (window.mathJaxReady || document.body.classList.contains('mathjax-ready'))) {
            callback();
        } else {
            // Wait with polling and event listening
            const checkReady = () => {
                if (window.MathJax && window.MathJax.typesetPromise && (window.mathJaxReady || document.body.classList.contains('mathjax-ready'))) {
                    callback();
                } else {
                    setTimeout(checkReady, 50); // Check every 50ms
                }
            };
            
            // Also listen for the mathjax-ready event
            const readyHandler = () => {
                document.removeEventListener('mathjax-ready', readyHandler);
                callback();
            };
            
            document.addEventListener('mathjax-ready', readyHandler);
            checkReady();
        }
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
                    
                    // FOUC Prevention: Mark as processed
                    const processedElements = element.querySelectorAll('.tex2jax_process');
                    processedElements.forEach(el => {
                        el.classList.add('MathJax_Processed');
                    });
                    
                    // Also mark question text specifically
                    const questionElement = document.getElementById('preview-question-text-split');
                    if (questionElement && questionElement.classList.contains('tex2jax_process')) {
                        questionElement.classList.add('MathJax_Processed');
                    }
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
            
            // Check if option contains LaTeX and apply FOUC prevention
            const hasLatex = option && (option.includes('$') || option.includes('\\(') || 
                            option.includes('\\[') || option.includes('\\frac') ||
                            option.includes('\\sqrt') || option.includes('\\sum'));
            
            const optionLetter = translationManager.getOptionLetter(index) || String.fromCharCode(65 + index);
            const formattedContent = `${optionLetter}: ${this.formatCodeBlocks(option)}`;
            
            if (hasLatex) {
                // Hide option during LaTeX processing to prevent blinking
                optionDiv.style.opacity = '0';
                optionDiv.classList.add('tex2jax_process');
                optionDiv.innerHTML = formattedContent;
                optionsContainer.appendChild(optionDiv);
                
                // Show option after MathJax processing
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        window.MathJax.typesetPromise([optionDiv])
                            .then(() => {
                                optionDiv.style.opacity = '1';
                            })
                            .catch(() => {
                                optionDiv.style.opacity = '1';
                            });
                    } else {
                        optionDiv.style.opacity = '1';
                    }
                }, 50);
            } else {
                // No LaTeX, show immediately
                optionDiv.style.opacity = '1';
                optionDiv.innerHTML = formattedContent;
                optionsContainer.appendChild(optionDiv);
            }
            
            logger.debug(`Added option ${index}: ${option} (${isCorrect ? 'correct' : 'incorrect'}) - LaTeX: ${hasLatex}`);
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
            
            // Check if option contains LaTeX and apply FOUC prevention
            const hasLatex = option && (option.includes('$') || option.includes('\\(') || 
                            option.includes('\\[') || option.includes('\\frac') ||
                            option.includes('\\sqrt') || option.includes('\\sum'));
            
            const optionLetter = translationManager.getOptionLetter(index) || String.fromCharCode(65 + index);
            const formattedContent = `<input type="checkbox" ${isCorrect ? 'checked' : ''} disabled> ${optionLetter}: ${this.formatCodeBlocks(option)}`;
            
            if (hasLatex) {
                // Hide option during LaTeX processing to prevent blinking
                optionDiv.style.opacity = '0';
                optionDiv.classList.add('tex2jax_process');
                optionDiv.innerHTML = formattedContent;
                optionsContainer.appendChild(optionDiv);
                
                // Show option after MathJax processing
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        window.MathJax.typesetPromise([optionDiv])
                            .then(() => {
                                optionDiv.style.opacity = '1';
                            })
                            .catch(() => {
                                optionDiv.style.opacity = '1';
                            });
                    } else {
                        optionDiv.style.opacity = '1';
                    }
                }, 50);
            } else {
                // No LaTeX, show immediately
                optionDiv.style.opacity = '1';
                optionDiv.innerHTML = formattedContent;
                optionsContainer.appendChild(optionDiv);
            }
            
            logger.debug(`Added multiple correct option ${index}: ${option} (${isCorrect ? 'correct' : 'incorrect'}) - LaTeX: ${hasLatex}`);
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
            
            const trueOptionLetter = translationManager.getOptionLetter(0) || 'A';
            const falseOptionLetter = translationManager.getOptionLetter(1) || 'B';
            const trueText = translationManager.getTranslationSync('true') || 'True';
            const falseText = translationManager.getTranslationSync('false') || 'False';
            
            trueOption.textContent = `${trueOptionLetter}: ${trueText}`;
            falseOption.textContent = `${falseOptionLetter}: ${falseText}`;
            
            logger.debug('✅ True/False buttons updated successfully');
        } else {
            logger.error('❌ True/False option buttons not found!');
        }
    }

    /**
     * Render split numeric preview
     */
    renderSplitNumericPreview() {
        logger.debug('🔢 Rendering numeric preview');
        
        // Ensure other containers are hidden
        document.getElementById('preview-true-false-split').style.display = 'none';
        document.getElementById('preview-multiple-choice-split').style.display = 'none';
        document.getElementById('preview-multiple-correct-split').style.display = 'none';
        
        document.getElementById('preview-numeric-split').style.display = 'block';
        
        const input = document.getElementById('preview-numeric-input-split');
        if (input) {
            input.placeholder = translationManager.getTranslationSync('enter_answer') || 'Enter your answer';
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
        
        logger.debug(`📝 Auto-scroll triggered: questionIndex=${questionIndex}, current=${this.currentPreviewQuestion}, total=${questionItems.length}`);
        
        if (questionIndex !== -1 && questionIndex !== this.currentPreviewQuestion) {
            // Validate the index before updating
            if (questionIndex >= 0 && questionIndex < questionItems.length) {
                logger.debug(`🎯 Auto-scrolling preview from question ${this.currentPreviewQuestion + 1} to ${questionIndex + 1}`);
                this.currentPreviewQuestion = questionIndex;
                this.updateSplitPreview();
                // updateSplitPreview() already calls renderMathJaxForPreview()
            } else {
                logger.debug(`❌ Invalid questionIndex: ${questionIndex}, not updating preview`);
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
            imageHandler: null,
            // Drag handlers
            dragStart: null,
            dragMove: null,
            dragEnd: null,
            sliderChange: null
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
     * Initialize drag functionality for the split divider
     */
    initializeDragFunctionality() {
        const resizeHandle = document.getElementById('split-resize-handle');
        if (!resizeHandle) {
            logger.warn('Resize handle not found, drag functionality not initialized');
            return;
        }

        // Mouse down on resize handle
        this.listeners.dragStart = (e) => {
            e.preventDefault();
            this.isDragging = true;
            this.dragStartX = e.clientX;
            
            // Get current split ratio
            const hostContainer = document.querySelector('.host-container');
            const computedStyle = getComputedStyle(hostContainer);
            const leftValue = computedStyle.getPropertyValue('--split-left').trim();
            
            // Parse current ratio (handle both 'fr' and '%' units)
            if (leftValue.endsWith('fr')) {
                this.initialSplitRatio = parseFloat(leftValue);
            } else if (leftValue.endsWith('%')) {
                this.initialSplitRatio = parseFloat(leftValue);
            } else {
                this.initialSplitRatio = 70; // Default fallback to 70/30 split
            }
            
            resizeHandle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            // Create and show tooltip
            this.createDragTooltip();
            
            logger.debug('Drag started', { initialRatio: this.initialSplitRatio, startX: this.dragStartX });
        };

        // Mouse move during drag
        this.listeners.dragMove = (e) => {
            if (!this.isDragging) return;
            
            e.preventDefault();
            const hostContainer = document.querySelector('.host-container');
            const containerRect = hostContainer.getBoundingClientRect();
            const containerWidth = containerRect.width;
            
            // Calculate new ratio based on mouse position
            const mouseX = e.clientX - containerRect.left;
            const newRatio = Math.max(25, Math.min(75, (mouseX / containerWidth) * 100));
            
            // Update CSS custom properties
            hostContainer.style.setProperty('--split-left', `${newRatio}fr`);
            hostContainer.style.setProperty('--split-right', `${100 - newRatio}fr`);
            
            // Update drag handle position
            this.updateDragHandlePosition(newRatio);
            
            
            // Update tooltip position and content
            this.updateDragTooltip(e.clientX, newRatio);
            
            logger.debug('Dragging', { newRatio, mouseX, containerWidth });
        };

        // Mouse up - end drag
        this.listeners.dragEnd = (e) => {
            if (!this.isDragging) return;
            
            this.isDragging = false;
            resizeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Hide and remove tooltip
            this.hideDragTooltip();
            
            // Save the new ratio to localStorage
            const hostContainer = document.querySelector('.host-container');
            const leftValue = getComputedStyle(hostContainer).getPropertyValue('--split-left').trim();
            const ratio = parseFloat(leftValue);
            
            if (!isNaN(ratio)) {
                localStorage.setItem('splitRatio', ratio.toString());
                logger.debug('Saved split ratio to localStorage', { ratio });
            }
            
            logger.debug('Drag ended');
        };

        // Add event listeners
        resizeHandle.addEventListener('mousedown', this.listeners.dragStart);
        document.addEventListener('mousemove', this.listeners.dragMove);
        document.addEventListener('mouseup', this.listeners.dragEnd);
        
        // Load saved ratio from localStorage
        this.loadSavedSplitRatio();
    }


    /**
     * Update the drag handle position based on the split ratio
     */
    updateDragHandlePosition(ratio) {
        const resizeHandle = document.getElementById('split-resize-handle');
        if (!resizeHandle) return;
        
        // Position the handle at the split ratio percentage
        resizeHandle.style.left = `${ratio}%`;
        
        logger.debug('Updated drag handle position', { ratio });
    }

    /**
     * Load saved split ratio from localStorage
     */
    loadSavedSplitRatio() {
        const savedRatio = localStorage.getItem('splitRatio');
        if (savedRatio) {
            const ratio = parseFloat(savedRatio);
            if (!isNaN(ratio) && ratio >= 25 && ratio <= 75) {
                const hostContainer = document.querySelector('.host-container');
                if (hostContainer) {
                    hostContainer.style.setProperty('--split-left', `${ratio}fr`);
                    hostContainer.style.setProperty('--split-right', `${100 - ratio}fr`);
                    this.updateDragHandlePosition(ratio);
                    logger.debug('Loaded saved split ratio', { ratio });
                }
            }
        }
    }


    /**
     * Create drag tooltip
     */
    createDragTooltip() {
        if (this.dragTooltip) {
            this.dragTooltip.remove();
        }
        
        this.dragTooltip = document.createElement('div');
        this.dragTooltip.className = 'drag-tooltip';
        this.dragTooltip.textContent = '50% / 50%';
        document.body.appendChild(this.dragTooltip);
        
        // Show tooltip after a brief delay
        setTimeout(() => {
            if (this.dragTooltip) {
                this.dragTooltip.classList.add('visible');
            }
        }, 100);
    }

    /**
     * Update drag tooltip position and content
     */
    updateDragTooltip(mouseX, ratio) {
        if (!this.dragTooltip) return;
        
        this.dragTooltip.style.left = `${mouseX}px`;
        this.dragTooltip.style.top = `${window.scrollY + 100}px`;
        this.dragTooltip.textContent = `${Math.round(ratio)}% / ${Math.round(100 - ratio)}%`;
    }

    /**
     * Hide and remove drag tooltip
     */
    hideDragTooltip() {
        if (this.dragTooltip) {
            this.dragTooltip.classList.remove('visible');
            setTimeout(() => {
                if (this.dragTooltip) {
                    this.dragTooltip.remove();
                    this.dragTooltip = null;
                }
            }, 200);
        }
    }

    /**
     * Clean up drag functionality
     */
    cleanupDragFunctionality() {
        const resizeHandle = document.getElementById('split-resize-handle');
        
        if (resizeHandle && this.listeners.dragStart) {
            resizeHandle.removeEventListener('mousedown', this.listeners.dragStart);
        }
        
        if (this.listeners.dragMove) {
            document.removeEventListener('mousemove', this.listeners.dragMove);
        }
        
        if (this.listeners.dragEnd) {
            document.removeEventListener('mouseup', this.listeners.dragEnd);
        }
        
        
        // Reset drag state
        this.isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Clean up tooltip
        this.hideDragTooltip();
    }

    /**
     * Load saved font size preference - much simpler now!
     */
    loadSavedFontSize() {
        const savedSize = localStorage.getItem('globalFontSize');
        if (savedSize && ['small', 'medium', 'large', 'xlarge'].includes(savedSize)) {
            setTimeout(() => {
                if (window.setGlobalFontSize) {
                    window.setGlobalFontSize(savedSize);
                }
            }, 100);
        } else {
            // Set default to medium
            setTimeout(() => {
                if (window.setGlobalFontSize) {
                    window.setGlobalFontSize('medium');
                }
            }, 100);
        }
    }

    /**
     * Check if preview mode is active
     */
    isPreviewMode() {
        return this.previewMode;
    }
}