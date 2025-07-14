/**
 * Settings Manager Module
 * Handles theme management, settings persistence, and application preferences
 */

import { getTranslation } from '../utils/translations.js';

export class SettingsManager {
    constructor() {
        this.settings = {
            theme: 'light',
            soundEnabled: true,
            language: 'en',
            autoSave: true,
            animations: true,
            fullscreenMode: false
        };
        
        this.loadSettings();
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('quizSettings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        
        // Apply loaded settings
        this.applySettings();
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('quizSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Apply settings to the application
     */
    applySettings() {
        // Apply theme
        this.applyTheme(this.settings.theme);
        
        // Apply other settings
        this.applyAnimations(this.settings.animations);
        this.applyFullscreen(this.settings.fullscreenMode);
        
        // Update UI elements
        this.updateSettingsUI();
    }

    /**
     * Apply theme to the application
     */
    applyTheme(theme) {
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        
        if (theme === 'dark') {
            body.classList.add('dark-theme');
            body.classList.remove('light-theme');
            if (themeToggle) {
                themeToggle.textContent = '☀️';
                themeToggle.title = getTranslation('switch_light_mode');
            }
        } else {
            body.classList.add('light-theme');
            body.classList.remove('dark-theme');
            if (themeToggle) {
                themeToggle.textContent = '🌙';
                themeToggle.title = getTranslation('switch_dark_mode');
            }
        }
        
        this.settings.theme = theme;
    }

    /**
     * Toggle theme between light and dark
     */
    toggleTheme() {
        const newTheme = this.settings.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.saveSettings();
    }

    /**
     * Apply animations setting
     */
    applyAnimations(enabled) {
        const body = document.body;
        if (enabled) {
            body.classList.remove('no-animations');
        } else {
            body.classList.add('no-animations');
        }
        
        this.settings.animations = enabled;
    }

    /**
     * Toggle animations
     */
    toggleAnimations() {
        this.applyAnimations(!this.settings.animations);
        this.saveSettings();
    }

    /**
     * Apply fullscreen setting
     */
    applyFullscreen(enabled) {
        // Only apply fullscreen changes if explicitly requested by user
        // Don't try to apply stored fullscreen state on initialization
        if (enabled && document.fullscreenElement === null) {
            this.enterFullscreen();
        } else if (!enabled && document.fullscreenElement) {
            this.exitFullscreen();
        }
        // Update the setting but don't force changes on initialization
        this.settings.fullscreenMode = enabled;
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (document.fullscreenElement) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    /**
     * Enter fullscreen mode
     */
    enterFullscreen() {
        const element = document.documentElement;
        
        try {
            let fullscreenPromise;
            
            if (element.requestFullscreen) {
                fullscreenPromise = element.requestFullscreen();
            } else if (element.mozRequestFullScreen) { // Firefox
                fullscreenPromise = element.mozRequestFullScreen();
            } else if (element.webkitRequestFullscreen) { // Chrome, Safari, Opera
                fullscreenPromise = element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) { // IE/Edge
                fullscreenPromise = element.msRequestFullscreen();
            }
            
            // Handle promise-based fullscreen API
            if (fullscreenPromise && fullscreenPromise.then) {
                fullscreenPromise
                    .then(() => {
                        this.settings.fullscreenMode = true;
                        this.updateFullscreenButton();
                        this.saveSettings();
                    })
                    .catch((err) => {
                        console.warn('Fullscreen request failed:', err.message);
                        this.settings.fullscreenMode = false;
                        this.updateFullscreenButton();
                    });
            } else {
                // For older browsers that don't return a promise
                this.settings.fullscreenMode = true;
                this.updateFullscreenButton();
                this.saveSettings();
            }
        } catch (err) {
            console.warn('Fullscreen not supported or blocked:', err.message);
            this.settings.fullscreenMode = false;
            this.updateFullscreenButton();
        }
    }

    /**
     * Exit fullscreen mode
     */
    exitFullscreen() {
        // Only try to exit fullscreen if we're actually in fullscreen mode
        if (document.fullscreenElement || document.webkitFullscreenElement || 
            document.mozFullScreenElement || document.msFullscreenElement) {
            try {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.mozCancelFullScreen) { // Firefox
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { // IE/Edge
                    document.msExitFullscreen();
                }
            } catch (error) {
                console.warn('Failed to exit fullscreen:', error);
            }
        }
        
        this.settings.fullscreenMode = false;
        this.updateFullscreenButton();
    }

    /**
     * Update fullscreen button appearance
     */
    updateFullscreenButton() {
        const fullscreenToggle = document.getElementById('fullscreen-toggle');
        if (fullscreenToggle) {
            if (this.settings.fullscreenMode) {
                fullscreenToggle.textContent = '🔲';
                fullscreenToggle.title = getTranslation('exit_fullscreen');
            } else {
                fullscreenToggle.textContent = '⛶';
                fullscreenToggle.title = getTranslation('enter_fullscreen');
            }
        }
    }

    /**
     * Set sound enabled/disabled
     */
    setSoundEnabled(enabled) {
        this.settings.soundEnabled = enabled;
        this.saveSettings();
        this.updateSettingsUI();
    }

    /**
     * Toggle sound
     */
    toggleSound() {
        this.setSoundEnabled(!this.settings.soundEnabled);
    }

    /**
     * Set language
     */
    setLanguage(language) {
        this.settings.language = language;
        this.saveSettings();
        this.updateSettingsUI();
    }

    /**
     * Set auto-save enabled/disabled
     */
    setAutoSave(enabled) {
        this.settings.autoSave = enabled;
        this.saveSettings();
        this.updateSettingsUI();
    }

    /**
     * Toggle auto-save
     */
    toggleAutoSave() {
        this.setAutoSave(!this.settings.autoSave);
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get specific setting
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * Update setting
     */
    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        this.applySettings();
    }

    /**
     * Reset settings to defaults
     */
    resetSettings() {
        this.settings = {
            theme: 'light',
            soundEnabled: true,
            language: 'en',
            autoSave: true,
            animations: true,
            fullscreenMode: false
        };
        
        this.saveSettings();
        this.applySettings();
    }

    /**
     * Update settings UI elements
     */
    updateSettingsUI() {
        // Update theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            if (this.settings.theme === 'dark') {
                themeToggle.textContent = '☀️';
                themeToggle.title = getTranslation('switch_light_mode');
            } else {
                themeToggle.textContent = '🌙';
                themeToggle.title = getTranslation('switch_dark_mode');
            }
        }
        
        // Update sound toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
            soundToggle.title = this.settings.soundEnabled ? 
                getTranslation('disable_sound') : getTranslation('enable_sound');
        }
        
        // Update fullscreen toggle
        this.updateFullscreenButton();
        
        // Update language selector
        const languageButtons = document.querySelectorAll('[data-lang]');
        languageButtons.forEach(button => {
            const lang = button.getAttribute('data-lang');
            if (lang === this.settings.language) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Update auto-save toggle
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        if (autoSaveToggle) {
            autoSaveToggle.checked = this.settings.autoSave;
        }
        
        // Update animations toggle
        const animationsToggle = document.getElementById('animations-toggle');
        if (animationsToggle) {
            animationsToggle.checked = this.settings.animations;
        }
    }

    /**
     * Initialize settings event listeners
     */
    initializeEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Sound toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.toggleSound());
        }
        
        // Fullscreen toggle
        const fullscreenToggle = document.getElementById('fullscreen-toggle');
        if (fullscreenToggle) {
            fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());
        }
        
