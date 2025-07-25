/**
 * Socket Manager Module
 * Handles all socket.io event listeners and socket communication
 */

import { translationManager } from '../utils/translation-manager.js';
import { errorBoundary } from '../utils/error-boundary.js';
import { logger } from '../core/config.js';

export class SocketManager {
    constructor(socket, gameManager, uiManager, soundManager) {
        this.socket = socket;
        this.gameManager = gameManager;
        this.uiManager = uiManager;
        this.soundManager = soundManager;
        
        this.initializeSocketListeners();
    }

    /**
     * Initialize all socket event listeners
     */
    initializeSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            logger.debug('Connected to server');
        });

        this.socket.on('disconnect', () => {
            logger.debug('Disconnected from server');
        });

        // Game creation and joining
        this.socket.on('game-created', (data) => {
            logger.debug('Game created:', data);
            this.gameManager.setGamePin(data.pin);
            this.gameManager.setPlayerInfo('Host', true);
            this.uiManager.updateGamePin(data.pin);
            this.uiManager.loadQRCode(data.pin);
            this.uiManager.showScreen('game-lobby');
        });
        
        // Listen for new games becoming available
        this.socket.on('game-available', (data) => {
            logger.debug('New game available:', data);
            // Refresh the active games list (will only have effect if games list is visible)
            this.uiManager.refreshActiveGames();
        });

        this.socket.on('player-joined', (data) => {
            logger.debug('Player joined:', data);
            logger.debug('data.players:', data.players);
            logger.debug('data keys:', Object.keys(data));
            
            // Set player info correctly - player is NOT a host
            logger.debug('PlayerJoined', { playerName: data.playerName, gamePin: data.gamePin });
            if (data.playerName && data.gamePin) {
                this.gameManager.setPlayerInfo(data.playerName, false);
                this.gameManager.setGamePin(data.gamePin);
                
                // Update lobby display with game information
                this.updatePlayerLobbyDisplay(data.gamePin, data.players);
            } else {
                logger.warn('PlayerJoin failed', { playerName: data.playerName, gamePin: data.gamePin });
            }
            this.gameManager.updatePlayersList(data.players);
            this.uiManager.showScreen('player-lobby');
        });

        // Game flow events
        this.socket.on('game-started', (data) => {
            logger.debug('Game started:', data);
            if (this.gameManager.isHost) {
                this.uiManager.showScreen('host-game-screen');
            } else {
                this.uiManager.showScreen('player-game-screen');
            }
        });

        this.socket.on('question-start', errorBoundary.safeSocketHandler((data) => {
            logger.debug('Question started:', data);
            logger.debug('Question timeLimit value:', data.timeLimit, 'Type:', typeof data.timeLimit);
            logger.debug('Question image data:', JSON.stringify(data.image), 'Has image:', !!data.image);
            logger.debug('Full question data received:', JSON.stringify(data, null, 2));
            this.gameManager.displayQuestion(data);
            
            // Ensure timer has valid duration
            const timerDuration = data.timeLimit && !isNaN(data.timeLimit) ? data.timeLimit * 1000 : 30000; // Default 30 seconds
            logger.debug('Timer duration calculated:', timerDuration);
            this.gameManager.startTimer(timerDuration);
            
            if (this.soundManager.isEnabled()) {
                this.soundManager.playQuestionStartSound();
            }
        }, 'question-start'));

        this.socket.on('question-end', (data) => {
            logger.debug('Question ended:', data);
            this.gameManager.stopTimer();
            
            if (data && data.leaderboard) {
                this.gameManager.showLeaderboard(data.leaderboard);
            }
        });

        this.socket.on('question-timeout', (data) => {
            logger.debug('Question timed out:', data);
            this.gameManager.stopTimer();
            
            if (this.gameManager.timer) {
                clearInterval(this.gameManager.timer);
                this.gameManager.timer = null;
            }
            
            // Show correct answer on host side
            if (this.gameManager.isHost) {
                this.gameManager.showCorrectAnswer(data);
            }
        });

        this.socket.on('show-next-button', () => {
            logger.debug('Showing next question button');
            const nextButton = document.getElementById('next-question');
            if (nextButton) {
                nextButton.style.display = 'block';
                nextButton.style.position = 'fixed';
                nextButton.style.bottom = '20px';
                nextButton.style.right = '20px';
                nextButton.style.zIndex = '1000';
                nextButton.style.backgroundColor = '#4CAF50';
                nextButton.style.color = 'white';
                nextButton.style.border = 'none';
                nextButton.style.padding = '15px 30px';
                nextButton.style.borderRadius = '8px';
                nextButton.style.fontSize = '16px';
                nextButton.style.cursor = 'pointer';
                nextButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                nextButton.onclick = null; // Clear any existing onclick
            }
        });

        this.socket.on('hide-next-button', () => {
            logger.debug('Hiding next question button');
            const nextButton = document.getElementById('next-question');
            if (nextButton) {
                nextButton.style.display = 'none';
                nextButton.onclick = null; // Clear onclick handler
            }
        });

        this.socket.on('game-end', (data) => {
            logger.debug('Game ended:', data);
            
            // Hide manual advancement button
            const nextButton = document.getElementById('next-question');
            if (nextButton) {
                nextButton.style.display = 'none';
                nextButton.onclick = null;
            }
            
            // Clear any remaining timers
            this.gameManager.stopTimer();
            
            // Delay showing final results to ensure proper state
            setTimeout(() => {
                logger.debug('Calling showFinalResults with leaderboard:', data.finalLeaderboard);
                this.gameManager.showFinalResults(data.finalLeaderboard);
            }, 1000);
        });

        // Player-specific events
        this.socket.on('player-result', errorBoundary.safeSocketHandler((data) => {
            logger.debug('🎯 Player result event received:', data);
            logger.debug('🎯 Calling gameManager.showPlayerResult...');
            this.gameManager.showPlayerResult(data);
        }, 'player-result'));

        this.socket.on('answer-submitted', (data) => {
            logger.debug('Answer submitted feedback:', data);
            this.gameManager.showAnswerSubmitted(data.answer);
        });

        // Statistics and updates
        this.socket.on('statistics-update', (data) => {
            logger.debug('Statistics updated:', data);
            this.updateStatistics(data);
        });

        this.socket.on('leaderboard-update', (data) => {
            logger.debug('Leaderboard updated:', data);
            this.gameManager.showLeaderboard(data.leaderboard);
            // Note: Removed fanfare from here - it should only play at final game end
        });

        // Answer statistics updates
        this.socket.on('answer-statistics', (data) => {
            logger.debug('Answer statistics received:', data);
            this.gameManager.updateAnswerStatistics(data);
        });

        this.socket.on('players-update', (data) => {
            logger.debug('Players updated:', data);
            this.gameManager.updatePlayersList(data.players);
        });

        this.socket.on('player-list-update', (data) => {
            logger.debug('Player list updated:', data);
            this.gameManager.updatePlayersList(data.players);
            
            // Update player count in lobby if we're in player lobby
            if (this.uiManager.currentScreen === 'player-lobby') {
                const lobbyPlayerCount = document.getElementById('lobby-player-count');
                if (lobbyPlayerCount && data.players) {
                    lobbyPlayerCount.textContent = data.players.length;
                }
            }
        });

        // Error handling
        this.socket.on('error', (data) => {
            logger.error('Socket error:', data);
            translationManager.showAlert('error', data.message || 'An error occurred');
        });

        this.socket.on('game-not-found', (data) => {
            logger.error('Game not found:', data);
            translationManager.showAlert('error', data.message || 'Game not found');
        });

        this.socket.on('player-limit-reached', (data) => {
            logger.error('Player limit reached:', data);
            translationManager.showAlert('error', data.message || 'Player limit reached');
        });

        this.socket.on('invalid-pin', (data) => {
            logger.error('Invalid PIN:', data);
            translationManager.showAlert('error', data.message || 'Invalid game PIN');
        });

        this.socket.on('name-taken', (data) => {
            logger.error('Name taken:', data);
            translationManager.showAlert('error', data.message || 'Name is already taken');
        });

        // Host-specific events
        this.socket.on('host-statistics', (data) => {
            logger.debug('Host statistics:', data);
            this.updateHostStatistics(data);
        });

        this.socket.on('player-disconnected', (data) => {
            logger.debug('Player disconnected:', data);
            this.gameManager.updatePlayersList(data.players);
        });

        this.socket.on('all-players-answered', (data) => {
            logger.debug('All players answered:', data);
            // Could show visual feedback that all players have answered
        });

        // Special events
        this.socket.on('force-disconnect', (data) => {
            logger.debug('Force disconnect:', data);
            translationManager.showAlert('info', data.message || 'You have been disconnected');
            this.uiManager.showScreen('main-menu');
        });

        this.socket.on('reconnect', (attemptNumber) => {
            logger.debug('Reconnecting attempt:', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
            logger.error('Reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            logger.error('Reconnection failed');
            translationManager.showAlert('error', 'Failed to reconnect to server');
        });
    }

    /**
     * Update game statistics display
     */
    updateStatistics(data) {
        if (!data.statistics) return;
        
        const statsContainer = document.getElementById('game-statistics');
        if (!statsContainer) return;
        
        // Clear previous statistics
        statsContainer.innerHTML = '';
        
        // Show answer distribution
        if (data.statistics.answerDistribution) {
            const distributionDiv = document.createElement('div');
            distributionDiv.className = 'answer-distribution';
            distributionDiv.innerHTML = '<h4>Answer Distribution</h4>';
            
            Object.entries(data.statistics.answerDistribution).forEach(([answer, count]) => {
                const answerDiv = document.createElement('div');
                answerDiv.className = 'answer-stat';
                answerDiv.innerHTML = `
                    <span class="answer-label">${answer}</span>
                    <span class="answer-count">${count}</span>
                `;
                distributionDiv.appendChild(answerDiv);
            });
            
            statsContainer.appendChild(distributionDiv);
        }
        
        // Show response time statistics
        if (data.statistics.averageResponseTime) {
            const responseTimeDiv = document.createElement('div');
            responseTimeDiv.className = 'response-time-stat';
            responseTimeDiv.innerHTML = `
                <h4>Average Response Time</h4>
                <span class="time-value">${data.statistics.averageResponseTime.toFixed(1)}s</span>
            `;
            statsContainer.appendChild(responseTimeDiv);
        }
        
        // Show participation rate
        if (data.statistics.participationRate !== undefined) {
            const participationDiv = document.createElement('div');
            participationDiv.className = 'participation-stat';
            participationDiv.innerHTML = `
                <h4>Participation Rate</h4>
                <span class="participation-value">${(data.statistics.participationRate * 100).toFixed(1)}%</span>
            `;
            statsContainer.appendChild(participationDiv);
        }
    }

    /**
     * Update host-specific statistics
     */
    updateHostStatistics(data) {
        // Update host dashboard with detailed statistics
        const hostStats = document.getElementById('host-statistics');
        if (!hostStats) return;
        
        hostStats.innerHTML = `
            <div class="host-stat-grid">
                <div class="host-stat-item">
                    <h4>Total Players</h4>
                    <span class="stat-value">${data.totalPlayers || 0}</span>
                </div>
                <div class="host-stat-item">
                    <h4>Answered</h4>
                    <span class="stat-value">${data.playersAnswered || 0}</span>
                </div>
                <div class="host-stat-item">
                    <h4>Correct</h4>
                    <span class="stat-value">${data.correctAnswers || 0}</span>
                </div>
                <div class="host-stat-item">
                    <h4>Avg Time</h4>
                    <span class="stat-value">${data.averageTime ? data.averageTime.toFixed(1) + 's' : 'N/A'}</span>
                </div>
            </div>
        `;
    }

    /**
     * Join game by PIN
     */
    joinGame(pin, playerName) {
        logger.debug('Attempting to join game with PIN:', pin, 'Name:', playerName);
        this.socket.emit('player-join', {
            pin: pin,
            name: playerName
        });
        logger.debug('Emitted player-join event');
    }

    /**
     * Update player lobby display with game information
     */
    updatePlayerLobbyDisplay(gamePin, players) {
        // Update game PIN display
        const lobbyPinDisplay = document.getElementById('lobby-pin-display');
        if (lobbyPinDisplay && gamePin) {
            lobbyPinDisplay.textContent = gamePin;
        }

        // Update player count
        const lobbyPlayerCount = document.getElementById('lobby-player-count');
        if (lobbyPlayerCount && players) {
            lobbyPlayerCount.textContent = players.length;
        }

        // Show the lobby info section
        const lobbyInfo = document.getElementById('lobby-info');
        if (lobbyInfo) {
            lobbyInfo.style.display = 'flex';
        }

        logger.debug('Updated player lobby display:', { gamePin, playerCount: players?.length });
    }

    /**
     * Create game
     */
    createGame(quizData) {
        logger.debug('SocketManager.createGame called with:', quizData);
        logger.debug('Socket connected:', this.socket.connected);
        try {
            this.socket.emit('host-join', quizData);
            logger.debug('Emitted host-join event successfully');
        } catch (error) {
            logger.error('Error emitting host-join:', error);
        }
    }

    /**
     * Start game
     */
    startGame() {
        logger.debug('Attempting to start game...');
        logger.debug('Socket connected:', this.socket.connected);
        try {
            this.socket.emit('start-game');
            logger.debug('Emitted start-game event successfully');
        } catch (error) {
            logger.error('Error starting game:', error);
        }
    }

    /**
     * Submit player answer
     */
    submitAnswer(answer) {
        this.socket.emit('submit-answer', {
            answer: answer,
            type: 'player-answer'
        });
    }

    /**
     * Request next question (manual advancement)
     */
    nextQuestion() {
        this.socket.emit('next-question');
    }

    /**
     * Leave game
     */
    leaveGame() {
        this.socket.emit('leave-game');
    }

    /**
     * Get socket connection status
     */
    isConnected() {
        return this.socket.connected;
    }

    /**
     * Reconnect to server
     */
    reconnect() {
        this.socket.connect();
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        this.socket.disconnect();
    }
}