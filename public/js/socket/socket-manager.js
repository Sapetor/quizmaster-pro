/**
 * Socket Manager Module
 * Handles all socket.io event listeners and socket communication
 */

import { showAlert } from '../utils/translations.js';

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
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        // Game creation and joining
        this.socket.on('game-created', (data) => {
            console.log('Game created:', data);
            this.gameManager.setGamePin(data.pin);
            this.gameManager.setPlayerInfo('Host', true);
            this.uiManager.updateGamePin(data.pin);
            this.uiManager.loadQRCode(data.pin);
            this.uiManager.showScreen('game-lobby');
        });

        this.socket.on('player-joined', (data) => {
            console.log('Player joined:', data);
            console.log('data.players:', data.players);
            console.log('data keys:', Object.keys(data));
            
            // Set player info correctly - player is NOT a host
            console.log('🔥🔥🔥 PLAYER-JOINED EVENT RECEIVED 🔥🔥🔥');
            console.log('🔥 data.playerName:', data.playerName);
            console.log('🔥 data.gamePin:', data.gamePin);
            if (data.playerName && data.gamePin) {
                console.log('🔥 CRITICAL: Setting player info:', data.playerName, 'isHost: false');
                this.gameManager.setPlayerInfo(data.playerName, false);
                this.gameManager.setGamePin(data.gamePin);
                console.log('🔥 CRITICAL: After setPlayerInfo, isHost =', this.gameManager.isHost);
                
                // Update lobby display with game information
                this.updatePlayerLobbyDisplay(data.gamePin, data.players);
            } else {
                console.log('🔥 CRITICAL: playerName or gamePin missing:', {
                    playerName: data.playerName,
                    gamePin: data.gamePin
                });
            }
            console.log('🔥🔥🔥 END PLAYER-JOINED PROCESSING 🔥🔥🔥');
            this.gameManager.updatePlayersList(data.players);
            this.uiManager.showScreen('player-lobby');
        });

        // Game flow events
        this.socket.on('game-started', (data) => {
            console.log('Game started:', data);
            if (this.gameManager.isHost) {
                this.uiManager.showScreen('host-game-screen');
            } else {
                this.uiManager.showScreen('player-game-screen');
            }
        });

        this.socket.on('question-start', (data) => {
            console.log('Question started:', data);
            console.log('Question timeLimit value:', data.timeLimit, 'Type:', typeof data.timeLimit);
            this.gameManager.displayQuestion(data);
            
            // Ensure timer has valid duration
            const timerDuration = data.timeLimit && !isNaN(data.timeLimit) ? data.timeLimit * 1000 : 30000; // Default 30 seconds
            console.log('Timer duration calculated:', timerDuration);
            this.gameManager.startTimer(timerDuration);
            
            if (this.soundManager.isEnabled()) {
                this.soundManager.playQuestionStartSound();
            }
        });

        this.socket.on('question-end', (data) => {
            console.log('Question ended:', data);
            this.gameManager.stopTimer();
            
            if (data && data.leaderboard) {
                this.gameManager.showLeaderboard(data.leaderboard);
            }
        });

        this.socket.on('question-timeout', (data) => {
            console.log('Question timed out:', data);
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
            console.log('Showing next question button');
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
            console.log('Hiding next question button');
            const nextButton = document.getElementById('next-question');
            if (nextButton) {
                nextButton.style.display = 'none';
                nextButton.onclick = null; // Clear onclick handler
            }
        });

        this.socket.on('game-end', (data) => {
            console.log('Game ended:', data);
            
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
                console.log('Calling showFinalResults with leaderboard:', data.finalLeaderboard);
                this.gameManager.showFinalResults(data.finalLeaderboard);
            }, 1000);
        });

        // Player-specific events
        this.socket.on('player-result', (data) => {
            console.log('🎯 Player result event received:', data);
            console.log('🎯 Calling gameManager.showPlayerResult...');
            this.gameManager.showPlayerResult(data);
        });

        this.socket.on('answer-submitted', (data) => {
            console.log('Answer submitted feedback:', data);
            this.gameManager.showAnswerSubmitted(data.answer);
        });

        // Statistics and updates
        this.socket.on('statistics-update', (data) => {
            console.log('Statistics updated:', data);
            this.updateStatistics(data);
        });

        this.socket.on('leaderboard-update', (data) => {
            console.log('Leaderboard updated:', data);
            this.gameManager.showLeaderboard(data.leaderboard);
            // Note: Removed fanfare from here - it should only play at final game end
        });

        // Answer statistics updates
        this.socket.on('answer-statistics', (data) => {
            console.log('Answer statistics received:', data);
            this.gameManager.updateAnswerStatistics(data);
        });

        this.socket.on('players-update', (data) => {
            console.log('Players updated:', data);
            this.gameManager.updatePlayersList(data.players);
        });

        this.socket.on('player-list-update', (data) => {
            console.log('Player list updated:', data);
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
            console.error('Socket error:', data);
            showAlert('error', data.message || 'An error occurred');
        });

        this.socket.on('game-not-found', (data) => {
            console.error('Game not found:', data);
            showAlert('error', data.message || 'Game not found');
        });

        this.socket.on('player-limit-reached', (data) => {
            console.error('Player limit reached:', data);
            showAlert('error', data.message || 'Player limit reached');
        });

        this.socket.on('invalid-pin', (data) => {
            console.error('Invalid PIN:', data);
            showAlert('error', data.message || 'Invalid game PIN');
        });

        this.socket.on('name-taken', (data) => {
            console.error('Name taken:', data);
            showAlert('error', data.message || 'Name is already taken');
        });

        // Host-specific events
        this.socket.on('host-statistics', (data) => {
            console.log('Host statistics:', data);
            this.updateHostStatistics(data);
        });

        this.socket.on('player-disconnected', (data) => {
            console.log('Player disconnected:', data);
            this.gameManager.updatePlayersList(data.players);
        });

        this.socket.on('all-players-answered', (data) => {
            console.log('All players answered:', data);
            // Could show visual feedback that all players have answered
        });

        // Special events
        this.socket.on('force-disconnect', (data) => {
            console.log('Force disconnect:', data);
            showAlert('info', data.message || 'You have been disconnected');
            this.uiManager.showScreen('main-menu');
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Reconnecting attempt:', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Reconnection failed');
            showAlert('error', 'Failed to reconnect to server');
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
        console.log('Attempting to join game with PIN:', pin, 'Name:', playerName);
        this.socket.emit('player-join', {
            pin: pin,
            name: playerName
        });
        console.log('Emitted player-join event');
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

        console.log('Updated player lobby display:', { gamePin, playerCount: players?.length });
    }

    /**
     * Create game
     */
    createGame(quizData) {
        console.log('SocketManager.createGame called with:', quizData);
        console.log('Socket connected:', this.socket.connected);
        try {
            this.socket.emit('host-join', quizData);
            console.log('Emitted host-join event successfully');
        } catch (error) {
            console.error('Error emitting host-join:', error);
        }
    }

    /**
     * Start game
     */
    startGame() {
        console.log('Attempting to start game...');
        console.log('Socket connected:', this.socket.connected);
        try {
            this.socket.emit('start-game');
            console.log('Emitted start-game event successfully');
        } catch (error) {
            console.error('Error starting game:', error);
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