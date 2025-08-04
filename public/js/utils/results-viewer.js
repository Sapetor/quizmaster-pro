/**
 * Results Viewer - Enhanced interface for viewing and managing quiz results
 * Provides a comprehensive modal interface accessible from the toolbar
 */

import { translationManager, showErrorAlert, showSuccessAlert } from './translation-manager.js';
import { errorHandler } from './error-handler.js';
import { logger } from '../core/config.js';

export class ResultsViewer {
    constructor() {
        this.resultsCache = null;
        this.filteredResults = null;
        this.isLoading = false;
        this.currentDetailResult = null;
        
        this.initializeEventListeners();
        logger.debug('🔧 ResultsViewer initialized');
    }

    /**
     * Initialize event listeners for modal interactions
     */
    initializeEventListeners() {
        // Main modal controls - X close button
        const closeBtn = document.getElementById('close-results-viewer');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }

        // Detail modal controls - X close button  
        const detailCloseBtn = document.getElementById('close-result-detail');
        if (detailCloseBtn) {
            detailCloseBtn.addEventListener('click', () => this.hideDetailModal());
        }

        // Search and sorting
        const searchInput = document.getElementById('search-results');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterResults());
        }

        const sortSelect = document.getElementById('sort-results');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.filterResults());
        }

        // Action buttons
        const refreshBtn = document.getElementById('refresh-results');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshResults());
        }

        const downloadBtn = document.getElementById('download-result-csv');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadCurrentResult());
        }

        const deleteBtn = document.getElementById('delete-result');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteCurrentResult());
        }

        // Modal overlay click to close
        const modal = document.getElementById('results-viewing-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }

        const detailModal = document.getElementById('result-detail-modal');
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) {
                    this.hideDetailModal();
                }
            });
        }
    }

    /**
     * Show the results viewing modal
     */
    async showModal() {
        logger.debug('📊 Opening results viewing modal');
        const modal = document.getElementById('results-viewing-modal');
        if (modal) {
            modal.style.display = 'flex';
            await this.loadResults();
        } else {
            logger.error('📊 Results viewing modal not found');
            showErrorAlert('Results viewer not available');
        }
    }

    /**
     * Hide the results viewing modal
     */
    hideModal() {
        const modal = document.getElementById('results-viewing-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Show the result detail modal
     */
    showDetailModal(result) {
        this.currentDetailResult = result;
        const modal = document.getElementById('result-detail-modal');
        if (modal) {
            this.populateDetailModal(result);
            modal.style.display = 'flex';
        }
    }

    /**
     * Hide the result detail modal
     */
    hideDetailModal() {
        const modal = document.getElementById('result-detail-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentDetailResult = null;
    }

    /**
     * Fetch results with retry logic
     */
    async fetchWithRetry(url, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.debug(`📊 Fetch attempt ${attempt}/${maxRetries} for ${url}`);
                const response = await fetch(url);
                
                if (response.ok) {
                    logger.debug(`📊 Fetch successful on attempt ${attempt}`);
                    return response;
                }
                
                if (response.status === 404 && attempt < maxRetries) {
                    logger.warn(`📊 404 error on attempt ${attempt}, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                return response;
                
            } catch (error) {
                logger.error(`📊 Fetch attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Load and display results
     */
    async loadResults() {
        this.isLoading = true;
        this.showLoading();

        try {
            logger.debug('📊 Fetching results from /api/results...');
            const response = await this.fetchWithRetry('/api/results', 3, 1000);
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('📊 Error response:', errorText);
                throw new Error(`Failed to fetch results: ${response.status} - ${errorText}`);
            }
            
            const results = await response.json();
            this.resultsCache = results;
            this.filteredResults = [...results];
            
            logger.debug(`📊 Loaded ${results.length} results`);
            
            this.updateSummaryStats();
            this.filterResults();
            
        } catch (error) {
            logger.error('❌ Error loading results:', error);
            this.showError('Failed to load quiz results');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * Refresh results data
     */
    async refreshResults() {
        await this.loadResults();
        showSuccessAlert('Results refreshed successfully');
    }

    /**
     * Show loading state
     */
    showLoading() {
        const loadingEl = document.getElementById('results-loading');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingEl = document.getElementById('results-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const resultsList = document.getElementById('results-list');
        if (resultsList) {
            resultsList.innerHTML = `
                <div class="empty-results">
                    <div class="icon">⚠️</div>
                    <h4>Error</h4>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * Update summary statistics
     */
    updateSummaryStats() {
        if (!this.resultsCache) return;

        const totalQuizzes = this.resultsCache.length;
        let totalParticipants = 0;
        let totalScore = 0;
        let totalPossibleScore = 0;

        this.resultsCache.forEach(result => {
            if (result.results && Array.isArray(result.results)) {
                totalParticipants += result.results.length;
                
                result.results.forEach(player => {
                    totalScore += player.score || 0;
                    totalPossibleScore += player.maxScore || 0;
                });
            }
        });

        const avgScore = totalPossibleScore > 0 ? Math.round((totalScore / totalPossibleScore) * 100) : 0;

        this.updateStatElement('total-quizzes', totalQuizzes);
        this.updateStatElement('total-participants', totalParticipants);
        this.updateStatElement('avg-score', `${avgScore}%`);
    }

    /**
     * Update a stat element
     */
    updateStatElement(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    /**
     * Filter and sort results based on user input
     */
    filterResults() {
        if (!this.resultsCache) return;

        const searchTerm = document.getElementById('search-results')?.value.toLowerCase() || '';
        const sortBy = document.getElementById('sort-results')?.value || 'date-desc';

        // Filter by search term
        let filtered = this.resultsCache.filter(result => {
            return result.quizTitle?.toLowerCase().includes(searchTerm);
        });

        // Sort results
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.saved || 0) - new Date(a.saved || 0);
                case 'date-asc':
                    return new Date(a.saved || 0) - new Date(b.saved || 0);
                case 'title-asc':
                    return (a.quizTitle || '').localeCompare(b.quizTitle || '');
                case 'participants-desc':
                    const aParticipants = a.results?.length || 0;
                    const bParticipants = b.results?.length || 0;
                    return bParticipants - aParticipants;
                default:
                    return 0;
            }
        });

        this.filteredResults = filtered;
        this.renderResults();
    }

    /**
     * Render the results list
     */
    renderResults() {
        const resultsList = document.getElementById('results-list');
        if (!resultsList) return;

        if (!this.filteredResults || this.filteredResults.length === 0) {
            resultsList.innerHTML = `
                <div class="empty-results">
                    <div class="icon">📊</div>
                    <h4>No Results Found</h4>
                    <p>No quiz results match your search criteria.</p>
                </div>
            `;
            return;
        }

        const resultsHTML = this.filteredResults.map(result => {
            const participantCount = result.results?.length || 0;
            const avgScore = this.calculateAverageScore(result);
            const formattedDate = this.formatDate(result.saved);

            return `
                <div class="result-item" data-filename="${result.filename}">
                    <div class="result-info">
                        <div class="result-title">${result.quizTitle || 'Untitled Quiz'}</div>
                        <div class="result-meta">
                            <span>📅 ${formattedDate}</span>
                            <span>🎯 PIN: ${result.gamePin}</span>
                            <span>👥 ${participantCount} participants</span>
                            <span>📊 ${avgScore}% avg score</span>
                        </div>
                    </div>
                    <div class="result-actions">
                        <button class="result-action-btn download" onclick="resultsViewer.quickDownload('${result.filename}')">
                            💾 Download
                        </button>
                        <button class="result-action-btn delete" onclick="resultsViewer.quickDelete('${result.filename}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        resultsList.innerHTML = resultsHTML;

        // Add click listeners for detail view
        resultsList.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger detail view if clicking action buttons
                if (!e.target.closest('.result-actions')) {
                    const filename = item.dataset.filename;
                    const result = this.filteredResults.find(r => r.filename === filename);
                    if (result) {
                        this.showDetailModal(result);
                    }
                }
            });
        });
    }

    /**
     * Calculate average score for a result
     */
    calculateAverageScore(result) {
        if (!result.results || result.results.length === 0) return '0';
        
        let totalScore = 0;
        let totalPossible = 0;
        
        result.results.forEach(player => {
            totalScore += player.score || 0;
            totalPossible += player.maxScore || 0;
        });
        
        return totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Populate the detail modal with result information
     */
    async populateDetailModal(result) {
        // If we only have summary data, fetch full details
        let fullResult = result;
        if (!result.results && result.filename) {
            try {
                const response = await fetch(`/api/results/${result.filename}`);
                if (response.ok) {
                    fullResult = await response.json();
                    fullResult.filename = result.filename; // Preserve filename
                }
            } catch (error) {
                logger.error('Error fetching detailed results:', error);
            }
        }

        // Set basic info
        document.getElementById('result-detail-title').textContent = `${fullResult.quizTitle || 'Untitled Quiz'} - Results`;
        document.getElementById('detail-quiz-title').textContent = fullResult.quizTitle || 'Untitled Quiz';
        document.getElementById('detail-game-pin').textContent = fullResult.gamePin || 'Unknown';
        document.getElementById('detail-date').textContent = this.formatDate(fullResult.saved);
        document.getElementById('detail-participants').textContent = fullResult.results?.length || 0;
        document.getElementById('detail-avg-score').textContent = `${this.calculateAverageScore(fullResult)}%`;

        // Populate participant results
        const participantResults = document.getElementById('participant-results');
        if (!participantResults) return;

        if (!fullResult.results || fullResult.results.length === 0) {
            participantResults.innerHTML = `
                <div class="empty-results">
                    <div class="icon">👥</div>
                    <h4>No Participants</h4>
                    <p>No participant data available for this quiz.</p>
                </div>
            `;
            return;
        }

        // Sort participants by score (descending)
        const sortedResults = [...fullResult.results].sort((a, b) => (b.score || 0) - (a.score || 0));

        // Calculate max score for percentage calculation
        const maxPossibleScore = sortedResults.length > 0 ? 
            Math.max(...sortedResults.map(p => p.answers?.length || 0)) * 100 : 0;

        const participantsHTML = `
            <div class="participant-header">Participant Results</div>
            ${sortedResults.map(player => {
                const playerScore = player.score || 0;
                const answeredQuestions = player.answers?.filter(a => a).length || 0;
                const totalQuestions = player.answers?.length || 0;
                const percentage = totalQuestions > 0 ? Math.round((playerScore / (totalQuestions * 100)) * 100) : 0;
                const scoreClass = this.getScoreClass(percentage);
                const timeDisplay = player.completedAt ? this.formatTime(player.completedAt) : 'N/A';
                
                return `
                    <div class="participant-row">
                        <div class="participant-name">${player.name || 'Anonymous'}</div>
                        <div class="participant-score ${scoreClass}">${playerScore} pts</div>
                        <div class="participant-percentage ${scoreClass}">${percentage}%</div>
                        <div class="participant-time">${timeDisplay}</div>
                    </div>
                `;
            }).join('')}
        `;

        participantResults.innerHTML = participantsHTML;
    }

    /**
     * Get CSS class for score coloring
     */
    getScoreClass(percentage) {
        if (percentage >= 90) return 'score-excellent';
        if (percentage >= 75) return 'score-good';
        if (percentage >= 60) return 'score-average';
        return 'score-poor';
    }

    /**
     * Format time duration
     */
    formatTime(completedAt) {
        try {
            const date = new Date(completedAt);
            return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (error) {
            return 'N/A';
        }
    }

    /**
     * Quick download functionality
     */
    async quickDownload(filename) {
        try {
            logger.debug(`📊 Quick downloading result: ${filename}`);
            
            const response = await fetch(`/api/results/${filename}/export/csv`);
            if (!response.ok) {
                throw new Error(`Failed to export result: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const gamePin = filename.match(/results_(\d+)_/)?.[1] || 'unknown';
            const downloadFilename = `quiz_results_${gamePin}.csv`;
            
            const link = document.createElement('a');
            link.href = url;
            link.download = downloadFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            window.URL.revokeObjectURL(url);
            
            showSuccessAlert('Result downloaded successfully');
            logger.debug(`📊 Result downloaded successfully as ${downloadFilename}`);
            
        } catch (error) {
            logger.error('❌ Error downloading result:', error);
            showErrorAlert('Failed to download result');
        }
    }

    /**
     * Quick delete functionality
     */
    async quickDelete(filename) {
        if (!confirm('Are you sure you want to delete this quiz result? This action cannot be undone.')) {
            return;
        }

        try {
            logger.debug(`📊 Deleting result: ${filename}`);
            logger.debug(`📊 Delete URL: /api/results/${filename}`);
            
            const response = await fetch(`/api/results/${filename}`, {
                method: 'DELETE'
            });
            
            logger.debug(`📊 Delete response status: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`📊 Delete error response: ${errorText}`);
                throw new Error(`Failed to delete result: ${response.status}`);
            }
            
            // Remove from cache and refresh display
            this.resultsCache = this.resultsCache.filter(r => r.filename !== filename);
            this.updateSummaryStats();
            this.filterResults();
            
            showSuccessAlert('Result deleted successfully');
            logger.debug(`📊 Result deleted successfully: ${filename}`);
            
        } catch (error) {
            logger.error('❌ Error deleting result:', error);
            showErrorAlert('Failed to delete result');
        }
    }

    /**
     * Download current result from detail modal
     */
    async downloadCurrentResult() {
        if (this.currentDetailResult) {
            await this.quickDownload(this.currentDetailResult.filename);
        }
    }

    /**
     * Delete current result from detail modal
     */
    async deleteCurrentResult() {
        if (this.currentDetailResult) {
            await this.quickDelete(this.currentDetailResult.filename);
            this.hideDetailModal();
        }
    }
}

// Create and export singleton instance
export const resultsViewer = new ResultsViewer();

// Make available globally for onclick handlers
window.resultsViewer = resultsViewer;

export default resultsViewer;