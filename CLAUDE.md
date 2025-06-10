# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon auto-restart

**Testing:**
No test framework is configured in this project.

**Building:**
No build process required - static files served directly.

## Architecture

QuizMaster Pro is a real-time multiplayer quiz platform with a Node.js backend and vanilla JavaScript frontend, featuring quiz management and results tracking.

### Backend Structure (server.js)
- **Express.js** web server serving static files from `public/`
- **Socket.IO** for real-time WebSocket communication between host and players
- **Game Management**: In-memory storage using Maps for games and players
- **File Upload**: Multer middleware for image uploads to `public/uploads/`
- **Quiz Storage**: File-based storage in `quizzes/` directory as JSON files
- **Results Tracking**: Automatic saving of game results to `results/` directory
- **API Endpoints**: RESTful endpoints for quiz management and results storage
- **Game Class**: Core game logic with timer management, race condition protection, and automatic cleanup

### Frontend Structure
- **Single Page Application**: All screens managed in `public/index.html`
- **Screen Management**: JavaScript class-based approach with enhanced animations
- **Real-time Communication**: Socket.IO client for bidirectional communication
- **LaTeX Support**: MathJax integration for mathematical equations
- **Modern UI**: Enhanced styling with gradients, animations, and responsive design
- **Quiz Management**: Modal-based interface for saving and loading quizzes
- **Input Validation**: Comprehensive client-side validation with user-friendly error messages

### Key Game Flow
1. Host creates quiz with questions (multiple types supported) or loads saved quiz
2. Host starts game and receives PIN
3. Players join via PIN with validation
4. Auto-advancing question flow with enhanced timers
5. Real-time scoring and animated leaderboards
6. Automatic results saving with participant tracking

### Question Types Supported
- Multiple choice (single answer) - displays full option text
- Multiple correct answers (checkbox selection)
- True/False with enhanced styling
- Numeric input with tolerance settings

### Data Persistence
- **Quiz Storage**: JSON files in `quizzes/` directory with metadata (title, creation date, question count)
- **Results Storage**: Automatic saving to `results/` directory with complete game data
- **File Structure**: Organized storage with unique filenames and timestamps
- **Data Integrity**: Input validation and error handling throughout

### API Endpoints
- `POST /api/save-quiz` - Save quiz with validation
- `GET /api/quizzes` - List all saved quizzes with metadata
- `GET /api/quiz/:filename` - Load specific quiz by filename
- `POST /api/save-results` - Manual results saving (auto-save also implemented)
- `POST /upload` - Image upload with error handling

### Network Configuration
Server binds to `0.0.0.0:3000` by default for local network access. Uses environment variable PORT for customization.

### Error Handling & Robustness
- Race condition protection in game state management
- Memory leak prevention with proper timer cleanup
- Comprehensive input validation on both client and server
- Graceful disconnection handling with game cleanup
- Null pointer protection throughout codebase

### Visual Enhancements
- Modern gradient backgrounds and animations
- Enhanced button styles with hover effects
- Modal dialogs for quiz management
- Improved leaderboard styling with podium positions
- Responsive design optimized for mobile devices
- Loading states and user feedback throughout interface