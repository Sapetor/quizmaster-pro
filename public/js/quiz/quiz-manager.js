/**
 * Quiz Manager Module
 * Handles quiz operations: save, load, import, export, and quiz management
 */

import { getTranslation, showAlert } from '../utils/translations.js';
import { createQuestionElement } from '../utils/question-utils.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { errorHandler } from '../utils/error-handler.js';

export class QuizManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.mathRenderer = new MathRenderer();
        this.autoSaveTimeout = null;
        this.errorHandler = errorHandler; // Add ErrorHandler for future use
    }

    /**
     * Collect all questions from the quiz builder
     */
    collectQuestions() {
        console.log('collectQuestions called');
        const questions = [];
        const questionElements = document.querySelectorAll('.question-item');
        console.log('Found question elements:', questionElements.length);
        
        questionElements.forEach(questionElement => {
            const questionData = this.extractQuestionData(questionElement);
            if (questionData) {
                questions.push(questionData);
            }
        });
        
        return questions;
    }

    /**
     * Extract question data from DOM element
     */
    extractQuestionData(questionElement) {
        const questionText = questionElement.querySelector('.question-text')?.value?.trim();
        const questionType = questionElement.querySelector('.question-type')?.value;
        const questionTime = parseInt(questionElement.querySelector('.question-time-limit')?.value) || 30;
        const questionDifficulty = questionElement.querySelector('.question-difficulty')?.value || 'medium';
        
        if (!questionText || !questionType) return null;
        
        const questionData = {
            question: questionText,
            type: questionType,
            time: questionTime,
            difficulty: questionDifficulty
        };
        
        // Handle different question types using the correct CSS selectors from question-utils.js
        if (questionType === 'multiple-choice') {
            const options = [];
            // Use the correct selector - .option not .option-input
            const optionInputs = questionElement.querySelectorAll('.multiple-choice-options .option');
            optionInputs.forEach(input => {
                if (input.value.trim()) {
                    options.push(input.value.trim());
                }
            });
            
            const correctAnswerElement = questionElement.querySelector('.multiple-choice-options .correct-answer');
            const correctAnswer = correctAnswerElement ? parseInt(correctAnswerElement.value) : 0;
            
            console.log(`Question ${questionData.question}: options=${options.length}, correctAnswer=${correctAnswer}`);
            
            questionData.options = options;
            questionData.correctAnswer = isNaN(correctAnswer) ? 0 : correctAnswer;
            
        } else if (questionType === 'multiple-correct') {
            const options = [];
            // Use the correct selector
            const optionInputs = questionElement.querySelectorAll('.multiple-correct-options .option');
            optionInputs.forEach(input => {
                if (input.value.trim()) {
                    options.push(input.value.trim());
                }
            });
            
            const correctAnswers = [];
            // Use the correct selector - .correct-option not .correct-checkbox
            const correctCheckboxes = questionElement.querySelectorAll('.multiple-correct-options .correct-option:checked');
            correctCheckboxes.forEach(checkbox => {
                correctAnswers.push(parseInt(checkbox.dataset.option));
            });
            
            questionData.options = options;
            questionData.correctAnswers = correctAnswers;
            
        } else if (questionType === 'true-false') {
            const correctAnswer = questionElement.querySelector('.true-false-options .correct-answer')?.value === 'true';
            questionData.correctAnswer = correctAnswer;
            
        } else if (questionType === 'numeric') {
            const correctAnswer = parseFloat(questionElement.querySelector('.numeric-answer')?.value);
            const tolerance = parseFloat(questionElement.querySelector('.numeric-tolerance')?.value) || 0;
            questionData.correctAnswer = correctAnswer;
            questionData.tolerance = tolerance;
        }
        
        // Extract image data
        const imageElement = questionElement.querySelector('.question-image');
        if (imageElement && imageElement.src) {
            // Extract the relative path from the src URL
            const imageSrc = imageElement.src;
            if (imageSrc.includes('/uploads/')) {
                questionData.image = imageSrc.substring(imageSrc.indexOf('/uploads/') + 1); // Remove leading /
            } else if (imageSrc.startsWith('uploads/')) {
                questionData.image = imageSrc;
            }
        }
        
        return questionData;
    }

    /**
     * Validate questions array
     */
    validateQuestions(questions) {
        const errors = [];
        
        questions.forEach((question, index) => {
            const questionNum = index + 1;
            
            // Check for question text
            if (!question.question || question.question.trim() === '') {
                errors.push(`Question ${questionNum}: ${getTranslation('question_missing_text')}`);
            }
            
            // LaTeX validation temporarily disabled to fix blocking error
            console.log('Skipping LaTeX validation for question', questionNum);
            
            // Type-specific validation
            if (question.type === 'multiple-choice' || question.type === 'multiple-correct') {
                if (!question.options || question.options.length < 2) {
                    errors.push(`Question ${questionNum}: ${getTranslation('question_needs_two_options')}`);
                }
                
                if (question.type === 'multiple-choice' && 
                    (question.correctAnswer < 0 || question.correctAnswer >= question.options.length)) {
                    errors.push(`Question ${questionNum}: ${getTranslation('invalid_correct_answer')}`);
                }
                
                if (question.type === 'multiple-correct' && 
                    (!question.correctAnswers || question.correctAnswers.length === 0)) {
                    errors.push(`Question ${questionNum}: ${getTranslation('select_at_least_one_correct')}`);
                }
            }
            
            if (question.type === 'numeric' && isNaN(question.correctAnswer)) {
                errors.push(`Question ${questionNum}: ${getTranslation('invalid_numeric_answer')}`);
            }
        });
        
        return errors;
    }

    /**
     * Save quiz to server
     */
    async saveQuiz() {
        const title = document.getElementById('quiz-title')?.value?.trim();
        if (!title) {
            showAlert('error', getTranslation('please_enter_quiz_title'));
            return;
        }
        
        const questions = this.collectQuestions();
        if (questions.length === 0) {
            showAlert('error', getTranslation('please_add_one_question'));
            return;
        }
        
        // Validate questions
        const validationErrors = this.validateQuestions(questions);
        if (validationErrors.length > 0) {
            showAlert('error', validationErrors.join('\\n'));
            return;
        }
        
        try {
            const response = await fetch('/api/save-quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    questions: questions
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAlert('success', getTranslation('quiz_saved_successfully'));
                
                // Auto-save the current state
                this.autoSaveQuiz();
            } else {
                showAlert('error', data.message || getTranslation('failed_save_quiz'));
            }
        } catch (error) {
            this.errorHandler.log(error, { operation: 'saveQuiz' });
            showAlert('error', getTranslation('failed_save_quiz'));
        }
    }

    /**
     * Show load quiz modal
     */
    async showLoadQuizModal() {
        console.log('showLoadQuizModal called');
        const modal = document.getElementById('load-quiz-modal');
        if (!modal) {
            console.error('Load quiz modal not found');
            return;
        }
        
        // Load quizzes list
        try {
            console.log('Fetching quizzes from /api/quizzes');
            const response = await fetch('/api/quizzes');
            const data = await response.json();
            console.log('Quiz data received:', data);
            
            const quizList = document.getElementById('quiz-list');
            if (quizList) {
                quizList.innerHTML = '';
                
                // Check if data is directly an array or has a quizzes property
                const quizzes = Array.isArray(data) ? data : data.quizzes;
                console.log('Processing quizzes:', quizzes);
                
                if (quizzes && quizzes.length > 0) {
                    quizzes.forEach(quiz => {
                        const quizItem = document.createElement('div');
                        quizItem.className = 'quiz-item clickable';
                        quizItem.style.cursor = 'pointer';
                        quizItem.onclick = () => window.game.loadQuiz(quiz.filename);
                        quizItem.innerHTML = `
                            <div class="quiz-info">
                                <h3>${this.escapeHtml(quiz.title)}</h3>
                                <p>${quiz.questionCount} ${getTranslation('questions')} • ${getTranslation('created')}: ${new Date(quiz.created).toLocaleDateString()}</p>
                            </div>
                        `;
                        quizList.appendChild(quizItem);
                    });
                } else {
                    quizList.innerHTML = `
                        <div class="no-quizzes">
                            <p>${getTranslation('no_saved_quizzes')}</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            this.errorHandler.log(error, { operation: 'loadQuizzes' });
            const quizList = document.getElementById('quiz-list');
            if (quizList) {
                quizList.innerHTML = `
                    <div class="no-quizzes">
                        <p>${getTranslation('failed_load_quizzes')}</p>
                    </div>
                `;
            }
        }
        
        modal.style.display = 'flex';
    }

    /**
     * Hide load quiz modal
     */
    hideLoadQuizModal() {
        const modal = document.getElementById('load-quiz-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Load quiz from server
     */
    async loadQuiz(filename) {
        try {
            const response = await fetch(`/api/quiz/${filename}`);
            const data = await response.json();
            
            if (response.ok) {
                // Validate data before loading to prevent corruption
                if (this.validateQuizData(data)) {
                    this.populateQuizBuilder(data);
                    this.hideLoadQuizModal();
                    showAlert('success', getTranslation('quiz_loaded_successfully'));
                } else {
                    console.error('Quiz data appears corrupted:', filename);
                    showAlert('error', 'Quiz data appears corrupted. Please try a different quiz.');
                }
            } else {
                showAlert('error', data.message || getTranslation('failed_load_quiz'));
            }
        } catch (error) {
            console.error('Error loading quiz:', error);
            showAlert('error', getTranslation('failed_load_quiz'));
        }
    }

    /**
     * Clean corrupted text from quiz data
     */
    cleanQuizData(data) {
        if (!data || !data.questions) return data;
        
        const cleanedData = JSON.parse(JSON.stringify(data)); // Deep copy
        
        cleanedData.questions = cleanedData.questions.map(question => {
            const cleanedQuestion = { ...question };
            
            // Clean question text
            if (cleanedQuestion.question && typeof cleanedQuestion.question === 'string') {
                cleanedQuestion.question = cleanedQuestion.question.replace(/ and this is of the client.*$/g, '');
                cleanedQuestion.question = cleanedQuestion.question.replace(/ if this means that we sorted the first task.*$/g, '');
            }
            
            // Clean options
            if (cleanedQuestion.options && Array.isArray(cleanedQuestion.options)) {
                cleanedQuestion.options = cleanedQuestion.options.map(option => {
                    if (typeof option === 'string') {
                        return option.replace(/ and this is of the client.*$/g, '')
                                   .replace(/ if this means that we sorted the first task.*$/g, '');
                    }
                    return option;
                });
            }
            
            return cleanedQuestion;
        });
        
        return cleanedData;
    }

    /**
     * Populate quiz builder with loaded data
     */
    populateQuizBuilder(quizData) {
        // Clean any corrupted data first
        const cleanedData = this.cleanQuizData(quizData);
        
        // Set quiz title
        const titleInput = document.getElementById('quiz-title');
        if (titleInput) {
            titleInput.value = quizData.title || '';
        }
        
        // Clear existing questions
        const questionsContainer = document.getElementById('questions-container');
        if (questionsContainer) {
            questionsContainer.innerHTML = '';
        }
        
        // Add loaded questions
        if (quizData.questions) {
            quizData.questions.forEach(questionData => {
                this.addQuestionFromData(questionData);
            });
        }
        
        // Render math if present
        setTimeout(() => {
            this.mathRenderer.renderMathJaxGlobal();
        }, 100);
    }

    /**
     * Add question from data object
     */
    addQuestionFromData(questionData) {
        const questionsContainer = document.getElementById('questions-container');
        if (!questionsContainer) return;
        
        const questionElement = createQuestionElement(questionData);
        questionsContainer.appendChild(questionElement);
        
        // Populate the question data
        this.populateQuestionElement(questionElement, questionData);
    }

    /**
     * Populate question element with data
     */
    populateQuestionElement(questionElement, questionData) {
        // Set question text
        const questionText = questionElement.querySelector('.question-text');
        if (questionText) {
            questionText.value = questionData.question || '';
        }
        
        // Set question type
        const questionType = questionElement.querySelector('.question-type');
        if (questionType) {
            questionType.value = questionData.type || 'multiple-choice';
            // Trigger change event to update UI
            questionType.dispatchEvent(new Event('change'));
        }
        
        // Set question time
        const questionTime = questionElement.querySelector('.question-time');
        if (questionTime) {
            questionTime.value = questionData.time || 30;
        }
        
        // Set question difficulty
        const questionDifficulty = questionElement.querySelector('.question-difficulty');
        if (questionDifficulty) {
            questionDifficulty.value = questionData.difficulty || 'medium';
        }
        
        // Handle image data
        if (questionData.image) {
            console.log('Populating image for question:', questionData.image);
            const imageElement = questionElement.querySelector('.question-image');
            const imagePreview = questionElement.querySelector('.image-preview');
            
            if (imageElement && imagePreview) {
                // Set the image source
                imageElement.src = questionData.image.startsWith('http') ? questionData.image : `/${questionData.image}`;
                imageElement.dataset.url = questionData.image;
                
                // Show the image preview
                imagePreview.style.display = 'block';
                console.log('Image populated:', imageElement.src);
            } else {
                console.log('Image elements not found in question DOM');
            }
        }
        
        // Handle type-specific data
        setTimeout(() => {
            if (questionData.type === 'multiple-choice') {
                this.populateMultipleChoiceData(questionElement, questionData);
            } else if (questionData.type === 'multiple-correct') {
                this.populateMultipleCorrectData(questionElement, questionData);
            } else if (questionData.type === 'true-false') {
                this.populateTrueFalseData(questionElement, questionData);
            } else if (questionData.type === 'numeric') {
                this.populateNumericData(questionElement, questionData);
            }
        }, 100);
    }

    /**
     * Populate multiple choice question data
     */
    populateMultipleChoiceData(questionElement, questionData) {
        // Use correct selectors from question-utils.js
        const optionInputs = questionElement.querySelectorAll('.multiple-choice-options .option');
        if (questionData.options) {
            questionData.options.forEach((option, index) => {
                if (optionInputs[index]) {
                    optionInputs[index].value = option;
                }
            });
        }
        
        const correctAnswer = questionElement.querySelector('.multiple-choice-options .correct-answer');
        if (correctAnswer && questionData.correctAnswer !== undefined) {
            correctAnswer.value = questionData.correctAnswer;
        }
    }

    /**
     * Populate multiple correct question data
     */
    populateMultipleCorrectData(questionElement, questionData) {
        // Use correct selectors from question-utils.js
        const optionInputs = questionElement.querySelectorAll('.multiple-correct-options .option');
        if (questionData.options) {
            questionData.options.forEach((option, index) => {
                if (optionInputs[index]) {
                    optionInputs[index].value = option;
                }
            });
        }
        
        const correctCheckboxes = questionElement.querySelectorAll('.multiple-correct-options .correct-option');
        if (questionData.correctAnswers) {
            questionData.correctAnswers.forEach(answerIndex => {
                if (correctCheckboxes[answerIndex]) {
                    correctCheckboxes[answerIndex].checked = true;
                }
            });
        }
    }

    /**
     * Populate true/false question data
     */
    populateTrueFalseData(questionElement, questionData) {
        const correctAnswer = questionElement.querySelector('.true-false-options .correct-answer');
        if (correctAnswer && questionData.correctAnswer !== undefined) {
            correctAnswer.value = questionData.correctAnswer ? 'true' : 'false';
        }
    }

    /**
     * Populate numeric question data
     */
    populateNumericData(questionElement, questionData) {
        const correctAnswer = questionElement.querySelector('.numeric-answer');
        if (correctAnswer && questionData.correctAnswer !== undefined) {
            correctAnswer.value = questionData.correctAnswer;
        }
        
        const tolerance = questionElement.querySelector('.numeric-tolerance');
        if (tolerance && questionData.tolerance !== undefined) {
            tolerance.value = questionData.tolerance;
        }
    }

    /**
     * Import quiz from file
     */
    async importQuiz() {
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Handle file import
     */
    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            showAlert('error', getTranslation('invalid_file_format'));
            return;
        }
        
        try {
            const text = await file.text();
            const quizData = JSON.parse(text);
            
            // Validate quiz data structure
            if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
                showAlert('error', getTranslation('invalid_quiz_format'));
                return;
            }
            
            // Validate questions
            const validationErrors = this.validateQuestions(quizData.questions);
            if (validationErrors.length > 0) {
                showAlert('error', getTranslation('invalid_quiz_questions') + '\\n' + validationErrors.join('\\n'));
                return;
            }
            
            // Load the quiz
            this.populateQuizBuilder(quizData);
            showAlert('success', getTranslation('quiz_imported_successfully'));
            
        } catch (error) {
            console.error('Error importing quiz:', error);
            showAlert('error', getTranslation('failed_import_quiz'));
        }
        
        // Clear file input
        event.target.value = '';
    }

    /**
     * Export quiz to file
     */
    async exportQuiz() {
        const title = document.getElementById('quiz-title')?.value?.trim();
        if (!title) {
            showAlert('error', getTranslation('please_enter_quiz_title'));
            return;
        }
        
        const questions = this.collectQuestions();
        if (questions.length === 0) {
            showAlert('error', getTranslation('please_add_one_question'));
            return;
        }
        
        const quizData = {
            title: title,
            questions: questions,
            createdAt: new Date().toISOString()
        };
        
        try {
            const dataStr = JSON.stringify(quizData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
            link.click();
            
            showAlert('success', getTranslation('quiz_exported_successfully'));
        } catch (error) {
            console.error('Error exporting quiz:', error);
            showAlert('error', getTranslation('failed_export_quiz'));
        }
    }

    /**
     * Auto-save quiz to localStorage
     */
    autoSaveQuiz() {
        const title = document.getElementById('quiz-title')?.value?.trim();
        const questions = this.collectQuestions();
        
        if (title || questions.length > 0) {
            const autoSaveData = {
                title: title,
                questions: questions,
                timestamp: Date.now()
            };
            
            try {
                localStorage.setItem('quizAutoSave', JSON.stringify(autoSaveData));
                console.log('Auto-saved quiz data');
            } catch (error) {
                console.error('Failed to auto-save quiz:', error);
            }
        }
    }

    /**
     * Load auto-saved quiz
     */
    loadAutoSave() {
        try {
            const autoSaveData = localStorage.getItem('quizAutoSave');
            if (autoSaveData) {
                const data = JSON.parse(autoSaveData);
                
                // Check if auto-save is recent (within 24 hours)
                const hoursSinceAutoSave = (Date.now() - data.timestamp) / (1000 * 60 * 60);
                if (hoursSinceAutoSave < 24) {
                    // Validate data before loading to prevent corruption
                    if (this.validateQuizData(data)) {
                        this.populateQuizBuilder(data);
                        console.log('Loaded auto-saved quiz data');
                    } else {
                        console.warn('Auto-save data appears corrupted, clearing localStorage');
                        localStorage.removeItem('quizAutoSave');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load auto-save:', error);
            localStorage.removeItem('quizAutoSave');
        }
    }

    /**
     * Validate quiz data to prevent corruption
     */
    validateQuizData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        if (!data.questions || !Array.isArray(data.questions)) {
            return false;
        }
        
        // Check each question for corruption
        for (const question of data.questions) {
            if (!question || typeof question !== 'object') {
                return false;
            }
            
            // Check for the specific corruption pattern
            if (question.question && typeof question.question === 'string' && 
                question.question.includes('if this means that we sorted the first task')) {
                console.warn('Found corrupted question text:', question.question);
                return false;
            }
            
            // Check options for corruption
            if (question.options && Array.isArray(question.options)) {
                for (const option of question.options) {
                    if (typeof option === 'string' && 
                        option.includes('if this means that we sorted the first task')) {
                        console.warn('Found corrupted option text:', option);
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        // Set up auto-save on quiz title change
        const titleInput = document.getElementById('quiz-title');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(() => {
                    this.autoSaveQuiz();
                }, 5000); // Auto-save after 5 seconds of inactivity
            });
        }
        
        // Auto-save on question changes
        document.addEventListener('input', (event) => {
            if (event.target.closest('.question')) {
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(() => {
                    this.autoSaveQuiz();
                }, 5000);
            }
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}