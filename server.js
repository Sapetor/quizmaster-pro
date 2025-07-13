const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const os = require('os');

// Import configuration constants
const CONFIG = {
    TIMING: {
        DEFAULT_QUESTION_TIME: 20,
        LEADERBOARD_DISPLAY_TIME: 3000,
        GAME_START_DELAY: 3000,
        AUTO_ADVANCE_DELAY: 3000,
    },
    SCORING: {
        BASE_POINTS: 100,
        MAX_BONUS_TIME: 10000,
        TIME_BONUS_DIVISOR: 10,
        DIFFICULTY_MULTIPLIERS: { 'easy': 1, 'medium': 2, 'hard': 3 },
        DEFAULT_TOLERANCE: 0.1,
    },
    LIMITS: {
        MAX_PLAYER_NAME_LENGTH: 20,
        MAX_FILE_SIZE: 5 * 1024 * 1024,
        PIN_LENGTH: 6,
    },
    NETWORK: {
        PING_TIMEOUT: 60000,
        PING_INTERVAL: 25000,
        UPGRADE_TIMEOUT: 30000,
    }
};

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow localhost and local network origins
      if (!origin || 
          origin.includes('localhost') || 
          origin.includes('127.0.0.1') || 
          origin.includes('192.168.') || 
          origin.includes('10.') || 
          origin.includes('172.')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    methods: ["GET", "POST"]
  },
  pingTimeout: CONFIG.NETWORK.PING_TIMEOUT,
  pingInterval: CONFIG.NETWORK.PING_INTERVAL,
  upgradeTimeout: CONFIG.NETWORK.UPGRADE_TIMEOUT,
  allowUpgrades: true
});

app.use(cors());
app.use(express.json());

// Disable caching for development
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Expires', '-1');
    res.set('Pragma', 'no-cache');
    next();
});

app.use(express.static('public'));

// Ensure directories exist
if (!fs.existsSync('quizzes')) {
  fs.mkdirSync('quizzes');
}
if (!fs.existsSync('results')) {
  fs.mkdirSync('results');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: CONFIG.LIMITS.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Save quiz endpoint
app.post('/api/save-quiz', (req, res) => {
  try {
    const { title, questions } = req.body;
    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Invalid quiz data' });
    }
    
    // Sanitize filename more thoroughly to prevent path traversal
    const safeTitle = title.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase().substring(0, 50);
    const filename = `${safeTitle}_${Date.now()}.json`;
    const quizData = {
      title,
      questions,
      created: new Date().toISOString(),
      id: uuidv4()
    };
    
    fs.writeFileSync(path.join('quizzes', filename), JSON.stringify(quizData, null, 2));
    res.json({ success: true, filename, id: quizData.id });
  } catch (error) {
    console.error('Save quiz error:', error);
    res.status(500).json({ error: 'Failed to save quiz' });
  }
});

// Load quiz endpoint
app.get('/api/quizzes', (req, res) => {
  try {
    const files = fs.readdirSync('quizzes').filter(f => f.endsWith('.json'));
    const quizzes = files.map(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join('quizzes', file), 'utf8'));
        return {
          filename: file,
          title: data.title,
          questionCount: data.questions.length,
          created: data.created,
          id: data.id
        };
      } catch (err) {
        console.error('Error reading quiz file:', file, err);
        return null;
      }
    }).filter(Boolean);
    
    res.json(quizzes);
  } catch (error) {
    console.error('Load quizzes error:', error);
    res.status(500).json({ error: 'Failed to load quizzes' });
  }
});

// Load specific quiz endpoint
app.get('/api/quiz/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join('quizzes', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Load quiz error:', error);
    res.status(500).json({ error: 'Failed to load quiz' });
  }
});

