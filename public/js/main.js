/**
 * QuizMaster Pro Application Entry Point
 * Initializes the modular application
 */

import { QuizGame } from './core/app.js';
import { setLanguage } from './utils/translations.js';
import './utils/globals.js'; // Import globals to make them available

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('QuizMaster Pro - Initializing modular application...');
    
    try {
        // Initialize the main application
        window.game = new QuizGame();
        console.log('QuizGame instance created successfully');
        
        // Make sure theme toggle is available globally
        window.toggleTheme = () => {
            console.log('Global theme toggle called');
            if (window.game && window.game.toggleTheme) {
                window.game.toggleTheme();
            } else {
                console.log('window.game.toggleTheme not available');
            }
        };
        
        // Apply saved theme immediately
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        
        // Update theme toggle icon to match current theme
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️'; // Moon for dark, sun for light
        }
        
        console.log('Applied theme:', savedTheme);
        
        // Wait a bit for initialization to complete, then set language
        setTimeout(() => {
            try {
                const savedLanguage = localStorage.getItem('language') || 'en';
                console.log('Setting language to:', savedLanguage);
                setLanguage(savedLanguage);
                console.log('Language initialized successfully');
            } catch (error) {
                console.error('Error setting language:', error);
            }
        }, 100);
        
        console.log('QuizMaster Pro - Application initialized successfully');
    } catch (error) {
        console.error('Error initializing QuizMaster Pro:', error);
    }
});