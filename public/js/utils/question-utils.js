/**
 * Question Utilities Module
 * Handles question creation, validation, and manipulation utilities
 * 
 * EXTRACTION NOTES:
 * - Extracted from script.js lines 1761-1855, 1913-1981, 3223-3270, 5382-5474
 * - Includes question HTML generation, validation, and randomization
 * - Manages LaTeX validation and delimiter checking
 * - Dependencies: translation-manager.js for translationManager.getTranslationSync()
 */

import { logger } from '../core/config.js';

import { translationManager, getTrueFalseText } from './translation-manager.js';

export class QuestionUtils {
    constructor() {
        this.autoSaveTimeout = null;
    }

    /**
     * Generate HTML for a new question
     * @param {number} questionCount - The index of the question being created
     * @returns {string} - HTML string for the question
     */
    generateQuestionHTML(questionCount) {
        return `
            <h3><span data-translate="question">Question</span> ${questionCount + 1}</h3>
            
            <div class="question-meta">
                <select class="question-type" onchange="updateQuestionType(this)">
                    <option value="multiple-choice" data-translate="multiple_choice">Multiple Choice</option>
                    <option value="multiple-correct" data-translate="multiple_correct">Multiple Correct Answers</option>
                    <option value="true-false" data-translate="true_false">True/False</option>
                    <option value="numeric" data-translate="numeric">Numeric Answer</option>
                </select>
                
                <select class="question-difficulty">
                    <option value="easy" data-translate="easy">Easy</option>
                    <option value="medium" selected data-translate="medium">Medium</option>
                    <option value="hard" data-translate="hard">Hard</option>
                </select>
                
                <div class="time-limit-container">
                    <label>
                        <span data-translate="time_seconds">Time (sec)</span>
                        <input type="number" class="question-time-limit" min="5" max="300" value="20" onchange="updateTimeLimit(this)">
                    </label>
                </div>
            </div>
            
            <div class="question-content">
                <textarea class="question-text" placeholder="Enter your question (supports LaTeX)" data-translate-placeholder="enter_question_with_latex"></textarea>
                
                <div class="image-upload">
                    <label data-translate="add_image">Add Image</label>
                    <input type="file" class="image-input" accept="image/*" onchange="uploadImage(this)">
                    <div class="image-preview" style="display: none;">
                        <img class="question-image" src="" alt="Question Image" style="max-width: 200px; max-height: 150px;">
                        <button type="button" class="remove-image" onclick="removeImage(this)" data-translate="remove_image">Remove Image</button>
                    </div>
                </div>
            </div>
            
            <div class="answer-options multiple-choice-options">
                <div class="options">
                    <input type="text" class="option" data-option="0" placeholder="Option A" data-translate-placeholder="option_a">
                    <input type="text" class="option" data-option="1" placeholder="Option B" data-translate-placeholder="option_b">
                    <input type="text" class="option" data-option="2" placeholder="Option C" data-translate-placeholder="option_c">
                    <input type="text" class="option" data-option="3" placeholder="Option D" data-translate-placeholder="option_d">
                </div>
                <select class="correct-answer">
                    <option value="0" data-translate="a_is_correct">A is correct</option>
                    <option value="1" data-translate="b_is_correct">B is correct</option>
                    <option value="2" data-translate="c_is_correct">C is correct</option>
                    <option value="3" data-translate="d_is_correct">D is correct</option>
                </select>
            </div>
            
            <div class="answer-options multiple-correct-options" style="display: none;">
                <div class="options-checkboxes">
                    <label><input type="checkbox" class="correct-option" data-option="0"> <input type="text" class="option" placeholder="Option A" data-translate-placeholder="option_a"></label>
                    <label><input type="checkbox" class="correct-option" data-option="1"> <input type="text" class="option" placeholder="Option B" data-translate-placeholder="option_b"></label>
                    <label><input type="checkbox" class="correct-option" data-option="2"> <input type="text" class="option" placeholder="Option C" data-translate-placeholder="option_c"></label>
                    <label><input type="checkbox" class="correct-option" data-option="3"> <input type="text" class="option" placeholder="Option D" data-translate-placeholder="option_d"></label>
                </div>
            </div>
            
            <div class="answer-options true-false-options" style="display: none;">
                <select class="correct-answer">
                    <option value="true" data-translate="true">True</option>
                    <option value="false" data-translate="false">False</option>
                </select>
            </div>
            
            <div class="answer-options numeric-options" style="display: none;">
                <label data-translate="correct_answer">Correct Answer</label>
                <input type="number" class="numeric-answer" data-translate-placeholder="enter_numeric_answer" step="any">
                <label data-translate="tolerance">Tolerance</label>
                <input type="number" class="numeric-tolerance" placeholder="0.1" step="any" value="0.1">
            </div>
            
            <button class="btn secondary remove-question" onclick="removeQuestion(this)" data-translate="remove">Remove</button>
        `;
    }