// Save quiz results endpoint
app.post('/api/save-results', (req, res) => {
  try {
    const { quizTitle, gamePin, results, startTime, endTime } = req.body;
    if (!quizTitle || !gamePin || !results) {
      return res.status(400).json({ error: 'Invalid results data' });
    }
    
    const filename = `results_${gamePin}_${Date.now()}.json`;
    const resultsData = {
      quizTitle,
      gamePin,
      results,
      startTime,
      endTime,
      saved: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join('results', filename), JSON.stringify(resultsData, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    console.error('Save results error:', error);
    res.status(500).json({ error: 'Failed to save results' });
  }
});

// Get list of active games endpoint
app.get('/api/active-games', (req, res) => {
  try {
    const allGames = Array.from(games.values()).map(game => ({
      pin: game.pin,
      title: game.quiz.title || 'Untitled Quiz',
      playerCount: game.players.size,
      questionCount: game.quiz.questions.length,
      gameState: game.gameState,
      created: new Date().toISOString()
    }));
    
    const activeGames = allGames.filter(game => game.gameState === 'lobby');
    
    console.log(`Active games request: Found ${allGames.length} total games, ${activeGames.length} in lobby state`);
    allGames.forEach(game => {
      console.log(`  Game ${game.pin}: ${game.title} (${game.gameState}) - ${game.playerCount} players`);
    });
    
    res.json({ 
      games: activeGames,
      debug: {
        totalGames: allGames.length,
        allGames: allGames
      }
    });
  } catch (error) {
    console.error('Active games fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch active games' });
  }
});

// Generate QR code endpoint
app.get('/api/qr/:pin', async (req, res) => {
  try {
    const { pin } = req.params;
    const game = games.get(pin);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Use the same IP detection logic as server startup
    let localIP = 'localhost';
    const NETWORK_IP = process.env.NETWORK_IP;
    
    if (NETWORK_IP) {
      localIP = NETWORK_IP;
    } else {
      const networkInterfaces = os.networkInterfaces();
      const interfaces = Object.values(networkInterfaces).flat();
      
      // Prefer 192.168.x.x (typical home network) over 172.x.x.x (WSL internal)
      localIP = interfaces.find(iface => 
        iface.family === 'IPv4' && 
        !iface.internal && 
        iface.address.startsWith('192.168.')
      )?.address ||
      interfaces.find(iface => 
        iface.family === 'IPv4' && 
        !iface.internal && 
        iface.address.startsWith('10.')
      )?.address ||
      interfaces.find(iface => 
        iface.family === 'IPv4' && 
        !iface.internal
      )?.address || 'localhost';
    }
    
    const port = process.env.PORT || 3000;
    const gameUrl = `http://${localIP}:${port}?pin=${pin}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(gameUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    res.json({ 
      qrCode: qrCodeDataUrl,
      gameUrl: gameUrl,
      pin: pin
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Fetch available Ollama models endpoint
app.get('/api/ollama/models', async (req, res) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch Ollama models' });
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    res.json({
      models: models.map(model => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at
      }))
    });
  } catch (error) {
    console.error('Ollama models fetch error:', error);
    res.status(500).json({ error: 'Failed to connect to Ollama' });
  }
});

// Claude API proxy endpoint
app.post('/api/claude/generate', async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;
    
    if (!prompt || !apiKey) {
      return res.status(400).json({ error: 'Prompt and API key are required' });
    }
    
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      
      let errorMessage = `Claude API error: ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your Claude API key and try again.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (response.status === 400) {
        errorMessage = 'Invalid request. Please check your input and try again.';
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorText
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Claude proxy error:', error);
    res.status(500).json({ error: 'Failed to connect to Claude API' });
  }
});

const games = new Map();
const players = new Map();

function generateGamePin() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games.has(pin));
  return pin;
}

class Game {
  constructor(hostId, quiz) {
    this.id = uuidv4();
    this.pin = generateGamePin();
    this.hostId = hostId;
    this.quiz = quiz;
    this.players = new Map();
    this.currentQuestion = -1;
    this.gameState = 'lobby';
    this.questionStartTime = null;
    this.leaderboard = [];
    this.questionTimer = null;
    this.advanceTimer = null;
    this.isAdvancing = false;
    this.startTime = null;
    this.endTime = null;
    this.manualAdvancement = quiz.manualAdvancement || false;
  }

