# QuizMaster Pro - Code Style & Conventions

## JavaScript Conventions

### Module Structure
- **ES6 Modules**: Use import/export syntax throughout
- **Single Responsibility**: Each module focuses on one concern
- **Class-based Architecture**: Most modules export classes (e.g., `GameManager`, `QuizManager`)
- **Consistent Naming**: PascalCase for classes, camelCase for functions/variables

### Function Guidelines
- **Target Size**: Keep functions under 50 lines when possible
- **Refactor Trigger**: Functions over 100 lines should be evaluated for splitting
- **Method Extraction**: Extract logical groups into focused methods
- **Single Responsibility**: Each function should do one thing well

### Error Handling Patterns
```javascript
// ✅ Use centralized error handler
import { ErrorHandler } from './utils/error-handler.js';
const errorHandler = new ErrorHandler();

try {
    await someAsyncOperation();
} catch (error) {
    errorHandler.log(error, { context: 'operation-name' }, 'error');
}
```

### Translation Integration
```javascript
// ✅ Use translation system consistently
import { getTranslation } from './utils/translations.js';
const message = getTranslation('key', [param1, param2]);
```

### MathJax Integration
```javascript
// ✅ Use centralized MathJax service
import { MathJaxService } from './utils/mathjax-service.js';
const mathJaxService = new MathJaxService();
await mathJaxService.renderElement(element);
```

### DOM Management
```javascript
// ✅ Use DOM Manager for caching
import { DOMManager } from './utils/dom-manager.js';
const domManager = new DOMManager();
const element = domManager.get('element-id');
```

## CSS Conventions

### Modular Architecture
- **CSS Custom Properties**: Use variables from `variables.css` for colors/tokens
- **BEM-like Naming**: Descriptive class names with hyphens
- **Module Separation**: Each CSS file has focused responsibility
- **Design System**: Consistent color system across all components

### Color System
- **Option Colors**: Blue, Green, Orange, Red, Purple, Cyan (defined in variables.css)
- **True/False**: Green for True, Red for False
- **Theme Support**: Light and dark mode variants

## File Organization

### JavaScript Structure
```
public/js/
├── core/        # Main application logic
├── game/        # Game flow and state management
├── quiz/        # Quiz CRUD operations
├── socket/      # Real-time communication
├── settings/    # User preferences
├── ui/          # Screen and UI management
├── utils/       # Shared utilities and translations
├── ai/          # AI question generation
└── audio/       # Sound management
```

### CSS Structure
```
public/css/
├── main.css         # Master import file
├── variables.css    # Design system tokens
├── base.css         # Reset and typography
├── layout.css       # Grid systems
├── components.css   # Reusable components
├── modals.css       # Modal dialogs
├── game.css         # Game-specific styling
├── preview.css      # Live preview system
├── toolbar.css      # Navigation
├── responsive.css   # Media queries
└── animations.css   # Motion effects
```

## Quality Standards
- **Translation Coverage**: All user-visible text must use translation system
- **MathJax Integration**: Always call rendering methods after DOM updates
- **Error Handling**: All async operations should have try-catch blocks
- **Memory Management**: Clean up event listeners and timers
- **Debug Logging**: Use logger system, never raw console statements