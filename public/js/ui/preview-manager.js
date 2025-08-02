/**
 * Preview Manager Module
 * Handles live preview functionality with auto-scroll and real-time updates
 * Restored to match original monolithic functionality
 */

import { translationManager } from '../utils/translation-manager.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { simpleMathJaxService } from '../utils/simple-mathjax-service.js';
import { contentDensityManager } from '../utils/content-density-manager.js';
import { SplitLayoutManager } from './modules/split-layout-manager.js';
import { PreviewRenderer } from './modules/preview-renderer.js';
import { logger, TIMING, UI } from '../core/config.js';

export class PreviewManager {
    constructor(mathRenderer) {
        this.mathRenderer = mathRenderer || new MathRenderer();
        this.mathJaxService = simpleMathJaxService;
        this.splitLayoutManager = new SplitLayoutManager();
        this.previewRenderer = new PreviewRenderer();
        this.currentPreviewQuestion = 0;
        this.previewListenersSet = false;
        this.splitPreviewListenersSet = false;
        this.previewMode = false;
        this.manualNavigationInProgress = false;
        this.updatePreviewDebounced = this.debounce(() => this.updateSplitPreview(), TIMING.ANIMATION_DURATION);
        
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
            
            // Initialize split layout (handles resize handle, drag functionality, and ratios)
            this.splitLayoutManager.initializeSplitLayout();
            
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
            // initializeSplitPreview() already calls updateSplitPreview() which handles rendering
        } else {
            // Clean up listeners first
            this.cleanupPreviewListeners();
            this.splitLayoutManager.cleanupSplitLayout();
            
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
        
        // Clear simple MathJax cache for fresh rendering
        if (this.mathJaxService && this.mathJaxService.clearCache) {
            this.mathJaxService.clearCache();
            logger.debug('MathJax cache cleared for fresh preview rendering');
        }

        // Track who called updateSplitPreview
        const stack = new Error().stack;
        const caller = stack.split('\n')[2]?.trim() || 'unknown';
        logger.debug(`UPDATE SPLIT PREVIEW: total=${totalQuestions}, current=${this.currentPreviewQuestion}, caller=${caller}`);
        
        // Log all question items and their indices
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
                this.previewRenderer.renderSplitQuestionPreview(questionData);
                
                // Render MathJax after content is ready
                setTimeout(() => {
                    this.previewRenderer.renderMathJaxForPreview();
                }, 100);
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
        
        
        this.previewRenderer.renderSplitQuestionPreview(questionData);
        
        // Render MathJax after content is ready
        setTimeout(() => {
            this.previewRenderer.renderMathJaxForPreview();
        }, 100);
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
                // Use more specific selector to avoid conflicts with image uploads
                const mcOptions = questionItem.querySelectorAll('.multiple-choice-options .options .option');
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
                // Use more specific selector for multiple correct options
                const mcorrOptions = questionItem.querySelectorAll('.multiple-correct-options .options-checkboxes .option');
                logger.debug('Found multiple correct option elements:', mcorrOptions.length);
                mcorrOptions.forEach((opt, idx) => {
                    logger.debug(`Option ${idx}: element type=${opt.tagName}, value="${opt.value}", textContent="${opt.textContent}"`);
                });
                
                options = Array.from(mcorrOptions)
                    .map(opt => opt.value?.trim())
                    .filter(opt => opt && opt !== '' && opt !== 'Option text')  // Filter out empty/placeholder options
                    .slice(0, 6); // Limit to max 6 options
                
                const correctCheckboxes = questionItem.querySelectorAll('.multiple-correct-options .correct-option:checked');
                correctAnswers = Array.from(correctCheckboxes).map(cb => parseInt(cb.dataset.option));
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
     * Update the question counter display for split preview
     */
    updateSplitQuestionCounter(questionNumber, totalQuestions) {
        const counterDisplay = document.getElementById('preview-question-counter-display-split');
        if (counterDisplay) {
            counterDisplay.textContent = `${translationManager.getTranslationSync('question')} ${questionNumber} ${translationManager.getTranslationSync('of')} ${totalQuestions}`;
        }
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
                // updateSplitPreview() already handles rendering
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
     * Check if preview mode is active
     */
    isPreviewMode() {
        return this.previewMode;
    }
}