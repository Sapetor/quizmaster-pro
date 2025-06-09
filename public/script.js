class KahootGame {
    constructor() {
        this.socket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true
        });
        this.currentScreen = 'main-menu';
        this.isHost = false;
        this.gamePin = null;
        this.questions = [];
        this.currentQuestion = 0;
        this.timer = null;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    initializeEventListeners() {
        document.getElementById('host-btn').addEventListener('click', () => this.showScreen('host-screen'));
        document.getElementById('join-btn').addEventListener('click', () => this.showScreen('join-screen'));
        
        document.getElementById('add-question').addEventListener('click', () => this.addQuestion());
        document.getElementById('start-hosting').addEventListener('click', () => this.startHosting());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('next-question').addEventListener('click', () => this.nextQuestion());
        
        document.getElementById('join-game').addEventListener('click', () => this.joinGame());
        document.getElementById('new-game').addEventListener('click', () => this.newGame());

        document.getElementById('player-multiple-choice').addEventListener('click', (e) => {
            if (e.target.classList.contains('player-option')) {
                this.submitAnswer(parseInt(e.target.dataset.option));
            }
        });

        document.getElementById('player-true-false').addEventListener('click', (e) => {
            if (e.target.classList.contains('tf-option')) {
                this.submitAnswer(e.target.dataset.answer);
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
            this.displayQuestion(data);
            this.startTimer(data.timeLimit);
        });

        this.socket.on('question-end', (data) => {
            this.showLeaderboard(data.leaderboard);
            if (this.isHost) {
                document.getElementById('next-question').style.display = 'block';
            }
        });

        this.socket.on('game-end', (data) => {
            this.showFinalResults(data.finalLeaderboard);
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
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }

    addQuestion() {
        const questionsContainer = document.getElementById('questions-container');
        const questionCount = questionsContainer.children.length;
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.setAttribute('data-question', questionCount);
        
        questionDiv.innerHTML = `
            <h3>Question ${questionCount + 1}</h3>
            
            <select class="question-type" onchange="updateQuestionType(this)">
                <option value="multiple-choice">Multiple Choice</option>
                <option value="multiple-correct">Multiple Correct Answers</option>
                <option value="true-false">True/False</option>
                <option value="numeric">Numeric Answer</option>
            </select>
            
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
        const title = document.getElementById('quiz-title').value;
        if (!title.trim()) {
            alert('Please enter a quiz title');
            return;
        }

        const questions = this.collectQuestions();
        if (questions.length === 0) {
            alert('Please add at least one question');
            return;
        }

        const quiz = {
            title: title,
            questions: questions
        };

        this.socket.emit('host-join', { quiz });
    }

    collectQuestions() {
        const questions = [];
        const questionItems = document.querySelectorAll('.question-item');
        
        questionItems.forEach((item, index) => {
            const questionText = item.querySelector('.question-text').value.trim();
            const questionType = item.querySelector('.question-type').value;
            const imageUrl = item.querySelector('.question-image').dataset.url || '';
            
            if (!questionText) return;
            
            let question = {
                question: questionText,
                type: questionType,
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
                    question.options = ['True', 'False'];
                    question.correctAnswer = tfCorrect;
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

    displayQuestion(data) {
        if (this.isHost) {
            document.getElementById('question-counter').textContent = `Question ${data.questionNumber} of ${data.totalQuestions}`;
            document.getElementById('current-question').innerHTML = data.question;
            
            if (data.image) {
                const imageDisplay = document.getElementById('question-image-display');
                const img = document.getElementById('host-question-image');
                img.src = data.image;
                imageDisplay.style.display = 'block';
            } else {
                document.getElementById('question-image-display').style.display = 'none';
            }
            
            const optionsContainer = document.getElementById('answer-options');
            if (data.type === 'numeric') {
                optionsContainer.style.display = 'none';
            } else {
                optionsContainer.style.display = 'grid';
                const options = document.querySelectorAll('.option-display');
                
                if (data.type === 'true-false') {
                    options[0].textContent = 'TRUE';
                    options[1].textContent = 'FALSE';
                    options[2].style.display = 'none';
                    options[3].style.display = 'none';
                } else {
                    options.forEach((option, index) => {
                        if (data.options && data.options[index]) {
                            option.textContent = `${String.fromCharCode(65 + index)}: ${data.options[index]}`;
                            option.style.display = 'block';
                        } else {
                            option.style.display = 'none';
                        }
                    });
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
            
            console.log('Question type received:', data.type, 'Data:', data);
            
            switch (data.type) {
                case 'multiple-choice':
                    document.getElementById('player-multiple-choice').style.display = 'block';
                    const mcOptions = document.querySelectorAll('#player-multiple-choice .player-option');
                    mcOptions.forEach((option, index) => {
                        option.textContent = String.fromCharCode(65 + index);
                        option.disabled = false;
                        option.classList.remove('selected');
                    });
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
                    
                    document.getElementById('submit-multiple').disabled = false;
                    break;
                    
                case 'true-false':
                    document.getElementById('player-true-false').style.display = 'block';
                    document.querySelectorAll('.tf-option').forEach(option => {
                        option.disabled = false;
                        option.classList.remove('selected');
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
        let timeLeft = timeLimit;
        const timerElement = document.getElementById('timer');
        
        if (timerElement) {
            timerElement.textContent = timeLeft;
            
            this.timer = setInterval(() => {
                timeLeft--;
                timerElement.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    clearInterval(this.timer);
                    if (this.isHost) {
                        setTimeout(() => this.nextQuestion(), 1000);
                    }
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
        
        options[answer].classList.add('selected');
        this.socket.emit('submit-answer', { answer });
    }

    showAnswerSubmitted(answer) {
        const feedback = document.getElementById('answer-feedback');
        const message = document.getElementById('feedback-message');
        
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.style.backgroundColor = '#3498db';
        
        let displayText = '';
        if (typeof answer === 'number') {
            displayText = `Answer submitted: ${answer}`;
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
            
            if (questionType === 'multiple-choice' || questionType === 'true-false') {
                options.forEach((option, index) => {
                    if (index === data.correctAnswer) {
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
            // Only highlight correct answer options, don't override player feedback
            const questionType = data.questionType || 'multiple-choice';
            if (questionType === 'multiple-choice') {
                const options = document.querySelectorAll('.player-option');
                if (options[data.correctAnswer]) {
                    options[data.correctAnswer].style.border = '5px solid #2ecc71';
                }
            } else if (questionType === 'true-false') {
                const tfOptions = document.querySelectorAll('.tf-option');
                tfOptions.forEach(option => {
                    if (option.dataset.answer === data.correctAnswer.toString().toLowerCase()) {
                        option.style.border = '5px solid #2ecc71';
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
        document.getElementById('final-results').classList.remove('hidden');
        this.showScreen('leaderboard-screen');
    }

    updateLeaderboardDisplay(leaderboard) {
        const leaderboardList = document.getElementById('leaderboard-list');
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
        const answers = Array.from(checkboxes).map(cb => parseInt(cb.closest('.checkbox-option').dataset.option));
        console.log('Submitting multiple correct answers:', answers);
        this.socket.emit('submit-answer', { answer: answers, type: 'multiple-correct' });
        document.getElementById('submit-multiple').disabled = true;
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
        } else {
            feedback.style.backgroundColor = '#e74c3c';
            message.textContent = '❌ Incorrect';
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
        location.reload();
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
        
        const result = await response.json();
        if (result.url) {
            const questionItem = input.closest('.question-item');
            const preview = questionItem.querySelector('.image-preview');
            const img = questionItem.querySelector('.question-image');
            
            img.src = result.url;
            img.dataset.url = result.url;
            preview.style.display = 'block';
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image');
    }
}

function removeImage(button) {
    const questionItem = button.closest('.question-item');
    const preview = questionItem.querySelector('.image-preview');
    const img = questionItem.querySelector('.question-image');
    const input = questionItem.querySelector('.image-input');
    
    preview.style.display = 'none';
    img.src = '';
    img.dataset.url = '';
    input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    new KahootGame();
});