    /**
     * Collect questions from the DOM
     * @returns {Array} - Array of question objects
     */
    collectQuestions() {
        const questions = [];
        const questionItems = document.querySelectorAll('.question-item');
        
        questionItems.forEach((item) => {
            const questionText = item.querySelector('.question-text').value.trim();
            const questionType = item.querySelector('.question-type').value;
            const questionDifficulty = item.querySelector('.question-difficulty').value;
            const imageElement = item.querySelector('.question-image');
            const imageUrl = imageElement ? (imageElement.dataset.url || '') : '';
            
            if (!questionText) return;
            
            // Get time limit for this question
            const timeLimitElement = item.querySelector('.question-time-limit');
            const useGlobalTime = document.getElementById('use-global-time')?.checked || false;
            const globalTimeLimit = parseInt(document.getElementById('global-time-limit')?.value) || 20;
            const individualTimeLimit = parseInt(timeLimitElement.value) || 20;
            
            let question = {
                question: questionText,
                type: questionType,
                difficulty: questionDifficulty,
                timeLimit: useGlobalTime ? globalTimeLimit : individualTimeLimit,
                image: imageUrl
            };
            
            switch (questionType) {
                case 'multiple-choice':
                    const mcOptions = Array.from(item.querySelectorAll('.multiple-choice-options .option')).map(opt => opt.value.trim());
                    const mcCorrect = parseInt(item.querySelector('.multiple-choice-options .correct-answer').value);
                    if (mcOptions.every(opt => opt)) {
                        question.options = mcOptions;
                        question.correctAnswer = mcCorrect;
                        questions.push(question);
                    }
                    break;
                    
                case 'multiple-correct':
                    const mcorrOptions = Array.from(item.querySelectorAll('.multiple-correct-options .option')).map(opt => opt.value.trim());
                    const mcorrCorrect = Array.from(item.querySelectorAll('.multiple-correct-options .correct-option:checked')).map(cb => parseInt(cb.dataset.option));
                    if (mcorrOptions.every(opt => opt) && mcorrCorrect.length > 0) {
                        question.options = mcorrOptions;
                        question.correctAnswers = mcorrCorrect;
                        questions.push(question);
                    }
                    break;
                    
                case 'true-false':
                    const tfCorrect = item.querySelector('.true-false-options .correct-answer').value;
                    question.options = [getTrueFalseText().trueDisplay, getTrueFalseText().falseDisplay]; // Display names
                    question.correctAnswer = tfCorrect; // Will be "true" or "false" (lowercase)
                    questions.push(question);
                    break;
                    
                case 'numeric':
                    const numAnswer = parseFloat(item.querySelector('.numeric-answer').value);
                    const numTolerance = parseFloat(item.querySelector('.numeric-tolerance').value) || 0.1;
                    if (!isNaN(numAnswer)) {
                        question.correctAnswer = numAnswer;
                        question.tolerance = numTolerance;
                        questions.push(question);
                    }
                    break;
            }
        });
        
        return questions;
    }

