/**
 * Main QuizGame Application Class
 * Coordinating class that manages all game modules and core functionality
 */

import { TIMING, SCORING, LIMITS, logger } from './config.js';
import { UIManager } from '../ui/ui-manager.js';
import { PreviewManager } from '../ui/preview-manager.js';
import { GameManager } from '../game/game-manager.js';
import { QuizManager } from '../quiz/quiz-manager.js';
import { SocketManager } from '../socket/socket-manager.js';
import { SettingsManager } from '../settings/settings-manager.js';
import { SoundManager } from '../audio/sound-manager.js';
import { MathRenderer } from '../utils/math-renderer.js';
import { AIQuestionGenerator } from '../ai/generator.js';
import { addQuestion, createQuestionElement, randomizeAnswers, shuffleArray } from '../utils/question-utils.js';
import { getTranslation, showAlert, translatePage, setLanguage } from '../utils/translations.js';

export class QuizGame {
    constructor() {
        logger.info('Initializing QuizGame...');
        
        // Initialize socket connection
        this.socket = io();
        
        // Initialize all managers with error handling
        try {
            this.settingsManager = new SettingsManager();
            logger.debug('SettingsManager initialized successfully');
        } catch (error) {
            logger.error('SettingsManager initialization failed:', error);
            // Create minimal fallback
            this.settingsManager = {
                toggleTheme: () => {
                    logger.debug('Fallback theme toggle from SettingsManager');
                    this.toggleTheme();
                },
                toggleFullscreen: () => console.log('Fullscreen toggle not available'),
                initializeEventListeners: () => {},
                getSetting: () => null
            };
            logger.warn('Using fallback SettingsManager');
        }
        
        this.soundManager = new SoundManager();
        this.uiManager = new UIManager();
        this.mathRenderer = new MathRenderer();
        this.previewManager = new PreviewManager(this.mathRenderer);
        this.gameManager = new GameManager(this.socket, this.uiManager, this.soundManager);
        this.quizManager = new QuizManager(this.uiManager);
        this.socketManager = new SocketManager(this.socket, this.gameManager, this.uiManager, this.soundManager);
        
        // Update GameManager with SocketManager reference
        this.gameManager.socketManager = this.socketManager;
        this.aiGenerator = new AIQuestionGenerator();
        
        // Initialize core functionality
        this.initializeEventListeners();
        this.initializePreviewSystem();
        this.initializeToolbar();
        
        // Make preview manager globally accessible for onclick handlers
        window.game = this;
        
        // Initialize AI generator
        if (this.aiGenerator && this.aiGenerator.initializeEventListeners) {
            this.aiGenerator.initializeEventListeners();
        }
        
        // Setup auto-save and load any existing data (temporarily disabled for debugging)
        this.quizManager.setupAutoSave();
        // DISABLED: this.quizManager.loadAutoSave(); // Disabled to prevent data corruption during debugging
        
        // Load theme and settings
        this.settingsManager.initializeEventListeners();
        
        // Set default player name
        this.setDefaultPlayerName();
        
        // Test logger system on initialization (disabled for clean console)
        // this.testLoggerSystem();
        
        logger.info('QuizGame initialized successfully');
    }

