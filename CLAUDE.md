# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Status & Recent Changes

**Phase 1 - Initial Cleanup Completed (2025-01):**
- ✅ **Removed testing bloat**: Eliminated 150KB+ of unnecessary testing infrastructure (12 files)
- ✅ **Simplified configuration**: Reduced config.js from 226 to 161 lines (29% smaller)
- ✅ **Dead code cleanup**: Removed 300+ lines of debug functions and obsolete code
- **Result**: 37% fewer JavaScript files, significantly cleaner and more maintainable codebase

**Phase 2 - Advanced Modularization Completed (2025-08):**
- ✅ **GameManager Modular Extraction**: Reduced from 1,983 → 1,686 lines (15.0% reduction)
  - ✅ Extracted QuestionRenderer module (476 lines) for question display logic
  - ✅ Fixed DOM structure preservation and event handling
  - ✅ Maintained full functionality with proper delegation
- ✅ **MathJax System Simplification**: Reduced from ~2,900 → ~200 lines (94% reduction)
  - ✅ Replaced over-engineered system with SimpleMathJaxService
  - ✅ Fixed main menu button failures and initialization issues
  - ✅ Bulletproof error handling prevents app breakage
- ✅ **Results Management System**: Complete implementation
  - ✅ Automatic results saving on game completion
  - ✅ CSV export functionality working correctly
  - ✅ Quiz title and timing capture integrated

**Phase 3 - Architecture & Security Hardening Completed (2025-08):**
- ✅ **Service Layer Architecture**: Professional service-oriented design
  - ✅ NavigationService for UI decoupling and centralized routing
  - ✅ DOMService with element caching for performance optimization
  - ✅ SecureStorageService with AES-GCM encryption for API keys
  - ✅ ErrorHandlingService with standardized patterns and retry logic
  - ✅ CORSValidationService with proper IP range validation
- ✅ **Security Enhancements**: Production-ready security measures
  - ✅ Encrypted API key storage using Web Crypto API
  - ✅ Robust CORS validation with regex patterns for local networks
  - ✅ Automatic migration from plaintext to encrypted storage
- ✅ **Error Handling Standardization**: Comprehensive error management
  - ✅ Categorized error types (network, validation, system, etc.)
  - ✅ Severity levels with appropriate user feedback
  - ✅ Automatic retry logic with exponential backoff
  - ✅ Error analytics and frequency monitoring
  - ✅ AI Generator content type detection fixes

**Phase 4 - Performance & Bundle Optimization Completed (2025-08):**
- ✅ **Immediate Cleanup**: High-impact, low-risk optimizations
  - ✅ Removed MathJax backup files directory (~76KB bundle reduction)
  - ✅ Eliminated additional backup files (mathjax-service.js.backup)
  - ✅ Verified clean codebase practices (proper logger usage, minimal console.log)
  - ✅ Confirmed no dead code in globals.js (all functions essential for HTML handlers)
- ✅ **Bundle Size Optimization**: ~79KB total reduction
  - ✅ Cleaned file structure with no orphaned backup files
  - ✅ Maintained 100% functionality with zero breaking changes
  - ✅ Application tested and verified working correctly

**Current Architecture:**
- **Modular ES6 structure** with proper imports/exports and focused responsibilities
- **Service-oriented architecture** with dedicated services for common operations
- **Centralized configuration** in `public/js/core/config.js`
- **Professional logging system** using structured logger instead of console statements
- **Standardized error handling** with categorized errors and automatic retry logic
- **Encrypted security layer** for sensitive data storage and network validation
- **Clean separation** between core functionality, display logic, and debugging code

## Commands

**Development:**
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon auto-restart

**Testing:**
- No formal test framework configured - functionality verified manually
- Debug/test functions have been removed to keep codebase clean

**Building:**
- `npm run build` - Process CSS with autoprefixer and minification for production
- `npm run build:css` - Process CSS files with browser compatibility prefixes
- `npm run build:css:watch` - Watch CSS files and rebuild automatically
- `node build-css.js` - Alternative CSS build script with detailed output

**CSS Processing:**
- Uses PostCSS with Autoprefixer for broader browser compatibility
- Supports IE11+ and modern browsers for LAN environments
- Creates both development (prefixed) and production (minified) versions
- Configuration in `postcss.config.js` and `.browserslistrc`

