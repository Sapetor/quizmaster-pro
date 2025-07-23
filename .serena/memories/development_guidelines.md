# QuizMaster Pro - Development Guidelines

## Common Issues & Solutions

### LaTeX Rendering
- Use 100-150ms timeouts after content updates for proper MathJax rendering
- Always use `waitForMathJaxReady()` instead of hardcoded timeouts
- Never clear MathJax elements aggressively - use conservative Windows-specific clearing only
- Use centralized MathJax service for consistency

### Translation Problems
- Verify all dynamic text uses `getTranslation()` and `data-translate` attributes
- Ensure `updateGameTranslations()` is called on language changes
- All user-visible text must use the translation system

### Module Loading
- Ensure ES6 imports/exports are properly resolved
- Make sure globals.js loads correctly
- Use absolute paths from project root

### Game State Management
- Use Game class methods consistently for state changes
- Maintain proper cleanup of timers and event listeners
- Handle race conditions in game progression

## Performance Best Practices

### DOM Operations
```javascript
// ❌ Avoid: Repeated DOM queries
document.getElementById('element').style.display = 'block';
document.getElementById('element').innerHTML = content;

// ✅ Correct: Cache DOM references
const element = domManager.get('element');
element.style.display = 'block';
element.innerHTML = content;
```

### MathJax Performance
```javascript
// ❌ Avoid: Multiple individual render calls
elements.forEach(el => MathJax.typesetPromise([el]));

// ✅ Correct: Batch rendering
await mathJaxService.renderElements(elements);
```

### Memory Management
```javascript
// ✅ Correct: Cleanup timers and event listeners
const cleanup = () => {
    if (gameTimer) clearTimeout(gameTimer);
    if (leaderboardTimer) clearTimeout(leaderboardTimer);
    document.removeEventListener('click', outsideClickHandler);
};
```

## Common Development Pitfalls

1. **Don't clear MathJax elements aggressively** - MathJax needs its internal elements
2. **Don't create AudioContext on page load** - Modern browsers require user gesture
3. **Don't render MathJax immediately after DOM changes** - Allow elements to be ready
4. **Don't duplicate event listeners** - Always remove before adding new ones
5. **Don't ignore screen transition timing** - UI elements need time to be fully visible

## Debugging Best Practices

### Logger System
```javascript
// ✅ Use logger system instead of console
logger.debug('Debug info');
logger.info('Info message');
logger.warn('Warning');
logger.error('Error occurred');

// Control via config.js
DEBUG.ENABLED = true/false;
DEBUG.CURRENT_LEVEL = 1-4; // 1=errors only, 4=all logs
```

### Error Handling
```javascript
// ✅ Use centralized error handler
import { ErrorHandler } from './utils/error-handler.js';
const errorHandler = new ErrorHandler();

try {
    await riskyOperation();
} catch (error) {
    errorHandler.log(error, { context: 'operation-name' }, 'error');
}
```

## Mobile & Responsive Design
- Focus on flexbox layouts and proper viewport management
- Test on multiple screen sizes
- Ensure touch targets are appropriately sized
- Verify keyboard accessibility

## CSS Best Practices
- Use CSS custom properties from `variables.css` for colors and design tokens
- Follow modular CSS architecture
- Ensure proper specificity with `.with-toolbar` class selectors
- Test both light and dark themes