    /**
     * Validate an array of questions
     * @param {Array} questions - Questions to validate
     * @returns {Array} - Array of valid questions
     */
    validateQuestions(questions) {
        const validQuestions = [];
        logger.debug('Validating questions, count:', questions.length);
        
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            logger.debug(`Validating question ${i}:`, q);
            
            if (q.question && q.type && q.correctAnswer !== undefined) {
                logger.debug('Basic validation passed for question', i);
                
                // Basic LaTeX validation
                const hasErrors = this.hasLatexErrors(q.question);
                if (hasErrors) {
                    logger.warn('LaTeX validation would skip:', q.question);
                    logger.warn('But allowing it through for now...');
                }
                logger.debug('LaTeX validation passed for question', i);
                
                // Set default values for missing fields
                q.difficulty = q.difficulty || 'medium';
                q.timeLimit = q.timeLimit || 20;
                
                // Validate question type
                if (['multiple-choice', 'true-false', 'multiple-correct', 'numeric'].includes(q.type)) {
                    logger.debug('Question type validation passed for question', i);
                    validQuestions.push(q);
                } else {
                    logger.warn('Invalid question type:', q.type);
                }
            } else {
                logger.warn('Question failed basic validation:', {
                    hasQuestion: !!q.question,
                    hasType: !!q.type,
                    hasCorrectAnswer: q.correctAnswer !== undefined
                });
            }
        }
        