  addPlayer(playerId, playerName) {
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      score: 0,
      answers: []
    });
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  nextQuestion() {
    // Check if we can advance before incrementing
    const nextQuestionIndex = this.currentQuestion + 1;
    const hasMore = nextQuestionIndex < this.quiz.questions.length;
    
    if (hasMore) {
      this.currentQuestion = nextQuestionIndex;
      this.gameState = 'question';
      this.questionTimer = null;
      this.advanceTimer = null;
    }
    
    return hasMore;
  }
  
  saveResults() {
    try {
      const results = {
        quizTitle: this.quiz.title || 'Untitled Quiz',
        gamePin: this.pin,
        results: Array.from(this.players.values()).map(player => ({
          name: player.name,
          score: player.score,
          answers: player.answers
        })),
        startTime: this.startTime,
        endTime: this.endTime
      };
      
      // Save to file via internal API call
      const filename = `results_${this.pin}_${Date.now()}.json`;
      fs.writeFileSync(path.join('results', filename), JSON.stringify(results, null, 2));
      console.log(`Game results saved: ${filename}`);
    } catch (error) {
      console.error('Error saving game results:', error);
    }
  }

  endQuestion() {
    this.gameState = 'revealing';
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  submitAnswer(playerId, answer, answerType) {
    const player = this.players.get(playerId);
    if (!player) return false;

    const question = this.quiz.questions[this.currentQuestion];
    let isCorrect = false;

    switch (question.type || 'multiple-choice') {
      case 'multiple-choice':
        isCorrect = answer === question.correctAnswer;
        break;
        
      case 'multiple-correct':
        if (Array.isArray(answer) && Array.isArray(question.correctAnswers)) {
          const sortedAnswer = [...answer].sort();
          const sortedCorrect = [...question.correctAnswers].sort();
          isCorrect = JSON.stringify(sortedAnswer) === JSON.stringify(sortedCorrect);
        }
        break;
        
      case 'true-false':
        isCorrect = answer.toString().toLowerCase() === question.correctAnswer.toString().toLowerCase();
        break;
        
      case 'numeric':
        if (typeof answer === 'number' && typeof question.correctAnswer === 'number') {
          const tolerance = question.tolerance || 0.1;
          isCorrect = Math.abs(answer - question.correctAnswer) <= tolerance;
        }
        break;
    }

    const timeTaken = Date.now() - this.questionStartTime;
    // Extended time bonus window to 10 seconds (10000ms) for more noticeable scoring differences
    const maxBonusTime = 10000;
    const timeBonus = Math.max(0, maxBonusTime - timeTaken);
    const difficultyMultiplier = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    }[question.difficulty] || 2;
    
    const basePoints = 100 * difficultyMultiplier;
    // Scale time bonus more significantly 
    const scaledTimeBonus = Math.floor(timeBonus * difficultyMultiplier / 10);
    const points = isCorrect ? basePoints + scaledTimeBonus : 0;
    
    console.log(`Scoring Debug - Player: ${this.players.get(playerId)?.name || playerId}, Time: ${timeTaken}ms, TimeBonus: ${timeBonus}, ScaledBonus: ${scaledTimeBonus}, BasePoints: ${basePoints}, FinalPoints: ${points}`);

    player.answers[this.currentQuestion] = {
      answer,
      isCorrect,
      points,
      timeMs: Date.now() - this.questionStartTime
    };
    player.score += points;

    return { isCorrect, points };
  }

  updateLeaderboard() {
    this.leaderboard = Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  getAnswerStatistics() {
    const question = this.quiz.questions[this.currentQuestion];
    
    // Return empty stats if question doesn't exist (game ended)
    if (!question) {
      return {
        totalPlayers: this.players.size,
        answeredPlayers: 0,
        answerCounts: {},
        questionType: 'multiple-choice'
      };
    }
    
    const stats = {
      totalPlayers: this.players.size,
      answeredPlayers: 0,
      answerCounts: {},
      questionType: question.type || 'multiple-choice'
    };

    // Initialize answer counts based on question type
    if (question.type === 'multiple-choice' || question.type === 'multiple-correct') {
      question.options.forEach((_, index) => {
        stats.answerCounts[index] = 0;
      });
    } else if (question.type === 'true-false') {
      stats.answerCounts['true'] = 0;
      stats.answerCounts['false'] = 0;
    } else if (question.type === 'numeric') {
      stats.answerCounts = {}; // For numeric, we'll show distribution
    }

    // Count actual answers
    Array.from(this.players.values()).forEach(player => {
      const playerAnswer = player.answers[this.currentQuestion];
      if (playerAnswer) {
        stats.answeredPlayers++;
        const answer = playerAnswer.answer;
        
        if (question.type === 'multiple-choice') {
          if (stats.answerCounts[answer] !== undefined) {
            stats.answerCounts[answer]++;
          }
        } else if (question.type === 'multiple-correct') {
          if (Array.isArray(answer)) {
            answer.forEach(a => {
              if (stats.answerCounts[a] !== undefined) {
                stats.answerCounts[a]++;
              }
            });
          }
        } else if (question.type === 'true-false') {
          const normalizedAnswer = answer.toString().toLowerCase();
          if (stats.answerCounts[normalizedAnswer] !== undefined) {
            stats.answerCounts[normalizedAnswer]++;
          }
        } else if (question.type === 'numeric') {
          // For numeric answers, group by ranges or exact values
          stats.answerCounts[answer.toString()] = (stats.answerCounts[answer.toString()] || 0) + 1;
        }
      }
    });

    return stats;
  }
}

