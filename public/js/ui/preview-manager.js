/**
 * Preview Manager Module
 * Handles live preview functionality with auto-scroll and real-time updates
 * Restored to match original monolithic functionality
 */

import { translationManager } from '../utils/translation-manager.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { MathJaxService } from '../utils/mathjax-service.js';
import { contentDensityManager } from '../utils/content-density-manager.js';
import { logger, TIMING, UI } from '../core/config.js';

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
        this.updatePreviewDebounced = this.debounce(() => this.updateSplitPreview(), TIMING.ANIMATION_DURATION);
        
        // Drag functionality state
        this.isDragging = false;
        this.dragStartX = 0;
        this.initialSplitRatio = UI.INITIAL_SPLIT_RATIO;
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
        
        // CRITICAL FIX: NUCLEAR CACHE CLEAR - Clear ALL caches to force fresh rendering
        // This prevents stale cached content from causing invisible/unselectable LaTeX
        if (this.mathJaxService) {
            // Clear render debounce cache
            if (this.mathJaxService.renderService && this.mathJaxService.renderService.renderDebounce) {
                const debounceCache = this.mathJaxService.renderService.renderDebounce;
                const initialDebounceSize = debounceCache.size;
                debounceCache.clear(); // NUCLEAR: Clear entire debounce cache
                logger.warn(`🧹 NUCLEAR DEBOUNCE CLEAR: Removed ${initialDebounceSize} debounce entries`);
            }
            
            // Clear MathJax content cache (this is the cached rendered content)
            if (this.mathJaxService.cacheService && this.mathJaxService.cacheService.mathJaxCache) {
                const mathJaxCache = this.mathJaxService.cacheService.mathJaxCache;
                const initialCacheSize = mathJaxCache.size;
                mathJaxCache.clear(); // NUCLEAR: Clear entire MathJax cache to force fresh rendering
                logger.warn(`🧹 NUCLEAR MATHJAX CACHE CLEAR: Removed ${initialCacheSize} cached MathJax entries - forcing fresh rendering`);
            }
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
        
        
        this.updateSplitQuestionCounter(data.questionNumber, data.totalQuestions);
        this.renderSplitQuestionText(data.question);
        this.handleSplitQuestionImage(data.image);
        this.clearAllSplitAnswerTypes();
        this.renderSplitAnswerType(data);
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
     * Render question text with LaTeX support for split preview
     */
    renderSplitQuestionText(questionText) {
        const previewElement = document.getElementById('preview-question-text-split');
        logger.debug('🔍 Preview element found:', !!previewElement, 'Question data:', !!questionText);
        
        if (!previewElement) {
            logger.error('❌ Preview question text element not found! DOM structure may be incorrect.');
            return;
        }
        
        if (questionText) {
            this.renderSplitTextWithLatex(previewElement, questionText);
            previewElement.dataset.hasContent = 'true';
        } else {
            this.showSplitFallbackText(previewElement);
        }
    }

    /**
     * Render text with LaTeX support and FOUC prevention
     */
    renderSplitTextWithLatex(element, text) {
        // FOUC Prevention: Detect LaTeX content using same logic as render service
        const hasLatex = text && (text.includes('$$') || 
                        text.includes('\\(') ||
                        text.includes('\\[') ||
                        text.includes('$') ||
                        text.includes('\\frac') ||
                        text.includes('\\sqrt') ||
                        text.includes('\\sum') ||
                        text.includes('\\int') ||
                        text.includes('\\lim') ||
                        text.includes('\\alpha') ||
                        text.includes('\\beta') ||
                        text.includes('\\gamma') ||
                        text.includes('\\delta') ||
                        text.includes('\\theta') ||
                        text.includes('\\pi') ||
                        text.includes('\\sin') ||
                        text.includes('\\cos') ||
                        text.includes('\\tan') ||
                        text.includes('\\log') ||
                        text.includes('\\ln'));
        
        const formattedContent = this.formatCodeBlocks(text);
        logger.debug(`🔍 Preview LaTeX detection - hasLatex: ${hasLatex}, text: "${text?.substring(0, 50)}..."`);
        
        // Always set content first
        element.innerHTML = formattedContent;
        
        if (hasLatex) {
            // CRITICAL FIX: Aggressive state reset for session-based cache interference
            element.classList.remove('mathjax-ready', 'mathjax-loading', 'tex2jax_process');
            
            // Also clear any cached MathJax content attributes that might interfere
            element.removeAttribute('data-mathJax-original');
            element.removeAttribute('data-has-loading-overlay');
            
            // NUCLEAR DOM CLEAR: Remove ALL MathJax-generated content and reset DOM completely
            const existingMathJax = element.querySelectorAll('mjx-container, .MathJax, mjx-math, mjx-assistive-mml');
            existingMathJax.forEach(mjx => mjx.remove());
            
            // Also clear any data attributes that MathJax might have set
            element.removeAttribute('data-mjx-content');
            element.removeAttribute('data-mjx-processed');
            
            // Hide content during LaTeX processing to prevent blinking
            element.style.opacity = '0';
            element.classList.add('tex2jax_process');
            logger.debug('🔄 Starting MathJax processing for preview element with aggressive state reset');
            
            // CRITICAL FIX: Add timeout fallback to prevent permanent invisibility
            let renderCompleted = false;
            const fallbackTimeout = setTimeout(() => {
                if (!renderCompleted) {
                    logger.warn('⚠️ Preview LaTeX render timeout fallback - showing content anyway');
                    // NUCLEAR FIX: Force complete CSS override to eliminate transition interference
                    element.style.setProperty('opacity', '1', 'important');
                    element.style.setProperty('transition', 'none', 'important');
                    element.style.setProperty('animation', 'none', 'important');
                    element.classList.remove('tex2jax_process');
                    renderCompleted = true;
                }
            }, 2000); // 2 second fallback timeout
            
            // Show content after MathJax processing completes - use fast mode for preview to avoid F5 corruption detection
            setTimeout(() => {
                // CRITICAL FIX: Use renderElement with higher retry count instead of renderElementFast for preview reliability
                // Fast mode was causing failures in complex LaTeX scenarios in preview contexts
                this.mathJaxService.renderElement(element, 100, 8, true) // fastMode=true, higher retries for reliability
                    .then(() => {
                        if (!renderCompleted) {
                            // CRITICAL VALIDATION: Verify MathJax actually created visible content before declaring success
                            const mathJaxElements = element.querySelectorAll('mjx-container, .MathJax, mjx-math');
                            const hasActualContent = mathJaxElements.length > 0;
                            const hasVisibleHeight = element.offsetHeight > 0;
                            const textContent = element.textContent.trim();
                            
                            if (hasActualContent && hasVisibleHeight && textContent.length > 0) {
                                logger.debug(`✅ MathJax preview rendering successful with ${mathJaxElements.length} elements`);
                                // NUCLEAR FIX: Force complete CSS override to eliminate transition interference
                                element.style.setProperty('opacity', '1', 'important');
                                element.style.setProperty('transition', 'none', 'important'); // Disable transitions
                                element.style.setProperty('animation', 'none', 'important'); // Disable animations
                                element.classList.remove('tex2jax_process'); // Remove processing class
                                renderCompleted = true;
                                clearTimeout(fallbackTimeout);
                            } else {
                                // CRITICAL: MathJax reported success but no actual content - force fallback
                                logger.warn(`⚠️ MathJax render reported success but no content found - MathJax: ${mathJaxElements.length}, Height: ${element.offsetHeight}px, Text: "${textContent.substring(0, 50)}..."`);
                                // NUCLEAR FIX: Force complete CSS override
                                element.style.setProperty('opacity', '1', 'important');
                                element.style.setProperty('transition', 'none', 'important');
                                element.style.setProperty('animation', 'none', 'important');
                                element.classList.remove('tex2jax_process');
                                renderCompleted = true;
                                clearTimeout(fallbackTimeout);
                            }
                            
                            // Check actual visual state after validation
                            setTimeout(() => {
                                const computedStyle = window.getComputedStyle(element);
                                const parentComputedStyle = window.getComputedStyle(element.parentElement);
                                const rect = element.getBoundingClientRect();
                                
                                logger.error(`🔍 QUESTION VISUAL STATE - Opacity: ${element.style.opacity}/${computedStyle.opacity}, Display: ${element.style.display}/${computedStyle.display}, Visible: ${element.offsetParent !== null}, Height: ${rect.height}px, MathJax: ${element.querySelectorAll('mjx-container, .MathJax').length}, Classes: ${element.className}, Parent opacity: ${element.parentElement?.style.opacity}/${parentComputedStyle.opacity}, Text: "${element.textContent.substring(0, 50)}..."`);
                            }, 100);
                        }
                    })
                    .catch((error) => {
                        if (!renderCompleted) {
                            logger.debug('❌ MathJax preview rendering failed:', error);
                            // NUCLEAR FIX: Force complete CSS override to eliminate transition interference
                            element.style.setProperty('opacity', '1', 'important');
                            element.style.setProperty('transition', 'none', 'important');
                            element.style.setProperty('animation', 'none', 'important');
                            element.classList.remove('tex2jax_process');
                            renderCompleted = true;
                            clearTimeout(fallbackTimeout);
                        }
                    });
            }, 10); // Reduced delay for faster preview updates
        } else {
            // No LaTeX, show immediately without MathJax processing
            element.style.opacity = '1';
            element.classList.remove('tex2jax_process'); // Remove any existing classes
            logger.debug('📝 No LaTeX detected, showing content immediately');
            // Content already set above
        }
    }

    /**
     * Show fallback text when no question data is available
     */
    showSplitFallbackText(element) {
        element.style.opacity = '1';
        element.innerHTML = translationManager.getTranslationSync('enter_question_preview') || 'Enter question text to see preview...';
        element.dataset.hasContent = 'false';
        logger.debug('🔤 Showing fallback text for empty question');
    }

    /**
     * Handle image display with error handling for split preview
     */
    handleSplitQuestionImage(imageData) {
        const imageDisplay = document.getElementById('preview-question-image-split');
        const img = document.getElementById('preview-question-img-split');
        
        if (imageData && imageDisplay && img) {
            this.setupSplitImageHandlers(img, imageDisplay, imageData);
            this.setSplitImageSource(img, imageData);
            imageDisplay.style.display = 'block';
        } else if (imageData) {
            this.logSplitImageError(imageData, imageDisplay, img);
        } else if (imageDisplay) {
            imageDisplay.style.display = 'none';
        }
    }

    /**
     * Set up image error and load handlers
     */
    setupSplitImageHandlers(img, imageDisplay, imageData) {
        // Add error handling for missing images
        img.onerror = () => {
            img.onerror = null; // Prevent infinite loop
            logger.warn('⚠️ Preview image failed to load:', imageData);
            this.showSplitImageError(imageDisplay, imageData);
        };
        
        // Add load handler to show image when ready
        img.onload = () => {
            imageDisplay.style.display = 'block';
        };
    }

    /**
     * Set image source with proper path handling
     */
    setSplitImageSource(img, imageData) {
        if (imageData.startsWith('data:')) {
            img.src = imageData;
            logger.debug('📸 Set preview image: data URI (length:', imageData.length, ')');
        } else {
            const imageSrc = imageData.startsWith('/') ? imageData : `/${imageData}`;
            img.src = imageSrc;
            logger.debug('📸 Set preview image: URL', imageSrc);
        }
    }

    /**
     * Show image error message in preview
     */
    showSplitImageError(imageDisplay, imageData) {
        const img = imageDisplay.querySelector('img');
        if (img) img.style.display = 'none';
        
        let errorMsg = imageDisplay.querySelector('.image-error-message');
        if (!errorMsg) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'image-error-message';
            errorMsg.style.cssText = `
                padding: 20px;
                text-align: center;
                background: rgba(255, 255, 255, 0.05);
                border: 2px dashed rgba(255, 255, 255, 0.3);
                border-radius: 8px;
                color: var(--text-primary);
                font-size: 0.9rem;
                margin: 10px 0;
            `;
            imageDisplay.appendChild(errorMsg);
        }
        
        errorMsg.innerHTML = `
            <div style="margin-bottom: 8px;">📷 Image not found</div>
            <div style="font-size: 0.8rem; opacity: 0.7;">${imageData}</div>
            <div style="font-size: 0.75rem; opacity: 0.6; margin-top: 4px;">Remove image reference or upload the file</div>
        `;
        
        imageDisplay.style.display = 'block';
        logger.debug('Shown image error message in preview');
    }

    /**
     * Log error when image data exists but elements not found
     */
    logSplitImageError(imageData, imageDisplay, img) {
        logger.warn('⚠️ Image data exists but preview elements not found:', {
            hasImage: !!imageData,
            imageType: imageData?.startsWith?.('data:') ? 'data-uri' : 'url',
            hasDisplay: !!imageDisplay,
            hasImg: !!img
        });
    }

    /**
     * Clear all answer types and reset states for split preview
     */
    clearAllSplitAnswerTypes() {
        logger.debug('CLEARING ALL ANSWER TYPES for split preview');
        
        const answerContainers = [
            'preview-multiple-choice-split',
            'preview-multiple-correct-split', 
            'preview-true-false-split',
            'preview-numeric-split'
        ];
        
        this.hideSplitAnswerContainers(answerContainers);
        this.resetSplitAnswerStates();
    }

    /**
     * Hide specific answer type containers
     */
    hideSplitAnswerContainers(containerIds) {
        containerIds.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'none';
                logger.debug(`Hidden container: ${containerId}`);
            }
        });
    }

    /**
     * Reset all answer type states and clear content
     */
    resetSplitAnswerStates() {
        document.querySelectorAll('#preview-answer-area-split .preview-answer-type').forEach(type => {
            type.style.display = 'none';
            this.clearSplitAnswerContent(type);
            this.resetSplitTrueFalseButtons(type);
            this.resetSplitInputFields(type);
        });
    }

    /**
     * Clear dynamic content from answer types
     */
    clearSplitAnswerContent(type) {
        const playerOptions = type.querySelector('.player-options');
        if (playerOptions) {
            playerOptions.innerHTML = '';
        }
        
        const checkboxOptions = type.querySelector('.player-checkbox-options');
        if (checkboxOptions) {
            checkboxOptions.innerHTML = '';
        }
    }

    /**
     * Reset True/False button states
     */
    resetSplitTrueFalseButtons(type) {
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
    }

    /**
     * Reset input field values
     */
    resetSplitInputFields(type) {
        const inputs = type.querySelectorAll('input');
        inputs.forEach(input => {
            input.value = '';
            input.placeholder = '';
        });
    }

    /**
     * Render the appropriate answer type for split preview
     */
    renderSplitAnswerType(data) {
        logger.debug('Rendering answer type:', data.type, 'with options:', data.options);
        logger.debug('Question data for rendering:', {
            questionNumber: data.questionNumber,
            type: data.type,
            hasOptions: !!data.options,
            optionsLength: data.options?.length,
            correctAnswer: data.correctAnswer,
            correctAnswers: data.correctAnswers
        });
        
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
    }

    /**
     * Render MathJax for preview content with enhanced navigation support
     */
    renderMathJaxForPreview() {
        const previewElement = document.getElementById('preview-content-split');
        
        if (!previewElement) return;

        // Clear any existing MathJax state to ensure fresh rendering
        previewElement.classList.remove('mathjax-ready');
        
        // Also clear MathJax state from all child elements (options, etc.)
        const allMathJaxElements = previewElement.querySelectorAll('.mathjax-ready, .mathjax-loading, .tex2jax_process');
        allMathJaxElements.forEach(el => {
            el.classList.remove('mathjax-ready', 'mathjax-loading', 'tex2jax_process');
        });
        
        // Clear the render debounce cache for preview elements to prevent stale entries
        if (this.mathJaxService && this.mathJaxService.renderService && this.mathJaxService.renderService.renderDebounce) {
            const debounceCache = this.mathJaxService.renderService.renderDebounce;
            const keysToDelete = [];
            for (const [key] of debounceCache.entries()) {
                if (key.includes('preview-') || key.includes('split')) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => debounceCache.delete(key));
            logger.debug(`🧹 Cleared ${keysToDelete.length} debounce cache entries for preview`);
        }
        
        // Small delay for DOM stability on initial loads
        setTimeout(() => {
            // Use fast rendering for live preview - immediate, no delays
            this.mathJaxService.renderElementFast(previewElement).catch(() => {
                logger.debug('Preview MathJax rendering failed, using fallback');
            });
        }, 10); // 10ms delay to ensure DOM is stable
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
                    setTimeout(checkReady, TIMING.DOM_UPDATE_DELAY);
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
            const hasLatex = this.hasLatexContent(option);
            
            const optionLetter = translationManager.getOptionLetter(index) || String.fromCharCode(65 + index);
            const formattedContent = `${optionLetter}: ${this.formatCodeBlocks(option)}`;
            
            // Use centralized rendering method to reduce nesting
            this.renderOptionWithLatex(optionDiv, formattedContent, optionsContainer, hasLatex);
            
            
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
            const hasLatex = this.hasLatexContent(option);
            
            const optionLetter = translationManager.getOptionLetter(index) || String.fromCharCode(65 + index);
            const formattedContent = `<input type="checkbox" ${isCorrect ? 'checked' : ''} disabled> ${optionLetter}: ${this.formatCodeBlocks(option)}`;
            
            // Use centralized rendering method to reduce nesting
            this.renderOptionWithLatex(optionDiv, formattedContent, optionsContainer, hasLatex);
            
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
     * Check if text contains LaTeX patterns
     * @param {string} text - Text to check
     * @returns {boolean} - True if LaTeX is detected
     */
    hasLatexContent(text) {
        if (!text) return false;
        return text.includes('$') || text.includes('\\(') || 
               text.includes('\\[') || text.includes('\\frac') ||
               text.includes('\\sqrt') || text.includes('\\sum');
    }

    /**
     * Render option with LaTeX support and prevent FOUC
     * @param {HTMLElement} optionDiv - Option element to render
     * @param {string} formattedContent - Formatted option content
     * @param {HTMLElement} container - Container to append to
     * @param {boolean} hasLatex - Whether content contains LaTeX
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
     * @param {HTMLElement} optionDiv - Option element
     * @param {string} formattedContent - Content to render
     * @param {HTMLElement} container - Container element
     */
    renderLatexOption(optionDiv, formattedContent, container) {
        // CRITICAL FIX: Aggressive state reset for session-based cache interference
        optionDiv.classList.remove('mathjax-ready', 'mathjax-loading', 'tex2jax_process');
        
        // Clear any cached MathJax content attributes and elements
        optionDiv.removeAttribute('data-mathJax-original');
        optionDiv.removeAttribute('data-has-loading-overlay');
        const existingMathJax = optionDiv.querySelectorAll('mjx-container, .MathJax, mjx-math');
        existingMathJax.forEach(mjx => mjx.remove());
        
        // Hide option during LaTeX processing to prevent blinking
        optionDiv.style.opacity = '0';
        optionDiv.classList.add('tex2jax_process');
        optionDiv.innerHTML = formattedContent;
        container.appendChild(optionDiv);
        
        // Show option after MathJax processing with timeout
        setTimeout(() => {
            this.showOptionAfterMathjax(optionDiv);
        }, TIMING.DOM_UPDATE_DELAY);
    }

    /**
     * Render option without LaTeX content
     * @param {HTMLElement} optionDiv - Option element
     * @param {string} formattedContent - Content to render
     * @param {HTMLElement} container - Container element
     */
    renderPlainOption(optionDiv, formattedContent, container) {
        optionDiv.style.opacity = '1';
        optionDiv.innerHTML = formattedContent;
        container.appendChild(optionDiv);
    }

    /**
     * Show option after MathJax rendering with error handling
     * @param {HTMLElement} optionDiv - Option element to show
     */
    showOptionAfterMathjax(optionDiv) {
        // Check if element is still in DOM before processing
        if (!optionDiv || !optionDiv.parentNode || !document.contains(optionDiv)) {
            // Element was removed during rapid preview updates - skip rendering
            return;
        }
        
        // CRITICAL FIX: Add timeout fallback to prevent permanent invisibility for options
        let renderCompleted = false;
        const fallbackTimeout = setTimeout(() => {
            if (!renderCompleted && optionDiv && optionDiv.parentNode && document.contains(optionDiv)) {
                logger.warn('⚠️ Preview option LaTeX render timeout fallback - showing content anyway');
                // NUCLEAR FIX: Force complete CSS override to eliminate transition interference
                optionDiv.style.setProperty('opacity', '1', 'important');
                optionDiv.style.setProperty('transition', 'none', 'important');
                optionDiv.style.setProperty('animation', 'none', 'important');
                optionDiv.classList.remove('tex2jax_process');
                renderCompleted = true;
            }
        }, 2000); // 2 second fallback timeout
        
        // CRITICAL FIX: Use renderElement with higher retry count instead of renderElementFast for option reliability
        this.mathJaxService.renderElement(optionDiv, 100, 8, true) // fastMode=true, higher retries for reliability
            .then(() => {
                // Double-check element is still in DOM before setting opacity
                if (!renderCompleted && optionDiv && optionDiv.parentNode && document.contains(optionDiv)) {
                    // CRITICAL VALIDATION: Verify MathJax actually created visible content before declaring success
                    const mathJaxElements = optionDiv.querySelectorAll('mjx-container, .MathJax, mjx-math');
                    const hasActualContent = mathJaxElements.length > 0;
                    const hasVisibleHeight = optionDiv.offsetHeight > 0;
                    const textContent = optionDiv.textContent.trim();
                    
                    if (hasActualContent && hasVisibleHeight && textContent.length > 0) {
                        logger.debug(`✅ MathJax option rendering successful with ${mathJaxElements.length} elements`);
                        // NUCLEAR FIX: Force complete CSS override to eliminate transition interference
                        optionDiv.style.setProperty('opacity', '1', 'important');
                        optionDiv.style.setProperty('transition', 'none', 'important');
                        optionDiv.style.setProperty('animation', 'none', 'important');
                        optionDiv.classList.remove('tex2jax_process');
                        renderCompleted = true;
                        clearTimeout(fallbackTimeout);
                    } else {
                        // CRITICAL: MathJax reported success but no actual content - force fallback
                        logger.warn(`⚠️ Option MathJax render reported success but no content found - MathJax: ${mathJaxElements.length}, Height: ${optionDiv.offsetHeight}px, Text: "${textContent.substring(0, 30)}..."`);
                        // NUCLEAR FIX: Force complete CSS override
                        optionDiv.style.setProperty('opacity', '1', 'important');
                        optionDiv.style.setProperty('transition', 'none', 'important');
                        optionDiv.style.setProperty('animation', 'none', 'important');
                        optionDiv.classList.remove('tex2jax_process');
                        renderCompleted = true;
                        clearTimeout(fallbackTimeout);
                    }
                    
                    // Check option visual state after validation
                    setTimeout(() => {
                        const computedStyle = window.getComputedStyle(optionDiv);
                        const parentComputedStyle = window.getComputedStyle(optionDiv.parentElement);
                        const rect = optionDiv.getBoundingClientRect();
                        
                        logger.error(`🔍 OPTION VISUAL STATE - Opacity: ${optionDiv.style.opacity}/${computedStyle.opacity}, Display: ${optionDiv.style.display}/${computedStyle.display}, Visible: ${optionDiv.offsetParent !== null}, Height: ${rect.height}px, MathJax: ${optionDiv.querySelectorAll('mjx-container, .MathJax').length}, Classes: ${optionDiv.className}, Container opacity: ${optionDiv.parentElement?.style.opacity}/${parentComputedStyle.opacity}, Text: "${optionDiv.textContent.substring(0, 30)}..."`);
                    }, 100);
                }
            })
            .catch(() => {
                // Show even if MathJax fails, but only if element still exists
                if (!renderCompleted && optionDiv && optionDiv.parentNode && document.contains(optionDiv)) {
                    // NUCLEAR FIX: Force complete CSS override to eliminate transition interference
                    optionDiv.style.setProperty('opacity', '1', 'important');
                    optionDiv.style.setProperty('transition', 'none', 'important');
                    optionDiv.style.setProperty('animation', 'none', 'important');
                    optionDiv.classList.remove('tex2jax_process');
                    renderCompleted = true;
                    clearTimeout(fallbackTimeout);
                }
            });
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