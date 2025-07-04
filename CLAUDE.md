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
- **Prominent Start Game Button**: Large, easily accessible "🚀 Start Game" button positioned at top of quiz builder for better UX
- **Real-Time Split-Screen Preview**: Live preview system allowing simultaneous editing and preview of questions

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
- **Confetti**: Multi-directional confetti burst using canvas-confetti library for ALL clients
- **Audio**: Victory melody with timed note sequences for both host and players
- **Visual Polish**: Enhanced final results styling with gradient backgrounds
- **Time-Based Scoring**: Points awarded based on answer speed with difficulty multipliers
- **Player Final Screen**: Dedicated ending screen with personal rank, score, and top players display

### Recent Critical Fixes (Latest Session)
- **True/False Preview Bug**: Comprehensive CSS fixes ensuring True/False buttons only appear for True/False questions in preview
- **Modal Display Issues**: Fixed modals to use `display: flex` instead of `display: block` for proper centering
- **AI Generation Parsing**: Enhanced `parseAIResponse()` to handle both JSON arrays and single objects from Ollama
- **Layout Centering**: Fixed main editing page to center properly and only move left when preview is active
- **UI Button Cleanup**: Removed duplicate Start Game buttons and organized interface properly
- **Settings Sidebar**: Moved from modal to left sidebar with proper positioning and animation
- **Toolbar Restrictions**: Scroll buttons now only work when live preview is active
- **Code Formatting**: Enhanced display of code blocks in questions with proper styling integration

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

### Real-Time Preview System (ENHANCED)
- **Split-Screen Design**: Editor (customizable ratio) and live preview with optimal width utilization
- **Real-Time Updates**: Debounced preview updates (300ms) as user types questions and answers
- **Simultaneous Editing**: No overlay blocking - edit and preview simultaneously
- **Navigation**: Previous/Next buttons to browse through questions while editing
- **Device Simulation**: Desktop/Mobile viewport toggle in preview
- **Game-Accurate Styling**: Preview matches actual player experience with proper button styling
- **LaTeX Support**: Live MathJax rendering in preview
- **Responsive Design**: Stacks vertically on screens < 1200px width
- **Toggle Control**: "📱 Toggle Live Preview" button with danger styling when active
- **Event Management**: Proper listener cleanup to prevent memory leaks
- **CSS Grid Layout**: Proper two-column layout with quiz-editor-section and quiz-preview-section as siblings
- **Styling Integration**: All preview elements styled with both modal and split-screen selectors
- **Customizable Layout**: Real-time slider controls for split ratio, font size, spacing, and button size
- **Left Toolbar**: Quick access desktop toolbar with add question, save, load, AI generator, preview toggle, and import
- **Preview Settings Sidebar**: Left-positioned settings panel with Start Game button and layout controls
- **Edit Navigation**: "✏️ Edit Question" button to scroll to current question in editor
- **Keyboard Shortcuts**: Support for toolbar actions and navigation when preview is active
- **True/False Bug Fixed**: Comprehensive fix ensuring True/False buttons only appear for True/False questions

### AI Question Generation System (NEW FEATURE)
- **Multiple Providers**: Support for Ollama (local, free), OpenAI, HuggingFace, and Claude APIs
- **Local AI Support**: Ollama integration for offline question generation with llama3.2:3b model
- **Content Type Detection**: Automatic detection of mathematics, programming, physics, chemistry content
- **Smart Prompting**: Content-aware prompt engineering with specialized formatting instructions
- **Question Type Flexibility**: Support for multiple choice, true/false, multiple correct, and numeric questions
- **Difficulty Levels**: Beginner, intermediate, advanced, and expert difficulty settings
- **Batch Generation**: Generate 1-10 questions at once with progress indicators
- **JSON Parsing**: Robust parsing handling both arrays and single objects from AI responses
- **Validation System**: Comprehensive validation of generated questions with error handling
- **Modal Interface**: User-friendly modal with provider selection, content input, and settings
- **API Key Management**: Secure localStorage for API keys with provider-specific handling
- **Error Recovery**: Detailed error messages and debugging for troubleshooting AI responses

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
5. **Preview Not Updating**: Check if `initializeSplitPreview()` is called and real-time listeners are properly set up
6. **Split-Screen Layout Issues**: Ensure `.host-container.split-screen` CSS grid is properly applied
7. **Preview Button States**: Verify danger/secondary class toggling in `togglePreviewMode()` function
8. **Preview Appearing in Wrong Column**: Ensure quiz-preview-section is a sibling of quiz-editor-section, not nested inside it
9. **Preview Styling Missing**: Verify CSS selectors include both `.preview-content` and `.preview-content-split` versions
10. **True/False Preview Bug**: If True/False buttons appear for non-True/False questions, check CSS specificity - use explicit hiding in render functions
11. **Modal Display Issues**: Modals should use `display: flex` not `display: block` for proper centering
12. **AI Generation "No questions generated"**: Usually parsing issue - check Ollama response format and `parseAIResponse()` function
13. **Toolbar Layout Issues**: Ensure proper centering when toolbar is visible using specific CSS selectors for `.with-toolbar` state
14. **Settings Sidebar Not Opening**: Check z-index conflicts and proper `display: block` with transform animation

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
- [ ] Real-time preview updates as questions are typed
- [ ] Split-screen preview toggle works correctly
- [ ] Preview navigation (Previous/Next) functions properly
- [ ] Device simulation (Desktop/Mobile) works in preview
- [ ] LaTeX renders correctly in live preview
- [ ] True/False buttons only appear for True/False questions in preview
- [ ] AI question generation works with Ollama (llama3.2:3b model)
- [ ] Preview settings sidebar opens from left side
- [ ] Left toolbar functions work only when preview is active
- [ ] Layout centers properly when preview is closed
- [ ] Modals display with proper centering (flex not block)
- [ ] Start Game button accessible in preview settings
- [ ] Split ratio slider changes layout in real-time
- [ ] Code formatting displays properly in questions