**Debugging:**
- Development/production logging controlled via `DEBUG.ENABLED` and `DEBUG.CURRENT_LEVEL` in `/public/js/core/config.js`
- Use `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()` instead of console statements
- Set `DEBUG.ENABLED = false` for production builds to remove all debug output
- Adjust `DEBUG.CURRENT_LEVEL` to filter log verbosity (1=errors only, 4=all logs)
- **IMPORTANT**: Always use logger for new debugging code, never raw console statements

## Critical Refactoring Guidelines

### ⚠️ Function Dependencies - CRITICAL
When removing code during cleanup:
1. **Always check imports/exports** before deleting functions
2. **Search entire codebase** for function usage: `grep -r "functionName" public/js/`
3. **Test immediately** after major removals to catch missing exports
4. **Common functions to verify**: `createQuestionElement`, `addQuestion`, etc.

### Module Import/Export Patterns
- **Core utilities** in `/utils/` are imported by multiple modules
- **Always verify exports** match imports when modifying utility files
- **Use proper ES6 exports**: `export function functionName()` not `window.functionName =`

### DOM Structure Preservation
- **CRITICAL**: Never clear parent container innerHTML that contains required child elements
- **Example**: `host-multiple-choice` contains `answer-options` - clearing innerHTML destroys the structure
- **Always check HTML hierarchy** before DOM manipulation

## Server Management

### Server Restart Guidelines
- **Important**: Do not restart the server unless absolutely necessary
- Only restart when:
  - Deploying new code changes
  - Experiencing persistent memory leaks
  - Configuration files have been modified
  - Unexpected system-level issues occur

### Development Workflow
- Server runs on port 3000 by default
- **No hot reload** - refresh browser after JavaScript changes
- **CSS changes** may require browser cache clear (Ctrl+F5)
- **WSL/Windows**: Server can run in either WSL or Windows, ensure proper networking

## Architecture Overview

### Core Modules (Current State)
- `public/js/game/game-manager.js` (1,686 lines) - Main game logic and state management **[15% reduced]**
- `public/js/game/modules/question-renderer.js` (476 lines) - **[NEW]** Question display and rendering logic
- `public/js/ui/preview-manager.js` (747 lines) - Quiz preview and split-view **[58% reduced via previous extraction]**
- `public/js/quiz/quiz-manager.js` (1,400+ lines) - Quiz creation, editing, save/load
- `public/js/core/app.js` (1,100+ lines) - Application initialization and coordination

### Key Utilities & Services
- `public/js/core/config.js` - Centralized configuration constants
- `public/js/utils/question-utils.js` - Question creation and manipulation utilities
- `public/js/utils/translation-manager.js` - Multi-language support
- `public/js/utils/simple-mathjax-service.js` - Simplified LaTeX/mathematical equation rendering
- `public/js/utils/simple-results-downloader.js` - Results management and CSV export

### Service Layer (Phase 3)
- `public/js/services/navigation-service.js` - **[NEW]** Centralized UI navigation and routing
- `public/js/services/dom-service.js` - **[NEW]** DOM manipulation with element caching
- `public/js/services/secure-storage-service.js` - **[NEW]** AES-GCM encrypted localStorage
- `public/js/services/error-handling-service.js` - **[NEW]** Standardized error patterns with retry logic
- `services/cors-validation-service.js` - **[NEW]** Server-side CORS validation with IP range support

### Recent Modularization (Phase 2)
- **GameManager Modules**:
  - `public/js/game/modules/question-renderer.js` - Question content rendering and DOM manipulation
  - `public/js/game/modules/game-display-manager.js` - Display coordination and MathJax integration
  - `public/js/game/modules/game-state-manager.js` - Game state management
  - `public/js/game/modules/player-interaction-manager.js` - Player interaction handling
  - `public/js/game/modules/timer-manager.js` - Timer functionality
- **MathJax Simplification**:
  - Removed over-engineered recovery mechanisms and complex coordinators
  - Implemented bulletproof error handling with non-blocking operations
  - Fixed main menu button failures and initialization issues

## Security Notes

- Application designed for **local network use only**
- **No authentication system** - suitable for classroom/educational use
- **CORS configured** for local network access patterns with robust IP range validation
- **API keys encrypted** using AES-GCM encryption via Web Crypto API ✅
- **File uploads** restricted to images with size limits
- **Automatic security migration** from plaintext to encrypted storage

## Current Technical Debt