function advanceToNextQuestion(game, io) {
  console.log(`advanceToNextQuestion: Called for game ${game.pin}, currentQuestion=${game.currentQuestion}, total=${game.quiz.questions.length}`);
  
  // Prevent advancement if game is already finished or advancing
  if (game.gameState === 'finished' || game.isAdvancing) {
    console.log(`advanceToNextQuestion: Game ${game.pin} already finished/advancing, skipping`);
    return;
  }
  
  // Set advancing flag to prevent duplicate calls
  game.isAdvancing = true;
  
  // Clear any existing advance timer to prevent duplication
  if (game.advanceTimer) {
    clearTimeout(game.advanceTimer);
    game.advanceTimer = null;
  }
  
  game.advanceTimer = setTimeout(() => {
    // Double-check game state before proceeding
    if (game.gameState === 'finished') {
      console.log(`advanceToNextQuestion: Game ${game.pin} finished during timer, skipping`);
      game.isAdvancing = false;
      return;
    }
    
    game.updateLeaderboard();
    io.to(`game-${game.pin}`).emit('question-end', {
      leaderboard: game.leaderboard.slice(0, 5)
    });
    
    // Check if manual advancement is enabled AND there are more questions
    const hasMoreQuestions = (game.currentQuestion + 1) < game.quiz.questions.length;
    console.log(`Checking advancement for game ${game.pin}: Manual = ${game.manualAdvancement}, currentQuestion=${game.currentQuestion}, hasMore=${hasMoreQuestions}`);
    
    if (game.manualAdvancement && hasMoreQuestions) {
      // Show next question button for host and wait for manual trigger
      console.log(`Showing next button for manual advancement in game ${game.pin} to host ${game.hostId}`);
      io.to(game.hostId).emit('show-next-button');
      game.isAdvancing = false; // Reset for manual mode
    } else if (game.manualAdvancement && !hasMoreQuestions) {
      // Manual mode but no more questions - end the game
      console.log(`Manual mode: No more questions for game ${game.pin}, ending`);
      game.isAdvancing = false;
      endGame(game, io);
    } else {
      // Auto-advance to next question
      console.log(`Auto-advancing game ${game.pin} in ${CONFIG.TIMING.AUTO_ADVANCE_DELAY}ms`);
      game.advanceTimer = setTimeout(() => {
        if (game.gameState === 'finished') {
          console.log(`Auto-advance: Game ${game.pin} finished during auto-advance timer, skipping`);
          game.isAdvancing = false;
          return;
        }
        
        console.log(`Auto-advance: Calling nextQuestion() for game ${game.pin}`);
        if (game.nextQuestion()) {
          startQuestion(game, io);
        } else {
          // No more questions - end the game
          console.log(`Auto-advance: No more questions for game ${game.pin}, ending`);
          endGame(game, io);
        }
        game.isAdvancing = false; // Reset after auto-advance
      }, CONFIG.TIMING.AUTO_ADVANCE_DELAY);
    }
  }, CONFIG.TIMING.LEADERBOARD_DISPLAY_TIME);
}