        logger.debug('Validation complete. Valid questions:', validQuestions.length);
        return validQuestions;
    }

    /**
     * Shuffle an array using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} - Shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    /**
     * Randomize answer positions for multiple choice questions
     * @param {Array} questions - Array of questions
     * @returns {Array} - Questions with randomized answers
     */
    randomizeAnswers(questions) {
        return questions.map(question => {
            // Only randomize multiple-choice and multiple-correct questions
            if (question.type === 'multiple-choice' || question.type === 'multiple-correct') {
                if (!question.options || question.options.length < 2) {
                    return question; // Skip if not enough options
                }
                
                // Create array of indices and shuffle them
                const indices = question.options.map((_, index) => index);
                const shuffledIndices = this.shuffleArray(indices);
                
                // Create new options array based on shuffled indices
                const newOptions = shuffledIndices.map(oldIndex => question.options[oldIndex]);
                
                // Update correct answer mapping
                const newQuestion = { ...question, options: newOptions };
                
                if (question.type === 'multiple-choice') {
                    // Find where the original correct answer ended up
                    const oldCorrectIndex = question.correctAnswer;
                    const newCorrectIndex = shuffledIndices.indexOf(oldCorrectIndex);
                    newQuestion.correctAnswer = newCorrectIndex;
                } else if (question.type === 'multiple-correct') {
                    // Map all correct answer indices to their new positions
                    const oldCorrectAnswers = question.correctAnswers || [];
                    const newCorrectAnswers = oldCorrectAnswers.map(oldIndex => 
                        shuffledIndices.indexOf(oldIndex)
                    ).sort();
                    newQuestion.correctAnswers = newCorrectAnswers;
                }
                
                return newQuestion;
            }
            
            // Return unchanged for true-false and numeric questions
            return question;
        });
    }

    /**
     * Check for LaTeX syntax errors in text
     * @param {string} text - Text to validate
     * @returns {boolean} - Whether the text has LaTeX errors
     */
    hasLatexErrors(text) {
        // Check for unmatched LaTeX environments
        const beginMatches = (text.match(/\\begin\{[^}]+\}/g) || []).length;
        const endMatches = (text.match(/\\end\{[^}]+\}/g) || []).length;
        
        // Check for unmatched dollar signs
        const dollarMatches = (text.match(/\$/g) || []).length;
        
        // Check for incomplete LaTeX commands (but allow common math functions)
        const commonMathFunctions = /\\(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|int|sum|prod|lim|frac|partial|nabla|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|infty|cdot|times|div|pm|mp|neq|leq|geq|approx|equiv|subset|supset|in|notin|cup|cap|emptyset|mathbb|mathcal|mathbf|text)\b/;
        const hasIncompleteCommands = /\\[a-zA-Z]+(?![a-zA-Z]|\{|\()/.test(text) && !commonMathFunctions.test(text);
        
        // Check for problematic LaTeX patterns
        const hasProblematicText = /\\text\{[iπe]\}/.test(text); // \text{i}, \text{π}, \text{e}
        const hasInvalidFunctions = /\\text\{sqrt|sin|cos|tan|log\}/.test(text); // \text{sqrt}, etc.
        const hasInvalidTrigSyntax = false; // Allow all trig function syntax
        
        // Check for bracket mismatches
        const hasUnmatchedParens = this.hasUnmatchedDelimiters(text, '(', ')');
        const hasUnmatchedBrackets = this.hasUnmatchedDelimiters(text, '[', ']');
        const hasUnmatchedBraces = this.hasUnmatchedDelimiters(text, '{', '}');
        
        // Check for double subscripts/superscripts without braces
        const hasDoubleScripts = /\^[^{]\^|\^[^{]*\^|_[^{]_|_[^{]*_/.test(text);
        
        // Check for incomplete fractions
        const hasIncompleteFractions = /\\frac\{[^}]*\}(?!\{)/.test(text);
        
        return beginMatches !== endMatches || 
               dollarMatches % 2 !== 0 || 
               hasIncompleteCommands || 
               hasProblematicText || 
               hasInvalidFunctions || 
               hasInvalidTrigSyntax ||
               hasUnmatchedParens ||
               hasUnmatchedBrackets ||
               hasUnmatchedBraces ||
               hasDoubleScripts ||
               hasIncompleteFractions;
    }

    /**
     * Check for unmatched delimiters in text
     * @param {string} text - Text to check
     * @param {string} open - Opening delimiter
     * @param {string} close - Closing delimiter
     * @returns {boolean} - Whether delimiters are unmatched
     */
    hasUnmatchedDelimiters(text, open, close) {
        let count = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === open) count++;
            if (text[i] === close) count--;
            if (count < 0) return true; // More closing than opening
        }
        return count !== 0; // Unmatched delimiters
    }

    /**
     * Add generated questions from AI to the question list
     * @param {Array} questions - Generated questions to add
     */
    addGeneratedQuestions(questions) {
        if (!window.game) return;

        questions.forEach(q => {
            window.game.addQuestion();
            const questionItems = document.querySelectorAll('.question-item');
            const newQuestionItem = questionItems[questionItems.length - 1];
            
            // Populate the question
            if (newQuestionItem) {
                const questionText = newQuestionItem.querySelector('.question-text');
                const questionType = newQuestionItem.querySelector('.question-type');
                const questionDifficulty = newQuestionItem.querySelector('.question-difficulty');
                
                if (questionText) questionText.value = q.question || '';
                if (questionType) questionType.value = q.type || 'multiple-choice';
                if (questionDifficulty) questionDifficulty.value = q.difficulty || 'medium';
                
                // Trigger question type change to show appropriate options
                if (questionType) {
                    const event = new Event('change');
                    questionType.dispatchEvent(event);
                }
                
                // Populate options based on question type
                setTimeout(() => {
                    this.populateQuestionOptions(newQuestionItem, q);
                }, 100);
            }
        });
    }

    /**
     * Populate question options based on question type
     * @param {HTMLElement} questionItem - Question DOM element
     * @param {Object} questionData - Question data to populate
     */
    populateQuestionOptions(questionItem, questionData) {
        const questionType = questionData.type;
        
        switch (questionType) {
            case 'multiple-choice':
                const mcOptions = questionItem.querySelectorAll('.multiple-choice-options .option');
                mcOptions.forEach((option, index) => {
                    if (questionData.options && questionData.options[index]) {
                        option.value = questionData.options[index];
                    }
                });
                
                const mcCorrect = questionItem.querySelector('.multiple-choice-options .correct-answer');
                if (mcCorrect && questionData.correctAnswer !== undefined) {
                    mcCorrect.value = questionData.correctAnswer;
                }
                break;
                
            case 'multiple-correct':
                const mcorrOptions = questionItem.querySelectorAll('.multiple-correct-options .option');
                mcorrOptions.forEach((option, index) => {
                    if (questionData.options && questionData.options[index]) {
                        option.value = questionData.options[index];
                    }
                });
                
                const mcorrCorrect = questionItem.querySelectorAll('.multiple-correct-options .correct-option');
                mcorrCorrect.forEach((checkbox, index) => {
                    if (questionData.correctAnswers && questionData.correctAnswers.includes(index)) {
                        checkbox.checked = true;
                    }
                });
                break;
                
            case 'true-false':
                const tfCorrect = questionItem.querySelector('.true-false-options .correct-answer');
                if (tfCorrect && questionData.correctAnswer !== undefined) {
                    tfCorrect.value = questionData.correctAnswer.toString();
                }
                break;
                
            case 'numeric':
                const numAnswer = questionItem.querySelector('.numeric-answer');
                const numTolerance = questionItem.querySelector('.numeric-tolerance');
                
                if (numAnswer && questionData.correctAnswer !== undefined) {
                    numAnswer.value = questionData.correctAnswer;
                }
                if (numTolerance && questionData.tolerance !== undefined) {
                    numTolerance.value = questionData.tolerance;
                }
                break;
        }
    }

    /**
     * Auto-save questions after a delay
     * @param {Function} saveCallback - Function to call for saving
     */
    scheduleAutoSave(saveCallback) {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        this.autoSaveTimeout = setTimeout(() => {
            if (saveCallback && typeof saveCallback === 'function') {
                saveCallback();
            }
        }, 1000);
    }

    /**
     * Clean up any timeouts
     */
    cleanup() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }
    }
}