        // Auto-save toggle
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        if (autoSaveToggle) {
            autoSaveToggle.addEventListener('change', (e) => {
                this.setAutoSave(e.target.checked);
            });
        }
        
        // Animations toggle
        const animationsToggle = document.getElementById('animations-toggle');
        if (animationsToggle) {
            animationsToggle.addEventListener('change', (e) => {
                this.applyAnimations(e.target.checked);
                this.saveSettings();
            });
        }
        
        // Language buttons
        const languageButtons = document.querySelectorAll('[data-lang]');
        languageButtons.forEach(button => {
            button.addEventListener('click', () => {
                const lang = button.getAttribute('data-lang');
                this.setLanguage(lang);
            });
        });
        
        // Handle fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            this.settings.fullscreenMode = !!document.fullscreenElement;
            this.updateFullscreenButton();
            this.saveSettings();
        });
        
        // Handle fullscreen errors
        document.addEventListener('fullscreenerror', (e) => {
            console.error('Fullscreen error:', e);
            this.settings.fullscreenMode = false;
            this.updateFullscreenButton();
            this.saveSettings();
        });
    }

    /**
     * Export settings
     */
    exportSettings() {
        const settingsData = {
            settings: this.settings,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(settingsData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'quizmaster-settings.json';
        link.click();
    }

    /**
     * Import settings
     */
    async importSettings(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (importData.settings) {
                this.settings = { ...this.settings, ...importData.settings };
                this.saveSettings();
                this.applySettings();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }
}