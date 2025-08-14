# QuizMaster Pro - Essential Commands

## Development Commands

### Start Server
```bash
npm start          # Production server
npm run dev        # Development server with auto-restart via nodemon
```

### Package Management
```bash
npm install        # Install dependencies
```

### Port Configuration
```bash
PORT=8080 npm start    # Start on custom port
```

## Testing & Quality
- **No test framework configured** - static files served directly
- **No build process required** - static files served directly
- **No linting configuration** - ESLint is available as dev dependency but not configured

## Git Commands
```bash
# Standard workflow (development on modular-architecture branch)
git add .
git commit -m "message"
git push origin modular-architecture

# Branch switching
git checkout main                    # Original stable version
git checkout modular-architecture    # Current development branch
```

## System Commands (Linux)
```bash
# Process management
lsof -ti:3000                       # Check what's using port 3000
kill <pid>                          # Kill process by PID

# File operations
ls -la                              # List files with details
grep -r "pattern" .                 # Search for pattern recursively
find . -name "*.js"                 # Find JavaScript files
```

## Debugging
- Development/production logging controlled via `DEBUG.ENABLED` and `DEBUG.CURRENT_LEVEL` in `/public/js/core/config.js`
- Use `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()` instead of console statements
- Set `DEBUG.ENABLED = false` for production builds

## Network Access
- Local: `http://localhost:3000`
- Network: `http://[YOUR_LOCAL_IP]:3000`
- Server binds to `0.0.0.0:3000` by default for network access