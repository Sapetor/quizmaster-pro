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
│   ├── app.js (900+ lines) - Main QuizGame coordination class
│   └── config.js - Configuration constants and logger system
├── game/
│   └── game-manager.js (1,300+ lines) - Game flow and state management
├── quiz/
│   └── quiz-manager.js (700+ lines) - Quiz CRUD operations
├── socket/
│   └── socket-manager.js (450+ lines) - Real-time communication
├── settings/
│   └── settings-manager.js (500+ lines) - User preferences and themes
├── ui/
│   ├── ui-manager.js (200+ lines) - Screen and UI management
│   └── preview-manager.js (900+ lines) - Live preview functionality
├── utils/
│   ├── translations.js (2,000+ lines) - 9-language translation system (EN/ES/FR/DE/IT/PT/PL/JA/ZH)
│   ├── globals.js - Global functions for HTML handlers
│   ├── math-renderer.js - MathJax rendering with retry mechanisms
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
├── variables.css - CSS custom properties and design system (214 lines)
├── base.css - CSS reset, typography (Inter font) (284 lines)
├── layout.css - Grid systems, containers, host layouts (500+ lines)
├── components.css - Buttons, inputs, cards, form elements (1,400+ lines)
├── modals.css - Modal dialog systems and overlays (297 lines)
├── game.css - Game screens, lobby, leaderboard styling (1,600+ lines)
├── preview.css - Live preview system and split-screen layout (1,463 lines)
├── toolbar.css - Left toolbar navigation and controls (180+ lines)
├── responsive.css - Media queries and mobile optimizations (349 lines)
└── animations.css - Keyframes, transitions, motion effects (384 lines)
```

**Total: 6,500+ lines** organized into focused modules with clean separation of concerns.

**Benefits of Modular CSS**:
- **Maintainability**: Each module has focused responsibility with clear boundaries
- **Design System**: CSS custom properties in `variables.css` ensure consistency
- **Performance**: Faster loading and better browser caching per module
- **Development**: Easy to locate and modify specific styling areas
- **Scalability**: New features can add focused CSS without affecting existing modules

### Key Features
- **Question Types**: Multiple choice, multiple correct, true/false, numeric input with consistent colorful styling
- **AI Generation**: Ollama (local), OpenAI, Claude API integration for automated question creation
- **Internationalization**: Complete 9-language support with real-time switching and dynamic translation
- **Real-time Features**: QR code sharing, live scoring, sound effects, live answer statistics
- **Data Persistence**: Quiz/results storage with JSON files and auto-save functionality
- **Live Preview**: Split-screen real-time preview system for quiz editing with MathJax support
- **Modern UI**: Glass morphism design with consistent colorful options across all question types
- **Responsive Design**: Mobile-optimized layouts and interactions with adaptive toolbar
- **Always-On Toolbar**: Persistent toolbar access for efficient quiz creation workflow

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
- **Real-time Updates**: `updateGameTranslations()` function ensures dynamic content updates with language changes

## Development Notes

### Common Issues & Solutions
1. **LaTeX Rendering**: Use 100-150ms timeouts after content updates for proper MathJax rendering
2. **Translation Problems**: Verify all dynamic text uses `getTranslation()` and `data-translate` attributes; ensure `updateGameTranslations()` is called on language changes
3. **Module Loading**: Ensure ES6 imports/exports are properly resolved and globals.js loads correctly
4. **Game State**: Use Game class methods consistently for state changes
5. **Mobile Layout**: Focus on flexbox layouts and proper viewport management
6. **CSS Specificity**: When modifying quiz-editor-section styling, ensure proper specificity with `.with-toolbar` class selectors

### Code Quality Guidelines
- **Modular Structure**: Keep modules focused on single responsibilities
- **Error Handling**: All async operations should have try-catch blocks
- **Translation Coverage**: All user-visible text must use the translation system
- **MathJax Integration**: Always call rendering methods after DOM updates
- **CSS Consistency**: Use CSS custom properties from `variables.css` for colors and design tokens

### Testing Checklist
- [ ] Host can create and start games
- [ ] Players can join via PIN and QR code
- [ ] All question types work with colorful options (MC, Multiple correct, T/F, Numeric)
- [ ] LaTeX renders properly in questions and answers
- [ ] All 9 languages switch correctly and translate all interface elements including dynamic counters
- [ ] Live preview updates in real-time during editing
- [ ] Live answer statistics display correctly during gameplay
- [ ] AI question generation works with local Ollama models
- [ ] Sound effects and animations work on game completion
- [ ] Mobile responsiveness works across all screens
- [ ] Toolbar provides consistent access to tools and maintains proper layout spacing

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
- **User**: Sapetor (sapetor@github.com)

### Branch Strategy
- **`main` branch**: Original monolithic version (stable, working baseline)
- **`modular-architecture` branch**: Complete modular refactor with CSS extraction
- **Current active branch**: `modular-architecture` (all new development)
- **Branch switching**: `git checkout main` or `git checkout modular-architecture`

### Git Workflow
- **Standard**: `git add . && git commit -m "message" && git push origin modular-architecture`
- **SSH**: SSH keys are configured, no need for HTTPS authentication
- **Pull Request**: Available at https://github.com/Sapetor/quizmaster-pro/pull/new/modular-architecture
- **Commits**: Use descriptive messages with bullet points for multiple changes

## Network Configuration

Server binds to `0.0.0.0:3000` by default for local network access. Uses environment variable PORT for customization.

## Design System

### Colorful Options System
QuizMaster Pro uses a consistent color system for quiz options across all question types:

- **Option A**: Blue (`#3b82f6` → `#2563eb`)
- **Option B**: Green (`#10b981` → `#059669`) 
- **Option C**: Orange (`#f59e0b` → `#d97706`)
- **Option D**: Red (`#ef4444` → `#dc2626`)
- **Option E**: Purple (`#8b5cf6` → `#7c3aed`)
- **Option F**: Cyan (`#06b6d4` → `#0891b2`)

