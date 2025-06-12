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
  }
});

app.use(cors());
app.use(express.json());
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
  limits: { fileSize: 5 * 1024 * 1024 },
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

// Generate QR code endpoint
app.get('/api/qr/:pin', async (req, res) => {
  try {
    const { pin } = req.params;
    const game = games.get(pin);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const networkInterfaces = os.networkInterfaces();
    const localIP = Object.values(networkInterfaces)
      .flat()
      .find(iface => iface.family === 'IPv4' && !iface.internal)?.address || 'localhost';
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
    if (this.isAdvancing) return false;
    this.isAdvancing = true;
    this.currentQuestion++;
    this.questionStartTime = Date.now();
    this.gameState = 'question';
    this.questionTimer = null;
    this.advanceTimer = null;
    const hasMore = this.currentQuestion < this.quiz.questions.length;
    this.isAdvancing = false;
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

    const timeBonus = Math.max(0, 1000 - (Date.now() - this.questionStartTime));
    const difficultyMultiplier = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    }[question.difficulty] || 2;
    
    const basePoints = 100 * difficultyMultiplier;
    const points = isCorrect ? Math.floor(basePoints + (timeBonus * difficultyMultiplier / 2)) : 0;

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
}

function advanceToNextQuestion(game, io) {
  game.advanceTimer = setTimeout(() => {
    game.updateLeaderboard();
    io.to(`game-${game.pin}`).emit('question-end', {
      leaderboard: game.leaderboard.slice(0, 5)
    });
    
    // Move to next question and continue
    game.advanceTimer = setTimeout(() => {
      if (game.nextQuestion()) {
        startQuestion(game, io);
      } else {
        // No more questions - end the game
        game.gameState = 'finished';
        game.endTime = new Date().toISOString();
        game.updateLeaderboard();
        game.saveResults();
        io.to(`game-${game.pin}`).emit('game-end', {
          finalLeaderboard: game.leaderboard
        });
      }
    }, 3000);
  }, 3000);
}

function startQuestion(game, io) {
  if (game.currentQuestion >= game.quiz.questions.length) {
    // Game finished
    game.gameState = 'finished';
    game.endTime = new Date().toISOString();
    game.updateLeaderboard();
    game.saveResults();
    io.to(`game-${game.pin}`).emit('game-end', {
      finalLeaderboard: game.leaderboard
    });
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
  
  console.log(`Emitting question-start to room game-${game.pin}:`, {
    questionNumber: questionData.questionNumber,
    type: questionData.type,
    playersInGame: game.players.size
  });
  
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
      questionType: question.type || 'multiple-choice'
    });

    // Send individual results to each player
    game.players.forEach((player, playerId) => {
      const playerAnswer = player.answers[game.currentQuestion];
      if (playerAnswer) {
        io.to(playerId).emit('player-result', {
          isCorrect: playerAnswer.isCorrect,
          points: playerAnswer.points,
          totalScore: player.score
        });
      }
    });

    advanceToNextQuestion(game, io);
    
  }, timeLimit * 1000);
}

function autoAdvanceGame(game, io) {
  setTimeout(() => {
    if (game.nextQuestion()) {
      startQuestion(game, io);
    } else {
      console.error('Failed to start first question - no questions available');
    }
  }, 3000);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'from:', socket.handshake.address);

  socket.on('host-join', (data) => {
    // Check if request is from local machine or local network (but allow all for now due to NAT/proxy issues)
    const clientIP = socket.handshake.address;
    const isLocalHost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    const isLocalNetwork = isLocalHost || clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP.startsWith('172.') || clientIP.startsWith('::ffff:192.168.');
    
    // Log for debugging but don't restrict for now
    console.log(`Host join attempt from IP: ${clientIP}, isLocalNetwork: ${isLocalNetwork}`);
    
    // Uncomment this line to enable hosting restriction:
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
    
    const game = new Game(socket.id, quiz);
    games.set(game.pin, game);
    
    socket.join(`game-${game.pin}`);
    socket.emit('game-created', {
      pin: game.pin,
      gameId: game.id
    });
    
    console.log(`Game created with PIN: ${game.pin} from IP: ${clientIP}`);
  });

  socket.on('player-join', (data) => {
    if (!data || typeof data !== 'object') {
      socket.emit('error', { message: 'Invalid request data' });
      return;
    }
    
    const { pin, name } = data;
    
    if (!pin || !name || typeof pin !== 'string' || typeof name !== 'string') {
      socket.emit('error', { message: 'PIN and name are required' });
      return;
    }
    
    if (name.length > 20 || name.trim().length === 0) {
      socket.emit('error', { message: 'Name must be 1-20 characters' });
      return;
    }
    
    console.log(`Player attempting to join PIN: ${pin}, Name: ${name}`);
    console.log(`Available games:`, Array.from(games.keys()));
    const game = games.get(pin);
    
    if (!game) {
      console.log(`Game not found for PIN: ${pin}`);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    if (game.gameState !== 'lobby') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    game.addPlayer(socket.id, name);
    players.set(socket.id, { gamePin: pin, name });
    
    socket.join(`game-${pin}`);
    console.log(`Player ${name} (${socket.id}) joined room game-${pin}`);
    socket.emit('player-joined', { gamePin: pin, playerName: name });
    
    io.to(`game-${pin}`).emit('player-list-update', {
      players: Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name }))
    });
    
    console.log(`Player ${name} joined game ${pin}, total players: ${game.players.size}`);
  });

  socket.on('start-game', () => {
    const game = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (!game) {
      console.log('No game found for host:', socket.id);
      return;
    }

    console.log(`Starting game ${game.pin} with ${game.players.size} players`);
    game.gameState = 'starting';
    game.startTime = new Date().toISOString();
    
    // Emit to the room and log
    console.log(`Emitting game-starting to room: game-${game.pin}`);
    io.to(`game-${game.pin}`).emit('game-starting');
    
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

    const result = game.submitAnswer(socket.id, answer, type);
    socket.emit('answer-submitted', { answer: answer });
    
    // Check if all players have submitted answers
    const totalPlayers = game.players.size;
    const answeredPlayers = Array.from(game.players.values())
      .filter(player => player.answers[game.currentQuestion]).length;
    
    if (answeredPlayers >= totalPlayers && totalPlayers > 0 && game.gameState === 'question') {
      // All players have answered, end question early (prevent race condition with state check)
      if (game.questionTimer) {
        clearTimeout(game.questionTimer);
        game.questionTimer = null;
        
        // Trigger question end immediately
        setTimeout(() => {
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
            earlyEnd: true
          });

          // Send individual results to each player
          game.players.forEach((player, playerId) => {
            const playerAnswer = player.answers[game.currentQuestion];
            if (playerAnswer) {
              io.to(playerId).emit('player-result', {
                isCorrect: playerAnswer.isCorrect,
                points: playerAnswer.points,
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
    if (!game || game.isAdvancing) return;

    // Clear any pending auto-advance timers
    if (game.advanceTimer) {
      clearTimeout(game.advanceTimer);
      game.advanceTimer = null;
    }
    
    // Move to next question manually
    if (game.nextQuestion()) {
      startQuestion(game, io);
    }
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
server.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  const localIP = Object.values(networkInterfaces)
    .flat()
    .find(iface => iface.family === 'IPv4' && !iface.internal)?.address || 'localhost';
  console.log(`Network access: http://${localIP}:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Server running on port ${PORT}`);
});