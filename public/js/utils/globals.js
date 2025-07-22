/**
 * Global Functions Module
 * Provides global functions that are called from HTML onclick handlers
 * 
 * EXTRACTION NOTES:
 * - Functions needed by HTML onclick/onchange handlers
 * - Made globally accessible via window object
 * - Dependencies: Imports from other modules as needed
 */

import { translationManager } from './translation-manager.js';
import { logger, LIMITS, TIMING } from '../core/config.js';

// Global functions that need to be accessible from HTML

// Language dropdown functions
export function toggleLanguageDropdown() {
    const dropdown = document.getElementById('language-selector');
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

export async function selectLanguage(langCode, event) {
    event.stopPropagation();
    
    logger.debug(`🌐 Switching language to: ${langCode}`);
    
    // Close dropdown
    const dropdown = document.getElementById('language-selector');
    if (dropdown) {
        dropdown.classList.remove('open');
    }
    
    // Update selected language display
    const selectedFlag = dropdown.querySelector('.language-dropdown-selected .language-flag');
    const selectedName = dropdown.querySelector('.language-dropdown-selected .language-name');
    const selectedOption = dropdown.querySelector(`[data-value="${langCode}"]`);
    
    if (selectedFlag && selectedName && selectedOption) {
        selectedFlag.textContent = selectedOption.querySelector('.language-flag').textContent;
        selectedName.textContent = selectedOption.querySelector('.language-name').textContent;
        selectedName.setAttribute('data-translate', selectedOption.querySelector('.language-name').getAttribute('data-translate'));
    }
    
    // Update selected state
    dropdown.querySelectorAll('.language-option').forEach(option => {
        option.classList.remove('selected');
    });
    selectedOption.classList.add('selected');
    
    try {
        // Use the setLanguage method which handles change + UI update
        const success = await translationManager.setLanguage(langCode);
        
        if (success) {
            logger.debug(`✅ Language changed successfully to: ${langCode}`);
            logger.debug(`🔄 UI updated for language: ${langCode}`);
        } else {
            logger.error(`❌ Failed to change language to: ${langCode}`);
        }
    } catch (error) {
        logger.error(`❌ Error changing language to ${langCode}:`, error);
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('language-selector');
    if (dropdown && !dropdown.contains(event.target)) {
        dropdown.classList.remove('open');
    }
});

export function togglePreviewMode() {
    logger.debug('Preview mode toggle function called');
    if (window.game && window.game.togglePreviewMode) {
        window.game.togglePreviewMode();
    } else {
        logger.debug('Preview mode not implemented in modular version yet');
    }
}

export function openAIGeneratorModal() {
    logger.debug('AI Generator modal function called');
    if (window.game && window.game.aiGenerator && window.game.aiGenerator.openModal) {
        window.game.aiGenerator.openModal();
    } else {
        // Fallback: try to open modal directly
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            logger.debug('AI Generator modal not found');
        }
    }
}

export function toggleToolbar() {
    logger.debug('Toolbar toggle function called');
    // Implementation for toolbar toggle
    const toolbar = document.getElementById('left-toolbar');
    if (toolbar) {
        const isVisible = toolbar.style.display !== 'none';
        toolbar.style.display = isVisible ? 'none' : 'block';
    }
}

export function toggleGlobalTime() {
    logger.debug('Global time toggle function called');
    const globalTimeContainer = document.getElementById('global-time-container');
    const useGlobalTime = document.getElementById('use-global-time');
    
    if (globalTimeContainer && useGlobalTime) {
        globalTimeContainer.style.display = useGlobalTime.checked ? 'block' : 'none';
        logger.debug('Global time container display set to:', useGlobalTime.checked ? 'block' : 'none');
        
        // Update individual question time inputs based on global setting
        const questionTimeInputs = document.querySelectorAll('.question-time-limit');
        questionTimeInputs.forEach(input => {
            const container = input.closest('.time-limit-container');
            if (container) {
                container.style.display = useGlobalTime.checked ? 'none' : 'block';
            }
        });
    } else {
        logger.debug('Global time elements not found:', {
            container: !!globalTimeContainer,
            checkbox: !!useGlobalTime
        });
    }
}