function endGame(game, io) {
  // Prevent multiple game endings
  if (game.gameState === 'finished') {
    console.log(`endGame: Game ${game.pin} already finished, skipping`);
    return;
  }
  
  console.log(`Ending game ${game.pin}`);
  game.gameState = 'finished';
  game.endTime = new Date().toISOString();
  
  // Reset advancing flags to prevent stuck states
  game.isAdvancing = false;
  
  // Clear any pending timers
  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = null;
  }
  if (game.advanceTimer) {
    clearTimeout(game.advanceTimer);
    game.advanceTimer = null;
  }
  
  // CRITICAL: Hide manual advancement button immediately when game ends
  io.to(game.hostId).emit('hide-next-button');
  
  // Debug: Log player scores before final leaderboard generation
  console.log('Final player scores before leaderboard update:');
  game.players.forEach((player, playerId) => {
    console.log(`  Player ${player.name} (${playerId}): ${player.score} points`);
  });
  
  game.updateLeaderboard();
  
  // Debug: Log final leaderboard
  console.log('Final leaderboard:', game.leaderboard.map(p => ({ name: p.name, score: p.score })));
  
  game.saveResults();
  
  // Add longer delay to ensure all previous events are processed completely
  setTimeout(() => {
    // Double-check game is still finished (race condition protection)
    if (game.gameState === 'finished') {
      console.log('Sending final leaderboard to clients:', game.leaderboard.map(p => ({ name: p.name, score: p.score })));
      io.to(`game-${game.pin}`).emit('game-end', {
        finalLeaderboard: game.leaderboard
      });
    }
  }, 1000); // Increased delay from 500ms to 1000ms
}

function startQuestion(game, io) {
  if (game.currentQuestion >= game.quiz.questions.length) {
    // Game finished
    endGame(game, io);
    return;
  }

  const question = game.quiz.questions[game.currentQuestion];
  const timeLimit = question.timeLimit || 20;
  
  game.gameState = 'question';
  game.questionStartTime = Date.now();
  
  const questionData = {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.quiz.questions.length,
    question: question.question,
    options: question.options,
    type: question.type || 'multiple-choice',
    image: question.image || '',
    timeLimit: timeLimit
  };
  
  io.to(`game-${game.pin}`).emit('question-start', questionData);

  game.questionTimer = setTimeout(() => {
    game.endQuestion();
    const correctAnswer = question.correctAnswer;
    let correctOption = '';
    
    switch (question.type || 'multiple-choice') {
      case 'multiple-choice':
        correctOption = question.options && question.options[correctAnswer] ? question.options[correctAnswer] : '';
        break;
      case 'multiple-correct':
        const correctAnswers = question.correctAnswers || [];
        correctOption = correctAnswers.map(idx => question.options[idx]).join(', ');
        break;
      case 'true-false':
        correctOption = correctAnswer;
        break;
      case 'numeric':
        correctOption = correctAnswer.toString();
        break;
    }
    
    io.to(`game-${game.pin}`).emit('question-timeout', {
      correctAnswer: correctAnswer,
      correctOption: correctOption,
      questionType: question.type || 'multiple-choice',
      tolerance: question.tolerance || null
    });

    // Send answer statistics to host after question ends
    const answerStats = game.getAnswerStatistics();
    io.to(game.hostId).emit('answer-statistics', answerStats);

    // Send individual results to each player
    game.players.forEach((player, playerId) => {
      const playerAnswer = player.answers[game.currentQuestion];
      if (playerAnswer) {
        // Player answered - send their actual result
        io.to(playerId).emit('player-result', {
          isCorrect: playerAnswer.isCorrect,
          points: playerAnswer.points,
          totalScore: player.score
        });
      } else {
        // Player didn't answer - send incorrect result (0 points)
        io.to(playerId).emit('player-result', {
          isCorrect: false,
          points: 0,
          totalScore: player.score
        });
      }
    });

    advanceToNextQuestion(game, io);
    
  }, timeLimit * 1000);
}