### High Priority (Performance Impact) - **COMPLETED** ✅
- ✅ ~~Large module files need refactoring~~ **[GameManager and PreviewManager significantly reduced]**
- ✅ ~~MathJax service has over-engineered recovery mechanisms~~ **[Simplified to 200 lines]**
- ✅ ~~Tight coupling between UI and game logic modules~~ **[NavigationService and DOMService implemented]**

### Medium Priority (Maintainability) - **COMPLETED** ✅
- ✅ ~~API key storage should be encrypted~~ **[AES-GCM encryption implemented]**
- ✅ ~~CORS validation could be more robust~~ **[Proper IP range validation implemented]**
- ✅ ~~Legacy jQuery-style DOM manipulation patterns~~ **[DOMService with modern patterns]**
- ✅ ~~Standardize error handling patterns~~ **[ErrorHandlingService with retry logic]**

### Low Priority (Polish) - **COMPLETED** ✅
- ✅ ~~Reduce configuration complexity further~~ **[MathJax config simplified]**
- ✅ ~~Optimize bundle size for production~~ **[79KB reduction from backup file cleanup]**

### Future Performance Optimization Candidates (Optional)
**Priority: Low - Codebase is highly manageable as-is**

**Phase 5A - QuizManager Modularization (Medium Impact, Medium Risk)**
- **Quiz Validation Module** - Extract question validation logic (~200-300 lines)
- **Import/Export Module** - Separate file operations (JSON import/export, ~150-200 lines)  
- **Auto-Save Module** - Isolate localStorage and auto-save functionality (~100-150 lines)
- **Translation Cleaning Module** - Extract translation key cleanup logic (~100-150 lines)
- **Result**: quiz-manager.js reduced from 1,601 → ~800-900 lines

**Phase 5B - AI Generator Optimization (Medium Impact, Low Risk)**
- **Provider Classes** - Separate Ollama, OpenAI, Claude implementations
- **Event Handler Optimization** - Reduce memory footprint of event listeners
- **Prompt Builder Modularization** - Extract prompt logic by content type
- **Result**: ai/generator.js reduced from 1,176 → ~600-800 lines

**Phase 5C - App.js Lazy Loading (Low Impact, Medium Risk)**
- **Lazy Manager Loading** - Load managers only when needed for faster startup
- **Initialization Sequence Optimization** - Reduce startup time
- **Event Listener Batching** - More efficient DOM manipulation
- **Result**: Faster initial page load, reduced memory usage

**Expected Total Impact (All Optional Phases):**
- ~180KB additional bundle size reduction (20% of current total)
- Faster initial page load through lazy loading
- Improved code maintainability with better separation of concerns
- Enhanced development velocity with smaller, focused modules

## Development Best Practices

### Code Quality
- **Use ES6 modules** with proper imports/exports
- **Prefer logger over console** for all debugging output
- **Keep functions focused** on single responsibilities
- **Document complex algorithms** and business logic
- **Preserve DOM structure** - avoid clearing innerHTML of containers with required children

### File Organization
- **Core modules** in `/core/` for app initialization
- **Feature modules** in `/game/`, `/quiz/`, `/ui/` directories
- **Modular extractions** in `/modules/` subdirectories for focused functionality
- **Utilities** in `/utils/` for shared functionality
- **Keep modules under 500 lines** when possible (refactor larger files)

### Error Prevention & Handling
- **Use ErrorHandlingService** for all async operations and error management
- **Test imports** after refactoring utility files
- **Verify server startup** after major changes
- **Check browser console** for JavaScript errors
- **Leverage error categories** (network, validation, system, user input) for appropriate handling
- **Use retry logic** for network operations and transient failures
- **Test DOM element references** after structural changes

## Results Management

### Game Results System
- **Automatic saving**: Results are saved to server on game completion via `/api/save-results`
- **Data captured**: Quiz title, game PIN, player results, start/end times
- **Storage location**: `results/` directory with JSON files
- **Export functionality**: CSV download via `/api/results/{filename}/export/csv`
- **Management UI**: Download tool appears on leaderboard screen after game completion

### API Endpoints
- `GET /api/results` - List all saved game results
- `POST /api/save-results` - Save new game results
- `GET /api/results/{filename}/export/csv` - Export specific results as CSV

---

*Last updated: August 2025 - Post Phase 4 performance optimization and bundle size reduction*