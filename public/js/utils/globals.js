/**
 * Global Functions Module
 * Provides global functions that are called from HTML onclick handlers
 * 
 * EXTRACTION NOTES:
 * - Functions needed by HTML onclick/onchange handlers
 * - Made globally accessible via window object
 * - Dependencies: Imports from other modules as needed
 */

import { changeLanguage } from './translations.js';
import { logger } from '../core/config.js';

// Global functions that need to be accessible from HTML

// Language dropdown functions
export function toggleLanguageDropdown() {
    const dropdown = document.getElementById('language-selector');
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

export function selectLanguage(langCode, event) {
    event.stopPropagation();
    
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
    
    // Call the language change function
    changeLanguage(langCode);
}

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('language-selector');
    if (dropdown && !dropdown.contains(event.target)) {
        dropdown.classList.remove('open');
    }
});

export function togglePreviewMode() {
    console.log('Preview mode toggle function called');
    if (window.game && window.game.togglePreviewMode) {
        window.game.togglePreviewMode();
    } else {
        console.log('Preview mode not implemented in modular version yet');
    }
}

export function openAIGeneratorModal() {
    console.log('AI Generator modal function called');
    if (window.game && window.game.aiGenerator && window.game.aiGenerator.openModal) {
        window.game.aiGenerator.openModal();
    } else {
        // Fallback: try to open modal directly
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.log('AI Generator modal not found');
        }
    }
}

export function toggleToolbar() {
    console.log('Toolbar toggle function called');
    // Implementation for toolbar toggle
    const toolbar = document.getElementById('left-toolbar');
    if (toolbar) {
        const isVisible = toolbar.style.display !== 'none';
        toolbar.style.display = isVisible ? 'none' : 'block';
    }
}

export function toggleGlobalTime() {
    console.log('Global time toggle function called');
    const globalTimeContainer = document.getElementById('global-time-container');
    const useGlobalTime = document.getElementById('use-global-time');
    
    if (globalTimeContainer && useGlobalTime) {
        globalTimeContainer.style.display = useGlobalTime.checked ? 'block' : 'none';
        console.log('Global time container display set to:', useGlobalTime.checked ? 'block' : 'none');
        
        // Update individual question time inputs based on global setting
        const questionTimeInputs = document.querySelectorAll('.question-time-limit');
        questionTimeInputs.forEach(input => {
            const container = input.closest('.time-limit-container');
            if (container) {
                container.style.display = useGlobalTime.checked ? 'none' : 'block';
            }
        });
    } else {
        console.log('Global time elements not found:', {
            container: !!globalTimeContainer,
            checkbox: !!useGlobalTime
        });
    }
}

export function updateQuestionType(selectElement) {
    console.log('Question type update function called');
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
    console.log('Time limit update function called');
    // Implementation for time limit updates
    const value = parseInt(inputElement.value);
    if (value < 5) inputElement.value = 5;
    if (value > 300) inputElement.value = 300;
}

export function uploadImage(inputElement) {
    console.log('Image upload function called');
    if (window.game && window.game.uploadImage) {
        window.game.uploadImage(inputElement);
    } else {
        console.log('Image upload not implemented in modular version yet');
    }
}

export function removeImage(buttonElement) {
    console.log('Remove image function called');
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
    console.log('Scroll to current question function called');
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
    console.log('⬆️ Scroll to top function called');
    
    // First try to scroll the editor container itself
    const quizEditor = document.querySelector('.quiz-editor-section');
    if (quizEditor) {
        console.log('Scrolling editor section to top, current scrollTop:', quizEditor.scrollTop);
        quizEditor.scrollTo({ top: 0, behavior: 'smooth' });
        console.log('Editor scroll command sent');
    } else {
        console.log('Editor section not found, using window scroll');
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
    console.log('🔧 Toggle preview settings called');
    const panel = document.getElementById('preview-settings-panel');
    const button = document.getElementById('preview-settings-btn');
    
    console.log('Elements found:', {
        panel: !!panel,
        button: !!button,
        panelDisplay: panel ? panel.style.display : 'N/A'
    });
    
    if (panel) {
        const isVisible = panel.style.display === 'block';
        console.log('Settings panel current display:', panel.style.display, 'isVisible:', isVisible);
        panel.style.display = isVisible ? 'none' : 'block';
        console.log('Settings panel new display:', panel.style.display);
        
        // Update button state
        if (button) {
            button.style.backgroundColor = isVisible ? '' : 'var(--color-primary)';
        }
    } else {
        console.error('❌ Preview settings panel not found');
        // Try to find all elements with similar IDs
        const allElements = document.querySelectorAll('[id*="preview"], [id*="settings"]');
        console.log('Available elements:', Array.from(allElements).map(el => el.id));
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
    console.log('Setting global font size:', scale);
    
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
        // Editor elements
        '.quiz-editor-section input',
        '.quiz-editor-section textarea', 
        '.question-text',
        '.option',
        '#quiz-title',
        
        // Game elements  
        '#current-question',
        '#player-question-text',
        '#question-counter',
        '#player-question-counter',
        '.player-option',
        '.tf-option',
        '.checkbox-option',
        
        // Preview elements
        '#preview-question-text',
        '#preview-question-text-split'
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
    
    // Save preference
    localStorage.setItem('globalFontSize', scale);
    currentFontScale = scale;
    
    // Debug logging
    console.log('Global font size updated:', { 
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
    console.log('Update preview spacing called:', value);
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
    console.log('Global theme toggle function called');
    if (window.game && window.game.toggleTheme) {
        window.game.toggleTheme();
    } else {
        // Fallback theme toggle implementation
        console.log('Using fallback theme toggle');
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        
        const currentTheme = body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        if (themeToggle) {
            themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️'; // Moon for dark, sun for light
        }
        localStorage.setItem('theme', newTheme);
        console.log('Theme switched to:', newTheme);
    }
}

// Initialize floating back-to-top button behavior
function initializeBackToTopButton() {
    const backToTopBtn = document.getElementById('back-to-top-float');
    const editorSection = document.querySelector('.quiz-editor-section');
    
    console.log('Initializing back-to-top button:', {
        button: !!backToTopBtn,
        editor: !!editorSection
    });
    
    if (backToTopBtn && editorSection) {
        console.log('Setting up scroll listener for back-to-top button');
        editorSection.addEventListener('scroll', () => {
            const scrollTop = editorSection.scrollTop;
            
            if (scrollTop > 300) {
                if (!backToTopBtn.classList.contains('show')) {
                    console.log('Showing back-to-top button');
                    backToTopBtn.style.display = 'flex';
                    backToTopBtn.classList.add('show');
                }
            } else {
                if (backToTopBtn.classList.contains('show')) {
                    console.log('Hiding back-to-top button');
                    backToTopBtn.classList.remove('show');
                    setTimeout(() => {
                        if (!backToTopBtn.classList.contains('show')) {
                            backToTopBtn.style.display = 'none';
                        }
                    }, 300);
                }
            }
        });
        
        // Also listen to window scroll as fallback
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > 300) {
                backToTopBtn.style.display = 'flex';
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
                setTimeout(() => {
                    if (!backToTopBtn.classList.contains('show')) {
                        backToTopBtn.style.display = 'none';
                    }
                }, 300);
            }
        });
    } else {
        console.warn('Back-to-top button or editor section not found');
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
window.changeLanguage = changeLanguage; // Re-export from translations