function autoAdvanceGame(game, io) {
  console.log(`Starting game ${game.pin} with ${game.quiz.questions.length} questions`);
  setTimeout(() => {
    if (game.gameState === 'finished') {
      console.log(`Game ${game.pin} already finished, skipping`);
      return;
    }
    
    if (game.nextQuestion()) {
      startQuestion(game, io);
    } else {
      endGame(game, io);
    }
  }, CONFIG.TIMING.GAME_START_DELAY);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'from:', socket.handshake.address);

  socket.on('host-join', (data) => {
    // Check if request is from local machine or local network (but allow all for now due to NAT/proxy issues)
    const clientIP = socket.handshake.address;
    
    // Allow all local network connections
    
    // Uncomment this line to enable hosting restriction:
    // const isLocalHost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    // const isLocalNetwork = isLocalHost || clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP.startsWith('172.') || clientIP.startsWith('::ffff:192.168.');
    // if (!isLocalNetwork) {
    //   socket.emit('error', { message: 'Game hosting is restricted to local network only' });
    //   return;
    // }
    
    if (!data || !data.quiz || !Array.isArray(data.quiz.questions)) {
      socket.emit('error', { message: 'Invalid quiz data' });
      return;
    }
    
    const { quiz } = data;
    
    if (quiz.questions.length === 0) {
      socket.emit('error', { message: 'Quiz must have at least one question' });
      return;
    }
    
    // Clean up any existing games for this host
    const existingGame = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (existingGame) {
      existingGame.endQuestion();
      io.to(`game-${existingGame.pin}`).emit('game-ended', { reason: 'Host started new game' });
      games.delete(existingGame.pin);
    }
    
    const game = new Game(socket.id, quiz);
    games.set(game.pin, game);
    
    console.log(`Game created with PIN: ${game.pin}, Manual Advancement: ${game.manualAdvancement}`);
    
    socket.join(`game-${game.pin}`);
    socket.emit('game-created', {
      pin: game.pin,
      gameId: game.id
    });
    
    console.log(`Game created with PIN: ${game.pin} from IP: ${clientIP}`);
  });

  socket.on('player-join', (data) => {
    console.log('Player join attempt received:', data);
    console.log('Data type:', typeof data);
    
    if (!data || typeof data !== 'object') {
      console.log('Invalid request data - not object');
      socket.emit('error', { message: 'Invalid request data' });
      return;
    }
    
    const { pin, name } = data;
    console.log('Extracted PIN:', pin, 'Name:', name);
    console.log('PIN type:', typeof pin, 'Name type:', typeof name);
    
    if (!pin || !name || typeof pin !== 'string' || typeof name !== 'string') {
      console.log('PIN and name validation failed');
      socket.emit('error', { message: 'PIN and name are required' });
      return;
    }
    
    if (name.length > CONFIG.LIMITS.MAX_PLAYER_NAME_LENGTH || name.trim().length === 0) {
      socket.emit('error', { message: `Name must be 1-${CONFIG.LIMITS.MAX_PLAYER_NAME_LENGTH} characters` });
      return;
    }
    
    const game = games.get(pin);
    console.log('Looking for game with PIN:', pin);
    console.log('Game found:', !!game);
    console.log('Available games:', Array.from(games.keys()));
    
    if (!game) {
      console.log('Game not found for PIN:', pin);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    console.log('Game state:', game.gameState);
    if (game.gameState !== 'lobby') {
      console.log('Game already started, state:', game.gameState);
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    game.addPlayer(socket.id, name);
    players.set(socket.id, { gamePin: pin, name });
    
    socket.join(`game-${pin}`);
    
    // Get current players list for modular client compatibility
    const currentPlayers = Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name }));
    
    socket.emit('player-joined', { 
      gamePin: pin, 
      playerName: name,
      players: currentPlayers
    });
    
    io.to(`game-${pin}`).emit('player-list-update', {
      players: currentPlayers
    });
    
    console.log(`Player ${name} joined game ${pin}`);
  });

  socket.on('start-game', () => {
    const game = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (!game) {
      console.log('DEBUG: start-game called but no game found for host:', socket.id);
      return;
    }

    console.log(`Starting game ${game.pin} with ${game.quiz.questions.length} questions, manual advancement: ${game.manualAdvancement}`);
    
    game.gameState = 'starting';
    game.startTime = new Date().toISOString();
    
    // Send proper game-started event for modular client compatibility
    io.to(`game-${game.pin}`).emit('game-started', {
      gamePin: game.pin,
      questionCount: game.quiz.questions.length,
      manualAdvancement: game.manualAdvancement
    });
    
    // Start the auto-advancing game flow
    autoAdvanceGame(game, io);
  });

  socket.on('submit-answer', (data) => {
    if (!data || data.answer === undefined) {
      return;
    }
    
    const { answer, type } = data;
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gamePin);
    if (!game || game.gameState !== 'question') return;

    game.submitAnswer(socket.id, answer, type);
    socket.emit('answer-submitted', { answer: answer });
    
    // Check if all players have submitted answers
    const totalPlayers = game.players.size;
    const answeredPlayers = Array.from(game.players.values())
      .filter(player => player.answers[game.currentQuestion]).length;
    
    if (answeredPlayers >= totalPlayers && totalPlayers > 0 && game.gameState === 'question') {
      // All players have answered, end question early
      if (game.questionTimer) {
        clearTimeout(game.questionTimer);
        game.questionTimer = null;
        
        // Clear any pending advance timer to prevent double advancement
        if (game.advanceTimer) {
          clearTimeout(game.advanceTimer);
          game.advanceTimer = null;
        }
        
        // Trigger question end immediately
        setTimeout(() => {
          if (game.gameState !== 'question') return; // Prevent double execution
          
          game.endQuestion();
          const question = game.quiz.questions[game.currentQuestion];
          const correctAnswer = question.correctAnswer;
          let correctOption = '';
          
          switch (question.type || 'multiple-choice') {
            case 'multiple-choice':
              correctOption = question.options && question.options[correctAnswer] ? question.options[correctAnswer] : '';
              break;
            case 'multiple-correct':
              const correctAnswers = question.correctAnswers || [];
              correctOption = correctAnswers.map(idx => question.options[idx]).join(', ');
              break;
            case 'true-false':
              correctOption = correctAnswer;
              break;
            case 'numeric':
              correctOption = correctAnswer.toString();
              break;
          }
          
          io.to(`game-${game.pin}`).emit('question-timeout', {
            correctAnswer: correctAnswer,
            correctOption: correctOption,
            questionType: question.type || 'multiple-choice',
            tolerance: question.tolerance || null,
            earlyEnd: true
          });

          // Send answer statistics to host after question ends
          const answerStats = game.getAnswerStatistics();
          io.to(game.hostId).emit('answer-statistics', answerStats);

          // Send individual results to each player
          game.players.forEach((player, playerId) => {
            const playerAnswer = player.answers[game.currentQuestion];
            if (playerAnswer) {
              // Player answered - send their actual result
              io.to(playerId).emit('player-result', {
                isCorrect: playerAnswer.isCorrect,
                points: playerAnswer.points,
                totalScore: player.score
              });
            } else {
              // Player didn't answer - send incorrect result (0 points)
              io.to(playerId).emit('player-result', {
                isCorrect: false,
                points: 0,
                totalScore: player.score
              });
            }
          });

          advanceToNextQuestion(game, io);
        }, 1000); // 1 second delay to show "All players answered!"
      }
    }
  });

  socket.on('next-question', () => {
    const game = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (!game || game.isAdvancing) {
      console.log(`Ignoring next-question: game=${!!game}, isAdvancing=${game?.isAdvancing}`);
      return;
    }
    
    // CRITICAL: Prevent manual advancement if game is already finished
    if (game.gameState === 'finished') {
      console.log(`Ignoring next-question for finished game ${game.pin}`);
      io.to(game.hostId).emit('hide-next-button');
      return;
    }

    console.log(`Manual next-question for game ${game.pin}, currentQuestion=${game.currentQuestion}`);

    // Set advancing flag to prevent race conditions
    game.isAdvancing = true;

    // Clear any pending auto-advance timers
    if (game.advanceTimer) {
      clearTimeout(game.advanceTimer);
      game.advanceTimer = null;
    }
    
    // Hide the next question button immediately
    io.to(game.hostId).emit('hide-next-button');
    
    // Move to next question manually
    if (game.nextQuestion()) {
      startQuestion(game, io);
    } else {
      // No more questions - end the game
      console.log(`Manual advancement: No more questions for game ${game.pin}, ending`);
      endGame(game, io);
    }
    
    // Reset advancing flag
    game.isAdvancing = false;
  });

  socket.on('disconnect', () => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.gamePin);
      if (game) {
        game.removePlayer(socket.id);
        io.to(`game-${playerData.gamePin}`).emit('player-list-update', {
          players: Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name }))
        });
      }
      players.delete(socket.id);
    }

    const hostedGame = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (hostedGame) {
      // Clean up timers before removing game
      hostedGame.endQuestion();
      // Save results if game was in progress
      if (hostedGame.gameState === 'question' || hostedGame.gameState === 'finished') {
        hostedGame.endTime = new Date().toISOString();
        hostedGame.saveResults();
      }
      io.to(`game-${hostedGame.pin}`).emit('game-ended', { reason: 'Host disconnected' });
      games.delete(hostedGame.pin);
    }
    
    // Clean up games with no players
    games.forEach((game, pin) => {
      if (game.players.size === 0 && game.gameState === 'lobby') {
        games.delete(pin);
      }
    });

    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const NETWORK_IP = process.env.NETWORK_IP; // Allow manual IP override