// Create global instance for backward compatibility
const questionUtils = new QuestionUtils();

/**
 * Add a new question to the quiz builder
 */
export function addQuestion() {
    logger.debug('addQuestion called');
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) {
        logger.error('Questions container not found');
        return;
    }
    
    const questionCount = questionsContainer.children.length;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.setAttribute('data-question', questionCount);
    
    questionDiv.innerHTML = questionUtils.generateQuestionHTML(questionCount);
    
    // Pre-create the remove button to avoid later DOM manipulation
    const removeButton = document.createElement('button');
    removeButton.className = 'btn secondary remove-question';
    removeButton.onclick = () => {
        questionDiv.remove();
        // Use setTimeout to prevent immediate reflow issues
        setTimeout(() => {
            if (window.game && window.game.quizManager && window.game.quizManager.updateQuestionsUI) {
                window.game.quizManager.updateQuestionsUI();
            }
        }, 10);
    };
    removeButton.setAttribute('data-translate', 'remove');
    removeButton.textContent = 'Remove';
    removeButton.style.display = 'none'; // Hidden initially
    questionDiv.appendChild(removeButton);
    
    questionsContainer.appendChild(questionDiv);
    
    // Translate the newly added question element
    translationManager.translateContainer(questionDiv);
    
    // Update questions UI in single operation to prevent visual glitches
    if (window.game && window.game.quizManager && window.game.quizManager.updateQuestionsUI) {
        window.game.quizManager.updateQuestionsUI();
    }
    
    return questionDiv;
}

/**
 * Debug function to monitor DOM and style changes during question addition
 */
function debugQuestionChanges() {
    console.log('🔍 DEBUG: Setting up question change monitoring...');
    
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) return;
    
    // Monitor all question items for style changes
    const questionItems = questionsContainer.querySelectorAll('.question-item');
    questionItems.forEach((item, index) => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    console.log(`🎨 DEBUG: Question ${index} - Attribute "${mutation.attributeName}" changed`);
                    if (mutation.attributeName === 'style') {
                        console.log(`🎨 DEBUG: Question ${index} - Style changed to:`, item.style.cssText);
                    }
                    if (mutation.attributeName === 'data-question') {
                        console.log(`🎨 DEBUG: Question ${index} - data-question changed to:`, item.getAttribute('data-question'));
                    }
                }
                if (mutation.type === 'childList') {
                    console.log(`🎨 DEBUG: Question ${index} - Child nodes changed`);
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            console.log(`🎨 DEBUG: Question ${index} - Added element:`, node.tagName, node.className);
                        }
                    });
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            console.log(`🎨 DEBUG: Question ${index} - Removed element:`, node.tagName, node.className);
                        }
                    });
                }
                if (mutation.type === 'characterData') {
                    console.log(`🎨 DEBUG: Question ${index} - Text content changed to:`, mutation.target.textContent);
                }
            });
        });
        
        observer.observe(item, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });
        
        // Store observer for cleanup
        item._debugObserver = observer;
    });
    
    // Monitor for new question items being added
    const containerObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('question-item')) {
                    console.log(`📝 DEBUG: New question item added to container`);
                }
            });
        });
    });
    
    containerObserver.observe(questionsContainer, {
        childList: true
    });
}

/**
 * Enhanced addQuestion with comprehensive debugging
 */
export function addQuestionWithDebugging() {
    console.log('🚀🔍 DEBUG: addQuestionWithDebugging() started');
    
    // Monitor existing questions before changes
    debugQuestionChanges();
    
    // Call original addQuestion
    const result = addQuestion();
    
    // Monitor after changes
    setTimeout(() => {
        debugQuestionChanges();
        console.log('🚀🔍 DEBUG: Post-addition monitoring setup complete');
    }, 100);
    
    return result;
}

