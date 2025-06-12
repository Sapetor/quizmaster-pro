class KahootGame {
    constructor() {
        this.socket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
            timeout: 60000,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            maxReconnectionDelay: 5000
        });
        this.currentScreen = 'main-menu';
        this.isHost = false;
        this.gamePin = null;
        this.questions = [];
        this.currentQuestion = 0;
        this.timer = null;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.loadTheme();
        this.loadAutoSave();
        this.checkURLParameters();
        this.initializeSounds();
        this.mathJaxRenderTimeout = null;
    }

    initializeEventListeners() {
        document.getElementById('host-btn').addEventListener('click', () => {
            this.showScreen('host-screen');
        });
        document.getElementById('join-btn').addEventListener('click', () => this.showScreen('join-screen'));
        
        document.getElementById('add-question').addEventListener('click', () => this.addQuestion());
        document.getElementById('save-quiz').addEventListener('click', () => this.saveQuiz());
        document.getElementById('load-quiz').addEventListener('click', () => this.showLoadQuizModal());
        document.getElementById('cancel-load').addEventListener('click', () => this.hideLoadQuizModal());
        document.getElementById('import-quiz').addEventListener('click', () => this.importQuiz());
        document.getElementById('import-file-input').addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('preview-quiz').addEventListener('click', () => this.showQuizPreview());
        document.getElementById('cancel-preview').addEventListener('click', () => this.hideQuizPreview());
        document.getElementById('start-hosting').addEventListener('click', () => this.startHosting());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('next-question').addEventListener('click', () => this.nextQuestion());
        
        document.getElementById('join-game').addEventListener('click', () => this.joinGame());
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
        document.getElementById('play-again').addEventListener('click', () => this.newGame());
        
        // Auto-save on input changes
        document.getElementById('quiz-title').addEventListener('input', () => {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = setTimeout(() => this.autoSaveQuiz(), 1000);
        });
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        
        // Fullscreen toggle
        document.getElementById('fullscreen-toggle').addEventListener('click', () => this.toggleFullscreen());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        document.getElementById('player-multiple-choice').addEventListener('click', (e) => {
            if (e.target.classList.contains('player-option')) {
                this.submitAnswer(parseInt(e.target.dataset.option));
            }
        });

        document.getElementById('player-true-false').addEventListener('click', (e) => {
            if (e.target.classList.contains('tf-option')) {
                this.submitTrueFalseAnswer(e.target.dataset.answer);
            }
        });

        document.getElementById('submit-multiple').addEventListener('click', () => {
            this.submitMultipleCorrectAnswer();
        });

        document.getElementById('submit-numeric').addEventListener('click', () => {
            this.submitNumericAnswer();
        });
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
        });

        this.socket.on('game-created', (data) => {
            this.gamePin = data.pin;
            this.isHost = true;
            document.getElementById('game-pin').textContent = data.pin;
            this.showScreen('game-lobby');
            this.loadQRCode(data.pin);
        });

        this.socket.on('player-joined', (data) => {
            this.gamePin = data.gamePin;
            document.getElementById('player-info').textContent = `Welcome, ${data.playerName}!`;
            this.showScreen('player-lobby');
        });

        this.socket.on('player-list-update', (data) => {
            this.updatePlayersList(data.players);
        });

        this.socket.on('game-starting', () => {
            if (this.isHost) {
                this.showScreen('host-game-screen');
            } else {
                this.showScreen('player-game-screen');
            }
        });

        this.socket.on('question-start', (data) => {
            if (data && typeof data === 'object') {
                // Switch host back to game screen from leaderboard
                if (this.isHost) {
                    this.showScreen('host-game-screen');
                    // Hide next question button since we're auto-advancing
                    const nextBtn = document.getElementById('next-question');
                    if (nextBtn) nextBtn.style.display = 'none';
                }
                
                this.displayQuestion(data);
                this.startTimer(data.timeLimit || 20);
                
                // Play question start sound
                this.playSound(800, 0.3);
            }
        });

        this.socket.on('question-end', (data) => {
            if (data && data.leaderboard) {
                this.showLeaderboard(data.leaderboard);
                if (this.isHost) {
                    const nextBtn = document.getElementById('next-question');
                    if (nextBtn) nextBtn.style.display = 'block';
                }
            }
        });

        this.socket.on('game-end', (data) => {
            if (data && data.finalLeaderboard) {
                this.showFinalResults(data.finalLeaderboard);
            }
        });

        this.socket.on('answer-submitted', (data) => {
            this.showAnswerSubmitted(data.answer);
        });

        this.socket.on('question-timeout', (data) => {
            this.showCorrectAnswer(data);
        });

        this.socket.on('player-result', (data) => {
            this.showPlayerResult(data);
        });

        this.socket.on('error', (data) => {
            alert(data.message);
        });

        this.socket.on('game-ended', (data) => {
            alert(data.reason);
            this.newGame();
        });
    }

    showScreen(screenId) {
        // Clean up any active timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }

    addQuestion() {
        const questionsContainer = document.getElementById('questions-container');
        const questionCount = questionsContainer.children.length;
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.setAttribute('data-question', questionCount);
        
        // Auto-save when questions are modified
        setTimeout(() => this.autoSaveQuiz(), 100);
        
        questionDiv.innerHTML = `
            <h3>Question ${questionCount + 1}</h3>
            
            <div class="question-meta">
                <select class="question-type" onchange="updateQuestionType(this)">
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="multiple-correct">Multiple Correct Answers</option>
                    <option value="true-false">True/False</option>
                    <option value="numeric">Numeric Answer</option>
                </select>
                
                <select class="question-difficulty">
                    <option value="easy">Easy (100 pts)</option>
                    <option value="medium" selected>Medium (200 pts)</option>
                    <option value="hard">Hard (300 pts)</option>
                </select>
            </div>
            
            <div class="question-content">
                <textarea class="question-text" placeholder="Enter your question (supports LaTeX: $x^2 + y^2 = z^2$)"></textarea>
                
                <div class="image-upload">
                    <label>Add Image (optional):</label>
                    <input type="file" class="image-input" accept="image/*" onchange="uploadImage(this)">
                    <div class="image-preview" style="display: none;">
                        <img class="question-image" src="" alt="Question Image" style="max-width: 200px; max-height: 150px;">
                        <button type="button" class="remove-image" onclick="removeImage(this)">Remove</button>
                    </div>
                </div>
            </div>
            
            <div class="answer-options multiple-choice-options">
                <div class="options">
                    <input type="text" class="option" data-option="0" placeholder="Option A">
                    <input type="text" class="option" data-option="1" placeholder="Option B">
                    <input type="text" class="option" data-option="2" placeholder="Option C">
                    <input type="text" class="option" data-option="3" placeholder="Option D">
                </div>
                <select class="correct-answer">
                    <option value="0">A is correct</option>
                    <option value="1">B is correct</option>
                    <option value="2">C is correct</option>
                    <option value="3">D is correct</option>
                </select>
            </div>
            
            <div class="answer-options multiple-correct-options" style="display: none;">
                <div class="options-checkboxes">
                    <label><input type="checkbox" class="correct-option" data-option="0"> <input type="text" class="option" placeholder="Option A"></label>
                    <label><input type="checkbox" class="correct-option" data-option="1"> <input type="text" class="option" placeholder="Option B"></label>
                    <label><input type="checkbox" class="correct-option" data-option="2"> <input type="text" class="option" placeholder="Option C"></label>
                    <label><input type="checkbox" class="correct-option" data-option="3"> <input type="text" class="option" placeholder="Option D"></label>
                </div>
            </div>
            
            <div class="answer-options true-false-options" style="display: none;">
                <select class="correct-answer">
                    <option value="true">True</option>
                    <option value="false">False</option>
                </select>
            </div>
            
            <div class="answer-options numeric-options" style="display: none;">
                <label>Correct Answer:</label>
                <input type="number" class="numeric-answer" placeholder="Enter numeric answer" step="any">
                <label>Tolerance (+/-):</label>
                <input type="number" class="numeric-tolerance" placeholder="0.1" step="any" value="0.1">
            </div>
            
            <button class="btn secondary remove-question" onclick="this.parentElement.remove()">Remove</button>
        `;
        
        questionsContainer.appendChild(questionDiv);
    }

    startHosting() {
        const title = document.getElementById('quiz-title').value.trim();
        if (!title) {
            alert('Please enter a quiz title');
            return;
        }

        let questions = this.collectQuestions();
        if (questions.length === 0) {
            alert('Please add at least one question');
            return;
        }

        // Validate all questions have required content
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question || q.question.trim() === '') {
                alert(`Question ${i + 1} is missing question text`);
                return;
            }
            
            if (q.type === 'multiple-choice' || q.type === 'multiple-correct') {
                if (!q.options || q.options.filter(opt => opt && opt.trim()).length < 2) {
                    alert(`Question ${i + 1} needs at least 2 valid options`);
                    return;
                }
            }
        }

        // Check if questions should be randomized
        const shouldRandomizeQuestions = document.getElementById('randomize-questions').checked;
        if (shouldRandomizeQuestions) {
            questions = this.shuffleArray([...questions]);
        }

        // Check if answers should be randomized
        const shouldRandomizeAnswers = document.getElementById('randomize-answers').checked;
        if (shouldRandomizeAnswers) {
            questions = this.randomizeAnswers([...questions]);
        }

        const quiz = {
            title: title,
            questions: questions,
            randomized: shouldRandomizeQuestions,
            answersRandomized: shouldRandomizeAnswers
        };

        this.socket.emit('host-join', { quiz });
    }

    collectQuestions() {
        const questions = [];
        const questionItems = document.querySelectorAll('.question-item');
        
        questionItems.forEach((item, index) => {
            const questionText = item.querySelector('.question-text').value.trim();
            const questionType = item.querySelector('.question-type').value;
            const questionDifficulty = item.querySelector('.question-difficulty').value;
            const imageElement = item.querySelector('.question-image');
            const imageUrl = imageElement ? (imageElement.dataset.url || '') : '';
            
            if (!questionText) return;
            
            let question = {
                question: questionText,
                type: questionType,
                difficulty: questionDifficulty,
                timeLimit: 20,
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
                    question.options = ['True', 'False']; // Display names
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

    joinGame() {
        const pin = document.getElementById('game-pin-input').value.trim();
        const name = document.getElementById('player-name').value.trim();
        
        if (!pin || !name) {
            alert('Please enter both game PIN and your name');
            return;
        }
        
        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
            alert('Game PIN must be exactly 6 digits');
            return;
        }
        
        if (name.length > 20) {
            alert('Name must be 20 characters or less');
            return;
        }

        this.socket.emit('player-join', { pin, name });
    }

    updatePlayersList(players) {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        
        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.textContent = player.name;
            playersList.appendChild(playerCard);
        });
    }

    startGame() {
        this.socket.emit('start-game');
    }

    async loadQRCode(pin) {
        try {
            const response = await fetch(`/api/qr/${pin}`);
            const data = await response.json();
            
            if (data.qrCode) {
                const qrImage = document.getElementById('qr-code-image');
                const qrLoading = document.querySelector('.qr-loading');
                const gameUrl = document.getElementById('game-url');
                
                qrImage.src = data.qrCode;
                qrImage.style.display = 'block';
                qrLoading.style.display = 'none';
                gameUrl.textContent = data.gameUrl;
            }
        } catch (error) {
            console.error('Failed to load QR code:', error);
            const qrLoading = document.querySelector('.qr-loading');
            qrLoading.textContent = 'Failed to generate QR code';
        }
    }

    checkURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const pin = urlParams.get('pin');
        
        if (pin) {
            document.getElementById('game-pin-input').value = pin;
            this.showScreen('join-screen');
            
            // Show feedback that the PIN was detected from QR code
            const pinInput = document.getElementById('game-pin-input');
            const originalPlaceholder = pinInput.placeholder;
            pinInput.placeholder = `PIN detected: ${pin}`;
            setTimeout(() => {
                pinInput.placeholder = originalPlaceholder;
            }, 3000);
            
            // Clear URL to avoid confusion
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    initializeSounds() {
        // Create AudioContext for sound effects
        this.audioContext = null;
        this.soundsEnabled = true;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
            this.soundsEnabled = false;
        }
    }

    playSound(frequency, duration, type = 'sine') {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            console.log('Sound playback failed:', e);
        }
    }

    displayQuestion(data) {
        if (this.isHost) {
            const questionCounter = document.getElementById('question-counter');
            const currentQuestion = document.getElementById('current-question');
            
            if (questionCounter) questionCounter.textContent = `Question ${data.questionNumber} of ${data.totalQuestions}`;
            if (currentQuestion) currentQuestion.innerHTML = data.question;
            
            if (data.image) {
                const imageDisplay = document.getElementById('question-image-display');
                const img = document.getElementById('host-question-image');
                if (imageDisplay && img) {
                    img.src = data.image;
                    imageDisplay.style.display = 'block';
                }
            } else {
                const imageDisplay = document.getElementById('question-image-display');
                if (imageDisplay) imageDisplay.style.display = 'none';
            }
            
            const optionsContainer = document.getElementById('answer-options');
            if (optionsContainer) {
                if (data.type === 'numeric') {
                    optionsContainer.style.display = 'none';
                } else {
                    optionsContainer.style.display = 'grid';
                    const options = document.querySelectorAll('.option-display');
                    
                    // Reset all option styles from previous questions
                    options.forEach(option => {
                        option.style.border = '';
                        option.style.backgroundColor = '';
                    });
                
                    if (data.type === 'true-false') {
                        options[0].textContent = 'True';
                        options[1].textContent = 'False';
                        options[2].style.display = 'none';
                        options[3].style.display = 'none';
                    } else {
                        options.forEach((option, index) => {
                            if (data.options && data.options[index]) {
                                option.innerHTML = `${String.fromCharCode(65 + index)}: ${data.options[index]}`;
                                option.style.display = 'block';
                            } else {
                                option.style.display = 'none';
                            }
                        });
                        
                        // Render LaTeX in answer options
                        this.renderMathJax();
                    }
                }
            }
            
            document.getElementById('next-question').style.display = 'none';
            
            this.renderMathJax(document.getElementById('current-question'));
        } else {
            document.getElementById('player-question-counter').textContent = `Question ${data.questionNumber} of ${data.totalQuestions}`;
            
            // Display question text and image for players
            document.getElementById('player-question-text').innerHTML = data.question;
            
            if (data.image) {
                const imageDisplay = document.getElementById('player-question-image');
                const img = document.getElementById('player-question-img');
                img.src = data.image;
                imageDisplay.style.display = 'block';
            } else {
                document.getElementById('player-question-image').style.display = 'none';
            }
            
            // Render LaTeX for players with retry mechanism
            this.renderMathJax(document.getElementById('player-question-text'));
            
            document.querySelectorAll('.player-answer-type').forEach(type => type.style.display = 'none');
            document.getElementById('answer-feedback').classList.add('hidden');
            
            
            switch (data.type) {
                case 'multiple-choice':
                    document.getElementById('player-multiple-choice').style.display = 'block';
                    const mcOptions = document.querySelectorAll('#player-multiple-choice .player-option');
                    mcOptions.forEach((option, index) => {
                        if (data.options && data.options[index]) {
                            option.innerHTML = `${String.fromCharCode(65 + index)}: ${data.options[index]}`;
                            option.style.display = 'block';
                        } else {
                            option.style.display = 'none';
                        }
                        option.disabled = false;
                        option.classList.remove('selected');
                        // Reset any custom styling from previous questions
                        option.style.border = '';
                        option.style.backgroundColor = '';
                    });
                    
                    // Render LaTeX in answer options
                    this.renderMathJax();
                    break;
                    
                case 'multiple-correct':
                    document.getElementById('player-multiple-correct').style.display = 'block';
                    const checkboxes = document.querySelectorAll('#player-multiple-correct .option-checkbox');
                    const checkboxLabels = document.querySelectorAll('#player-multiple-correct .checkbox-option');
                    
                    checkboxes.forEach(cb => cb.checked = false);
                    checkboxLabels.forEach((label, index) => {
                        if (data.options && data.options[index]) {
                            label.innerHTML = `<input type="checkbox" class="option-checkbox"> ${String.fromCharCode(65 + index)}: ${data.options[index]}`;
                            label.setAttribute('data-option', index);
                            label.style.display = 'flex';
                        } else {
                            label.style.display = 'none';
                        }
                    });
                    
                    // Render LaTeX in answer options
                    this.renderMathJax();
                    
                    document.getElementById('submit-multiple').disabled = false;
                    break;
                    
                case 'true-false':
                    document.getElementById('player-true-false').style.display = 'block';
                    document.querySelectorAll('.tf-option').forEach(option => {
                        option.disabled = false;
                        option.classList.remove('selected');
                        // Reset any custom styling from previous questions
                        option.style.border = '';
                        option.style.backgroundColor = '';
                    });
                    break;
                    
                case 'numeric':
                    document.getElementById('player-numeric').style.display = 'block';
                    document.getElementById('numeric-answer-input').value = '';
                    document.getElementById('numeric-answer-input').disabled = false;
                    document.getElementById('submit-numeric').disabled = false;
                    break;
            }
        }
    }

    startTimer(timeLimit) {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        let timeLeft = timeLimit;
        const timerElement = document.getElementById('timer');
        
        if (timerElement) {
            timerElement.textContent = timeLeft;
            timerElement.className = 'timer'; // Reset classes
            
            this.timer = setInterval(() => {
                timeLeft--;
                if (timerElement) {
                    timerElement.textContent = timeLeft;
                    
                    // Add visual pressure indicators
                    timerElement.className = 'timer';
                    if (timeLeft <= 5) {
                        timerElement.classList.add('critical');
                    } else if (timeLeft <= 10) {
                        timerElement.classList.add('warning');
                    }
                }
                
                if (timeLeft <= 0) {
                    clearInterval(this.timer);
                    this.timer = null;
                }
            }, 1000);
        }
    }

    submitAnswer(answer) {
        const options = document.querySelectorAll('.player-option');
        options.forEach(option => {
            option.disabled = true;
            option.classList.remove('selected');
        });
        
        if (options[answer]) {
            options[answer].classList.add('selected');
        }
        
        // Play submission sound
        this.playSound(600, 0.2);
        
        this.socket.emit('submit-answer', { answer });
    }

    submitTrueFalseAnswer(answer) {
        const tfOptions = document.querySelectorAll('.tf-option');
        tfOptions.forEach(option => {
            option.disabled = true;
            option.classList.remove('selected');
        });
        
        // Find and highlight the selected option
        const selectedOption = document.querySelector(`.tf-option[data-answer="${answer}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // Play submission sound
        this.playSound(600, 0.2);
        
        this.socket.emit('submit-answer', { answer });
        this.showAnswerSubmitted(answer);
    }

    showAnswerSubmitted(answer) {
        const feedback = document.getElementById('answer-feedback');
        const message = document.getElementById('feedback-message');
        
        if (!feedback || !message) return;
        
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.style.backgroundColor = '#3498db';
        
        let displayText = '';
        if (typeof answer === 'number') {
            // Convert numeric answer to letter (0->A, 1->B, etc.)
            const letter = String.fromCharCode(65 + answer);
            displayText = `Answer submitted: ${letter}`;
        } else if (Array.isArray(answer)) {
            const letters = answer.map(a => String.fromCharCode(65 + a)).join(', ');
            displayText = `Answers submitted: ${letters}`;
        } else if (typeof answer === 'string') {
            displayText = `Answer submitted: ${answer.toUpperCase()}`;
        } else {
            displayText = `Answer submitted: ${String.fromCharCode(65 + answer)}`;
        }
        
        message.textContent = displayText;
        document.getElementById('score-display').textContent = 'Waiting for results...';
    }

    showCorrectAnswer(data) {
        if (this.isHost) {
            const questionType = data.questionType || 'multiple-choice';
            const options = document.querySelectorAll('.option-display');
            
            if (questionType === 'multiple-choice') {
                options.forEach((option, index) => {
                    if (index === data.correctAnswer) {
                        option.style.border = '5px solid #2ecc71';
                        option.style.backgroundColor = '#2ecc71';
                    }
                });
            } else if (questionType === 'true-false') {
                // For true-false, correctAnswer is a string ("true" or "false")
                // Convert to index: "true" = 0, "false" = 1
                const correctIndex = data.correctAnswer.toString().toLowerCase() === 'true' ? 0 : 1;
                options.forEach((option, index) => {
                    if (index === correctIndex) {
                        option.style.border = '5px solid #2ecc71';
                        option.style.backgroundColor = '#2ecc71';
                    }
                });
            } else if (questionType === 'multiple-correct') {
                if (Array.isArray(data.correctAnswer)) {
                    data.correctAnswer.forEach(correctIndex => {
                        if (options[correctIndex]) {
                            options[correctIndex].style.border = '5px solid #2ecc71';
                            options[correctIndex].style.backgroundColor = '#2ecc71';
                        }
                    });
                }
            }
        } else {
            // Only highlight correct answer options temporarily, don't override player feedback
            const questionType = data.questionType || 'multiple-choice';
            if (questionType === 'multiple-choice') {
                const options = document.querySelectorAll('.player-option');
                if (options[data.correctAnswer]) {
                    options[data.correctAnswer].style.border = '5px solid #2ecc71';
                    // Remove highlighting after 3 seconds to prevent persistence
                    setTimeout(() => {
                        if (options[data.correctAnswer]) {
                            options[data.correctAnswer].style.border = '';
                        }
                    }, 3000);
                }
            } else if (questionType === 'true-false') {
                const tfOptions = document.querySelectorAll('.tf-option');
                tfOptions.forEach(option => {
                    if (option.dataset.answer === data.correctAnswer.toString().toLowerCase()) {
                        option.style.border = '5px solid #2ecc71';
                        // Remove highlighting after 3 seconds to prevent persistence
                        setTimeout(() => {
                            option.style.border = '';
                        }, 3000);
                    }
                });
            }
        }
    }

    nextQuestion() {
        clearInterval(this.timer);
        this.socket.emit('next-question');
    }

    showLeaderboard(leaderboard) {
        this.updateLeaderboardDisplay(leaderboard);
        this.showScreen('leaderboard-screen');
        
        if (!this.isHost) {
            setTimeout(() => {
                this.showScreen('player-game-screen');
            }, 3000);
        }
    }

    showFinalResults(leaderboard) {
        this.updateLeaderboardDisplay(leaderboard);
        
        if (this.isHost) {
            // Host gets full celebration with confetti and sounds
            const finalResults = document.getElementById('final-results');
            finalResults.classList.remove('hidden');
            finalResults.classList.add('game-complete-animation');
            
            // Show confetti celebration
            this.showGameCompleteConfetti();
            
            // Play special game ending fanfare
            this.playGameEndingFanfare();
            
            this.showScreen('leaderboard-screen');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                finalResults.classList.remove('game-complete-animation');
            }, 2000);
        } else {
            // Players get a dedicated final screen with special ending sound
            this.playGameEndingFanfare();
            this.showPlayerFinalScreen(leaderboard);
        }
    }

    showPlayerFinalScreen(leaderboard) {
        // Find player's position in the final leaderboard
        let playerPosition = -1;
        let playerScore = 0;
        
        // Get player's socket ID to find their position
        const playerId = this.socket.id;
        leaderboard.forEach((player, index) => {
            if (player.id === playerId) {
                playerPosition = index + 1;
                playerScore = player.score;
            }
        });
        
        // Update player's final rank display
        const positionElement = document.getElementById('final-position');
        const scoreElement = document.getElementById('final-score');
        
        if (positionElement) {
            positionElement.textContent = `#${playerPosition || 'N/A'}`;
            
            // Add special styling for top 3
            positionElement.className = 'final-position';
            if (playerPosition === 1) positionElement.classList.add('first-place');
            else if (playerPosition === 2) positionElement.classList.add('second-place');
            else if (playerPosition === 3) positionElement.classList.add('third-place');
        }
        
        if (scoreElement) {
            scoreElement.textContent = `${playerScore} points`;
        }
        
        // Show top 3 players
        this.updateFinalLeaderboard(leaderboard.slice(0, 3));
        
        // The fanfare is already played in showFinalResults, so we don't need individual sounds here
        // This creates a unified game ending experience for all players
        
        this.showScreen('player-final-screen');
    }

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
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score} pts</span>
            `;
            
            if (position === 1) item.classList.add('first');
            else if (position === 2) item.classList.add('second');
            else if (position === 3) item.classList.add('third');
            
            leaderboardContainer.appendChild(item);
        });
    }

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
                <span>${medal} ${player.name}</span>
                <span>${player.score} pts</span>
            `;
            
            leaderboardList.appendChild(item);
        });
    }

    submitMultipleCorrectAnswer() {
        const checkboxes = document.querySelectorAll('#player-multiple-correct .option-checkbox:checked');
        const answers = Array.from(checkboxes).map(cb => {
            const closest = cb.closest('.checkbox-option');
            return closest ? parseInt(closest.dataset.option) : null;
        }).filter(option => option !== null);
        
        this.socket.emit('submit-answer', { answer: answers, type: 'multiple-correct' });
        
        const submitBtn = document.getElementById('submit-multiple');
        if (submitBtn) submitBtn.disabled = true;
    }

    submitNumericAnswer() {
        const answer = parseFloat(document.getElementById('numeric-answer-input').value);
        if (isNaN(answer)) {
            alert('Please enter a valid number');
            return;
        }
        this.socket.emit('submit-answer', { answer: answer, type: 'numeric' });
        document.getElementById('submit-numeric').disabled = true;
        document.getElementById('numeric-answer-input').disabled = true;
    }

    showPlayerResult(data) {
        const feedback = document.getElementById('answer-feedback');
        const message = document.getElementById('feedback-message');
        const score = document.getElementById('score-display');
        
        feedback.classList.remove('hidden');
        
        if (data.isCorrect) {
            feedback.style.backgroundColor = '#2ecc71';
            message.textContent = '🎉 Correct!';
            this.showConfetti();
            // Play success sound (ascending notes)
            setTimeout(() => this.playSound(523, 0.15), 0);   // C
            setTimeout(() => this.playSound(659, 0.15), 150); // E
            setTimeout(() => this.playSound(784, 0.3), 300);  // G
        } else {
            feedback.style.backgroundColor = '#e74c3c';
            message.textContent = '❌ Incorrect';
            // Play error sound (descending notes)
            this.playSound(400, 0.2, 'sawtooth');
            setTimeout(() => this.playSound(300, 0.3, 'sawtooth'), 200);
        }
        
        score.textContent = `+${data.points} points (Total: ${data.totalScore})`;
    }

    showConfetti() {
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ff6b35', '#4ecdc4', '#45b7aa', '#ffd700', '#2ecc71']
            });
        }
    }

    renderMathJax(element) {
        if (!element) return;
        
        const tryRender = (attempt = 0) => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                MathJax.typesetPromise([element]).catch(err => {
                    console.warn('MathJax rendering failed:', err);
                });
            } else if (attempt < 10) {
                setTimeout(() => tryRender(attempt + 1), 100);
            } else {
                console.warn('MathJax not available after 1 second');
            }
        };
        
        tryRender();
    }

    newGame() {
        // Clean up any timers before reloading
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Reset game state
        this.isHost = false;
        this.gamePin = null;
        this.currentQuestion = 0;
        
        location.reload();
    }
    
    autoSaveQuiz() {
        try {
            const title = document.getElementById('quiz-title').value.trim();
            const questions = this.collectQuestions();
            
            if (title || questions.length > 0) {
                const autosave = {
                    title,
                    questions,
                    timestamp: Date.now()
                };
                localStorage.setItem('quizmaster_autosave', JSON.stringify(autosave));
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
    
    loadAutoSave() {
        try {
            const autosave = localStorage.getItem('quizmaster_autosave');
            if (autosave) {
                const data = JSON.parse(autosave);
                // Only load if it's recent (within 24 hours)
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    if (confirm('Found auto-saved quiz draft. Would you like to restore it?')) {
                        document.getElementById('quiz-title').value = data.title || '';
                        
                        // Clear existing questions
                        document.getElementById('questions-container').innerHTML = '';
                        
                        // Load questions
                        if (data.questions && data.questions.length > 0) {
                            data.questions.forEach((question, index) => {
                                this.addQuestion();
                                this.populateQuestion(index, question);
                            });
                        } else {
                            this.addQuestion(); // Add at least one question
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load auto-save:', error);
        }
    }
    
    clearAutoSave() {
        localStorage.removeItem('quizmaster_autosave');
    }
    
    showQuizPreview() {
        const title = document.getElementById('quiz-title').value.trim();
        const questions = this.collectQuestions();
        
        if (questions.length === 0) {
            alert('Please add at least one question to preview');
            return;
        }
        
        const previewContent = document.getElementById('preview-content');
        let html = `<h4>${title || 'Untitled Quiz'}</h4>`;
        html += `<p><strong>Total Questions:</strong> ${questions.length}</p><hr>`;
        
        questions.forEach((q, index) => {
            html += `<div class="preview-question">`;
            html += `<h5>Question ${index + 1}</h5>`;
            html += `<p><strong>Type:</strong> ${q.type.replace('-', ' ')}</p>`;
            html += `<p><strong>Question:</strong> ${q.question}</p>`;
            
            if (q.type === 'multiple-choice') {
                html += `<p><strong>Options:</strong></p><ul>`;
                q.options.forEach((opt, i) => {
                    const isCorrect = q.correctAnswer === i;
                    html += `<li${isCorrect ? ' style="color: green; font-weight: bold;"' : ''}>${String.fromCharCode(65 + i)}: ${opt}${isCorrect ? ' ✓' : ''}</li>`;
                });
                html += `</ul>`;
            } else if (q.type === 'true-false') {
                html += `<p><strong>Correct Answer:</strong> <span style="color: green; font-weight: bold;">${q.correctAnswer}</span></p>`;
            } else if (q.type === 'numeric') {
                html += `<p><strong>Correct Answer:</strong> <span style="color: green; font-weight: bold;">${q.correctAnswer} (±${q.tolerance})</span></p>`;
            }
            
            if (q.image) {
                html += `<p><strong>Image:</strong> Yes</p>`;
            }
            
            html += `</div><hr>`;
        });
        
        previewContent.innerHTML = html;
        document.getElementById('quiz-preview-modal').style.display = 'block';
    }
    
    hideQuizPreview() {
        document.getElementById('quiz-preview-modal').style.display = 'none';
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
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
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Update button icon
        const toggleBtn = document.getElementById('theme-toggle');
        toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        // Save preference
        localStorage.setItem('theme', newTheme);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }
    
    handleKeyboardShortcuts(e) {
        // Only handle shortcuts on host screen
        if (this.currentScreen !== 'host-screen') return;
        
        // Ctrl/Cmd + key combinations
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'q':
                    e.preventDefault();
                    this.addQuestion();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveQuiz();
                    break;
                case 'o':
                    e.preventDefault();
                    this.showLoadQuizModal();
                    break;
                case 'p':
                    e.preventDefault();
                    this.showQuizPreview();
                    break;
                case 'enter':
                    e.preventDefault();
                    this.startHosting();
                    break;
            }
        }
        
        // F11 for fullscreen
        if (e.key === 'F11') {
            e.preventDefault();
            this.toggleFullscreen();
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    importQuiz() {
        document.getElementById('import-file-input').click();
    }
    
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let quizData;
                
                if (file.name.endsWith('.json')) {
                    quizData = JSON.parse(e.target.result);
                } else if (file.name.endsWith('.csv')) {
                    quizData = this.parseCSV(e.target.result);
                } else {
                    alert('Please select a CSV or JSON file');
                    return;
                }
                
                if (quizData && quizData.questions && Array.isArray(quizData.questions)) {
                    this.loadImportedQuiz(quizData);
                } else {
                    alert('Invalid file format. Please check the file structure.');
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Error importing file. Please check the file format.');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('CSV must have header and at least one data row');
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const questions = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const question = {
                type: 'multiple-choice',
                difficulty: 'medium',
                timeLimit: 20
            };
            
            headers.forEach((header, index) => {
                const value = values[index] || '';
                switch (header) {
                    case 'question':
                        question.question = value;
                        break;
                    case 'type':
                        question.type = value || 'multiple-choice';
                        break;
                    case 'difficulty':
                        question.difficulty = value || 'medium';
                        break;
                    case 'option_a':
                    case 'option_b':
                    case 'option_c':
                    case 'option_d':
                        if (!question.options) question.options = [];
                        question.options.push(value);
                        break;
                    case 'correct_answer':
                        if (question.type === 'multiple-choice') {
                            question.correctAnswer = parseInt(value) || 0;
                        } else {
                            question.correctAnswer = value;
                        }
                        break;
                }
            });
            
            if (question.question) {
                questions.push(question);
            }
        }
        
        return {
            title: 'Imported Quiz',
            questions: questions
        };
    }
    
    loadImportedQuiz(quizData) {
        if (confirm(`Import "${quizData.title || 'Imported Quiz'}" with ${quizData.questions.length} questions? This will replace your current quiz.`)) {
            // Clear existing questions
            document.getElementById('questions-container').innerHTML = '';
            document.getElementById('quiz-title').value = quizData.title || 'Imported Quiz';
            
            // Add each question
            quizData.questions.forEach((question, index) => {
                this.addQuestion();
                this.populateQuestion(index, question);
            });
            
            alert(`Successfully imported ${quizData.questions.length} questions!`);
        }
    }
    
    async saveQuiz() {
        const title = document.getElementById('quiz-title').value.trim();
        if (!title) {
            alert('Please enter a quiz title');
            return;
        }
        
        const questions = this.collectQuestions();
        if (questions.length === 0) {
            alert('Please add at least one question');
            return;
        }
        
        try {
            const response = await fetch('/api/save-quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, questions })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            alert(`Quiz saved successfully as ${result.filename}`);
        } catch (error) {
            console.error('Save quiz error:', error);
            alert('Failed to save quiz');
        }
    }
    
    async showLoadQuizModal() {
        try {
            const response = await fetch('/api/quizzes');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const quizzes = await response.json();
            const quizList = document.getElementById('quiz-list');
            
            if (quizzes.length === 0) {
                quizList.innerHTML = '<p>No saved quizzes found.</p>';
            } else {
                quizList.innerHTML = quizzes.map(quiz => `
                    <div class="quiz-item" onclick="window.game.loadQuiz('${quiz.filename}')">
                        <h4>${quiz.title}</h4>
                        <p>${quiz.questionCount} questions</p>
                        <small>Created: ${new Date(quiz.created).toLocaleDateString()}</small>
                    </div>
                `).join('');
            }
            
            document.getElementById('load-quiz-modal').style.display = 'block';
        } catch (error) {
            console.error('Load quizzes error:', error);
            alert('Failed to load quiz list');
        }
    }
    
    hideLoadQuizModal() {
        document.getElementById('load-quiz-modal').style.display = 'none';
    }
    
    async loadQuiz(filename) {
        try {
            const response = await fetch(`/api/quiz/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const quiz = await response.json();
            
            // Clear existing questions
            document.getElementById('questions-container').innerHTML = '';
            
            // Set quiz title
            document.getElementById('quiz-title').value = quiz.title;
            
            // Add each question
            quiz.questions.forEach((question, index) => {
                this.addQuestion();
                this.populateQuestion(index, question);
            });
            
            this.hideLoadQuizModal();
            alert(`Quiz "${quiz.title}" loaded successfully!`);
        } catch (error) {
            console.error('Load quiz error:', error);
            alert('Failed to load quiz');
        }
    }
    
    populateQuestion(index, questionData) {
        const questionItem = document.querySelectorAll('.question-item')[index];
        if (!questionItem) return;
        
        questionItem.querySelector('.question-text').value = questionData.question;
        questionItem.querySelector('.question-type').value = questionData.type || 'multiple-choice';
        
        // Update question type UI
        updateQuestionType(questionItem.querySelector('.question-type'));
        
        // Set options based on question type
        switch (questionData.type || 'multiple-choice') {
            case 'multiple-choice':
                if (questionData.options) {
                    questionData.options.forEach((option, optIndex) => {
                        const optionInput = questionItem.querySelector(`[data-option="${optIndex}"]`);
                        if (optionInput) optionInput.value = option;
                    });
                }
                if (questionData.correctAnswer !== undefined) {
                    questionItem.querySelector('.correct-answer').value = questionData.correctAnswer;
                }
                break;
                
            case 'multiple-correct':
                if (questionData.options) {
                    const labels = questionItem.querySelectorAll(`.multiple-correct-options label`);
                    questionData.options.forEach((option, optIndex) => {
                        if (labels[optIndex]) {
                            const optionInput = labels[optIndex].querySelector('.option');
                            if (optionInput) optionInput.value = option;
                        }
                    });
                }
                if (questionData.correctAnswers && Array.isArray(questionData.correctAnswers)) {
                    questionData.correctAnswers.forEach(correctIndex => {
                        const checkbox = questionItem.querySelector(`.multiple-correct-options .correct-option[data-option="${correctIndex}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }
                break;
                
            case 'true-false':
                if (questionData.correctAnswer !== undefined) {
                    // Normalize the value to lowercase to handle case sensitivity
                    const normalizedAnswer = questionData.correctAnswer.toString().toLowerCase();
                    // Use setTimeout to ensure the dropdown is visible after updateQuestionType
                    setTimeout(() => {
                        const dropdown = questionItem.querySelector('.true-false-options .correct-answer');
                        if (dropdown) {
                            dropdown.value = normalizedAnswer;
                        }
                    }, 10);
                }
                break;
                
            case 'numeric':
                if (questionData.correctAnswer !== undefined) {
                    questionItem.querySelector('.numeric-answer').value = questionData.correctAnswer;
                }
                if (questionData.tolerance !== undefined) {
                    questionItem.querySelector('.numeric-tolerance').value = questionData.tolerance;
                }
                break;
        }
        
        // Set image if present
        if (questionData.image) {
            const img = questionItem.querySelector('.question-image');
            const preview = questionItem.querySelector('.image-preview');
            if (img && preview) {
                img.src = questionData.image;
                img.dataset.url = questionData.image;
                preview.style.display = 'block';
            }
        }
    }

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
                        particleCount: 30,
                        angle: 60,
                        spread: 45,
                        origin: { x: 0, y: 0.7 },
                        colors: colors
                    });
                    confetti({
                        particleCount: 30,
                        angle: 120,
                        spread: 45,
                        origin: { x: 1, y: 0.7 },
                        colors: colors
                    });
                }, time);
            });
            
            // Final central burst
            setTimeout(() => {
                confetti({
                    particleCount: 60,
                    spread: 60,
                    origin: { y: 0.5 },
                    colors: colors
                });
            }, 2000);
        }
    }

    playVictorySound() {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            // Play a victory melody
            const notes = [
                { freq: 523, time: 0 },     // C
                { freq: 659, time: 0.15 },  // E
                { freq: 784, time: 0.3 },   // G
                { freq: 1047, time: 0.45 }, // C (higher)
                { freq: 784, time: 0.6 },   // G
                { freq: 1047, time: 0.75 }  // C (higher)
            ];
            
            notes.forEach(note => {
                setTimeout(() => {
                    this.playSound(note.freq, 0.2);
                }, note.time * 1000);
            });
        } catch (e) {
            console.log('Victory sound playback failed:', e);
        }
    }

    playGameEndingFanfare() {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            // Play an elaborate game ending fanfare (triumph-like melody)
            const fanfareNotes = [
                // Opening triumphant notes
                { freq: 523, time: 0, duration: 0.3 },     // C
                { freq: 659, time: 0.1, duration: 0.3 },   // E
                { freq: 784, time: 0.2, duration: 0.3 },   // G
                { freq: 1047, time: 0.3, duration: 0.4 },  // C (higher)
                
                // Rising sequence
                { freq: 659, time: 0.8, duration: 0.2 },   // E
                { freq: 784, time: 1.0, duration: 0.2 },   // G
                { freq: 1047, time: 1.2, duration: 0.2 },  // C
                { freq: 1319, time: 1.4, duration: 0.4 },  // E (higher)
                
                // Grand finale
                { freq: 1047, time: 2.0, duration: 0.3 },  // C
                { freq: 1319, time: 2.2, duration: 0.3 },  // E
                { freq: 1568, time: 2.4, duration: 0.6 },  // G (highest)
                { freq: 2093, time: 2.8, duration: 0.8 }   // C (very high)
            ];
            
            fanfareNotes.forEach(note => {
                setTimeout(() => {
                    this.playSound(note.freq, note.duration, 'triangle');
                }, note.time * 1000);
            });
            
            // Add some harmonic accompaniment
            setTimeout(() => {
                this.playSound(523, 1.5, 'sawtooth'); // Bass C
                setTimeout(() => this.playSound(659, 1.0, 'sawtooth'), 500); // Bass E
                setTimeout(() => this.playSound(784, 1.2, 'sawtooth'), 1000); // Bass G
            }, 1500);
            
        } catch (e) {
            console.log('Game ending fanfare playback failed:', e);
        }
    }

    // Debounced MathJax rendering to improve performance
    renderMathJax() {
        if (this.mathJaxRenderTimeout) {
            clearTimeout(this.mathJaxRenderTimeout);
        }
        
        this.mathJaxRenderTimeout = setTimeout(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise().catch(err => {
                    console.warn('MathJax rendering failed:', err);
                });
            }
        }, 100); // Small delay to batch multiple updates
    }
}

