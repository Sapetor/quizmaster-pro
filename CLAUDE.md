# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Status & Recent Changes

**Major Refactoring Completed (2025-01):**
- ✅ **Removed testing bloat**: Eliminated 150KB+ of unnecessary testing infrastructure (12 files)
- ✅ **Simplified configuration**: Reduced config.js from 226 to 161 lines (29% smaller)
- ✅ **Dead code cleanup**: Removed 300+ lines of debug functions and obsolete code
- **Result**: 37% fewer JavaScript files, significantly cleaner and more maintainable codebase

**Current Architecture:**
- **Modular ES6 structure** with proper imports/exports
- **Centralized configuration** in `public/js/core/config.js`
- **Professional logging system** using structured logger instead of console statements
- **Clean separation** between core functionality and debugging code

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

## Architecture Overview

### Core Modules (Largest Files)
- `public/js/game/game-manager.js` (2,300+ lines) - Main game logic and state management
- `public/js/ui/preview-manager.js` (1,800+ lines) - Quiz preview and split-view functionality
- `public/js/quiz/quiz-manager.js` (1,400+ lines) - Quiz creation, editing, save/load
- `public/js/core/app.js` (1,100+ lines) - Application initialization and coordination

### Key Utilities
- `public/js/core/config.js` - Centralized configuration constants
- `public/js/utils/question-utils.js` - Question creation and manipulation utilities
- `public/js/utils/translation-manager.js` - Multi-language support
- `public/js/utils/mathjax-service.js` - LaTeX/mathematical equation rendering

### Recent Cleanup Areas
- **Removed**: Performance monitoring, testing dashboards, debug utilities
- **Simplified**: Timing constants, audio settings, animation configurations
- **Cleaned**: Debug comments, excessive logging, obsolete functions

## Security Notes

- Application designed for **local network use only**
- **No authentication system** - suitable for classroom/educational use
- **CORS configured** for local network access patterns
- **API keys stored** in localStorage (encrypted storage pending)
- **File uploads** restricted to images with size limits

## Known Technical Debt

### High Priority (Performance Impact)
- Large module files need refactoring into focused components
- MathJax service has over-engineered recovery mechanisms
- Some tight coupling between UI and game logic modules

### Medium Priority (Maintainability)
- API key storage should be encrypted
- CORS validation could be more robust
- Some legacy jQuery-style DOM manipulation patterns

### Low Priority (Polish)
- Reduce configuration complexity further
- Standardize error handling patterns
- Optimize bundle size for production

## Development Best Practices

### Code Quality
- **Use ES6 modules** with proper imports/exports
- **Prefer logger over console** for all debugging output
- **Keep functions focused** on single responsibilities
- **Document complex algorithms** and business logic

### File Organization
- **Core modules** in `/core/` for app initialization
- **Feature modules** in `/game/`, `/quiz/`, `/ui/` directories
- **Utilities** in `/utils/` for shared functionality
- **Keep modules under 500 lines** when possible (refactor larger files)

### Error Prevention
- **Test imports** after refactoring utility files
- **Verify server startup** after major changes
- **Check browser console** for JavaScript errors
- **Use proper error boundaries** for graceful degradation

---

*Last updated: January 2025 - Post major cleanup and refactoring*