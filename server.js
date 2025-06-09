const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});

const games = new Map();
const players = new Map();

function generateGamePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    this.currentQuestion++;
    this.questionStartTime = Date.now();
    this.gameState = 'question';
    this.questionTimer = null;
    return this.currentQuestion < this.quiz.questions.length;
  }

  endQuestion() {
    this.gameState = 'revealing';
    clearTimeout(this.questionTimer);
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
          answer.sort();
          question.correctAnswers.sort();
          isCorrect = JSON.stringify(answer) === JSON.stringify(question.correctAnswers);
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
    const points = isCorrect ? Math.floor(1000 + timeBonus) : 0;

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

function startQuestion(game, io) {
  if (game.currentQuestion >= game.quiz.questions.length) {
    // Game finished
    game.gameState = 'finished';
    game.updateLeaderboard();
    io.to(`game-${game.pin}`).emit('game-end', {
      finalLeaderboard: game.leaderboard
    });
    return;
  }

  const question = game.quiz.questions[game.currentQuestion];
  const timeLimit = question.timeLimit || 20;
  
  game.gameState = 'question';
  game.questionStartTime = Date.now();
  
  io.to(`game-${game.pin}`).emit('question-start', {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.quiz.questions.length,
    question: question.question,
    options: question.options,
    type: question.type || 'multiple-choice',
    image: question.image || '',
    timeLimit: timeLimit
  });

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

    setTimeout(() => {
      game.updateLeaderboard();
      io.to(`game-${game.pin}`).emit('question-end', {
        leaderboard: game.leaderboard.slice(0, 5)
      });
      
      // Move to next question and continue
      game.currentQuestion++;
      setTimeout(() => {
        startQuestion(game, io);
      }, 3000);
    }, 3000);
    
  }, timeLimit * 1000);
}

function autoAdvanceGame(game, io) {
  setTimeout(() => {
    game.currentQuestion = 0; // Start with first question
    startQuestion(game, io);
  }, 3000);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'from:', socket.handshake.address);

  socket.on('host-join', (data) => {
    const { quiz } = data;
    const game = new Game(socket.id, quiz);
    games.set(game.pin, game);
    
    socket.join(`game-${game.pin}`);
    socket.emit('game-created', {
      pin: game.pin,
      gameId: game.id
    });
    
    console.log(`Game created with PIN: ${game.pin}`);
  });

  socket.on('player-join', (data) => {
    const { pin, name } = data;
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
    socket.emit('player-joined', { gamePin: pin, playerName: name });
    
    io.to(`game-${pin}`).emit('player-list-update', {
      players: Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name }))
    });
    
    console.log(`Player ${name} joined game ${pin}`);
  });

  socket.on('start-game', () => {
    const game = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (!game) return;

    game.gameState = 'starting';
    io.to(`game-${game.pin}`).emit('game-starting');
    
    // Start the auto-advancing game flow
    autoAdvanceGame(game, io);
  });

  socket.on('submit-answer', (data) => {
    const { answer, type } = data;
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gamePin);
    if (!game || game.gameState !== 'question') return;

    const result = game.submitAnswer(socket.id, answer, type);
    socket.emit('answer-submitted', { answer: answer });
  });

  socket.on('next-question', () => {
    const game = Array.from(games.values()).find(g => g.hostId === socket.id);
    if (!game) return;

    // Move to next question manually
    game.currentQuestion++;
    startQuestion(game, io);
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
      io.to(`game-${hostedGame.pin}`).emit('game-ended', { reason: 'Host disconnected' });
      games.delete(hostedGame.pin);
    }

    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://[YOUR_LOCAL_IP]:${PORT}`);
});