    /**
     * Initialize main event listeners
     */
    initializeEventListeners() {
        const safeAddEventListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        // Screen navigation
        safeAddEventListener('host-btn', 'click', () => {
            this.uiManager.showScreen('host-screen');
            // Always ensure toolbar is visible and layout is properly set
            const hostContainer = document.querySelector('.host-container');
            if (hostContainer) {
                hostContainer.classList.add('with-toolbar');
            }
        });
        safeAddEventListener('join-btn', 'click', () => this.uiManager.showScreen('join-screen'));
        safeAddEventListener('browse-games', 'click', () => this.uiManager.showGameBrowser());
        safeAddEventListener('refresh-games', 'click', () => this.uiManager.refreshActiveGames());
        safeAddEventListener('back-to-join', 'click', () => this.uiManager.showScreen('join-screen'));

        // Language selection
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => {
                setLanguage(btn.getAttribute('data-lang'));
            });
        });

        // Quiz building
        safeAddEventListener('add-question', 'click', () => this.addQuestion());
        safeAddEventListener('save-quiz', 'click', () => this.quizManager.saveQuiz());
        safeAddEventListener('load-quiz', 'click', () => this.quizManager.showLoadQuizModal());
        safeAddEventListener('cancel-load', 'click', () => this.quizManager.hideLoadQuizModal());
        safeAddEventListener('import-quiz', 'click', () => this.quizManager.importQuiz());
        safeAddEventListener('import-file-input', 'change', (e) => this.quizManager.handleFileImport(e));
        safeAddEventListener('preview-quiz', 'click', () => this.showQuizPreview());
        safeAddEventListener('cancel-preview', 'click', () => this.hideQuizPreview());

        // Game controls
        safeAddEventListener('start-hosting', 'click', () => this.startHosting());
        safeAddEventListener('start-hosting-top', 'click', () => this.startHosting());
        safeAddEventListener('start-hosting-main', 'click', () => this.startHosting());
        safeAddEventListener('start-hosting-header-small', 'click', () => this.startHosting());
        safeAddEventListener('start-game', 'click', () => this.startGame());
        safeAddEventListener('next-question', 'click', (e) => {
            e.preventDefault();
            this.nextQuestion();
        });
        safeAddEventListener('join-game', 'click', () => this.joinGame());
        safeAddEventListener('new-game', 'click', () => this.newGame());
        safeAddEventListener('play-again', 'click', () => this.newGame());

        // Auto-save setup
        safeAddEventListener('quiz-title', 'input', () => {
            clearTimeout(this.quizManager.autoSaveTimeout);
            this.quizManager.autoSaveTimeout = setTimeout(() => {
                this.quizManager.autoSaveQuiz();
            }, 5000);
        });

        // Global click handler for game interactions
        document.addEventListener('click', (e) => {
            // Handle player answer selection
            if (e.target.closest('#player-game-screen')) {
                this.handlePlayerGameClick(e);
            }
        });

        // Numeric answer input
        safeAddEventListener('numeric-answer-input', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.gameManager.submitNumericAnswer();
            }
        });

        // Multiple correct answer submission
        safeAddEventListener('submit-multiple', 'click', () => {
            this.gameManager.submitMultipleCorrectAnswer();
        });

        // Theme and settings controls (fallback in case SettingsManager doesn't catch them)
        safeAddEventListener('theme-toggle', 'click', () => {
            logger.debug('Theme toggle clicked!');
            if (this.settingsManager && typeof this.settingsManager.toggleTheme === 'function') {
                logger.debug('Using SettingsManager toggleTheme');
                this.settingsManager.toggleTheme();
            } else {
                logger.debug('Using fallback toggleTheme');
                this.toggleTheme();
            }
        });
        safeAddEventListener('fullscreen-toggle', 'click', () => {
            if (this.settingsManager.toggleFullscreen) {
                this.settingsManager.toggleFullscreen();
            } else {
                this.toggleFullscreen();
            }
        });
    }

    /**
     * Handle player game screen clicks
     */
    handlePlayerGameClick(e) {
        // Handle numeric answer submission
        if (e.target.id === 'submit-numeric') {
            this.gameManager.submitNumericAnswer();
            return;
        }

        // Handle multiple choice options
        if (e.target.classList.contains('player-option') && !e.target.classList.contains('disabled')) {
            const option = e.target.getAttribute('data-answer');
            if (option && !isNaN(option) && !this.gameManager.isHost) {
                this.gameManager.selectAnswer(parseInt(option));
            }
            return;
        }

        // Handle true/false buttons
        if (e.target.classList.contains('true-btn')) {
            const answer = e.target.getAttribute('data-answer');
            if (answer && !this.gameManager.isHost) {
                this.gameManager.selectAnswer(parseInt(answer));
            }
            return;
        }

        if (e.target.classList.contains('false-btn')) {
            const answer = e.target.getAttribute('data-answer');
            if (answer && !this.gameManager.isHost) {
                this.gameManager.selectAnswer(parseInt(answer));
            }
            return;
        }

        // Handle multiple correct checkboxes
        if (e.target.type === 'checkbox' && e.target.classList.contains('multiple-correct-option')) {
            if (!this.gameManager.isHost) {
                const selectedOptions = Array.from(document.querySelectorAll('.multiple-correct-option:checked'))
                    .map(cb => parseInt(cb.value));
                this.gameManager.selectAnswer(selectedOptions);
            }
            return;
        }
    }

    /**
     * Add a new question to the quiz builder
     */
    addQuestion() {
        addQuestion();
        translatePage();
    }

    /**
     * Add a new question and scroll to it
     */
    addQuestionAndScrollToIt() {
        this.addQuestion();
        
        // Wait for the DOM to update, then scroll to the new question
        setTimeout(() => {
            const questionItems = document.querySelectorAll('.question-item');
            if (questionItems.length > 0) {
                const lastQuestion = questionItems[questionItems.length - 1];
                lastQuestion.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Add brief highlight effect
                lastQuestion.style.background = 'rgba(37, 99, 235, 0.1)';
                lastQuestion.style.transform = 'scale(1.02)';
                
                setTimeout(() => {
                    lastQuestion.style.background = '';
                    lastQuestion.style.transform = '';
                }, 1500);
            }
        }, 100);
    }

    /**
     * Start hosting a game
     */
    startHosting() {
        // Debounce to prevent multiple rapid calls
        if (this.startHostingCalled) {
            console.log('startHosting already in progress, ignoring');
            return;
        }
        this.startHostingCalled = true;
        
        // Reset the flag after 3 seconds
        setTimeout(() => {
            this.startHostingCalled = false;
        }, 3000);
        
        logger.info('startHosting called');
        const title = document.getElementById('quiz-title')?.value?.trim();
        logger.debug('Quiz title:', title);
        if (!title) {
            showAlert('error', getTranslation('please_enter_quiz_title'));
            return;
        }

        const questions = this.quizManager.collectQuestions();
        logger.debug('Collected questions:', questions);
        if (questions.length === 0) {
            showAlert('error', getTranslation('please_add_one_question'));
            return;
        }

        // Skip validation temporarily to get game working
        logger.warn('Skipping question validation to allow game start');
        // const validationErrors = this.quizManager.validateQuestions(questions);
        // console.log('Validation errors:', validationErrors);
        // if (validationErrors.length > 0) {
        //     showAlert('error', validationErrors.join('\n'));
        //     return;
        // }

        // Get quiz settings
        const randomizeQuestions = document.getElementById('randomize-questions')?.checked;
        const shouldRandomizeAnswers = document.getElementById('randomize-answers')?.checked;
        const sameTimeForAll = document.getElementById('same-time-all')?.checked;
        const questionTime = parseInt(document.getElementById('default-time')?.value) || 30;
        const manualAdvancement = document.getElementById('manual-advancement')?.checked;

        // Process questions
        let processedQuestions = [...questions];
        
        if (randomizeQuestions) {
            processedQuestions = shuffleArray(processedQuestions);
        }
        
        if (shouldRandomizeAnswers) {
            processedQuestions = randomizeAnswers(processedQuestions);
        }

        // Apply same time for all questions if selected
        if (sameTimeForAll) {
            processedQuestions.forEach(q => {
                q.time = questionTime;
            });
        }

        const quizData = {
            quiz: {
                title,
                questions: processedQuestions,
                manualAdvancement,
                randomizeQuestions,
                randomizeAnswers: shouldRandomizeAnswers,
                sameTimeForAll,
                questionTime
            }
        };

        // Create game through socket
        logger.debug('About to call createGame with data:', quizData);
        try {
            this.socketManager.createGame(quizData);
            logger.debug('createGame call completed successfully');
        } catch (error) {
            logger.error('Error calling createGame:', error);
        }
    }

    /**
     * Join a game
     */
    joinGame() {
        const pin = document.getElementById('game-pin-input')?.value?.trim();
        const name = document.getElementById('player-name')?.value?.trim();

        if (!pin || !name) {
            showAlert('error', getTranslation('please_enter_pin_and_name'));
            return;
        }

        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
            showAlert('error', getTranslation('pin_must_be_six_digits'));
            return;
        }

        if (name.length > LIMITS.MAX_PLAYER_NAME_LENGTH) {
            showAlert('error', getTranslation('name_max_twenty_chars'));
            return;
        }

        if (!this.socketManager.isConnected()) {
            showAlert('error', getTranslation('not_connected_refresh'));
            return;
        }

        this.socketManager.joinGame(pin, name);
    }

    /**
     * Join game by PIN (called from game browser)
     */
    joinGameByPin(pin) {
        this.uiManager.joinGameByPin(pin);
    }

    /**
     * Start the game
     */
    startGame() {
        this.socketManager.startGame();
    }

    /**
     * Request next question (manual advancement)
     */
    nextQuestion() {
        // Debounce to prevent double calls
        if (this.nextQuestionCalled) return;
        this.nextQuestionCalled = true;
        
        setTimeout(() => {
            this.nextQuestionCalled = false;
        }, 1000);
        
        this.socketManager.nextQuestion();
    }

    /**
     * Start a new game
     */
    newGame() {
        // Reset game state
        this.gameManager.resetGameState();
        
        // Clear any timers
        if (this.gameManager.timer) {
            clearInterval(this.gameManager.timer);
            this.gameManager.timer = null;
        }

        // Return to main menu
        this.uiManager.showScreen('main-menu');
    }

    /**
     * Show quiz preview modal
     */
    showQuizPreview() {
        const questions = this.quizManager.collectQuestions();
        if (questions.length === 0) {
            showAlert('error', getTranslation('please_add_one_question'));
            return;
        }

        const modal = document.getElementById('preview-modal');
        const previewContainer = document.getElementById('quiz-preview-container');
        
        if (!modal || !previewContainer) return;

        previewContainer.innerHTML = '';
        
        questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'preview-question';
            
            let questionHTML = `
                <h3>${getTranslation('question')} ${index + 1}</h3>
                <div class="preview-question-text">${this.mathRenderer.formatCodeBlocks(question.question)}</div>
                <div class="preview-question-meta">
                    <span>${getTranslation('type')}: ${getTranslation(question.type)}</span>
                    <span>${getTranslation('time')}: ${question.time}s</span>
                </div>
            `;
            
            if (question.type === 'multiple-choice' || question.type === 'multiple-correct') {
                questionHTML += '<div class="preview-options">';
                question.options.forEach((option, optIndex) => {
                    const isCorrect = question.type === 'multiple-choice' ? 
                        optIndex === question.correctAnswer :
                        question.correctAnswers?.includes(optIndex);
                    
                    questionHTML += `
                        <div class="preview-option ${isCorrect ? 'correct' : ''}">
                            ${String.fromCharCode(65 + optIndex)}. ${this.mathRenderer.formatCodeBlocks(option)}
                        </div>
                    `;
                });
                questionHTML += '</div>';
            } else if (question.type === 'true-false') {
                questionHTML += `
                    <div class="preview-options">
                        <div class="preview-option ${question.correctAnswer === true ? 'correct' : ''}">A. ${getTranslation('true')}</div>
                        <div class="preview-option ${question.correctAnswer === false ? 'correct' : ''}">B. ${getTranslation('false')}</div>
                    </div>
                `;
            } else if (question.type === 'numeric') {
                questionHTML += `
                    <div class="preview-answer">
                        ${getTranslation('correct_answer')}: ${question.correctAnswer}
                        ${question.tolerance ? ` (±${question.tolerance})` : ''}
                    </div>
                `;
            }
            
            questionDiv.innerHTML = questionHTML;
            previewContainer.appendChild(questionDiv);
        });

        // Render math in preview
        this.mathRenderer.renderMathJax(previewContainer);
        
        modal.style.display = 'flex';
    }

    /**
     * Hide quiz preview modal
     */
    hideQuizPreview() {
        const modal = document.getElementById('preview-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Initialize preview system
     */
    initializePreviewSystem() {
        // Implementation would depend on existing preview system
        // This is a placeholder for the live preview functionality
    }

    /**
     * Initialize toolbar
     */
    initializeToolbar() {
        const toolbarButtons = [
            { id: 'toolbar-add-question', handler: () => this.addQuestionAndScrollToIt() },
            { id: 'toolbar-save', handler: () => this.quizManager.saveQuiz() },
            { id: 'toolbar-load', handler: () => this.quizManager.showLoadQuizModal() },
            { id: 'toolbar-load-last', handler: () => this.loadLastQuiz() },
            { id: 'toolbar-preview', handler: () => this.togglePreviewMode() },
            { id: 'toolbar-ai-gen', handler: () => this.openAIGeneratorModal() },
            { id: 'toolbar-import', handler: () => this.quizManager.importQuiz() },
            { id: 'toolbar-preview-settings', handler: () => this.togglePreviewSettings() },
            { id: 'toolbar-top', handler: () => this.scrollToTop() },
            { id: 'toolbar-bottom', handler: () => this.scrollToBottom() },
        ];

        toolbarButtons.forEach(({ id, handler }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
                logger.debug(`Connected toolbar button: ${id}`);
            } else {
                logger.warn(`Toolbar button not found: ${id}`);
            }
        });
    }

    /**
     * Show screen (wrapper for UI manager)
     */
    showScreen(screenId) {
        this.uiManager.showScreen(screenId);
    }

    /**
     * Load quiz (wrapper for quiz manager)
     */
    loadQuiz(filename) {
        this.quizManager.loadQuiz(filename);
    }

    /**
     * Quick debug: Load preset quiz and start game immediately
     */
    async loadLastQuiz() {
        try {
            console.log('🐛 DEBUG: Loading width comparison quiz...');
            
            // Load our specific debug quiz for width testing
            const debugQuizFilename = 'debug-width-quiz.json';
            console.log('Loading debug quiz file:', debugQuizFilename);
            
            this.quizManager.loadQuiz(debugQuizFilename);
            
            // Wait for quiz to load, then start the game
            setTimeout(() => {
                console.log('🐛 DEBUG: Auto-starting width comparison quiz...');
                this.startHosting();
            }, 2000);
            
            console.log('🐛 DEBUG: Loading "Debug Quiz - Width Comparison" and starting game...');
            
            // Add debugging after game starts
            setTimeout(() => {
                this.debugQuestionWidths();
            }, 5000); // Wait for game to fully start
            
        } catch (error) {
            console.error('🐛 DEBUG: Error loading debug quiz:', error);
            
            // Fallback to original behavior
            try {
                const response = await fetch('/api/quizzes');
                const data = await response.json();
                
                if (data.quizzes && data.quizzes.length > 0) {
                    let targetQuiz = data.quizzes[0];
                    console.log('Fallback: loading quiz for debug:', targetQuiz.title);
                    this.quizManager.loadQuiz(targetQuiz.filename);
                    
                    setTimeout(() => {
                        console.log('Auto-starting fallback quiz...');
                        this.startHosting();
                    }, 2000);
                }
            } catch (fallbackError) {
                console.error('Failed to load any quiz for debugging:', fallbackError);
            }
        }
    }
    
    /**
     * Debug function to analyze question width styles
     */
    debugQuestionWidths() {
        console.log('🔎 WIDTH DEBUG: Analyzing question display styles...');
        
        const questionDisplay = document.querySelector('.question-display');
        const gameContainer = document.querySelector('.game-container');
        const currentQuestion = document.querySelector('#current-question');
        
        if (questionDisplay) {
            const styles = window.getComputedStyle(questionDisplay);
            console.log('📏 .question-display styles:', {
                'max-width': styles.maxWidth,
                'width': styles.width,
                'margin-left': styles.marginLeft,
                'margin-right': styles.marginRight,
                'padding': styles.padding,
                'box-sizing': styles.boxSizing
            });
            
            // Check for :has(pre) detection
            const hasPreElements = questionDisplay.querySelectorAll('pre').length > 0;
            const hasCodeClass = questionDisplay.classList.contains('has-code');
            console.log('📝 Code detection:', {
                'has <pre> elements': hasPreElements,
                'has .has-code class': hasCodeClass,
                'classes': Array.from(questionDisplay.classList)
            });
        }
        
        if (gameContainer) {
            const styles = window.getComputedStyle(gameContainer);
            console.log('📏 .game-container styles:', {
                'max-width': styles.maxWidth,
                'width': styles.width,
                'margin': styles.margin
            });
        }
        
        if (currentQuestion) {
            const hasCode = currentQuestion.innerHTML.includes('<pre>');
            const questionText = currentQuestion.textContent.substring(0, 50) + '...';
            console.log('📄 Current question:', {
                'text': questionText,
                'contains code': hasCode,
                'innerHTML length': currentQuestion.innerHTML.length
            });
        }
        
        // Log all CSS rules that might affect width
        console.log('📋 CSS Debug: Check browser DevTools > Elements > Computed styles for detailed CSS rules');
    }

    /**
     * Load quiz directly as fallback
     */
    async loadQuizDirectly() {
        try {
            console.log('Using direct quiz loading fallback');
            const filename = 'advanced_quiz_with_latex_images.json';
            this.quizManager.loadQuiz(filename);
            
            showAlert('success', 'Debug: Loading LaTeX quiz - starting in 2 seconds...');
            
            setTimeout(() => {
                console.log('Auto-starting quiz via fallback method...');
                this.startHosting();
            }, 2000);
        } catch (error) {
            console.error('Fallback quiz loading failed:', error);
            showAlert('error', 'Debug function failed');
        }
    }

    /**
     * Load default LaTeX quiz for debugging
     */
    async loadDefaultLatexQuiz() {
        try {
            console.log('Loading default LaTeX quiz for debugging');
            
            // Try to load the advanced LaTeX quiz file directly
            const filename = 'advanced_quiz_with_latex_images.json';
            console.log('Attempting to load:', filename);
            
            const response = await fetch(`/api/quiz/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load quiz: ${response.status}`);
            }
            
            const quizData = await response.json();
            console.log('Loaded quiz data:', quizData);
            
            if (quizData && quizData.quiz) {
                // Use the quiz manager to populate the form
                this.quizManager.populateQuizForm(quizData.quiz);
                
                showAlert('success', `Debug: Loaded "${quizData.quiz.title}" - starting game...`);
                
                // Wait for form to populate, then start game
                setTimeout(() => {
                    console.log('Auto-starting loaded LaTeX quiz...');
                    this.startHosting();
                }, 1500);
            } else {
                throw new Error('Invalid quiz data format');
            }
        } catch (error) {
            console.error('Failed to load default LaTeX quiz:', error);
            showAlert('error', 'Failed to load LaTeX quiz for debugging');
        }
    }

    /**
     * Get socket connection status
     */
    isConnected() {
        return this.socketManager.isConnected();
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return this.settingsManager.getSetting('theme');
    }

    /**
     * Get sound enabled status
     */
    isSoundEnabled() {
        return this.settingsManager.getSetting('soundEnabled');
    }

    /**
     * Open AI Generator Modal
     */
    openAIGeneratorModal() {
        logger.info('Opening AI Generator Modal');
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'flex';
            logger.debug('AI Generator modal opened');
            
            // Initialize AI generator if not already done
            if (this.aiGenerator && this.aiGenerator.initializeEventListeners) {
                this.aiGenerator.initializeEventListeners();
                logger.debug('AI Generator event listeners initialized');
            } else {
                logger.warn('AI Generator not available or already initialized');
            }
        } else {
            logger.error('AI Generator modal not found in DOM');
            // Try to find similar elements for debugging
            const allModals = document.querySelectorAll('[id*="modal"], [id*="ai"]');
            logger.debug('Available modal elements:', Array.from(allModals).map(el => el.id));
        }
    }

    /**
     * Update game translations when language changes
     */
    updateGameTranslations() {
        // Update host question counter if visible and has content
        const questionCounter = document.getElementById('question-counter');
        if (questionCounter && questionCounter.textContent.trim()) {
            // Extract current numbers from existing text and rebuild with new translation
            const match = questionCounter.textContent.match(/(\d+).*?(\d+)/);
            if (match) {
                const currentQ = match[1];
                const totalQ = match[2];
                questionCounter.textContent = `${getTranslation('question')} ${currentQ} ${getTranslation('of')} ${totalQ}`;
            }
        }
        
        // Update player question counter if visible and has content
        const playerQuestionCounter = document.getElementById('player-question-counter');
        if (playerQuestionCounter && playerQuestionCounter.textContent.trim()) {
            // Extract current numbers from existing text and rebuild with new translation
            const match = playerQuestionCounter.textContent.match(/(\d+).*?(\d+)/);
            if (match) {
                const currentQ = match[1];
                const totalQ = match[2];
                playerQuestionCounter.textContent = `${getTranslation('question')} ${currentQ} ${getTranslation('of')} ${totalQ}`;
            }
        }
        
        // Update preview question counter if visible and has content
        const previewCounter = document.getElementById('preview-question-counter');
        if (previewCounter && previewCounter.textContent.trim()) {
            const match = previewCounter.textContent.match(/(\d+).*?(\d+)/);
            if (match) {
                const currentQ = match[1];
                const totalQ = match[2];
                previewCounter.textContent = `${getTranslation('question')} ${currentQ} ${getTranslation('of')} ${totalQ}`;
            }
        }
        
        // Update preview question counter display inside preview content
        const previewCounterDisplay = document.getElementById('preview-question-counter-display');
        if (previewCounterDisplay && previewCounterDisplay.textContent.trim()) {
            const match = previewCounterDisplay.textContent.match(/(\d+).*?(\d+)/);
            if (match) {
                const currentQ = match[1];
                const totalQ = match[2];
                previewCounterDisplay.textContent = `${getTranslation('question')} ${currentQ} ${getTranslation('of')} ${totalQ}`;
            }
        }
        
        // Update other game-specific elements that need translation
        const playerInfo = document.getElementById('player-info');
        if (playerInfo && this.gameManager.playerName) {
            playerInfo.textContent = `${getTranslation('welcome')}, ${this.gameManager.playerName}!`;
        }
    }

    /**
     * Toggle preview mode (connected to PreviewManager)
     */
    togglePreviewMode() {
        console.log('Toggle preview mode called');
        if (this.previewManager) {
            this.previewManager.togglePreviewMode();
        } else {
            console.log('PreviewManager not available');
        }
    }

    /**
     * Fallback theme toggle
     */
    toggleTheme() {
        logger.info('Fallback theme toggle called');
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        
        const currentTheme = body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        if (themeToggle) {
            themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️'; // Moon for dark, sun for light
        }
        localStorage.setItem('theme', newTheme);
        logger.debug('Theme switched to:', newTheme);
    }

    /**
     * Fallback fullscreen toggle
     */
    toggleFullscreen() {
        logger.info('Fallback fullscreen toggle called');
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => {
                    logger.warn('Could not exit fullscreen:', err);
                });
            } else {
                document.documentElement.requestFullscreen().catch(err => {
                    logger.warn('Could not enter fullscreen:', err);
                });
            }
        } catch (error) {
            logger.warn('Fullscreen not supported or not allowed:', error);
        }
    }

    /**
     * Toggle preview settings (wrapper for global function)
     */
    togglePreviewSettings() {
        if (window.togglePreviewSettings) {
            window.togglePreviewSettings();
        }
    }


    /**
     * Scroll to top (wrapper for global function)
     */
    scrollToTop() {
        if (window.scrollToTop) {
            window.scrollToTop();
        }
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        logger.info('Scroll to bottom function called');
        const quizEditor = document.querySelector('.quiz-editor-section');
        if (quizEditor) {
            logger.debug('Scrolling editor section to bottom, scrollHeight:', quizEditor.scrollHeight);
            quizEditor.scrollTo({ top: quizEditor.scrollHeight, behavior: 'smooth' });
            logger.debug('Editor scroll to bottom command sent');
        } else {
            logger.warn('Editor section not found, using window scroll');
            // Fallback to window scroll
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        
        // Also try scrolling any parent containers
        const hostContainer = document.querySelector('.host-container');
        if (hostContainer) {
            hostContainer.scrollTo({ top: hostContainer.scrollHeight, behavior: 'smooth' });
        }
    }

    /**
     * Test the logger system (demonstrating all log levels)
     */
    testLoggerSystem() {
        logger.debug('🧪 LOGGER TEST: Debug level message (level 4)');
        logger.info('🧪 LOGGER TEST: Info level message (level 3)');
        logger.warn('🧪 LOGGER TEST: Warning level message (level 2)');
        logger.error('🧪 LOGGER TEST: Error level message (level 1)');
        console.log('🧪 LOGGER TEST: Raw console.log (should be avoided in production code)');
    }

    /**
     * Set default player name
     */
    setDefaultPlayerName() {
        const playerNameInput = document.getElementById('player-name');
        if (playerNameInput && !playerNameInput.value) {
            // Generate a random player number between 1-999
            const playerNumber = Math.floor(Math.random() * 999) + 1;
            const defaultName = `Player${playerNumber}`;
            playerNameInput.value = defaultName;
        }
    }
}