export function updateQuestionType(selectElement) {
    logger.debug('Question type update function called');
    if (window.game && window.game.updateQuestionType) {
        window.game.updateQuestionType(selectElement);
    } else {
        // Basic implementation for question type switching
        const questionItem = selectElement.closest('.question-item');
        if (!questionItem) return;

        const questionType = selectElement.value;
        const allOptions = questionItem.querySelectorAll('.answer-options');
        
        // Hide all option types
        allOptions.forEach(opt => opt.style.display = 'none');
        
        // Show the selected type
        const targetOptions = questionItem.querySelector(`.${questionType}-options`);
        if (targetOptions) {
            targetOptions.style.display = 'block';
        }
    }
}

export function updateTimeLimit(inputElement) {
    logger.debug('Time limit update function called');
    // Implementation for time limit updates
    const value = parseInt(inputElement.value);
    if (value < LIMITS.MIN_TIME_LIMIT) inputElement.value = LIMITS.MIN_TIME_LIMIT;
    if (value > LIMITS.MAX_TIME_LIMIT) inputElement.value = LIMITS.MAX_TIME_LIMIT;
}

export function uploadImage(inputElement) {
    logger.debug('Image upload function called');
    if (window.game && window.game.uploadImage) {
        window.game.uploadImage(inputElement);
    } else {
        logger.debug('Image upload not implemented in modular version yet');
    }
}

export function removeImage(buttonElement) {
    logger.debug('Remove image function called');
    const imagePreview = buttonElement.closest('.image-preview');
    if (imagePreview) {
        imagePreview.style.display = 'none';
        const img = imagePreview.querySelector('.question-image');
        if (img) {
            img.src = '';
            img.dataset.url = '';
        }
    }
}

