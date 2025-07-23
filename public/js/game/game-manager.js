/**
 * Game Manager Module
 * Handles game flow, question display, player results, and game state management
 */

import { translationManager, createQuestionCounter, getTrueFalseText } from '../utils/translation-manager.js';
import { TIMING, logger } from '../core/config.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { mathJaxService } from '../utils/mathjax-service.js';
import { domManager } from '../utils/dom-manager.js';
import { errorBoundary } from '../utils/error-boundary.js';

export class GameManager {
    constructor(socket, uiManager, soundManager, socketManager = null) {
        this.socket = socket;
        this.uiManager = uiManager;
        this.soundManager = soundManager;
        this.socketManager = socketManager;
        this.mathRenderer = new MathRenderer();
        
        // Initialize DOM Manager with common game elements
        domManager.initializeGameElements();
        
        // Game state
        this.isHost = false;
        this.playerName = '';
        this.currentQuestion = null;
        this.timer = null;
        this.gamePin = null;
        this.selectedAnswer = null;
        this.playerAnswers = new Map();
        this.gameEnded = false;
        this.resultShown = false;
        
        // Memory management tracking
        this.eventListeners = new Map(); // Track all event listeners for cleanup
        this.timers = new Set(); // Track all timers for cleanup
        this.domReferences = new Set(); // Track DOM element references
        
        // Bind cleanup methods
        this.cleanup = this.cleanup.bind(this);
        this.addEventListenerTracked = this.addEventListenerTracked.bind(this);
        this.createTimerTracked = this.createTimerTracked.bind(this);
        
        // Auto-cleanup on page unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this.cleanup);
            window.addEventListener('unload', this.cleanup);
        }
    }

    /**
     * Display a question to the player or host
     */
    displayQuestion(data) {
        return errorBoundary.safeExecute(() => {
            logger.debug('Displaying question:', data);
            
            // Initialize display state
            this.initializeQuestionDisplay(data);
            
            // Get DOM elements and containers
            const elements = this.getQuestionElements();
            const optionsContainer = this.setupQuestionContainers(data);
            
            // Update content based on host/player mode
            if (this.isHost) {
                this.updateHostDisplay(data, elements);
            } else {
                this.updatePlayerDisplay(data, elements, optionsContainer);
            }
            
            // Finalize display
            this.finalizeQuestionDisplay(data);
        }, {
            type: 'game_logic',
            operation: 'question_display',
            questionId: data.questionId
        }, () => {
            // Fallback: show error message
            logger.error('Failed to display question, showing error state');
            this.showQuestionErrorState();
        });
    }

    /**
     * Initialize question display state and reset for new question
     */
    initializeQuestionDisplay(data) {
        logger.debug('QuestionInit', { type: data.type, options: data.options?.length, isHost: this.isHost });
        
        // CRITICAL: Clean game elements of any MathJax contamination from loaded quizzes
        this.cleanGameElementsForFreshRendering();
        
        // Reset result flag for new question
        this.resultShown = false;
        
        // Reset button states for new question
        this.resetButtonStatesForNewQuestion();
        
        // EMERGENCY FIX: Force isHost to false for all non-host users
        if (this.playerName && this.playerName !== 'Host' && this.isHost !== false) {
            logger.warn('EMERGENCY: Forcing isHost to false for player:', this.playerName);
            this.isHost = false;
        }
    }

    /**
     * Get question display elements
     */
    getQuestionElements() {
        return {
            questionElement: domManager.get('player-question-text'),
            hostQuestionElement: domManager.get('current-question'),
            hostOptionsContainer: domManager.get('answer-options')
        };
    }

    /**
     * Setup question containers based on question type
     */
    setupQuestionContainers(data) {
        let optionsContainer = null;
        
        if (!this.isHost) {
            optionsContainer = this.setupPlayerContainers(data);
        } else {
            logger.debug('Host mode');
        }
        
        return optionsContainer;
    }

    /**
     * Setup player containers based on question type
     */
    setupPlayerContainers(data) {
        logger.debug('Player mode - setting up containers');
        
        // Hide all answer type containers
        document.querySelectorAll('.player-answer-type').forEach(type => type.style.display = 'none');
        
        const containerMap = {
            'multiple-choice': {
                containerId: 'player-multiple-choice',
                optionsSelector: '.player-options'
            },
            'multiple-correct': {
                containerId: 'player-multiple-correct',
                optionsSelector: '.player-checkbox-options'
            },
            'true-false': {
                containerId: 'player-true-false',
                optionsSelector: '.true-false-options'
            },
            'numeric': {
                containerId: 'player-numeric',
                optionsSelector: '.numeric-input-container'
            }
        };
        
        const config = containerMap[data.type];
        if (!config) {
            logger.warn('Unknown question type:', data.type);
            return null;
        }
        
        const container = domManager.get(config.containerId);
        logger.debug(`${config.containerId} found:`, !!container);
        
        if (container) {
            container.style.display = 'block';
            const optionsContainer = container.querySelector(config.optionsSelector);
            logger.debug('Player optionsContainer set to:', optionsContainer);
            return optionsContainer;
        }
        
        return null;
    }

    /**
     * Update host display with question content
     */
    updateHostDisplay(data, elements) {
        logger.debug('Host mode - updating display');
        
        // Switch to host game screen when new question starts
        this.uiManager.showScreen('host-game-screen');
        
        // Hide answer statistics during question
        this.hideAnswerStatistics();
        
        // Update question counter for host
        this.updateQuestionCounter(data.questionNumber, data.totalQuestions);
        
        // Add delay to ensure screen transition completes before MathJax rendering
        setTimeout(() => {
            // Update host question content
            this.updateHostQuestionContent(data, elements.hostQuestionElement);
            
            // Update host options content
            this.updateHostOptionsContent(data, elements.hostOptionsContainer);
        }, 150); // Allow screen transition to complete
    }

    /**
     * Update host question content and render MathJax
     */
    updateHostQuestionContent(data, hostQuestionElement) {
        if (!hostQuestionElement) return;
        
        // Simple content update - no FOUC prevention needed in game view
        hostQuestionElement.innerHTML = this.mathRenderer.formatCodeBlocks(data.question);
        
        logger.debug('Host question HTML set:', data.question);
        
        // Handle question image for host
        this.updateQuestionImage(data, 'question-image-display');
        
        // Render MathJax for host question with appropriate delay
        mathJaxService.renderElement(hostQuestionElement, 200).then(() => {
            logger.debug('MathJax question rendering completed for host');
        }).catch(err => {
            logger.error('MathJax question render error:', err);
        });
    }

    /**
     * Update host options content based on question type
     */
    updateHostOptionsContent(data, hostOptionsContainer) {
        if (!hostOptionsContainer) return;
        
        // Always clear previous content to prevent leaking between question types
        hostOptionsContainer.innerHTML = '';
        
        if (data.type === 'numeric') {
            hostOptionsContainer.style.display = 'none';
        } else if (data.type === 'true-false') {
            this.setupHostTrueFalseOptions(hostOptionsContainer);
        } else {
            this.setupHostMultipleChoiceOptions(data, hostOptionsContainer);
        }
        
        // Translate any dynamic content in the options container
        translationManager.translateContainer(hostOptionsContainer);
        
        // Render MathJax for host options with appropriate delay
        mathJaxService.renderElement(hostOptionsContainer, 250).then(() => {
            logger.debug('MathJax options rendering completed for host');
        }).catch(err => {
            logger.error('MathJax options render error:', err);
        });
    }

    /**
     * Setup host true/false options
     */
    setupHostTrueFalseOptions(hostOptionsContainer) {
        hostOptionsContainer.innerHTML = `
            <div class="true-false-options">
                <div class="tf-option true-btn" data-answer="true">${getTrueFalseText().true}</div>
                <div class="tf-option false-btn" data-answer="false">${getTrueFalseText().false}</div>
            </div>
        `;
        hostOptionsContainer.style.display = 'block';
    }

    /**
     * Setup host multiple choice options
     */
    setupHostMultipleChoiceOptions(data, hostOptionsContainer) {
        hostOptionsContainer.innerHTML = `
            <div class="option-display" data-option="0"></div>
            <div class="option-display" data-option="1"></div>
            <div class="option-display" data-option="2"></div>
            <div class="option-display" data-option="3"></div>
        `;
        hostOptionsContainer.style.display = 'grid';
        const options = document.querySelectorAll('.option-display');
        
        // Reset all option styles from previous questions
        this.resetButtonStyles(options);
    
        if (data.type === 'multiple-choice' || data.type === 'multiple-correct') {
            data.options.forEach((option, index) => {
                if (options[index]) {
                    options[index].innerHTML = `${translationManager.getOptionLetter(index)}: ${this.mathRenderer.formatCodeBlocks(option)}`;
                    options[index].style.display = 'block';
                    // Add data-multiple attribute for multiple-correct questions to get special styling
                    if (data.type === 'multiple-correct') {
                        options[index].setAttribute('data-multiple', 'true');
                    } else {
                        options[index].removeAttribute('data-multiple');
                    }
                }
            });
            // Hide unused options
            for (let i = data.options.length; i < 4; i++) {
                if (options[i]) {
                    options[i].style.display = 'none';
                }
            }
        }
    }

    /**
     * Update player display with question content
     */
    updatePlayerDisplay(data, elements, optionsContainer) {
        logger.debug('Player mode - updating display');
        
        // Update question counter for player
        this.updatePlayerQuestionCounter(data.questionNumber, data.totalQuestions);
        
        // Reset selected answer for new question
        this.selectedAnswer = null;
        
        // Add delay to ensure screen transition completes before MathJax rendering
        setTimeout(() => {
            // Update player question content
            this.updatePlayerQuestionContent(data, elements.questionElement);
            
            // Update player options based on question type
            this.updatePlayerOptions(data, optionsContainer);
        }, 150); // Match host delay for consistency
    }

    /**
     * Update player question content and render MathJax
     */
    updatePlayerQuestionContent(data, questionElement) {
        if (!questionElement) return;
        
        // Simple content update - no FOUC prevention needed in game view  
        questionElement.innerHTML = this.mathRenderer.formatCodeBlocks(data.question);
        
        // Handle question image for player
        this.updateQuestionImage(data, 'player-question-image');
        
        // Render MathJax for player question with appropriate delay
        mathJaxService.renderElement(questionElement, 200).then(() => {
            logger.debug('MathJax rendering completed for player question');
        }).catch(err => {
            logger.error('MathJax player question render error:', err);
        });
    }

    /**
     * Update player options based on question type
     */
    updatePlayerOptions(data, optionsContainer) {
        if (!optionsContainer) return;
        
        if (data.type === 'multiple-choice') {
            this.setupPlayerMultipleChoiceOptions(data, optionsContainer);
        } else if (data.type === 'multiple-correct') {
            this.setupPlayerMultipleCorrectOptions(data, optionsContainer);
        } else if (data.type === 'true-false') {
            this.setupPlayerTrueFalseOptions(data, optionsContainer);
        } else if (data.type === 'numeric') {
            this.setupPlayerNumericOptions(data, optionsContainer);
        }
        
        // Render MathJax for player options with appropriate delay
        mathJaxService.renderElement(optionsContainer, 250).then(() => {
            logger.debug('MathJax rendering completed for player options');
        }).catch(err => {
            logger.error('MathJax player options render error:', err);
        });
    }

    /**
     * Setup player multiple choice options
     */
    setupPlayerMultipleChoiceOptions(data, optionsContainer) {
        const existingButtons = optionsContainer.querySelectorAll('.player-option');
        existingButtons.forEach((button, index) => {
            if (index < data.options.length) {
                button.innerHTML = `<span class="option-letter">${translationManager.getOptionLetter(index)}:</span> ${this.mathRenderer.formatCodeBlocks(data.options[index])}`;
                button.setAttribute('data-answer', index.toString());
                button.classList.remove('selected', 'disabled');
                button.style.display = 'block';
                
                // Use tracked event listeners instead of cloning
                this.addEventListenerTracked(button, 'click', () => {
                    logger.debug('Button clicked:', index);
                    this.selectAnswer(index);
                });
            } else {
                button.style.display = 'none';
            }
        });
    }

    /**
     * Setup player multiple correct options
     */
    setupPlayerMultipleCorrectOptions(data, optionsContainer) {
        const checkboxes = optionsContainer.querySelectorAll('.option-checkbox');
        const checkboxLabels = optionsContainer.querySelectorAll('.checkbox-option');
        
        checkboxes.forEach(cb => cb.checked = false);
        checkboxLabels.forEach((label, index) => {
            if (data.options && data.options[index]) {
                const formattedOption = this.mathRenderer.formatCodeBlocks(data.options[index]);
                label.innerHTML = `<input type="checkbox" class="option-checkbox"> ${translationManager.getOptionLetter(index)}: ${formattedOption}`;
                label.setAttribute('data-option', index);
            } else {
                label.style.display = 'none';
            }
        });
    }

    /**
     * Setup player true/false options
     */
    setupPlayerTrueFalseOptions(data, optionsContainer) {
        const buttons = optionsContainer.querySelectorAll('.tf-option');
        buttons.forEach((button, index) => {
            button.classList.remove('selected', 'disabled');
            button.setAttribute('data-answer', index.toString());
            
            // Use tracked event listeners instead of cloning
            this.addEventListenerTracked(button, 'click', () => {
                logger.debug('True/False button clicked:', index);
                // Convert index to boolean: 0 = true, 1 = false
                const booleanAnswer = index === 0;
                logger.debug('Converting T/F index', index, 'to boolean:', booleanAnswer);
                this.selectAnswer(booleanAnswer);
            });
        });
    }

    /**
     * Setup player numeric options
     */
    setupPlayerNumericOptions(data, optionsContainer) {
        const input = optionsContainer.querySelector('#numeric-answer-input');
        const submitButton = optionsContainer.querySelector('#submit-numeric');
        
        if (input) {
            input.value = '';
            input.disabled = false;
            input.placeholder = translationManager.getTranslationSync('enter_numeric_answer');
            
            // Remove old listeners and add new ones
            input.replaceWith(input.cloneNode(true));
            const newInput = optionsContainer.querySelector('#numeric-answer-input');
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.submitNumericAnswer();
                }
            });
        }
        
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = translationManager.getTranslationSync('submit');
            
            // Use tracked event listeners instead of cloning
            this.addEventListenerTracked(submitButton, 'click', () => {
                this.submitNumericAnswer();
            });
        }
    }

    /**
     * Finalize question display with common actions
     */
    finalizeQuestionDisplay(data) {
        logger.debug('Finalizing question display');
        
        // Play question start sound
        if (this.soundManager.isEnabled()) {
            this.soundManager.playQuestionStartSound();
        }
        
        // Store current question data
        this.currentQuestion = data;
    }

    /**
     * Update the question counter display (host)
     */
    updateQuestionCounter(current, total) {
        const counterElement = domManager.get('question-counter');
        if (counterElement) {
            counterElement.textContent = createQuestionCounter(current, total);
        }
    }

    /**
     * Update the question counter display (player)
     */
    updatePlayerQuestionCounter(current, total) {
        const counterElement = domManager.get('player-question-counter');
        if (counterElement) {
            counterElement.textContent = createQuestionCounter(current, total);
        }
    }

    /**
     * Submit multiple correct answer
     */
    submitMultipleCorrectAnswer() {
        const submitBtn = domManager.get('submit-multiple');
        
        // Immediately disable button and provide visual feedback
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = translationManager.getTranslationSync('submitting');
        }
        
        const checkboxes = document.querySelectorAll('#player-multiple-correct .option-checkbox:checked');
        const answers = Array.from(checkboxes).map(cb => {
            const closest = cb.closest('.checkbox-option');
            return closest ? parseInt(closest.dataset.option) : null;
        }).filter(option => option !== null);
        
        // Play answer submission sound
        if (this.soundManager.isEnabled()) {
            this.soundManager.playAnswerSubmissionSound();
        }
        
        // Show answer submitted feedback
        this.showAnswerSubmitted(answers);
        
        this.socket.emit('submit-answer', { answer: answers, type: 'multiple-correct' });
    }

    /**
     * Handle player selecting an answer
     */
    selectAnswer(answer) {
        logger.debug('selectAnswer called with:', answer);
        if (this.selectedAnswer !== null) {
            logger.debug('Already answered, ignoring');
            return; // Already answered
        }
        
        logger.debug('Setting selected answer to:', answer);
        this.selectedAnswer = answer;
        
        // Enhanced visual feedback (from monolithic version)
        this.highlightSelectedAnswer(answer);
        
        // Play answer sound
        if (this.soundManager.isEnabled()) {
            this.soundManager.playAnswerSubmissionSound();
        }
        
        // Show answer submitted feedback
        this.showAnswerSubmitted(answer);
        
        // Send answer to server
        logger.debug('Socket connected:', this.socket?.connected);
        logger.debug('Player name:', this.playerName);
        logger.debug('Is host:', this.isHost);
        logger.debug('Submitting answer to server:', {
            answer: answer,
            type: 'player-answer'
        });
        
        if (!this.socket || !this.socket.connected) {
            logger.error('Socket not connected, cannot send answer');
            return;
        }
        
        // Use SocketManager if available, otherwise emit directly
        if (this.socketManager && this.socketManager.submitAnswer) {
            this.socketManager.submitAnswer(answer);
        } else {
            this.socket.emit('submit-answer', {
                answer: answer,
                type: 'player-answer'
            });
        }
    }

    /**
     * Highlight selected answer and disable options (from monolithic version)
     */
    highlightSelectedAnswer(answer) {
        logger.debug('Highlighting selected answer:', answer);
        
        // Handle multiple choice options
        const options = document.querySelectorAll('.player-option');
        options.forEach(option => {
            option.disabled = true;
            option.classList.remove('selected');
            option.classList.add('disabled');
        });
        
        if (typeof answer === 'number' && options[answer]) {
            options[answer].classList.add('selected');
            logger.debug('Added selected class to option:', answer);
        }
        
        // Handle true/false options
        const tfOptions = document.querySelectorAll('.true-btn, .false-btn');
        tfOptions.forEach(option => {
            option.disabled = true;
            option.classList.remove('selected');
        });
        
        // Find and highlight the selected true/false option
        if (typeof answer === 'boolean') {
            // Convert boolean back to index for UI highlighting: true = 0, false = 1
            const index = answer === true ? 0 : 1;
            const selectedTFOption = document.querySelector(`[data-answer="${index}"]`);
            if (selectedTFOption && selectedTFOption.classList.contains('tf-option')) {
                selectedTFOption.classList.add('selected');
                logger.debug('Added selected class to T/F option:', answer, 'at index:', index);
            }
        } else if (typeof answer === 'number') {
            const selectedTFOption = document.querySelector(`[data-answer="${answer}"]`);
            if (selectedTFOption && (selectedTFOption.classList.contains('true-btn') || selectedTFOption.classList.contains('false-btn'))) {
                selectedTFOption.classList.add('selected');
                logger.debug('Added selected class to T/F option:', answer);
            }
        }
        
        // Handle multiple correct checkboxes
        const checkboxes = document.querySelectorAll('.multiple-correct-option');
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
        });
    }

    /**
     * Submit numeric answer
     */
    submitNumericAnswer() {
        const input = domManager.get('numeric-answer-input');
        if (!input || input.value.trim() === '') return;
        
        const answer = parseFloat(input.value);
        if (isNaN(answer)) return;
        
        this.selectAnswer(answer);
        input.disabled = true;
        
        const submitButton = document.getElementById('submit-numeric');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = translationManager.getTranslationSync('submitted');
        }
    }

    /**
     * Show answer submitted feedback
     */
    showAnswerSubmitted(answer) {
        const feedback = document.getElementById('answer-feedback');
        if (feedback) {
            let answerText = answer;
            if (typeof answer === 'number' && answer < 10) {
                answerText = translationManager.getOptionLetter(answer);
            }
            
            feedback.innerHTML = `${translationManager.getTranslationSync('answer_submitted')}: ${answerText}`;
            feedback.classList.add('show');
            
            // Hide after delay
            setTimeout(() => {
                feedback.classList.remove('show');
            }, TIMING.ANSWER_FEEDBACK_DURATION);
        }
    }

    /**
     * Show player result (correct/incorrect)
     */
    showPlayerResult(data) {
        return errorBoundary.safeExecute(() => {
            logger.debug('showPlayerResult called with:', data);
            logger.debug('resultShown flag:', this.resultShown);
            
            // Prevent multiple displays of same result
            if (this.resultShown) {
                logger.debug('Result already shown, skipping');
                return;
            }
            this.resultShown = true;
        logger.debug('Processing player result...');
        
        const resultElement = document.getElementById('answer-feedback');
        logger.debug('answer-feedback element found:', !!resultElement);
        if (!resultElement) {
            logger.error('answer-feedback element not found, returning');
            return;
        }
        
        const isCorrect = data.isCorrect !== undefined ? data.isCorrect : data.correct;
        logger.debug('Raw data received:', data);
        logger.debug('Extracted isCorrect:', isCorrect, 'from data.isCorrect:', data.isCorrect, 'or data.correct:', data.correct);
        const earnedPoints = data.points || 0;
        logger.debug('isCorrect:', isCorrect, 'earnedPoints:', earnedPoints);
        
        // Use the existing feedback structure from the original monolithic version
        resultElement.classList.remove('hidden');
        logger.debug('Set result element visible');
        
        const messageElement = document.getElementById('feedback-message');
        const scoreElement = document.getElementById('score-display');
        
        if (messageElement) {
            if (isCorrect) {
                resultElement.style.backgroundColor = '#2ecc71';
                messageElement.textContent = '🎉 ' + translationManager.getTranslationSync('correct_answer_msg');
            } else {
                resultElement.style.backgroundColor = '#e74c3c';
                messageElement.textContent = '❌ ' + translationManager.getTranslationSync('incorrect_answer_msg');
            }
        }
        
        if (scoreElement && earnedPoints > 0) {
            scoreElement.textContent = `+${earnedPoints} ${translationManager.getTranslationSync('points')} (${translationManager.getTranslationSync('total')}: ${data.totalScore})`;
        }
        
        // Show correct answer if player was wrong (from monolithic version)
        if (!isCorrect && data.correctAnswer !== undefined) {
            this.showCorrectAnswerOnClient(data.correctAnswer);
        }
        logger.debug('Result element updated and shown');
        
        // Play result sound and show confetti for correct answers
        logger.debug('Player result - isCorrect:', isCorrect, 'isHost:', this.isHost, 'soundEnabled:', this.soundManager.isEnabled());
        if (isCorrect) {
            logger.debug('Playing correct answer sound and showing confetti');
            if (this.soundManager.isEnabled()) {
                this.soundManager.playCorrectAnswerSound();
            }
            // Show confetti for correct answers (for players only)
            if (!this.isHost) {
                logger.debug('Showing confetti for correct answer');
                this.showConfetti();
            }
        } else {
            logger.debug('Playing incorrect answer sound');
            if (this.soundManager.isEnabled()) {
                this.soundManager.playIncorrectAnswerSound();
            }
        }
        
            // Hide after delay
            setTimeout(() => {
                resultElement.classList.add('hidden');
            }, TIMING.RESULT_DISPLAY_DURATION);
        }, {
            type: 'game_logic',
            operation: 'player_result',
            playerId: data.playerId
        }, () => {
            // Fallback: show basic result message
            logger.error('Failed to show player result, using fallback');
            this.showResultErrorState();
        });
    }

    /**
     * Show answer submitted feedback (from monolithic version)
     */
    showAnswerSubmitted(answer) {
        logger.debug('showAnswerSubmitted called with:', answer);
        const feedback = document.getElementById('answer-feedback');
        const message = document.getElementById('feedback-message');
        const scoreDisplay = document.getElementById('score-display');
        
        if (!feedback || !message) {
            logger.error('answer-feedback or feedback-message elements not found');
            return;
        }
        
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.style.backgroundColor = '#3498db'; // Blue for submission
        
        let displayText = '';
        if (typeof answer === 'number') {
            // Check if this is a numeric input (decimal) or multiple choice index (integer)
            if (Number.isInteger(answer) && answer >= 0 && answer <= 3) {
                // Multiple choice answer - convert to letter
                const letter = String.fromCharCode(65 + answer);
                displayText = `Answer submitted: ${letter}`;
            } else {
                // Numeric input answer - show the actual number
                displayText = `Answer submitted: ${answer}`;
            }
        } else if (Array.isArray(answer)) {
            const letters = answer.map(a => String.fromCharCode(65 + a)).join(', ');
            displayText = `Answers submitted: ${letters}`;
        } else if (typeof answer === 'boolean') {
            displayText = `Answer submitted: ${answer ? 'TRUE' : 'FALSE'}`;
        } else if (typeof answer === 'string') {
            displayText = `Answer submitted: ${answer.toUpperCase()}`;
        } else {
            displayText = `Answer submitted: ${answer}`;
        }
        
        message.textContent = displayText;
        if (scoreDisplay) {
            scoreDisplay.textContent = translationManager.getTranslationSync('waiting_for_results');
        }
        
        logger.debug('Answer submission feedback shown:', displayText);
    }

    /**
     * Show correct answer on client side when player was wrong (from monolithic version)
     */
    showCorrectAnswerOnClient(correctAnswer) {
        logger.debug('Showing correct answer on client:', correctAnswer);
        
        // Handle multiple choice options
        const options = document.querySelectorAll('.player-option');
        if (typeof correctAnswer === 'number' && options[correctAnswer]) {
            options[correctAnswer].classList.add('correct-answer');
            options[correctAnswer].style.border = '3px solid #2ecc71';
            options[correctAnswer].style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
            logger.debug('Highlighted correct option:', correctAnswer);
        }
        
        // Handle true/false options
        if (typeof correctAnswer === 'boolean') {
            // Convert boolean to index for UI highlighting: true = 0, false = 1
            const index = correctAnswer === true ? 0 : 1;
            const correctTFOption = document.querySelector(`[data-answer="${index}"]`);
            if (correctTFOption && correctTFOption.classList.contains('tf-option')) {
                correctTFOption.classList.add('correct-answer');
                correctTFOption.style.border = '3px solid #2ecc71';
                correctTFOption.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                logger.debug('Highlighted correct T/F option:', correctAnswer, 'at index:', index);
            }
        } else {
            const correctTFOption = document.querySelector(`[data-answer="${correctAnswer}"]`);
            if (correctTFOption && (correctTFOption.classList.contains('true-btn') || correctTFOption.classList.contains('false-btn'))) {
                correctTFOption.classList.add('correct-answer');
                correctTFOption.style.border = '3px solid #2ecc71';
                correctTFOption.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                logger.debug('Highlighted correct T/F option:', correctAnswer);
            }
        }
    }

    /**
     * Reset button states for new question (fix for answer input bug)
     */
    resetButtonStatesForNewQuestion() {
        logger.debug('Resetting button states for new question');
        
        // Reset selected answer
        this.selectedAnswer = null;
        
        // Reset multiple choice options
        const options = document.querySelectorAll('.player-option');
        options.forEach(option => {
            option.disabled = false;
            option.classList.remove('selected', 'disabled', 'correct-answer');
            option.style.border = '';
            option.style.backgroundColor = '';
        });
        
        // Reset true/false options
        const tfOptions = document.querySelectorAll('.true-btn, .false-btn');
        tfOptions.forEach(option => {
            option.disabled = false;
            option.classList.remove('selected', 'correct-answer');
            option.style.border = '';
            option.style.backgroundColor = '';
        });
        
        // Reset multiple correct checkboxes
        const checkboxes = document.querySelectorAll('.multiple-correct-option');
        checkboxes.forEach(checkbox => {
            checkbox.disabled = false;
            checkbox.checked = false;
        });
        
        // Reset numeric input
        const numericInput = document.getElementById('numeric-answer-input');
        if (numericInput) {
            numericInput.disabled = false;
            numericInput.value = '';
        }
        
        const submitButton = document.getElementById('submit-numeric');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = translationManager.getTranslationSync('submit_answer');
        }
        
        // Reset multiple correct submit button
        const multipleSubmitButton = document.getElementById('submit-multiple');
        if (multipleSubmitButton) {
            multipleSubmitButton.disabled = false;
        }
        
        logger.debug('Button states reset completed');
    }

    /**
     * Clean game elements of any MathJax contamination from loaded quizzes
     * This prevents conflicts when loaded quiz data has pre-processed MathJax content
     */
    cleanGameElementsForFreshRendering() {
        // Game elements that must be clean before MathJax rendering
        const gameElements = document.querySelectorAll([
            '#current-question',        // Host question display
            '#player-question-text',    // Player question display
            '.player-option',           // Player multiple choice options
            '.option-display',          // Host option displays
            '.tf-option',               // True/false options
            '.checkbox-option',         // Multiple correct options
            '.numeric-input-container'  // Numeric input area
        ].join(', '));
        
        gameElements.forEach(element => {
            if (element) {
                // Remove MathJax containers that may have been added during quiz loading
                const mathJaxContainers = element.querySelectorAll('.mjx-container, .MathJax, mjx-container, mjx-math');
                mathJaxContainers.forEach(container => {
                    container.remove();
                });
                
                // Remove MathJax processing classes
                element.classList.remove('processing-math', 'math-ready', 'MathJax_Processed');
                
                // Remove any pointer-events none that might have been added
                if (element.style.pointerEvents === 'none') {
                    element.style.pointerEvents = '';
                }
            }
        });
        
        logger.debug('🧹 Cleaned game elements of MathJax contamination for fresh rendering');
    }

    /**
     * Reset button styles (from monolithic version)
     */
    resetButtonStyles(options) {
        options.forEach(option => {
            option.style.border = '';
            option.style.backgroundColor = '';
            option.style.color = '';
            option.style.fontWeight = '';
            option.style.display = 'block';
        });
    }

    /**
     * Highlight correct answers on host display (original monolithic style)
     */
    highlightCorrectAnswers(data) {
        if (!this.isHost) return;
        
        const questionType = data.questionType || data.type;
        const options = document.querySelectorAll('.option-display');
        
        if (questionType === 'multiple-choice') {
            options.forEach((option, index) => {
                if (index === data.correctAnswer) {
                    option.style.border = '5px solid #2ecc71';
                    option.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                    option.style.color = '#2ecc71';
                    option.style.fontWeight = 'bold';
                }
            });
        } else if (questionType === 'true-false') {
            // For true-false, correctAnswer is a string ("true" or "false")
            // Convert to index: "true" = 0, "false" = 1
            const correctIndex = (data.correctAnswer === true || data.correctAnswer === 'true') ? 0 : 1;
            if (options[correctIndex]) {
                options[correctIndex].style.border = '5px solid #2ecc71';
                options[correctIndex].style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                options[correctIndex].style.color = '#2ecc71';
                options[correctIndex].style.fontWeight = 'bold';
            }
        } else if (questionType === 'multiple-correct') {
            // Highlight multiple correct answers
            if (data.correctAnswers && Array.isArray(data.correctAnswers)) {
                data.correctAnswers.forEach(index => {
                    if (options[index]) {
                        options[index].style.border = '5px solid #2ecc71';
                        options[index].style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                        options[index].style.color = '#2ecc71';
                        options[index].style.fontWeight = 'bold';
                    }
                });
            }
        }
    }

    /**
     * Show correct answer (original monolithic style)
     */
    showCorrectAnswer(data) {
        if (!this.isHost) return;
        
        const questionType = data.questionType || data.type;
        
        if (questionType === 'numeric') {
            // Show numeric answer in options container (original style)
            this.showNumericCorrectAnswer(data.correctAnswer, data.tolerance);
        } else {
            // Highlight correct answers in the grid
            this.highlightCorrectAnswers(data);
        }
    }

    /**
     * Show numeric correct answer (original monolithic style) 
     */
    showNumericCorrectAnswer(correctAnswer, tolerance) {
        if (!this.isHost) return;
        
        // Remove any existing correct answer display
        const existingAnswer = document.querySelector('.correct-answer-display');
        if (existingAnswer) {
            existingAnswer.remove();
        }
        
        // Show the answer in the options container for numeric questions
        const optionsContainer = document.getElementById('answer-options');
        if (optionsContainer) {
            optionsContainer.style.display = 'block';
            let answerText = `✅ ${translationManager.getTranslationSync('correct_answer')}: ${correctAnswer}`;
            if (tolerance) {
                answerText += ` (±${tolerance})`;
            }
            
            optionsContainer.innerHTML = `
                <div class="correct-answer-display numeric-answer-display">
                    <div class="correct-answer-banner">
                        <strong>${answerText}</strong>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update answer statistics for host display
     */
    updateAnswerStatistics(data) {
        if (!this.isHost || !data) return;
        
        logger.debug('Answer statistics data received:', data);
        logger.debug('Data structure:', {
            answeredPlayers: data.answeredPlayers,
            totalPlayers: data.totalPlayers,
            answerCounts: data.answerCounts,
            questionType: data.questionType || data.type
        });
        
        // Get existing statistics container
        let statisticsContainer = document.getElementById('answer-statistics');
        if (!statisticsContainer) {
            logger.warn('Answer statistics container not found in HTML');
            return;
        }
        
        // Show statistics container
        if (statisticsContainer) {
            statisticsContainer.style.display = 'block';
            
            // Update response counts
            const responsesCount = document.getElementById('responses-count');
            const totalPlayers = document.getElementById('total-players');
            
            if (responsesCount) {
                responsesCount.textContent = data.answeredPlayers || 0;
            }
            if (totalPlayers) {
                totalPlayers.textContent = data.totalPlayers || 0;
            }
            
            // Update individual answer statistics
            const questionType = data.questionType || data.type;
            logger.debug('Question type:', questionType, 'Answer counts:', data.answerCounts);
            
            if (questionType === 'multiple-choice' || questionType === 'multiple-correct') {
                this.showMultipleChoiceStatistics(4);
                for (let i = 0; i < 4; i++) {
                    const count = data.answerCounts[i] || 0;
                    logger.debug(`Updating option ${i}: ${count} answers`);
                    this.updateStatItem(i, count, data.answeredPlayers || 0);
                }
            } else if (questionType === 'true-false') {
                this.showTrueFalseStatistics();
                const trueCount = data.answerCounts['true'] || data.answerCounts[0] || 0;
                const falseCount = data.answerCounts['false'] || data.answerCounts[1] || 0;
                logger.debug(`True/False counts: true=${trueCount}, false=${falseCount}`);
                this.updateStatItem(0, trueCount, data.answeredPlayers || 0);
                this.updateStatItem(1, falseCount, data.answeredPlayers || 0);
            }
        }
    }


    /**
     * Show statistics for multiple choice questions
     */
    showMultipleChoiceStatistics(optionCount) {
        const statsContent = document.getElementById('stats-grid');
        if (!statsContent) return;
        
        // Update existing stat item labels for multiple choice
        for (let i = 0; i < 4; i++) {
            const statItem = document.getElementById(`stat-item-${i}`);
            const optionLabel = statItem?.querySelector('.option-label');
            
            if (statItem && optionLabel) {
                if (i < optionCount) {
                    statItem.style.display = 'flex';
                    optionLabel.textContent = translationManager.getOptionLetter(i);
                    // Reset values
                    const statCount = statItem.querySelector('.stat-count');
                    const statFill = statItem.querySelector('.stat-fill');
                    if (statCount) statCount.textContent = '0';
                    if (statFill) statFill.style.width = '0%';
                } else {
                    statItem.style.display = 'none';
                }
            }
        }
    }

    /**
     * Show statistics for true/false questions
     */
    showTrueFalseStatistics() {
        const statsContent = document.getElementById('stats-grid');
        if (!statsContent) return;
        
        // Update existing stat items for true/false - show only first 2
        for (let i = 0; i < 4; i++) {
            const statItem = document.getElementById(`stat-item-${i}`);
            const optionLabel = statItem?.querySelector('.option-label');
            
            if (statItem && optionLabel) {
                if (i === 0) {
                    // True option
                    statItem.style.display = 'flex';
                    optionLabel.textContent = getTrueFalseText().true;
                    // Reset values
                    const statCount = statItem.querySelector('.stat-count');
                    const statFill = statItem.querySelector('.stat-fill');
                    if (statCount) statCount.textContent = '0';
                    if (statFill) statFill.style.width = '0%';
                } else if (i === 1) {
                    // False option
                    statItem.style.display = 'flex';
                    optionLabel.textContent = getTrueFalseText().false;
                    // Reset values
                    const statCount = statItem.querySelector('.stat-count');
                    const statFill = statItem.querySelector('.stat-fill');
                    if (statCount) statCount.textContent = '0';
                    if (statFill) statFill.style.width = '0%';
                } else {
                    // Hide unused options
                    statItem.style.display = 'none';
                }
            }
        }
    }

    /**
     * Update individual statistic item
     */
    updateStatItem(index, count, totalAnswered) {
        const statCount = document.getElementById(`stat-count-${index}`);
        const statFill = document.getElementById(`stat-fill-${index}`);
        
        logger.debug(`updateStatItem: index=${index}, count=${count}, totalAnswered=${totalAnswered}`);
        
        if (statCount) {
            statCount.textContent = count;
            logger.debug(`Updated stat count for index ${index}: ${count}`);
        } else {
            logger.warn(`stat-count-${index} element not found`);
        }
        
        if (statFill) {
            if (totalAnswered > 0) {
                const percentage = (count / totalAnswered) * 100;
                statFill.style.width = `${percentage}%`;
                logger.debug(`Updated stat fill for index ${index}: ${percentage}%`);
            } else {
                statFill.style.width = '0%';
            }
        } else {
            logger.warn(`stat-fill-${index} element not found`);
        }
    }

    /**
     * Hide answer statistics
     */
    hideAnswerStatistics() {
        const statisticsContainer = document.getElementById('answer-statistics');
        if (statisticsContainer) {
            statisticsContainer.style.display = 'none';
        }
    }

    /**
     * Show leaderboard
     */
    showLeaderboard(leaderboard) {
        // Use the updateLeaderboardDisplay method for consistency
        this.updateLeaderboardDisplay(leaderboard);
        
        // Show leaderboard screen
        if (this.isHost) {
            this.uiManager.showScreen('leaderboard-screen');
        } else {
            this.uiManager.showScreen('player-game-screen');
        }
    }

    /**
     * Show final results
     */
    showFinalResults(leaderboard) {
        logger.debug('Showing final results:', leaderboard);
        
        // Prevent multiple fanfare plays
        if (this.fanfarePlayed) {
            logger.debug('Fanfare already played, skipping');
            return;
        }
        this.fanfarePlayed = true;
        
        // Update leaderboard display first
        this.updateLeaderboardDisplay(leaderboard);
        
        if (this.isHost) {
            // Host gets full celebration with confetti and sounds
            const finalResults = document.getElementById('final-results');
            if (finalResults) {
                finalResults.classList.remove('hidden');
                finalResults.classList.add('game-complete-animation');
                
                // Remove animation class after animation completes
                setTimeout(() => {
                    finalResults.classList.remove('game-complete-animation');
                }, 2000);
            }
            
            // Show confetti celebration
            this.showGameCompleteConfetti();
            
            // Play special game ending fanfare
            this.playGameEndingFanfare();
            
            this.uiManager.showScreen('leaderboard-screen');
        } else {
            // Players get a dedicated final screen with special ending sound
            logger.debug('Player final screen - leaderboard:', leaderboard);
            this.playGameEndingFanfare();
            this.showPlayerFinalScreen(leaderboard);
        }
        
        // Mark game as ended
        this.gameEnded = true;
    }

    /**
     * Update leaderboard display (from monolithic version)
     */
    updateLeaderboardDisplay(leaderboard) {
        const leaderboardList = document.getElementById('leaderboard-list');
        if (!leaderboardList) return;
        
        leaderboardList.innerHTML = '';
        
        leaderboard.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            if (index === 0) item.classList.add('first');
            else if (index === 1) item.classList.add('second');
            else if (index === 2) item.classList.add('third');
            
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
            
            item.innerHTML = `
                <span>${medal} ${this.escapeHtml(player.name)}</span>
                <span>${player.score} pts</span>
            `;
            
            leaderboardList.appendChild(item);
        });
    }

    /**
     * Show player final screen (from monolithic version)
     */
    showPlayerFinalScreen(leaderboard) {
        logger.debug('showPlayerFinalScreen called with:', leaderboard);
        
        // Find player's position in the final leaderboard
        let playerPosition = -1;
        let playerScore = 0;
        
        // Get player's socket ID to find their position
        const playerId = this.socket.id;
        logger.debug('Player ID:', playerId);
        
        if (leaderboard && Array.isArray(leaderboard)) {
            leaderboard.forEach((player, index) => {
                if (player.id === playerId) {
                    playerPosition = index + 1;
                    playerScore = player.score;
                    logger.debug('Found player position:', playerPosition, 'score:', playerScore);
                }
            });
        }
        
        // Update final position display
        const finalPosition = document.getElementById('final-position');
        const finalScore = document.getElementById('final-score');
        
        if (finalPosition && playerPosition > 0) {
            finalPosition.textContent = `#${playerPosition}`;
        }
        
        if (finalScore) {
            finalScore.textContent = `${playerScore} ${translationManager.getTranslationSync('points')}`;
        }
        
        // Update top 3 players display
        this.updateFinalLeaderboard(leaderboard.slice(0, 3));
        
        // Add confetti celebration for all players
        this.showGameCompleteConfetti();
        
        logger.debug('Switching to player-final-screen');
        this.uiManager.showScreen('player-final-screen');
    }

    /**
     * Update final leaderboard (top 3 players)
     */
    updateFinalLeaderboard(topPlayers) {
        const leaderboardContainer = document.getElementById('final-leaderboard');
        if (!leaderboardContainer) return;
        
        leaderboardContainer.innerHTML = '';
        
        topPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'final-leaderboard-item';
            
            const position = index + 1;
            const medal = ['🥇', '🥈', '🥉'][index] || '🏅';
            
            item.innerHTML = `
                <span class="medal">${medal}</span>
                <span class="player-name">${this.escapeHtml(player.name)}</span>
                <span class="player-score">${player.score} pts</span>
            `;
            
            if (position === 1) item.classList.add('first');
            else if (position === 2) item.classList.add('second');
            else if (position === 3) item.classList.add('third');
            
            leaderboardContainer.appendChild(item);
        });
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
     * Show game complete confetti (from monolithic version)
     */
    showGameCompleteConfetti() {
        if (window.confetti) {
            // Optimized confetti with timed bursts instead of continuous animation
            const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
            
            // Initial big burst
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: colors
            });
            
            // Side bursts with reduced frequency and particles
            const burstTimes = [300, 600, 900, 1200, 1500];
            burstTimes.forEach(time => {
                setTimeout(() => {
                    confetti({
                        particleCount: 50,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: colors
                    });
                    confetti({
                        particleCount: 50,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: colors
                    });
                }, time);
            });
        }
    }

    /**
     * Show simple confetti for correct answers
     */
    showConfetti() {
        logger.debug('showConfetti called, confetti function available:', typeof confetti === 'function');
        if (typeof confetti === 'function') {
            logger.debug('Triggering confetti animation');
            confetti({
                particleCount: 50,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else {
            logger.debug('Confetti function not available');
        }
    }

    /**
     * Play game ending fanfare (from monolithic version)
     */
    playGameEndingFanfare() {
        if (this.soundManager.isEnabled()) {
            this.soundManager.playVictorySound();
        }
    }

    /**
     * Update players list
     */
    updatePlayersList(players) {
        logger.debug('updatePlayersList called with:', players);
        const playersListElement = document.getElementById('players-list');
        logger.debug('playersListElement found:', !!playersListElement);
        if (!playersListElement) {
            logger.debug('players-list element not found');
            return;
        }
        
        // Handle case where players is undefined or not an array
        if (!players || !Array.isArray(players)) {
            logger.debug('Players list is undefined or not an array:', players);
            return;
        }
        
        playersListElement.innerHTML = '';
        
        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.innerHTML = `
                <div class="player-avatar">👤</div>
                <div class="player-name">${this.escapeHtml(player.name)}</div>
            `;
            playersListElement.appendChild(playerElement);
        });
        
        // Update player count
        const playerCountElement = document.getElementById('player-count');
        if (playerCountElement) {
            playerCountElement.textContent = players.length;
        }
    }

    /**
     * Update timer display
     */
    updateTimerDisplay(timeRemaining) {
        const timerElement = document.getElementById('timer');
        logger.debug('updateTimerDisplay - element found:', !!timerElement, 'timeRemaining:', timeRemaining);
        if (timerElement && isFinite(timeRemaining) && timeRemaining >= 0) {
            const seconds = Math.ceil(timeRemaining / 1000);
            timerElement.textContent = seconds;
            logger.debug('Timer updated to:', seconds);
            
            // Add warning class when time is running out
            if (timeRemaining <= 5000) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }
        } else if (timerElement) {
            // Fallback for invalid timeRemaining
            timerElement.textContent = '0';
            logger.debug('Timer set to 0 (fallback)');
        } else {
            logger.debug('Timer element not found!');
        }
    }

    /**
     * Start game timer
     */
    startTimer(duration) {
        return errorBoundary.safeExecute(() => {
            logger.debug('Starting timer with duration:', duration, 'ms');
            
            // Validate duration
            if (!duration || isNaN(duration) || duration <= 0) {
                logger.error('Invalid timer duration:', duration, '- using 30 second default');
                duration = 30000; // Default to 30 seconds
            }
            
            if (this.timer) {
                this.clearTimerTracked(this.timer);
            }
            
            let timeRemaining = duration;
            this.updateTimerDisplay(timeRemaining);
            
            this.timer = this.createTimerTracked(() => {
                timeRemaining -= 1000;
                logger.debug('Timer tick - timeRemaining:', timeRemaining);
                this.updateTimerDisplay(timeRemaining);
                
                if (timeRemaining <= 0) {
                    logger.debug('Timer finished');
                    this.clearTimerTracked(this.timer);
                    this.timer = null;
                }
            }, 1000, true); // true indicates this is an interval, not a timeout
        }, {
            type: 'game_logic',
            operation: 'timer',
            duration: duration
        }, () => {
            // Fallback: set static timer display
            logger.error('Failed to start timer, using static display');
            this.setStaticTimerDisplay(Math.ceil(duration / 1000));
        });
    }

    /**
     * Stop game timer
     */
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Reset game state
     */
    resetGameState() {
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.playerAnswers.clear();
        this.gameEnded = false;
        this.resultShown = false;
        this.stopTimer();
        
        // Clean up event listeners and timers when resetting game
        this.cleanup();
    }

    /**
     * Set player info
     */
    setPlayerInfo(name, isHost = false) {
        this.playerName = name;
        this.isHost = isHost;
        logger.debug('PlayerInfo', { name, isHost });
    }

    /**
     * Set game pin
     */
    setGamePin(pin) {
        this.gamePin = pin;
    }

    // ==================== MEMORY MANAGEMENT METHODS ====================

    /**
     * Add event listener with automatic tracking for cleanup
     */
    addEventListenerTracked(element, event, handler, options = {}) {
        if (!element || typeof element.addEventListener !== 'function') {
            logger.warn('Invalid element passed to addEventListenerTracked:', element);
            return;
        }

        // Add the event listener
        element.addEventListener(event, handler, options);
        
        // Track for cleanup
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element).push({ event, handler, options });
        
        logger.debug(`Tracked event listener: ${event} on`, element);
    }

    /**
     * Create timer with automatic tracking for cleanup
     */
    createTimerTracked(callback, interval, isInterval = false) {
        const timer = isInterval ? setInterval(callback, interval) : setTimeout(callback, interval);
        this.timers.add(timer);
        
        logger.debug(`Tracked ${isInterval ? 'interval' : 'timeout'}:`, timer);
        return timer;
    }

    /**
     * Track DOM element reference for cleanup
     */
    trackDOMReference(element) {
        if (element && element.nodeType === Node.ELEMENT_NODE) {
            this.domReferences.add(element);
        }
    }

    /**
     * Remove tracked event listener
     */
    removeEventListenerTracked(element, event, handler) {
        if (!element) return;

        element.removeEventListener(event, handler);
        
        const listeners = this.eventListeners.get(element);
        if (listeners) {
            const index = listeners.findIndex(l => l.event === event && l.handler === handler);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (listeners.length === 0) {
                    this.eventListeners.delete(element);
                }
            }
        }
    }

    /**
     * Clear specific timer
     */
    clearTimerTracked(timer) {
        if (this.timers.has(timer)) {
            clearTimeout(timer); // Works for both setTimeout and setInterval
            clearInterval(timer);
            this.timers.delete(timer);
            logger.debug('Cleared tracked timer:', timer);
        }
    }

    /**
     * Comprehensive cleanup method - removes all tracked event listeners, timers, and references
     */
    cleanup() {
        logger.debug('GameManager cleanup started');
        
        try {
            // Clear all tracked event listeners
            let listenerCount = 0;
            this.eventListeners.forEach((listeners, element) => {
                listeners.forEach(({ event, handler }) => {
                    try {
                        element.removeEventListener(event, handler);
                        listenerCount++;
                    } catch (error) {
                        logger.warn('Error removing event listener:', error);
                    }
                });
            });
            this.eventListeners.clear();
            logger.debug(`Cleaned up ${listenerCount} event listeners`);

            // Clear all tracked timers
            let timerCount = 0;
            this.timers.forEach(timer => {
                try {
                    clearTimeout(timer);
                    clearInterval(timer);
                    timerCount++;
                } catch (error) {
                    logger.warn('Error clearing timer:', error);
                }
            });
            this.timers.clear();
            logger.debug(`Cleaned up ${timerCount} timers`);

            // Clear DOM references
            this.domReferences.clear();

            // Clear game state
            this.playerAnswers.clear();
            this.currentQuestion = null;
            this.selectedAnswer = null;

            // Clear main timer if it exists
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }

            // Remove page unload listeners
            if (typeof window !== 'undefined') {
                window.removeEventListener('beforeunload', this.cleanup);
                window.removeEventListener('unload', this.cleanup);
            }

            logger.debug('GameManager cleanup completed successfully');
        } catch (error) {
            logger.error('Error during GameManager cleanup:', error);
        }
    }

    /**
     * Safe DOM manipulation that doesn't destroy event listeners
     */
    safeSetContent(element, content) {
        if (!element) return;

        // Clear existing content while preserving structure
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        // Set new content
        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content && content.nodeType) {
            element.appendChild(content);
        }
    }

    /**
     * Create element with tracked event listeners
     */
    createElementWithEvents(tagName, attributes = {}, events = {}) {
        const element = document.createElement(tagName);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });

        // Add tracked event listeners
        Object.entries(events).forEach(([event, handler]) => {
            this.addEventListenerTracked(element, event, handler);
        });

        this.trackDOMReference(element);
        return element;
    }

    // ==================== ERROR STATE METHODS ====================

    /**
     * Show error state when question display fails
     */
    showQuestionErrorState() {
        try {
            const containers = ['current-question', 'player-question-text'];
            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = `
                        <div class="error-state">
                            <p>⚠️ ${translationManager.getTranslationSync('question_load_error')}</p>
                            <p>Please wait for the next question...</p>
                        </div>
                    `;
                }
            });

            // Hide all option containers
            document.querySelectorAll('.player-options, .answer-options').forEach(container => {
                container.style.display = 'none';
            });
        } catch (error) {
            logger.error('Failed to show question error state:', error);
        }
    }

    /**
     * Show error state when player result display fails
     */
    showResultErrorState() {
        try {
            const resultElement = document.getElementById('answer-feedback');
            if (resultElement) {
                resultElement.classList.remove('hidden');
                resultElement.style.backgroundColor = '#f39c12'; // Orange for error
                
                const messageElement = document.getElementById('feedback-message');
                if (messageElement) {
                    messageElement.textContent = '⚠️ Result display error';
                }
                
                // Hide after delay
                setTimeout(() => {
                    resultElement.classList.add('hidden');
                }, 3000);
            }
        } catch (error) {
            logger.error('Failed to show result error state:', error);
        }
    }

    /**
     * Set static timer display when timer fails
     */
    setStaticTimerDisplay(seconds) {
        try {
            const timerElement = document.getElementById('timer');
            if (timerElement) {
                timerElement.textContent = seconds.toString();
                timerElement.classList.add('error-state');
            }
        } catch (error) {
            logger.error('Failed to set static timer display:', error);
        }
    }
}