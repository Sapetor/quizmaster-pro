# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commands

**Development:**
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon auto-restart

**Testing:**
No test framework is configured in this project.

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

## Server Management

### Server Restart Guidelines
- **Important**: Do not restart the server unless absolutely necessary
- Only restart when:
  - Deploying new code changes
  - Experiencing persistent memory leaks
  - Configuration files have been modified
  - Unexpected system-level issues occur

... [rest of the existing content remains unchanged]