/**
 * UI Manager Module
 * Handles all user interface operations, screen management, and visual updates
 */

import { getTranslation, translatePage } from '../utils/translations.js';
import { TIMING } from '../core/config.js';

export class UIManager {
    constructor() {
        this.currentScreen = 'main-menu';
    }

    showScreen(screenId) {
        console.log('Switching to screen:', screenId);
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            console.log('Successfully switched to screen:', screenId);
            
            // Show/hide header start button based on screen
            const headerStartBtn = document.getElementById('start-hosting-header-small');
            if (headerStartBtn) {
                if (screenId === 'host-screen') {
                    headerStartBtn.style.display = 'block';
                } else {
                    headerStartBtn.style.display = 'none';
                }
            }
            
            // Translate the new screen
            setTimeout(() => {
                translatePage();
            }, TIMING.TRANSLATION_DELAY);
        } else {
            console.error('Screen not found:', screenId);
            // List available screens for debugging
            const availableScreens = Array.from(document.querySelectorAll('.screen')).map(s => s.id);
            console.log('Available screens:', availableScreens);
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
            const response = await fetch(`/api/qr/${pin}`);
            const data = await response.json();
            
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
            console.error('Failed to load QR code:', error);
            const qrLoading = document.querySelector('.qr-loading');
            if (qrLoading) {
                qrLoading.textContent = getTranslation('failed_generate_qr_code');
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
        
        gamesContainer.innerHTML = `<div class="loading-games">${getTranslation('loading_games')}</div>`;

        try {
            const response = await fetch('/api/active-games');
            const data = await response.json();

            if (data.games && data.games.length > 0) {
                gamesContainer.innerHTML = '';
                data.games.forEach(game => this.createGameCard(game));
            } else {
                gamesContainer.innerHTML = `
                    <div class="no-games">
                        <h3>${getTranslation('no_games_found')}</h3>
                        <p>${getTranslation('ask_someone_host')}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to fetch active games:', error);
            gamesContainer.innerHTML = `
                <div class="no-games">
                    <h3>${getTranslation('failed_load_games')}</h3>
                    <p>${getTranslation('check_connection')}</p>
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
                    <span class="game-players-count">${game.playerCount}</span> ${getTranslation('players')}
                </div>
                <div class="game-detail">
                    <span class="game-detail-icon">❓</span>
                    <span>${game.questionCount}</span> ${getTranslation('questions')}
                </div>
                <div class="game-detail">
                    <span class="game-detail-icon">🟢</span>
                    <span class="game-status waiting">${getTranslation('waiting_for_players') || 'Waiting'}</span>
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
                console.log('Auto-joining game with existing player name');
                // Small delay to ensure screen transition completes
                setTimeout(() => {
                    window.game.joinGame();
                }, 100);
            }
        }
    }
}