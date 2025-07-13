# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commands

**Development:**
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon auto-restart

**Testing:**
No test framework is configured in this project.

**Building:**
No build process required - static files served directly.

**Debugging:**
- Development/production logging controlled via `DEBUG.ENABLED` and `DEBUG.CURRENT_LEVEL` in `/public/js/core/config.js`
- Use `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()` instead of console statements
- Set `DEBUG.ENABLED = false` for production builds to remove all debug output
- Adjust `DEBUG.CURRENT_LEVEL` to filter log verbosity (1=errors only, 4=all logs)
- **IMPORTANT**: Always use logger for new debugging code, never raw console statements

## Architecture

QuizMaster Pro is a real-time multiplayer quiz platform with a Node.js backend and modular ES6 JavaScript frontend.

### Backend Structure (server.js)
- **Express.js** web server serving static files from `public/`
- **Socket.IO** for real-time WebSocket communication between host and players
- **Game Management**: In-memory storage using Maps for games and players
- **Game Class**: Core game logic with timer management, race condition protection, and automatic cleanup
- **File Upload**: Multer middleware for image uploads to `public/uploads/`
- **Quiz Storage**: File-based storage in `quizzes/` directory as JSON files
- **Results Tracking**: Automatic saving of game results to `results/` directory

### Frontend Structure (Modular ES6)
- **Single Page Application**: All screens managed in `public/index.html`
- **Modular Architecture**: ES6 modules with proper separation of concerns
- **Real-time Communication**: Socket.IO client for bidirectional communication
- **LaTeX Support**: MathJax integration for mathematical equations
- **Modern UI**: Glass morphism design with Inter font family
- **Live Preview**: Real-time split-screen preview system for quiz editing
- **Internationalization**: Complete 9-language support system

### Module Structure
```
public/js/
├── core/
│   ├── app.js (460 lines) - Main QuizGame coordination class
│   └── config.js - Configuration constants
├── game/
│   └── game-manager.js (578 lines) - Game flow and state management
├── quiz/
│   └── quiz-manager.js (659 lines) - Quiz CRUD operations
├── socket/
│   └── socket-manager.js (428 lines) - Real-time communication
├── settings/
│   └── settings-manager.js (486 lines) - User preferences and themes
├── ui/
│   ├── ui-manager.js (163 lines) - Screen and UI management
│   └── preview-manager.js - Live preview functionality
├── utils/
│   ├── translations.js - 9-language translation system (EN/ES/FR/DE/IT/PT/PL/JA/ZH)
│   ├── globals.js - Global functions for HTML handlers
│   ├── math-renderer.js - MathJax rendering
│   └── question-utils.js - Question creation and validation
├── ai/
│   └── generator.js - AI question generation (Ollama, OpenAI, Claude)
├── audio/
│   └── sound-manager.js - Web Audio API management
└── main.js - Application entry point
```

### CSS Architecture (Modular System)
```
public/css/
├── main.css - Master import file that loads all modules
├── base.css - CSS variables, reset, typography (Inter font)
├── layout.css - Grid systems, containers, host layouts
├── components.css - Buttons, inputs, cards, form elements
├── modals.css - Modal dialog systems and overlays
├── game.css - Game screens, lobby, leaderboard styling
├── preview.css - Live preview system and split-screen layout
├── toolbar.css - Left toolbar navigation and controls
├── responsive.css - Media queries and mobile optimizations
└── animations.css - Keyframes, transitions, motion effects
```

**Benefits of Modular CSS**:
- **22% Size Reduction**: From 4,733 lines to ~3,700 lines total
- **Maintainability**: Each module has focused responsibility
- **Performance**: Faster loading and better browser caching
- **Development**: Easier to locate and modify specific styling
- **Organization**: Clear separation between layout, components, and features

### Key Features
- **Question Types**: Multiple choice, multiple correct, true/false, numeric input
- **AI Generation**: Ollama (local), OpenAI, Claude API integration
- **Internationalization**: Full 9-language support with real-time switching
- **Real-time Features**: QR code sharing, live scoring, sound effects
- **Data Persistence**: Quiz/results storage with JSON files
- **Live Preview**: Split-screen real-time preview system for quiz editing

## Internationalization System

### 9-Language Support
- **Languages**: English, Spanish, French, German, Italian, Portuguese, Polish, Japanese, Chinese
- **Real-time Switching**: Users can change language during any part of the application
- **Coverage**: Complete UI translation including editor, preview, game screens, error messages
- **Flag Selector**: Visual language selector with flag emojis in header
- **Translation Keys**: 200+ semantic keys for consistent labeling

### Translation Architecture
- **File**: `public/js/utils/translations.js` - Central translation system
- **Usage**: All text uses `getTranslation()` function and `data-translate` attributes
- **Dynamic Content**: Question counters, game messages, AI generator all translate automatically
- **Parameter Support**: Translation strings support parameter substitution (e.g., "Question {0} of {1}")

## Development Notes

### Common Issues & Solutions
1. **LaTeX Rendering**: Use 100-150ms timeouts after content updates for proper MathJax rendering
2. **Translation Problems**: Verify all dynamic text uses `getTranslation()` and `data-translate` attributes
3. **Module Loading**: Ensure ES6 imports/exports are properly resolved and globals.js loads correctly
4. **Game State**: Use Game class methods consistently for state changes
5. **Mobile Layout**: Focus on flexbox layouts and proper viewport management

### Code Quality Guidelines
- **Modular Structure**: Keep modules focused on single responsibilities
- **Error Handling**: All async operations should have try-catch blocks
- **Translation Coverage**: All user-visible text must use the translation system
- **MathJax Integration**: Always call rendering methods after DOM updates

### Testing Checklist
- [ ] Host can create and start games
- [ ] Players can join via PIN and QR code
- [ ] All question types work (MC, Multiple correct, T/F, Numeric)
- [ ] LaTeX renders properly in questions and answers
- [ ] All 9 languages switch correctly and translate all interface elements
- [ ] Live preview updates in real-time during editing
- [ ] AI question generation works with local Ollama models
- [ ] Sound effects and animations work on game completion

## API Endpoints

- `POST /api/save-quiz` - Save quiz with validation
- `GET /api/quizzes` - List all saved quizzes with metadata
- `GET /api/quiz/:filename` - Load specific quiz by filename
- `POST /api/save-results` - Manual results saving (auto-save also implemented)
- `POST /upload` - Image upload with error handling
- `GET /api/qr/:pin` - Generate QR codes for game joining
- `POST /api/claude/generate` - Claude API proxy for AI question generation

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

## Network Configuration

Server binds to `0.0.0.0:3000` by default for local network access. Uses environment variable PORT for customization.