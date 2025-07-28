/**
 * UI Manager Module
 * Handles all user interface operations, screen management, and visual updates
 */

import { translationManager } from '../utils/translation-manager.js';
import { TIMING, logger } from '../core/config.js';
import { errorHandler } from '../utils/error-handler.js';
import { gameStateManager } from '../utils/game-state-manager.js';
import { APIHelper } from '../utils/api-helper.js';

export class UIManager {
    constructor() {
        this.currentScreen = 'main-menu';
        this.errorHandler = errorHandler; // Add ErrorHandler for future use
    }

    showScreen(screenId) {
        logger.debug('Switching to screen:', screenId);
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            logger.debug('Successfully switched to screen:', screenId);
            
            // DEBUG: Simple console log that should always appear
            console.log('🐛 UI MANAGER - Screen switched to:', screenId);
            
            // DEBUG: Log current layout state for mobile debugging
            console.log('🐛 SCREEN SWITCH - Layout debug for:', screenId);
            console.log('🐛 Current screen viewport height:', window.innerHeight);
            console.log('🐛 Document body height:', document.body.scrollHeight);
            console.log('🐛 Document body classes:', document.body.className);
            
            // Look for any containers that might be causing spacing issues
            const allContainers = document.querySelectorAll('.container, [class*="container"]');
            console.log('🐛 Found containers during screen switch:', allContainers.length);
            allContainers.forEach((container, index) => {
                const rect = container.getBoundingClientRect();
                if (rect.height > 0) {
                    console.log(`🐛 Container ${index} (${container.className}):`, {
                        height: rect.height,
                        top: rect.top,
                        element: container
                    });
                }
            });
            
            // Show/hide header elements based on screen
            const headerStartBtn = document.getElementById('start-hosting-header-small');
            const horizontalToolbar = document.getElementById('horizontal-toolbar');
            
            if (screenId === 'host-screen') {
                // Show toolbar and start button for host screen
                if (headerStartBtn) headerStartBtn.style.display = 'block';
                if (horizontalToolbar) horizontalToolbar.style.display = 'flex';
                
                // Set editing state for quiz creation
                gameStateManager.setState('editing');
            } else {
                // Hide toolbar and start button for other screens
                if (headerStartBtn) headerStartBtn.style.display = 'none';
                if (horizontalToolbar) horizontalToolbar.style.display = 'none';
            }
            
            // Set appropriate game state based on screen
            switch (screenId) {
                case 'main-menu':
                    gameStateManager.setState('lobby');
                    break;
                case 'host-lobby':
                case 'player-lobby':
                    gameStateManager.setState('lobby');
                    break;
                case 'host-game-screen':
                case 'player-game-screen':
                    // Note: playing state will be set by question-start event
                    // This ensures UI is ready for gameplay transition
                    break;
                case 'game-browser':
                case 'join-screen':
                    gameStateManager.setState('lobby');
                    break;
                default:
                    // Default to lobby state for other screens
                    if (screenId !== 'host-screen') {
                        gameStateManager.setState('lobby');
                    }
                    break;
            }
            
            // Translate the new screen
            setTimeout(() => {
                translationManager.translatePage();
            }, TIMING.TRANSLATION_DELAY);
        } else {
            logger.error('Screen not found:', screenId);
            // List available screens for debugging
            const availableScreens = Array.from(document.querySelectorAll('.screen')).map(s => s.id);
            logger.debug('Available screens:', availableScreens);
        }
    }

    updateGamePin(gamePin) {
        const pinElement = document.getElementById('game-pin');
        if (pinElement && gamePin) {
            pinElement.textContent = gamePin;
        }
    }

    async loadQRCode(pin) {
        try {
            const data = await APIHelper.fetchAPIJSON(`/api/qr/${pin}`);
            
            if (data.qrCode) {
                const qrImage = document.getElementById('qr-code-image');
                const qrLoading = document.querySelector('.qr-loading');
                const gameUrl = document.getElementById('game-url');
                
                if (qrImage) {
                    qrImage.src = data.qrCode;
                    qrImage.style.display = 'block';
                }
                if (qrLoading) qrLoading.style.display = 'none';
                if (gameUrl) gameUrl.textContent = data.gameUrl;
            }
        } catch (error) {
            logger.error('Failed to load QR code:', error);
            const qrLoading = document.querySelector('.qr-loading');
            if (qrLoading) {
                qrLoading.textContent = translationManager.getTranslationSync('failed_generate_qr_code');
            }
        }
    }

    // Game browser functionality
    async showGameBrowser() {
        this.showScreen('game-browser');
        await this.refreshActiveGames();
    }

    async refreshActiveGames() {
        const gamesContainer = document.getElementById('games-list');
        if (!gamesContainer) return;
        
        gamesContainer.innerHTML = `<div class="loading-games">${translationManager.getTranslationSync('loading_games')}</div>`;

        try {
            // Use API helper to ensure proper URL handling across different network configurations
            const data = await APIHelper.fetchAPIJSON('/api/active-games');

            if (data.games && data.games.length > 0) {
                gamesContainer.innerHTML = '';
                data.games.forEach(game => this.createGameCard(game));
            } else {
                gamesContainer.innerHTML = `
                    <div class="no-games">
                        <h3>${translationManager.getTranslationSync('no_games_found')}</h3>
                        <p>${translationManager.getTranslationSync('ask_someone_host')}</p>
                    </div>
                `;
            }
        } catch (error) {
            logger.error('Failed to fetch active games:', error);
            
            // Show detailed error information for debugging
            const errorMessage = error.message || 'Unknown error';
            const isNetworkError = error.name === 'TypeError' && error.message.includes('fetch');
            
            gamesContainer.innerHTML = `
                <div class="no-games">
                    <h3>${translationManager.getTranslationSync('failed_load_games')}</h3>
                    <p>${translationManager.getTranslationSync('check_connection')}</p>
                    <details style="margin-top: 10px; font-size: 0.8em; color: #666;">
                        <summary>Debug Info (tap to expand)</summary>
                        <p><strong>Error:</strong> ${errorMessage}</p>
                        <p><strong>Host:</strong> ${window.location.host}</p>
                        <p><strong>Network Error:</strong> ${isNetworkError ? 'Yes' : 'No'}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
                    </details>
                </div>
            `;
        }
    }

    createGameCard(game) {
        const gamesContainer = document.getElementById('games-list');
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        
        // Make the entire card clickable
        gameCard.style.cursor = 'pointer';
        gameCard.addEventListener('click', (e) => {
            // Prevent double-click if user clicks the button specifically
            e.preventDefault();
            window.game.joinGameByPin(game.pin);
        });
        
        gameCard.innerHTML = `
            <div class="game-title">${this.escapeHtml(game.title)}</div>
            <div class="game-info">
                <div class="game-detail">
                    <span class="game-detail-icon">🎯</span>
                    <span>PIN: <strong>${game.pin}</strong></span>
                </div>
                <div class="game-detail">
                    <span class="game-detail-icon">👥</span>
                    <span class="game-players-count">${game.playerCount}</span> ${translationManager.getTranslationSync('players')}
                </div>
                <div class="game-detail">
                    <span class="game-detail-icon">❓</span>
                    <span>${game.questionCount}</span> ${translationManager.getTranslationSync('questions')}
                </div>
                <div class="game-detail">
                    <span class="game-detail-icon">🟢</span>
                    <span class="game-status waiting">${translationManager.getTranslationSync('waiting_for_players') || 'Waiting'}</span>
                </div>
            </div>
            <div class="game-pin-display">${game.pin}</div>
        `;
        
        gamesContainer.appendChild(gameCard);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    joinGameByPin(pin) {
        const pinInput = document.getElementById('game-pin-input');
        const nameInput = document.getElementById('player-name');
        
        if (pinInput) {
            pinInput.value = pin;
            this.showScreen('join-screen');
            
            // If player name is already entered, auto-join the game
            if (nameInput && nameInput.value.trim()) {
                logger.debug('Auto-joining game with existing player name');
                // Small delay to ensure screen transition completes
                setTimeout(() => {
                    window.game.joinGame();
                }, 100);
            }
        }
    }
}