# QuizMaster Pro - Architecture & Structure

## Overall Architecture
QuizMaster Pro is a real-time multiplayer quiz platform with Node.js backend and modular ES6 JavaScript frontend.

## Backend Structure (server.js)
- **Express.js** web server serving static files from `public/`
- **Socket.IO** for real-time WebSocket communication between host and players
- **Game Management**: In-memory storage using Maps for games and players
- **Game Class**: Core game logic with timer management, race condition protection, and automatic cleanup
- **File Upload**: Multer middleware for image uploads to `public/uploads/`
- **Quiz Storage**: File-based storage in `quizzes/` directory as JSON files
- **Results Tracking**: Automatic saving of game results to `results/` directory

## Frontend Structure (Modular ES6)
- **Single Page Application**: All screens managed in `public/index.html`
- **Modular Architecture**: ES6 modules with proper separation of concerns
- **Real-time Communication**: Socket.IO client for bidirectional communication
- **LaTeX Support**: MathJax integration for mathematical equations
- **Modern UI**: Glass morphism design with Inter font family
- **Live Preview**: Real-time split-screen preview system for quiz editing
- **Internationalization**: Complete 9-language support system

## Key Modules

### Core Modules
- **`app.js`** (900+ lines) - Main QuizGame coordination class
- **`config.js`** - Configuration constants and logger system

### Game Management
- **`game-manager.js`** (1,300+ lines) - Game flow and state management with refactored functions
- **Game Display/State/Player Interaction Managers** - Modular game components

### Quiz Management
- **`quiz-manager.js`** (700+ lines) - Quiz CRUD operations with LaTeX support

### Real-time Communication
- **`socket-manager.js`** (450+ lines) - Socket.IO client management

### UI Management
- **`ui-manager.js`** (200+ lines) - Screen and UI management
- **`preview-manager.js`** (900+ lines) - Live preview functionality

### Utilities
- **`translations.js`** (2,000+ lines) - 9-language translation system
- **`globals.js`** (400+ lines) - Global functions for HTML handlers
- **`math-renderer.js`** - MathJax rendering with retry mechanisms
- **`mathjax-service.js`** - Centralized MathJax service
- **`dom-manager.js`** - DOM caching and management utility
- **`error-handler.js`** - Centralized error logging system

### Specialized Features
- **`generator.js`** - AI question generation (Ollama, OpenAI, Claude)
- **`sound-manager.js`** - Web Audio API management
- **`settings-manager.js`** (500+ lines) - User preferences and themes

## Data Flow
1. **Host creates quiz** → Quiz saved to `quizzes/` directory
2. **Game starts** → PIN generated, QR code created
3. **Players join** → Socket.IO connections established
4. **Real-time gameplay** → Questions sent, answers collected
5. **Results saved** → Automatic saving to `results/` directory

## Key Design Patterns
- **Module Pattern**: ES6 classes with focused responsibilities
- **Observer Pattern**: Socket.IO event-driven communication
- **Singleton Pattern**: DOM Manager, Error Handler, Translation Manager
- **Strategy Pattern**: Different question types with unified interface