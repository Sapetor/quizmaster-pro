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

## Recent Improvements & Bug Fixes

### QR Code Sharing (Added)
- **Endpoint**: `GET /api/qr/:pin` - Generates QR codes for game joining
- **Features**: Auto-detects network IP, creates shareable URLs with pin parameter
- **Frontend**: QR codes displayed in game lobby with game URL
- **Auto-Join**: URL parameters automatically populate join screen

### Sound Effects System (Added)
- **Web Audio API**: Integrated audio system with graceful fallbacks
- **Sound Types**:
  - Question start: 800Hz tone
  - Answer submission: 600Hz click sound
  - Correct answer: Ascending musical notes (C-E-G)
  - Incorrect answer: Descending error tones
  - Game completion: Victory melody sequence
- **Implementation**: `initializeSounds()`, `playSound()`, `playVictorySound()` methods

### LaTeX Support Enhancements (Fixed)
- **Answer Options**: Full LaTeX rendering in multiple choice and other answer types
- **MathJax Integration**: Automatic re-rendering after content updates
- **Click Protection**: `pointer-events: none` on MathJax elements to prevent interference
- **Button Compatibility**: LaTeX content in buttons remains clickable on parent element

### Game State Management (Critical Fixes)
- **Question Advancement**: Consolidated to use single `Game.nextQuestion()` method
- **Timer System**: Fixed early stop when all players submit answers
- **Host Display**: Fixed highlighting persistence between questions with style reset
- **Auto-Advance**: Unified `advanceToNextQuestion()` function prevents double incrementing

### Mobile Optimization (Enhanced)
- **Viewport Management**: Full height utilization with flexbox layouts
- **Button Sizing**: Optimized for touch with proper spacing and overflow handling
- **Answer Feedback**: Fixed positioning for mobile with `position: fixed`
- **Performance**: Reduced margins/padding, improved scrolling behavior

### Security & Dependencies (Fixed)
- **IP Package**: Replaced vulnerable `ip` package with built-in `os` module
- **Network Detection**: Safe IPv4 interface detection using `os.networkInterfaces()`
- **Hosting Restrictions**: Configurable local network restrictions (currently disabled for connectivity)

### Game Completion Experience (Enhanced)
- **Animations**: Golden glow effect with `gameCompleteGlow` keyframe animation
- **Confetti**: Multi-directional confetti burst using canvas-confetti library
- **Audio**: Victory melody with timed note sequences
- **Visual Polish**: Enhanced final results styling with gradient backgrounds

## Critical Bug Fixes Applied

### Host Screen Stuck Issue (RESOLVED)
**Problem**: Host screen would freeze after first question leaderboard
**Cause**: Double incrementing of `currentQuestion` in auto-advance logic
**Solution**: Unified question advancement through `Game.nextQuestion()` method

### Player Join Failures (RESOLVED)
**Problem**: "Game not found" errors even when games were active
**Cause**: Race conditions between manual and auto-advance question systems
**Solution**: Consolidated advancement logic, proper state management

### Answer Display Bug (RESOLVED)
**Problem**: "Answer submitted: 0" instead of "Answer submitted: A"
**Cause**: Raw numeric indices shown instead of converted letters
**Solution**: Convert indices to letters (0→A, 1→B, etc.) in `showAnswerSubmitted()`

### True/False Highlighting (RESOLVED)
**Problem**: Previous question highlights persisted on new questions
**Cause**: Missing style reset between questions
**Solution**: Added style reset in `displayQuestion()` function

### LaTeX Button Clicks (RESOLVED)
**Problem**: LaTeX rendered content intercepted button click events
**Cause**: MathJax elements capturing pointer events
**Solution**: Added CSS `pointer-events: none` for all MathJax elements

## Git & Deployment

### Repository Configuration
- **GitHub URL**: https://github.com/Sapetor/quizmaster-pro
- **Remote**: SSH configured (`git@github.com:Sapetor/quizmaster-pro.git`)
- **Branch**: `main`
- **User**: Sapetor (sapetor@github.com)

### Git Workflow
- **Standard**: `git add . && git commit -m "message" && git push origin main`
- **SSH**: SSH keys are configured, no need for HTTPS authentication
- **Commits**: Use descriptive messages with bullet points for multiple changes

## Development Notes

### Common Issues & Solutions
1. **Game Joining Problems**: Usually related to game state inconsistencies - check `advanceToNextQuestion()` and `Game.nextQuestion()` coordination
2. **Mobile Layout Issues**: Focus on flexbox layouts and viewport height management
3. **Timer Conflicts**: Ensure proper cleanup of `questionTimer` and `advanceTimer`
4. **LaTeX Rendering**: Always call `MathJax.typesetPromise()` after content updates

### Code Quality Guidelines
- **State Management**: Use Game class methods consistently for game state changes
- **Error Handling**: All async operations should have try-catch blocks
- **Mobile First**: Test responsive design on mobile viewports
- **Audio Fallbacks**: Wrap Web Audio API calls in try-catch blocks

### Testing Checklist
- [ ] Host can create and start games
- [ ] Players can join via PIN and QR code
- [ ] All question types work (MC, Multiple correct, T/F, Numeric)
- [ ] LaTeX renders properly in questions and answers
- [ ] Mobile layout shows all buttons without scrolling
- [ ] Sound effects play appropriately
- [ ] Game completion animation and confetti work
- [ ] Timer stops when all players answer