server.listen(PORT, '0.0.0.0', () => {
  let localIP = 'localhost';
  
  if (NETWORK_IP) {
    // Use manually specified IP
    localIP = NETWORK_IP;
    console.log(`Using manual IP: ${localIP}`);
  } else {
    // Try to detect network IP, preferring 192.168.x.x for local networks
    const networkInterfaces = os.networkInterfaces();
    const interfaces = Object.values(networkInterfaces).flat();
    
    // Prefer 192.168.x.x (typical home network) over 172.x.x.x (WSL internal)
    localIP = interfaces.find(iface => 
      iface.family === 'IPv4' && 
      !iface.internal && 
      iface.address.startsWith('192.168.')
    )?.address ||
    interfaces.find(iface => 
      iface.family === 'IPv4' && 
      !iface.internal && 
      iface.address.startsWith('10.')
    )?.address ||
    interfaces.find(iface => 
      iface.family === 'IPv4' && 
      !iface.internal
    )?.address || 'localhost';
  }
  
  console.log(`Network access: http://${localIP}:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Server running on port ${PORT}`);
  
  // WSL specific instructions
  if (localIP.startsWith('172.')) {
    console.log('');
    console.log('🔧 WSL DETECTED: If you can\'t connect from your phone:');
    console.log('1. Find your Windows IP: run "ipconfig" in Windows Command Prompt');
    console.log('2. Look for "Wireless LAN adapter Wi-Fi" or "Ethernet adapter"');
    console.log('3. Use that IP address instead of the one shown above');
    console.log('4. Or restart with: NETWORK_IP=your.windows.ip npm start');
    console.log('');
  }
});