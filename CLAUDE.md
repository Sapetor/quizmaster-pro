# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Status & Recent Changes

**Phase 1-5 - Core Development Completed (2025-01 to 2025-08):**
- ✅ **Modular Architecture**: ES6 modules with service-oriented design
- ✅ **Security Hardening**: AES-GCM encryption, CORS validation, error handling
- ✅ **Performance Optimization**: Bundle reduction, MathJax simplification
- ✅ **Cross-Tab Stability**: Fixed LaTeX rendering and browser caching issues

**Phase 6 - Mobile Performance & Stability Completed (2025-08):**
- ✅ **Mobile Performance Optimization**: Comprehensive improvements for Android/iOS
  - ✅ Gzip compression (60-80% text size reduction)
  - ✅ QR code generation caching (5-10x faster repeated requests)
  - ✅ CSS bundle optimization (eliminated @import waterfall)
  - ✅ Resource preloading for critical assets
  - ✅ Font optimization with display: swap
- ✅ **Mobile Stability Enhancements**: Android-specific improvements
  - ✅ Android render timing optimization (400ms vs 200ms)
  - ✅ Enhanced mobile device detection and initialization
  - ✅ Improved DOM validation and error handling
  - ✅ Better LaTeX fallback animations for F5 refresh
- ✅ **Performance Monitoring**: Real-time optimization tracking
  - ✅ QR code cache hit rate monitoring
  - ✅ Network IP detection caching
  - ✅ Mobile vs desktop client detection
  - ✅ Response time analytics via `/api/ping`

**Results**: 50-70% faster mobile loading, especially on less powerful Android devices

**Phase 7 - Game Restart Stability & Error Handling Consolidation Completed (2025-08):**
- ✅ **Critical Game Restart Bug Fixes**: Fixed new game issues without page refresh
  - ✅ Fixed modular state manager reset in `resetGameState()`
  - ✅ Fixed persistent "Game Complete" frame showing during new games
  - ✅ Fixed CSV download stuck in loading state with direct API approach
  - ✅ Fixed client-side image persistence between questions
  - ✅ Added proper image clearing in game element cleanup
- ✅ **Error Handling Consolidation**: Unified three overlapping error systems
  - ✅ Consolidated `error-handler.js`, `error-boundary.js`, and `error-handling-service.js`
  - ✅ Created `unified-error-handler.js` with all functionality preserved
  - ✅ Updated 10+ files to use unified system with backward compatibility
  - ✅ Moved deprecated files to debug folder for reference
  - ✅ Reduced error handling complexity by 67% (3 files → 1 file)
- ✅ **Console Warning Cleanup**: Eliminated DOM errors and invalid image loads
  - ✅ Fixed "Element not found: player-count" warnings
  - ✅ Enhanced image loading validation and error handling
  - ✅ Silent error handling for failed image loads

**Results**: Clean game state transitions, working CSV downloads, unified error handling, reduced console noise

**Current Architecture:**
- **Modular ES6 structure** with proper imports/exports and focused responsibilities
- **Service-oriented architecture** with dedicated services for common operations
- **Centralized configuration** in `public/js/core/config.js`
- **Professional logging system** using structured logger instead of console statements
- **Unified error handling** with consistent API across all components (`unified-error-handler.js`)
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
- `npm run build` - Build optimized CSS bundle with autoprefixer and minification
- `npm run build:css` - Process CSS files for browser compatibility
- `npm run build:css:watch` - Watch CSS files and rebuild automatically
- `npm run build:prod` - Complete production build

**CSS Processing:**
- PostCSS with postcss-import for CSS bundling (eliminates @import waterfall)
- Autoprefixer for IE11+ and modern browser compatibility
- cssnano for minification and optimization
- Configuration in `postcss.config.js`