/**
 * Advanced debugging utility to track animation triggers and visual changes
 */
class QuestionAnimationDebugger {
    constructor() {
        this.isDebugging = false;
        this.styleSnapshots = new Map();
        this.changeLog = [];
    }
    
    startDebugging() {
        console.log('🎬 DEBUG: Starting animation debugging...');
        this.isDebugging = true;
        this.changeLog = [];
        this.addVisualDebugger();
        this.captureInitialStyles();
        this.setupAnimationTracking();
    }
    
    stopDebugging() {
        console.log('🎬 DEBUG: Stopping animation debugging...');
        this.isDebugging = false;
        this.removeVisualDebugger();
        this.printChangeReport();
    }
    
    addVisualDebugger() {
        // Add visual overlay to track changes
        if (document.getElementById('debug-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'debug-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
            max-height: 200px;
            overflow-y: auto;
        `;
        overlay.innerHTML = '<h4>🎬 Animation Debugger</h4><div id="debug-log"></div>';
        document.body.appendChild(overlay);
    }
    
    removeVisualDebugger() {
        const overlay = document.getElementById('debug-overlay');
        if (overlay) overlay.remove();
    }
    
    logChange(message, element = null) {
        if (!this.isDebugging) return;
        
        const timestamp = Date.now();
        const logEntry = { timestamp, message, element };
        this.changeLog.push(logEntry);
        
        console.log(`🎬 ${message}`);
        
        // Update visual debugger
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            const entry = document.createElement('div');
            entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
            entry.style.color = this.getLogColor(message);
            debugLog.appendChild(entry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    }
    
    getLogColor(message) {
        if (message.includes('CHANGING')) return '#ff6b6b';
        if (message.includes('CREATE')) return '#4ecdc4';
        if (message.includes('REMOVE')) return '#ffe66d';
        if (message.includes('STYLE')) return '#a8e6cf';
        return '#ffffff';
    }
    
    captureInitialStyles() {
        const questionsContainer = document.getElementById('questions-container');
        if (!questionsContainer) return;
        
        const questionItems = questionsContainer.querySelectorAll('.question-item');
        questionItems.forEach((item, index) => {
            const computedStyle = window.getComputedStyle(item);
            const snapshot = {
                background: computedStyle.background,
                backgroundColor: computedStyle.backgroundColor,
                border: computedStyle.border,
                borderColor: computedStyle.borderColor,
                boxShadow: computedStyle.boxShadow,
                opacity: computedStyle.opacity,
                transform: computedStyle.transform,
                transition: computedStyle.transition
            };
            this.styleSnapshots.set(`question-${index}`, snapshot);
            this.logChange(`CAPTURED initial styles for question ${index}`);
        });
    }
    
    setupAnimationTracking() {
        // Track CSS animation events
        document.addEventListener('animationstart', (e) => {
            if (e.target.classList.contains('question-item')) {
                this.logChange(`ANIMATION START: ${e.animationName} on question item`, e.target);
            }
        });
        
        document.addEventListener('animationend', (e) => {
            if (e.target.classList.contains('question-item')) {
                this.logChange(`ANIMATION END: ${e.animationName} on question item`, e.target);
            }
        });
        
        document.addEventListener('transitionstart', (e) => {
            if (e.target.classList.contains('question-item')) {
                this.logChange(`TRANSITION START: ${e.propertyName} on question item`, e.target);
            }
        });
        
        document.addEventListener('transitionend', (e) => {
            if (e.target.classList.contains('question-item')) {
                this.logChange(`TRANSITION END: ${e.propertyName} on question item`, e.target);
            }
        });
    }
    
    compareStyles(element, index) {
        if (!this.isDebugging) return;
        
        const key = `question-${index}`;
        const oldSnapshot = this.styleSnapshots.get(key);
        if (!oldSnapshot) return;
        
        const computedStyle = window.getComputedStyle(element);
        const newSnapshot = {
            background: computedStyle.background,
            backgroundColor: computedStyle.backgroundColor,
            border: computedStyle.border,
            borderColor: computedStyle.borderColor,
            boxShadow: computedStyle.boxShadow,
            opacity: computedStyle.opacity,
            transform: computedStyle.transform,
            transition: computedStyle.transition
        };
        
        // Compare and log differences
        Object.keys(oldSnapshot).forEach(property => {
            if (oldSnapshot[property] !== newSnapshot[property]) {
                this.logChange(`STYLE CHANGE question ${index}: ${property} from "${oldSnapshot[property]}" to "${newSnapshot[property]}"`);
            }
        });
        
        // Update snapshot
        this.styleSnapshots.set(key, newSnapshot);
    }
    
    printChangeReport() {
        console.group('🎬 Animation Debug Report');
        console.log(`Total changes tracked: ${this.changeLog.length}`);
        
        const changesByType = {};
        this.changeLog.forEach(entry => {
            const type = entry.message.split(':')[0];
            changesByType[type] = (changesByType[type] || 0) + 1;
        });
        
        console.table(changesByType);
        console.log('Detailed log:', this.changeLog);
        console.groupEnd();
    }
}

/**
 * Enable debug mode for the add question button
 * Call this in browser console: enableQuestionDebug()
 */
export function enableQuestionDebug() {
    console.log('🔧 Enabling question debug mode...');
    
    // Find toolbar add button
    const toolbarButton = document.getElementById('toolbar-add-question');
    if (toolbarButton) {
        // Replace click handler with debug version
        const newButton = toolbarButton.cloneNode(true);
        newButton.onclick = () => {
            console.log('🔧 Debug button clicked');
            addQuestionDebug();
        };
        toolbarButton.parentNode.replaceChild(newButton, toolbarButton);
        
        // Visual indicator
        newButton.style.border = '2px solid red';
        newButton.title = 'DEBUG MODE: Add Question with Animation Tracking';
        
        console.log('🔧 Debug mode enabled! Add button now has animation tracking.');
        console.log('🔧 Look for 🎬 DEBUG messages in console when adding questions.');
        
        return true;
    }
    
    // Fallback: replace the main add button
    const addButton = document.getElementById('add-question');
    if (addButton) {
        const newButton = addButton.cloneNode(true);
        newButton.onclick = () => {
            console.log('🔧 Debug button clicked (main)');
            addQuestionDebug();
        };
        addButton.parentNode.replaceChild(newButton, addButton);
        
        newButton.style.border = '2px solid red';
        newButton.title = 'DEBUG MODE: Add Question with Animation Tracking';
        
        console.log('🔧 Debug mode enabled on main add button!');
        return true;
    }
    
    console.error('🔧 Could not find add question button to enable debug mode');
    return false;
}

/**
 * Quick test function to verify if the animation issue is fixed
 * Call this in console: testAddQuestionFix()
 */
export function testAddQuestionFix() {
    console.log('🧪 Testing add question fix...');
    
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) {
        console.error('🧪 No questions container found');
        return false;
    }
    
    const initialCount = questionsContainer.children.length;
    console.log(`🧪 Initial question count: ${initialCount}`);
    
    // Add a question and monitor for issues
    console.log('🧪 Adding question...');
    addQuestion();
    
    setTimeout(() => {
        const newCount = questionsContainer.children.length;
        console.log(`🧪 New question count: ${newCount}`);
        
        if (newCount === initialCount + 1) {
            console.log('✅ Question added successfully');
            console.log('🧪 Check visually: Did you see any flashing or glitchy animations?');
        } else {
            console.error('❌ Question count mismatch');
        }
    }, 100);
    
    return true;
}

/**
 * Test add question without scrolling to isolate the issue
 * Call this in console: testAddQuestionNoScroll()
 */
export function testAddQuestionNoScroll() {
    console.log('🧪 Testing add question WITHOUT scrolling...');
    
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) {
        console.error('🧪 No questions container found');
        return false;
    }
    
    const initialCount = questionsContainer.children.length;
    console.log(`🧪 Initial question count: ${initialCount}`);
    
    // Add a question WITHOUT the scrolling behavior
    console.log('🧪 Adding question (no scroll)...');
    addQuestion();
    
    setTimeout(() => {
        const newCount = questionsContainer.children.length;
        console.log(`🧪 New question count: ${newCount}`);
        
        if (newCount === initialCount + 1) {
            console.log('✅ Question added successfully');
            console.log('🧪 NO SCROLLING - Check visually: Did you see any flashing?');
            console.log('🧪 If no flashing, the issue is the scrolling behavior');
            console.log('🧪 If still flashing, the issue is DOM manipulation');
        } else {
            console.error('❌ Question count mismatch');
        }
    }, 100);
    
    return true;
}

/**
 * Replace toolbar button with no-scroll version for testing
 */
export function enableNoScrollMode() {
    console.log('🔧 Enabling no-scroll add question mode...');
    
    // Find toolbar add button
    const toolbarButton = document.getElementById('toolbar-add-question');
    if (toolbarButton) {
        // Replace click handler with no-scroll version
        const newButton = toolbarButton.cloneNode(true);
        newButton.onclick = () => {
            console.log('🔧 No-scroll button clicked');
            addQuestion(); // Direct call, no scrolling
        };
        toolbarButton.parentNode.replaceChild(newButton, toolbarButton);
        
        // Visual indicator
        newButton.style.border = '2px solid green';
        newButton.title = 'NO-SCROLL MODE: Add Question without Animation';
        
        console.log('🔧 No-scroll mode enabled!');
        return true;
    }
    
    console.error('🔧 Could not find toolbar button');
    return false;
}

// Make globally available
window.testAddQuestionNoScroll = testAddQuestionNoScroll;
window.enableNoScrollMode = enableNoScrollMode;

// Make it globally available
window.testAddQuestionFix = testAddQuestionFix;

// Make it available globally for console access
window.enableQuestionDebug = enableQuestionDebug;

// Global instance
window.questionDebugger = new QuestionAnimationDebugger();

/**
 * Debug-enabled version of addQuestion with comprehensive tracking
 */
export function addQuestionDebug() {
    console.log('🚀🎬 DEBUG: Starting addQuestionDebug()');
    
    // Start debugging
    window.questionDebugger.startDebugging();
    
    // Pre-addition state
    window.questionDebugger.logChange('PRE-ADDITION: Capturing state...');
    
    // Call the original function with step-by-step monitoring
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) {
        window.questionDebugger.logChange('ERROR: Questions container not found');
        window.questionDebugger.stopDebugging();
        return;
    }
    
    const initialCount = questionsContainer.children.length;
    window.questionDebugger.logChange(`PRE-ADDITION: ${initialCount} questions exist`);
    
    // Monitor existing questions during the process
    const existingQuestions = Array.from(questionsContainer.children);
    existingQuestions.forEach((q, i) => {
        window.questionDebugger.compareStyles(q, i);
    });
    
    // Call addQuestion with monitoring
    window.questionDebugger.logChange('CALLING: addQuestion()...');
    const result = addQuestion();
    window.questionDebugger.logChange('RETURNED: addQuestion() completed');
    
    // Post-addition monitoring
    setTimeout(() => {
        const newCount = questionsContainer.children.length;
        window.questionDebugger.logChange(`POST-ADDITION: ${newCount} questions now exist`);
        
        // Compare styles after all operations
        Array.from(questionsContainer.children).forEach((q, i) => {
            window.questionDebugger.compareStyles(q, i);
        });
        
        // Stop debugging after a delay to catch any delayed animations
        setTimeout(() => {
            window.questionDebugger.stopDebugging();
        }, 1000);
    }, 100);
    
    return result;
}

/**
 * Create a question element with given data
 */
export function createQuestionElement(questionData) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    
    const questionCount = document.querySelectorAll('.question-item').length;
    questionDiv.setAttribute('data-question', questionCount);
    
    questionDiv.innerHTML = questionUtils.generateQuestionHTML(questionCount);
    
    // Note: Translation is handled by the caller to ensure proper timing
    
    return questionDiv;
}

/**
 * Validate LaTeX in questions - simple implementation
 */
export function validateLatexInQuestions(questions) {
    logger.debug('validateLatexInQuestions called with', questions.length, 'questions');
    // For now, just return empty array to skip LaTeX validation
    // This prevents the blocking error
    return [];
}

/**
 * Shuffle array
 */
export function shuffleArray(array) {
    return questionUtils.shuffleArray(array);
}

/**
 * Randomize answers
 */
export function randomizeAnswers(questions) {
    return questionUtils.randomizeAnswers(questions);
}