export function scrollToCurrentQuestion() {
    logger.debug('Scroll to current question function called');
    if (window.game && window.game.previewManager && window.game.previewManager.scrollToCurrentQuestion) {
        window.game.previewManager.scrollToCurrentQuestion();
    } else {
        // Fallback implementation
        const questions = document.querySelectorAll('.question-item');
        if (questions.length > 0) {
            const targetQuestion = questions[0]; // Default to first question
            targetQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

export function scrollToTop() {
    logger.debug('⬆️ Scroll to top function called');
    
    // First try to scroll the editor container itself
    const quizEditor = document.querySelector('.quiz-editor-section');
    if (quizEditor) {
        logger.debug('Scrolling editor section to top, current scrollTop:', quizEditor.scrollTop);
        quizEditor.scrollTo({ top: 0, behavior: 'smooth' });
        logger.debug('Editor scroll command sent');
    } else {
        logger.debug('Editor section not found, using window scroll');
        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Also try scrolling any parent containers
    const hostContainer = document.querySelector('.host-container');
    if (hostContainer) {
        hostContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export function togglePreviewSettings() {
    logger.debug('🔧 Toggle preview settings called');
    const panel = document.getElementById('preview-settings-panel');
    const button = document.getElementById('preview-settings-btn');
    
    logger.debug('Elements found:', {
        panel: !!panel,
        button: !!button,
        panelDisplay: panel ? panel.style.display : 'N/A'
    });
    
    if (panel) {
        const isVisible = panel.style.display === 'block';
        logger.debug('Settings panel current display:', panel.style.display, 'isVisible:', isVisible);
        panel.style.display = isVisible ? 'none' : 'block';
        logger.debug('Settings panel new display:', panel.style.display);
        
        // Update button state
        if (button) {
            button.style.backgroundColor = isVisible ? '' : 'var(--color-primary)';
        }
    } else {
        logger.error('❌ Preview settings panel not found');
        // Try to find all elements with similar IDs
        const allElements = document.querySelectorAll('[id*="preview"], [id*="settings"]');
        logger.debug('Available elements:', Array.from(allElements).map(el => el.id));
    }
}


// Global font size control - much simpler!
let currentFontScale = 'medium';

export function toggleGlobalFontSize() {
    const scales = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = scales.indexOf(currentFontScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    currentFontScale = scales[nextIndex];
    
    setGlobalFontSize(currentFontScale);
}

export function setGlobalFontSize(scale) {
    logger.debug('Setting global font size:', scale);
    
    // Define scale multipliers - increased range with much bigger game text
    const scaleValues = {
        small: 0.9,
        medium: 1.0,
        large: 1.3,
        xlarge: 1.6
    };
    
    const scaleValue = scaleValues[scale] || 1.0;
    
    // Update CSS custom property for global scaling
    document.documentElement.style.setProperty('--global-font-scale', scaleValue);
    
    // Force immediate update on visible elements
    const elementsToUpdate = [
        // Header elements
        'header h1',
        '.language-name',
        '.language-option',
        
        // Editor elements
        '.quiz-editor-section input',
        '.quiz-editor-section textarea', 
        '.question-text',
        '.option',
        '#quiz-title',
        
        // Main Menu elements
        '.menu-options .btn',
        '#host-btn',
        '#join-btn',
        
        // Join Screen elements
        '.join-container h2',
        '.browser-container h2',
        '.input-field',
        '#game-pin-input',
        '#player-name',
        '#join-game',
        '#browse-games',
        '#refresh-games',
        '#back-to-join',
        '.join-divider span',
        '.loading-games',
        
        // Game Lobby (Host) elements
        '.lobby-container h2',
        '.lobby-container h3',
        '.pin-display',
        '#game-pin',
        '#start-game',
        '.large-start-btn',
        '.qr-section h3',
        '.qr-loading',
        '#game-url',
        '.game-url',
        
        // Player Lobby elements
        '.player-lobby-container h2',
        '#player-info',
        '.lobby-detail-label',
        '.lobby-detail-value',
        '.lobby-status',
        '.lobby-status span',
        
        // Games Grid elements
        '.games-grid .game-card',
        '.games-grid .game-item',
        '.games-grid .game-title',
        '.games-grid .game-info',
        '.game-card .game-title',
        '.game-card .game-info',
        '.game-card .game-detail',
        '.game-detail',
        '.game-card .game-detail-icon',
        '.game-detail-icon',
        '.game-card .game-players-count',
        '.game-players-count',
        '.game-card .game-status',
        '.game-status',
        '.game-card .game-pin-display',
        '.game-pin-display',
        
        // Toolbar elements
        '.toolbar-section h5',
        '.toolbar-icon',
        '.toolbar-label',
        
        // Quiz Action Buttons (Bottom of Editor)
        '.quiz-actions .btn',
        '#add-question',
        '#save-quiz',
        '#load-quiz',
        '#import-quiz',
        '#preview-quiz',
        '#start-hosting',
        
        // Editor Control Buttons
        '#toggle-preview',
        '#ai-generator-btn', 
        '#toggle-toolbar',
        
        // Header Controls
        '#fullscreen-toggle',
        '#theme-toggle',
        '#font-size-toggle',
        
        // Toolbar Buttons
        '.toolbar-btn',
        
        // Modal and Dialog Elements
        '.modal-content h3',
        '.modal-content h4', 
        '.modal-header h3',
        '.modal-body p',
        '.modal-body label',
        '.load-quiz-modal h3',
        '.preview-quiz-modal h3',
        '.api-key-section small',
        '.content-type-indicator',
        '.file-upload-section small',
        '.generation-status span',
        
        // AI Generator Modal
        '.ai-section label',
        '.ai-section select', 
        '.ai-section input',
        '.ai-section textarea',
        '#ai-model-select',
        '#ai-topic',
        '#ai-difficulty',
        '#ai-num-questions',
        '#generation-progress',
        '.generation-log',
        
        // Large Display Elements
        '.game-pin',
        '.pin-display',
        '.final-position',
        
        // Small Component Elements
        '.btn.small',
        '.language-flag',
        '.time-input-label',
        '.game-title',
        '.game-info',
        
        // Responsive Mobile Elements
        '.device-btn',
        '.option-label',
        '.option-count',
        '.option-percentage',
        
        // Base Typography
        'code',
        'pre',
        '.code',
        'small',
        '.small-text',
        
        // Messages and Notifications
        '.error-message',
        '.success-message',
        '.warning-message',
        '.info-message',
        '.toast-message',
        '.alert-message',
        '.notification',
        '.loading-text',
        '.progress-text',
        '.status-text',
        
        // Form Elements
        '.form-group label',
        '.form-control',
        'select',
        'option',
        'input[type="text"]',
        'input[type="number"]',
        'input[type="email"]',
        'input[type="password"]',
        'textarea',
        
        // Back to Top Button
        '.back-to-top-btn',
        '#back-to-top',
        
        // Game elements  
        '#current-question',
        '#player-question-text',
        '#question-counter',
        '#player-question-counter',
        '.player-option',
        '.tf-option',
        '.checkbox-option',
        '#timer',
        
        // Preview elements
        '#preview-question-text',
        '#preview-question-text-split',
        '#preview-numeric-input',
        '#preview-numeric-input-split',
        
        // Host and Client specific elements
        '.answer-stats h3',
        '.option-label',
        '.answer-option-label',
        '.answer-feedback-text',
        '.screen-title',
        '.submit-button',
        '.game-button',
        '.option-display',
        
        // Leaderboard and Results
        '.leaderboard-container h2',
        '.player-final-container h2',
        '.final-results h3',
        '.player-rank h3',
        '.final-score',
        '.top-players h3',
        '.result-text',
        '#feedback-message',
        '#score-display'
    ];
    
    elementsToUpdate.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            // Force recalculation by briefly removing and re-adding the style
            const currentFontSize = window.getComputedStyle(element).fontSize;
            element.style.fontSize = `calc(${currentFontSize} * ${scaleValue} / var(--global-font-scale, 1))`;
            
            // Small delay to ensure the change takes effect
            setTimeout(() => {
                element.style.fontSize = `calc(1rem * ${scaleValue})`;
            }, 10);
        });
    });
    
    // Update the icon in the header
    const fontIcon = document.getElementById('font-size-icon');
    if (fontIcon) {
        const icons = {
            small: 'A⁻',
            medium: 'A', 
            large: 'A⁺',
            xlarge: 'A⁺⁺'
        };
        fontIcon.textContent = icons[scale] || 'A';
    }
    
    // Force toolbar container adjustments
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    toolbarButtons.forEach(button => {
        // Adjust container dimensions to accommodate scaled text
        button.style.height = `calc(48px * ${scaleValue})`;
        button.style.width = `calc(65px * ${scaleValue})`;
        button.style.padding = `calc(6px * ${scaleValue}) calc(4px * ${scaleValue})`;
    });
    
    // Force toolbar width adjustment
    const toolbar = document.querySelector('.left-toolbar');
    if (toolbar) {
        toolbar.style.width = `calc(85px * ${scaleValue})`;
    }
    
    // Force host container margin adjustment
    const hostContainer = document.querySelector('.host-container.with-toolbar');
    if (hostContainer) {
        hostContainer.style.marginLeft = `calc(85px * ${scaleValue})`;
        hostContainer.style.maxWidth = `calc(100vw - 85px * ${scaleValue})`;
    }
    
    // Force placeholder text scaling
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        // Update placeholder font size by temporarily clearing and resetting
        if (input.placeholder) {
            const placeholder = input.placeholder;
            input.placeholder = '';
            setTimeout(() => {
                input.placeholder = placeholder;
            }, 10);
        }
    });
    
    // Save preference
    localStorage.setItem('globalFontSize', scale);
    currentFontScale = scale;
    
    // Debug logging
    logger.debug('Global font size updated:', { 
        scale, 
        scaleValue, 
        elementsFound: elementsToUpdate.map(sel => ({
            selector: sel,
            count: document.querySelectorAll(sel).length
        }))
    });
    
    logger.debug('Global font size updated', { scale, scaleValue });
}

export function updatePreviewSpacing(value) {
    logger.debug('Update preview spacing called:', value);
    const previewContent = document.getElementById('preview-content-split');
    if (previewContent) {
        // Apply spacing to various elements within preview
        previewContent.style.setProperty('--preview-spacing', `${value}px`);
        previewContent.style.gap = `${value}px`;
        
        // Also apply to options containers
        const optionsContainers = previewContent.querySelectorAll('.player-options, .player-checkbox-options, .true-false-options');
        optionsContainers.forEach(container => {
            container.style.gap = `${value}px`;
        });
        
        // Apply to individual options (excluding checkbox options to maintain consistent sizing)
        const options = previewContent.querySelectorAll('.player-option, .preview-option, .tf-option');
        options.forEach(option => {
            option.style.marginBottom = `${value}px`;
        });
        
        // Keep checkbox options at consistent 8px margin
        const checkboxOptions = previewContent.querySelectorAll('.checkbox-option');
        checkboxOptions.forEach(option => {
            option.style.marginBottom = '8px';
        });
    }
    
    // Update display
    const display = document.getElementById('spacing-display');
    if (display) {
        display.textContent = `${value}px`;
    }
}

export function toggleTheme() {
    logger.debug('Global theme toggle function called');
    if (window.game && window.game.toggleTheme) {
        window.game.toggleTheme();
    } else {
        // Fallback theme toggle implementation
        logger.debug('Using fallback theme toggle');
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        
        const currentTheme = body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        if (themeToggle) {
            themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️'; // Moon for dark, sun for light
        }
        localStorage.setItem('theme', newTheme);
        logger.debug('Theme switched to:', newTheme);
    }
}

// Initialize floating back-to-top button behavior
function initializeBackToTopButton() {
    const backToTopBtn = document.getElementById('back-to-top-float');
    const editorSection = document.querySelector('.quiz-editor-section');
    
    logger.debug('Initializing back-to-top button:', {
        button: !!backToTopBtn,
        editor: !!editorSection
    });
    
    if (backToTopBtn && editorSection) {
        logger.debug('Setting up scroll listener for back-to-top button');
        editorSection.addEventListener('scroll', () => {
            const scrollTop = editorSection.scrollTop;
            
            if (scrollTop > TIMING.SCROLL_THRESHOLD) {
                if (!backToTopBtn.classList.contains('show')) {
                    logger.debug('Showing back-to-top button');
                    backToTopBtn.style.display = 'flex';
                    backToTopBtn.classList.add('show');
                }
            } else {
                if (backToTopBtn.classList.contains('show')) {
                    logger.debug('Hiding back-to-top button');
                    backToTopBtn.classList.remove('show');
                    setTimeout(() => {
                        if (!backToTopBtn.classList.contains('show')) {
                            backToTopBtn.style.display = 'none';
                        }
                    }, TIMING.ANIMATION_FADE_DURATION);
                }
            }
        });
        
        // Also listen to window scroll as fallback
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > TIMING.SCROLL_THRESHOLD) {
                backToTopBtn.style.display = 'flex';
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
                setTimeout(() => {
                    if (!backToTopBtn.classList.contains('show')) {
                        backToTopBtn.style.display = 'none';
                    }
                }, TIMING.ANIMATION_FADE_DURATION);
            }
        });
    } else {
        logger.warn('Back-to-top button or editor section not found');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBackToTopButton);
} else {
    initializeBackToTopButton();
}

// Make all functions globally accessible for HTML handlers
window.toggleLanguageDropdown = toggleLanguageDropdown;
window.selectLanguage = selectLanguage;
window.togglePreviewMode = togglePreviewMode;
window.openAIGeneratorModal = openAIGeneratorModal;
window.toggleToolbar = toggleToolbar;
window.toggleGlobalTime = toggleGlobalTime;
window.updateQuestionType = updateQuestionType;
window.updateTimeLimit = updateTimeLimit;
window.uploadImage = uploadImage;
window.removeImage = removeImage;
window.scrollToCurrentQuestion = scrollToCurrentQuestion;
window.scrollToTop = scrollToTop;
window.togglePreviewSettings = togglePreviewSettings;
window.toggleGlobalFontSize = toggleGlobalFontSize;
window.setGlobalFontSize = setGlobalFontSize;
window.updatePreviewSpacing = updatePreviewSpacing;
window.toggleTheme = toggleTheme;
window.changeLanguage = (langCode) => translationManager.changeLanguage(langCode); // Re-export from translation-manager