// Global helper functions for question creation
function updateQuestionType(select) {
    const questionItem = select.closest('.question-item');
    const type = select.value;
    
    questionItem.querySelectorAll('.answer-options').forEach(option => {
        option.style.display = 'none';
    });
    
    const targetOption = questionItem.querySelector(`.${type}-options`);
    if (targetOption) {
        targetOption.style.display = 'block';
    }
}

async function uploadImage(input) {
    if (!input.files || !input.files[0]) return;
    
    const formData = new FormData();
    formData.append('image', input.files[0]);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.url) {
            const questionItem = input.closest('.question-item');
            if (questionItem) {
                const preview = questionItem.querySelector('.image-preview');
                const img = questionItem.querySelector('.question-image');
                
                if (img) {
                    img.src = result.url;
                    img.dataset.url = result.url;
                }
                if (preview) {
                    preview.style.display = 'block';
                }
            }
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image');
    }
}

function removeImage(button) {
    const questionItem = button.closest('.question-item');
    if (!questionItem) return;
    
    const preview = questionItem.querySelector('.image-preview');
    const img = questionItem.querySelector('.question-image');
    const input = questionItem.querySelector('.image-input');
    
    preview.style.display = 'none';
    img.src = '';
    img.dataset.url = '';
    input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new KahootGame();
});