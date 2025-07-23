# QuizMaster Pro - Project Overview

## Purpose
QuizMaster Pro is a sophisticated interactive quiz platform designed for local network use. It's a real-time multiplayer system that allows hosts to create rich quizzes with mathematical equations (LaTeX), images, and multiple question types, while players join via PIN codes to participate in live quiz sessions.

## Key Features
- **Real-time Multiplayer**: Multiple players join using PIN codes
- **Question Types**: Multiple choice, multiple correct answers, true/false, numeric input
- **Rich Content**: LaTeX equations via MathJax, image support, enhanced timing
- **Internationalization**: Complete 9-language support (EN/ES/FR/DE/IT/PT/PL/JA/ZH)
- **AI Integration**: Question generation via Ollama (local), OpenAI, and Claude APIs
- **Live Features**: Real-time scoring, leaderboards, QR code sharing, live answer statistics
- **Modern UI**: Glass morphism design with responsive layouts
- **Network Access**: Runs locally, accessible across devices on same network

## Tech Stack

### Backend
- **Node.js** with Express.js web server
- **Socket.IO** for real-time WebSocket communication
- **Multer** for image upload handling
- **QRCode** library for game joining
- File-based storage (JSON files in `quizzes/` and `results/` directories)

### Frontend
- **Vanilla JavaScript** with ES6 modules (no framework)
- **MathJax** for LaTeX equation rendering
- **Socket.IO client** for real-time communication
- **Modular CSS** architecture with CSS custom properties
- Single Page Application architecture

### Architecture
- **Modular ES6 JavaScript**: ~6,500+ lines organized into focused modules
- **Modular CSS**: ~6,500+ lines organized into themed modules
- **Real-time Communication**: Socket.IO for host-player interactions
- **In-memory Game Management**: Maps for games and players with automatic cleanup