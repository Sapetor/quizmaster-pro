/**
 * Game Manager Module
 * Handles game flow, question display, player results, and game state management
 */

import { getTranslation, getOptionLetter } from '../utils/translations.js';
import { TIMING, logger } from '../core/config.js';
import { MathRenderer } from '../utils/math-renderer.js';

export class GameManager {
    constructor(socket, uiManager, soundManager, socketManager = null) {
        this.socket = socket;
        this.uiManager = uiManager;
        this.soundManager = soundManager;
        this.socketManager = socketManager;
        this.mathRenderer = new MathRenderer();
        
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
    }

    /**
     * Display a question to the player or host
     */
    displayQuestion(data) {
        logger.debug('Displaying question:', data);
        logger.debug('Question options:', data.options);
        logger.debug('Question type:', data.type);
        logger.debug('CRITICAL: this.isHost =', this.isHost);
        logger.debug('CRITICAL: this.playerName =', this.playerName);
        
        // Reset result flag for new question
        this.resultShown = false;
        
        // Reset button states for new question
        this.resetButtonStatesForNewQuestion();
        
        const questionElement = document.getElementById('player-question-text');
        const hostQuestionElement = document.getElementById('current-question');
        const hostOptionsContainer = document.getElementById('answer-options');
        
        // For players, we'll dynamically find the correct container based on question type
        let optionsContainer = null;
        // EMERGENCY FIX: Force isHost to false for all non-host users
        if (this.playerName && this.playerName !== 'Host' && this.isHost !== false) {
            logger.warn('EMERGENCY: Forcing isHost to false for player:', this.playerName);
            this.isHost = false;
        }
        
        if (!this.isHost) {
            logger.debug('Player mode - setting up containers');
            // Show the appropriate answer type container
            document.querySelectorAll('.player-answer-type').forEach(type => type.style.display = 'none');
            
            if (data.type === 'multiple-choice') {
                const multipleChoiceContainer = document.getElementById('player-multiple-choice');
                logger.debug('multipleChoiceContainer found:', !!multipleChoiceContainer);
                if (multipleChoiceContainer) {
                    multipleChoiceContainer.style.display = 'block';
                    optionsContainer = multipleChoiceContainer.querySelector('.player-options');
                    logger.debug('Player optionsContainer set to:', optionsContainer);
                }
            } else if (data.type === 'multiple-correct') {
                const multipleCorrectContainer = document.getElementById('player-multiple-correct');
                logger.debug('multipleCorrectContainer found:', !!multipleCorrectContainer);
                if (multipleCorrectContainer) {
                    multipleCorrectContainer.style.display = 'block';
                    optionsContainer = multipleCorrectContainer.querySelector('.player-checkbox-options');
                    logger.debug('Player checkbox optionsContainer set to:', optionsContainer);
                }
            } else if (data.type === 'true-false') {
                const trueFalseContainer = document.getElementById('player-true-false');
                logger.debug('trueFalseContainer found:', !!trueFalseContainer);
                if (trueFalseContainer) {
                    trueFalseContainer.style.display = 'block';
                    optionsContainer = trueFalseContainer.querySelector('.true-false-options');
                    logger.debug('Player optionsContainer set to:', optionsContainer);
                }
            } else if (data.type === 'numeric') {
                const numericContainer = document.getElementById('player-numeric');
                logger.debug('numericContainer found:', !!numericContainer);
                if (numericContainer) {
                    numericContainer.style.display = 'block';
                    optionsContainer = numericContainer.querySelector('.numeric-input-container');
                    logger.debug('Player optionsContainer set to:', optionsContainer);
                }
            }
        } else {
            logger.debug('Host mode');
        }
        
        if (this.isHost) {
            // Switch to host game screen when new question starts
            this.uiManager.showScreen('host-game-screen');
            
            // Hide answer statistics during question
            this.hideAnswerStatistics();
            
            // Update question counter for host
            this.updateQuestionCounter(data.questionNumber, data.totalQuestions);
            
            // Host display
            if (hostQuestionElement) {
                hostQuestionElement.innerHTML = data.question;
                logger.debug('Host question HTML set:', data.question);
                // Debug what MathJax properties exist and force render
                logger.debug('MathJax debug:', {
                    exists: !!window.MathJax,
                    typesetPromise: !!window.MathJax?.typesetPromise,
                    startup: !!window.MathJax?.startup,
                    tex2jax: !!window.MathJax?.tex2jax,
                    Hub: !!window.MathJax?.Hub,
                    keys: window.MathJax ? Object.keys(window.MathJax) : 'none'
                });
                
                // Simple MathJax rendering with delay
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        logger.debug('Rendering MathJax for host question');
                        window.MathJax.typesetPromise([hostQuestionElement]).then(() => {
                            logger.debug('MathJax question rendering completed');
                        }).catch(err => {
                            logger.error('MathJax question render error:', err);
                        });
                    }
                }, 100); // Simple 100ms delay
            }
            
            if (hostOptionsContainer) {
                if (data.type === 'numeric') {
                    hostOptionsContainer.style.display = 'none';
                } else {
                    // Use the original monolithic structure with option-display divs
                    hostOptionsContainer.innerHTML = `
                        <div class="option-display"></div>
                        <div class="option-display"></div>
                        <div class="option-display"></div>
                        <div class="option-display"></div>
                    `;
                    hostOptionsContainer.style.display = 'grid';
                    const options = document.querySelectorAll('.option-display');
                    
                    // Reset all option styles from previous questions
                    this.resetButtonStyles(options);
                
                    if (data.type === 'true-false') {
                        options[0].textContent = getTranslation('true');
                        options[1].textContent = getTranslation('false');
                        options[2].style.display = 'none';
                        options[3].style.display = 'none';
                    } else if (data.type === 'multiple-choice' || data.type === 'multiple-correct') {
                        data.options.forEach((option, index) => {
                            if (options[index]) {
                                options[index].innerHTML = `${getOptionLetter(index)}: ${option}`;
                                options[index].style.display = 'block';
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
                
                // Simple MathJax rendering for options with delay
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        logger.debug('Rendering MathJax for host options');
                        window.MathJax.typesetPromise([hostOptionsContainer]).then(() => {
                            logger.debug('MathJax options rendering completed');
                        }).catch(err => {
                            logger.error('MathJax options render error:', err);
                        });
                    }
                }, 150); // Simple 150ms delay, slightly after question
            }
        } else {
            // Player display
            // Update question counter for player
            this.updatePlayerQuestionCounter(data.questionNumber, data.totalQuestions);
            
            if (questionElement) {
                questionElement.innerHTML = data.question;
                // Simple MathJax rendering for player with delay
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        window.MathJax.typesetPromise([questionElement]).then(() => {
                            logger.debug('MathJax rendering completed for player question');
                        }).catch(err => {
                            logger.error('MathJax player question render error:', err);
                        });
                    }
                }, 100);
            }
            
            // Update existing static elements with question data
            this.selectedAnswer = null;
            
            if (data.type === 'multiple-choice') {
                if (optionsContainer) {
                    logger.debug('Found optionsContainer for multiple choice:', optionsContainer);
                    const existingButtons = optionsContainer.querySelectorAll('.player-option');
                    existingButtons.forEach((button, index) => {
                        if (index < data.options.length) {
                            button.innerHTML = `<span class="option-letter">${getOptionLetter(index)}:</span> ${data.options[index]}`;
                            button.setAttribute('data-answer', index.toString());
                            button.classList.remove('selected', 'disabled');
                            button.style.display = 'block';
                            
                            // Remove old listeners and add new ones
                            button.replaceWith(button.cloneNode(true));
                            const newButton = optionsContainer.children[index];
                            newButton.addEventListener('click', () => {
                                logger.debug('Button clicked:', index);
                                this.selectAnswer(index);
                            });
                        } else {
                            button.style.display = 'none';
                        }
                    });
                }
            } else if (data.type === 'multiple-correct') {
                if (optionsContainer) {
                    logger.debug('Found optionsContainer for multiple correct:', optionsContainer);
                    const checkboxes = optionsContainer.querySelectorAll('.option-checkbox');
                    const checkboxLabels = optionsContainer.querySelectorAll('.checkbox-option');
                    
                    checkboxes.forEach(cb => cb.checked = false);
                    checkboxLabels.forEach((label, index) => {
                        if (data.options && data.options[index]) {
                            const formattedOption = data.options[index]; // this.formatCodeBlocks(data.options[index]);
                            label.innerHTML = `<input type="checkbox" class="option-checkbox"> ${getOptionLetter(index)}: ${formattedOption}`;
                            label.setAttribute('data-option', index);
                            // this.renderMathJax(label);
                        } else {
                            label.style.display = 'none';
                        }
                    });
                }
            } else if (data.type === 'true-false') {
                if (optionsContainer) {
                    logger.debug('Found optionsContainer for true/false:', optionsContainer);
                    const buttons = optionsContainer.querySelectorAll('.tf-option');
                    buttons.forEach((button, index) => {
                        button.classList.remove('selected', 'disabled');
                        button.setAttribute('data-answer', index.toString());
                        
                        // Remove old listeners and add new ones
                        button.replaceWith(button.cloneNode(true));
                        const newButton = optionsContainer.children[index];
                        newButton.addEventListener('click', () => {
                            logger.debug('True/False button clicked:', index);
                            // Convert index to boolean: 0 = true, 1 = false
                            const booleanAnswer = index === 0;
                            logger.debug('Converting T/F index', index, 'to boolean:', booleanAnswer);
                            this.selectAnswer(booleanAnswer);
                        });
                    });
                }
            } else if (data.type === 'numeric') {
                if (optionsContainer) {
                    logger.debug('Found optionsContainer for numeric:', optionsContainer);
                    const input = optionsContainer.querySelector('#numeric-answer-input');
                    const submitButton = optionsContainer.querySelector('#submit-numeric');
                    
                    if (input) {
                        input.value = '';
                        input.disabled = false;
                        input.placeholder = getTranslation('enter_numeric_answer');
                    }
                    
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = getTranslation('submit');
                        
                        // Remove old listeners and add new ones
                        submitButton.replaceWith(submitButton.cloneNode(true));
                        const newSubmitButton = optionsContainer.querySelector('#submit-numeric');
                        newSubmitButton.addEventListener('click', () => {
                            this.submitNumericAnswer();
                        });
                    }
                    
                    if (input) {
                        // Remove old listeners and add new ones
                        input.replaceWith(input.cloneNode(true));
                        const newInput = optionsContainer.querySelector('#numeric-answer-input');
                        newInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                this.submitNumericAnswer();
                            }
                        });
                    }
                }
            }
            
            // Render math in player options with delay
            if (optionsContainer) {
                setTimeout(() => {
                    if (window.MathJax?.typesetPromise) {
                        window.MathJax.typesetPromise([optionsContainer]).then(() => {
                            logger.debug('MathJax rendering completed for player options');
                        }).catch(err => {
                            logger.error('MathJax player options render error:', err);
                        });
                    }
                }, 150);
            }
        }
        
        // Play question start sound
        if (this.soundManager.isEnabled()) {
            this.soundManager.playQuestionStartSound();
        }
        
        // Store current question data
        this.currentQuestion = data;
        
        // Update question counter if element exists
        this.updateQuestionCounter(data.questionNumber, data.totalQuestions);
    }

    /**
     * Update the question counter display (host)
     */
    updateQuestionCounter(current, total) {
        const counterElement = document.getElementById('question-counter');
        if (counterElement) {
            counterElement.textContent = `${getTranslation('question')} ${current} ${getTranslation('of')} ${total}`;
        }
    }

    /**
     * Update the question counter display (player)
     */
    updatePlayerQuestionCounter(current, total) {
        const counterElement = document.getElementById('player-question-counter');
        if (counterElement) {
            counterElement.textContent = `${getTranslation('question')} ${current} ${getTranslation('of')} ${total}`;
        }
    }

    /**
     * Submit multiple correct answer
     */
    submitMultipleCorrectAnswer() {
        const submitBtn = document.getElementById('submit-multiple');
        
        // Immediately disable button and provide visual feedback
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = getTranslation('submitting');
        }
        
        const checkboxes = document.querySelectorAll('#player-multiple-correct .option-checkbox:checked');
        const answers = Array.from(checkboxes).map(cb => {
            const closest = cb.closest('.checkbox-option');
            return closest ? parseInt(closest.dataset.option) : null;
        }).filter(option => option !== null);
        
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
        const input = document.getElementById('numeric-answer-input');
        if (!input || input.value.trim() === '') return;
        
        const answer = parseFloat(input.value);
        if (isNaN(answer)) return;
        
        this.selectAnswer(answer);
        input.disabled = true;
        
        const submitButton = document.getElementById('submit-numeric');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = getTranslation('submitted');
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
                answerText = getOptionLetter(answer);
            }
            
            feedback.innerHTML = `${getTranslation('answer_submitted')}: ${answerText}`;
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
                messageElement.textContent = '🎉 ' + getTranslation('correct_answer_msg');
            } else {
                resultElement.style.backgroundColor = '#e74c3c';
                messageElement.textContent = '❌ ' + getTranslation('incorrect_answer_msg');
            }
        }
        
        if (scoreElement && earnedPoints > 0) {
            scoreElement.textContent = `+${earnedPoints} ${getTranslation('points')} (${getTranslation('total')}: ${data.totalScore})`;
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
            scoreDisplay.textContent = getTranslation('waiting_for_results');
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
            const tfOptions = document.querySelectorAll('.true-btn, .false-btn');
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
            submitButton.textContent = getTranslation('submit_answer');
        }
        
        // Reset multiple correct submit button
        const multipleSubmitButton = document.getElementById('submit-multiple');
        if (multipleSubmitButton) {
            multipleSubmitButton.disabled = false;
        }
        
        logger.debug('Button states reset completed');
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
            let answerText = `✅ ${getTranslation('correct_answer')}: ${correctAnswer}`;
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
        
        // Create statistics container if it doesn't exist
        let statisticsContainer = document.getElementById('answer-statistics');
        if (!statisticsContainer) {
            this.createAnswerStatisticsContainer();
            statisticsContainer = document.getElementById('answer-statistics');
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
     * Create answer statistics container if it doesn't exist
     */
    createAnswerStatisticsContainer() {
        if (document.getElementById('answer-statistics')) return;
        
        const hostGameScreen = document.getElementById('host-game-screen');
        if (!hostGameScreen) return;
        
        const statisticsHTML = `
            <div id="answer-statistics" style="display: none; margin-top: 20px; background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; backdrop-filter: blur(10px);">
                <h3 style="color: white; margin-bottom: 10px;">${getTranslation('live_answer_statistics')}</h3>
                <div class="stats-header" style="color: white; margin-bottom: 15px;">
                    <span id="responses-count">0</span> / <span id="total-players">0</span> ${getTranslation('responses')}
                </div>
                <div id="stats-content"></div>
            </div>
        `;
        
        hostGameScreen.insertAdjacentHTML('beforeend', statisticsHTML);
    }

    /**
     * Show statistics for multiple choice questions
     */
    showMultipleChoiceStatistics(optionCount) {
        const statsContent = document.querySelector('.stats-grid');
        if (!statsContent) return;
        
        statsContent.innerHTML = '';
        for (let i = 0; i < optionCount; i++) {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            statItem.id = `stat-item-${i}`;
            statItem.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 5px;
            `;
            statItem.innerHTML = `
                <div class="stat-letter" style="width: 30px; color: white; font-weight: bold;">${getOptionLetter(i)}</div>
                <div class="stat-bar" style="flex: 1; height: 20px; background: rgba(255,255,255,0.2); border-radius: 10px; margin: 0 10px; overflow: hidden;">
                    <div class="stat-fill" id="stat-fill-${i}" style="height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); width: 0%; transition: width 0.3s ease;"></div>
                </div>
                <div class="stat-count" id="stat-count-${i}" style="width: 40px; color: white; font-weight: bold; text-align: right;">0</div>
            `;
            statsContent.appendChild(statItem);
        }
    }

    /**
     * Show statistics for true/false questions
     */
    showTrueFalseStatistics() {
        const statsContent = document.querySelector('.stats-grid');
        if (!statsContent) return;
        
        const trueItem = document.createElement('div');
        trueItem.className = 'stat-item';
        trueItem.id = 'stat-item-0';
        trueItem.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 5px;
        `;
        trueItem.innerHTML = `
            <div class="stat-letter" style="width: 60px; color: white; font-weight: bold;">${getTranslation('true')}</div>
            <div class="stat-bar" style="flex: 1; height: 20px; background: rgba(255,255,255,0.2); border-radius: 10px; margin: 0 10px; overflow: hidden;">
                <div class="stat-fill" id="stat-fill-0" style="height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div class="stat-count" id="stat-count-0" style="width: 40px; color: white; font-weight: bold; text-align: right;">0</div>
        `;
        
        const falseItem = document.createElement('div');
        falseItem.className = 'stat-item';
        falseItem.id = 'stat-item-1';
        falseItem.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 5px;
        `;
        falseItem.innerHTML = `
            <div class="stat-letter" style="width: 60px; color: white; font-weight: bold;">${getTranslation('false')}</div>
            <div class="stat-bar" style="flex: 1; height: 20px; background: rgba(255,255,255,0.2); border-radius: 10px; margin: 0 10px; overflow: hidden;">
                <div class="stat-fill" id="stat-fill-1" style="height: 100%; background: linear-gradient(90deg, #f44336, #d32f2f); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div class="stat-count" id="stat-count-1" style="width: 40px; color: white; font-weight: bold; text-align: right;">0</div>
        `;
        
        statsContent.innerHTML = '';
        statsContent.appendChild(trueItem);
        statsContent.appendChild(falseItem);
    }

    /**
     * Update individual statistic item
     */
    updateStatItem(index, count, totalAnswered) {
        const statCount = document.getElementById(`stat-count-${index}`);
        const statFill = document.getElementById(`stat-fill-${index}`);
        
        if (statCount) {
            statCount.textContent = count;
        }
        
        if (statFill && totalAnswered > 0) {
            const percentage = (count / totalAnswered) * 100;
            statFill.style.width = `${percentage}%`;
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
            finalScore.textContent = `${playerScore} ${getTranslation('points')}`;
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
        logger.debug('Starting timer with duration:', duration, 'ms');
        
        // Validate duration
        if (!duration || isNaN(duration) || duration <= 0) {
            logger.error('Invalid timer duration:', duration, '- using 30 second default');
            duration = 30000; // Default to 30 seconds
        }
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        let timeRemaining = duration;
        this.updateTimerDisplay(timeRemaining);
        
        this.timer = setInterval(() => {
            timeRemaining -= 1000;
            logger.debug('Timer tick - timeRemaining:', timeRemaining);
            this.updateTimerDisplay(timeRemaining);
            
            if (timeRemaining <= 0) {
                logger.debug('Timer finished');
                clearInterval(this.timer);
                this.timer = null;
            }
        }, 1000);
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
    }

    /**
     * Set player info
     */
    setPlayerInfo(name, isHost = false) {
        logger.debug('CRITICAL: setPlayerInfo called with:', name, isHost);
        this.playerName = name;
        this.isHost = isHost;
        logger.debug('CRITICAL: setPlayerInfo result - this.isHost =', this.isHost, 'this.playerName =', this.playerName);
    }

    /**
     * Set game pin
     */
    setGamePin(pin) {
        this.gamePin = pin;
    }
}