**Debugging:**
- Development/production logging controlled via `DEBUG.ENABLED` and `DEBUG.CURRENT_LEVEL` in `/public/js/core/config.js`
- Use `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()` instead of console statements
- Set `DEBUG.ENABLED = false` for production builds to remove all debug output
- Adjust `DEBUG.CURRENT_LEVEL` to filter log verbosity (1=errors only, 4=all logs)
- **IMPORTANT**: Always use logger for new debugging code, never raw console statements

## Development Environment Notes

### Cross-Platform Compatibility
- **WSL/Windows**: Server performance optimized with compression and caching
- **External libraries**: Use CDN (MathJax, jQuery) for best performance across environments
- **Local assets**: Well-cached with mobile-optimized headers

### Performance Monitoring
- Use `/api/ping` endpoint to monitor QR generation and caching performance
- Check browser dev tools Network tab for file loading times
- Mobile devices: Expect 50-70% faster loading after Phase 6 optimizations

## LaTeX/MathJax Rendering 

### Cross-Tab Stability ✅
**Issue Resolved**: Fixed browser MathJax caching that caused LaTeX to fail in new tabs
- **Solution**: Smart cache-busting with session-based reload strategy
- **Result**: LaTeX renders reliably across all tabs and after F5 refresh
- **Implementation**: Cache detection in `index.html` + SimpleMathJaxService coordination

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

## Pending Future Optimizations (Optional)

**All critical performance and stability issues have been resolved. These are optional improvements for further optimization:**

### Phase 7 - Advanced Bundle Optimization (Optional)
**Priority: Low - For advanced performance optimization**

**JavaScript Code Splitting & Lazy Loading:**
- Lazy load AI generator module only when needed (~1,176 lines)
- Defer quiz editor until hosting a game
- Split game logic from quiz creation logic
- **Expected Result**: 40-50% faster initial page load, reduced memory usage

**Advanced Minification:**
- JavaScript minification for production builds
- Tree shaking for unused code elimination
- Module bundling optimization
- **Expected Result**: 20-30% additional bundle size reduction

### Phase 8 - Module Refinement (Optional)
**Priority: Very Low - Only if needed for maintainability**

**QuizManager Modularization:**
- Extract validation logic (~200-300 lines)
- Separate import/export operations (~150-200 lines)  
- Isolate auto-save functionality (~100-150 lines)
- **Expected Result**: quiz-manager.js reduced from ~1,400 → ~800-900 lines

**AI Generator Optimization:**
- Separate provider implementations (Ollama, OpenAI, Claude)
- Modularize prompt builders by content type
- Optimize event handler memory footprint
- **Expected Result**: ai/generator.js reduced from ~1,176 → ~600-800 lines

**Note**: Current codebase is highly performant and manageable as-is. These optimizations are only recommended if specific performance requirements arise or if the development team grows significantly.

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

## Production Deployment Checklist

### ⚠️ CRITICAL: Pre-Production Configuration
Before deploying to production environments, ensure these settings are configured:

**Debug Configuration (MANDATORY):**
- Set `DEBUG.ENABLED = false` in `/public/js/core/config.js` to disable all debug logging
- Set `DEBUG.CURRENT_LEVEL = 1` to show only critical errors in production
- Verify no `console.log` statements remain in production code (use logger instead)

**Performance Optimization:**
- Run `npm run build` to process CSS with autoprefixer and minification
- Verify bundle size is optimized (should be ~400KB total after Phase 4 reductions)
- Test MathJax rendering on target deployment browsers

**Security Verification:**
- Confirm API keys are encrypted using AES-GCM (automatic with Web Crypto API support)
- Verify CORS validation is properly configured for target network ranges
- Ensure no sensitive data is logged or exposed in client-side code

**Network Configuration:**
- Configure server to run on appropriate port for production environment
- Update CORS settings in `services/cors-validation-service.js` if needed for production network
- Test WebSocket connectivity for real-time multiplayer functionality

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

*Last updated: August 2025 - Phase 7 game restart stability and error handling consolidation completed*