**True/False Colors**:
- **True**: Green (same as Option B)
- **False**: Red (same as Option D)

All colors are defined as CSS custom properties in `variables.css` and used consistently across:
- Multiple choice options (host & client)
- Multiple correct options (host & client)
- True/false options (host & client)
- Live preview system
- Answer statistics display

### Code Quality Standards
- **Modular Structure**: Keep modules focused on single responsibilities
- **Error Handling**: All async operations should have try-catch blocks
- **Translation Coverage**: All user-visible text must use the translation system
- **MathJax Integration**: Always call rendering methods after DOM updates
- **CSS Consistency**: Use CSS custom properties from `variables.css` for colors and design tokens

## Recent Improvements (2024-2025)

### UI/UX Modernization ✅
- **Glass Morphism Design**: Implemented consistent glass morphism effects across all UI components
- **Colorful Options System**: Added consistent color-coding for all question types using CSS custom properties
- **Modern Animations**: Enhanced hover effects, transitions, and visual feedback
- **Mobile Optimization**: Improved responsive design for all screen sizes
- **Toolbar Optimization**: Simplified toolbar to always-visible state for consistent workflow

### CSS Architecture Optimization ✅
- **Modular Structure**: Successfully organized 6,500+ lines of CSS into focused modules
- **Design System**: Centralized color system using CSS custom properties
- **Performance**: Reduced redundancy while maintaining visual consistency
- **Maintainability**: Easier to modify colors and design tokens globally
- **Layout Fixes**: Resolved CSS specificity issues for proper toolbar/editor layout management

### Translation & Internationalization Enhancement ✅  
- **Dynamic Translation**: Fixed question counter translations to update immediately on language changes
- **Real-time Updates**: Enhanced `updateGameTranslations()` function for complete interface translation
- **Regex Pattern Matching**: Improved text extraction and rebuilding for dynamic content
- **Parameter Support**: Maintained translation parameter substitution across all languages

### Live Features Enhancement ✅  
- **Real-time Statistics**: Working live answer statistics with proper vertical alignment
- **Improved Feedback**: Better visual feedback for correct/incorrect answers
- **Consistent Styling**: Unified appearance across host and client interfaces
- **Answer System**: Fixed True/False color styling and Multiple Correct checkbox options

### Current State
- **Production Ready**: All core features optimized with modern UI and resolved layout issues
- **Code Health**: Excellent codebase health (8.2/10) with proper debugging configuration
- **Mobile Responsive**: Works seamlessly across desktop, tablet, and mobile devices
- **Internationalized**: Complete 9-language support with real-time dynamic translation
- **Performance Optimized**: Debug output properly suppressed for production use