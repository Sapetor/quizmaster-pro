/**
 * Results Viewer - Enhanced interface for viewing and managing quiz results
 * Provides a comprehensive modal interface accessible from the toolbar
 */

import { translationManager, showErrorAlert, showSuccessAlert } from './translation-manager.js';
import { errorHandler } from './error-handler.js';
import { logger } from '../core/config.js';
import { resultsManagerService } from '../services/results-manager-service.js';

export class ResultsViewer {
    constructor() {
        this.filteredResults = null;
        this.currentDetailResult = null;
        this.currentExportFormat = 'analytics';
        
        this.initializeEventListeners();
        
        // Listen to results service updates
        resultsManagerService.addListener((event, data) => {
            this.handleServiceUpdate(event, data);
        });
        
        logger.debug('🔧 ResultsViewer initialized');
    }

    /**
     * Handle updates from the results manager service
     */
    handleServiceUpdate(event, data) {
        switch (event) {
            case 'loadingStart':
                this.showLoading();
                break;
            case 'loadingEnd':
                this.hideLoading();
                break;
            case 'resultsUpdated':
                this.onResultsUpdated(data);
                break;
            case 'error':
                this.showError('Failed to load quiz results: ' + data.message);
                break;
            case 'downloadComplete':
                showSuccessAlert(`Downloaded: ${data.downloadFilename}`);
                break;
            case 'resultDeleted':
                this.onResultDeleted(data);
                break;
        }
    }

    /**
     * Handle results update from service
     */
    onResultsUpdated(results) {
        this.filteredResults = [...results];
        this.updateSummaryStats();
        this.filterResults();
    }

    /**
     * Handle result deletion from service
     */
    onResultDeleted(filename) {
        if (this.filteredResults) {
            this.filteredResults = this.filteredResults.filter(r => r.filename !== filename);
            this.updateSummaryStats();
            this.renderResults();
        }
        
        // Close detail modal if we're viewing the deleted result
        if (this.currentDetailResult && this.currentDetailResult.filename === filename) {
            this.hideDetailModal();
        }
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

        // Format selection for downloads
        const formatSelect = document.getElementById('export-format-select');
        if (formatSelect) {
            formatSelect.addEventListener('change', (e) => {
                this.currentExportFormat = e.target.value;
                logger.debug(`📊 Export format changed to: ${this.currentExportFormat}`);
            });
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
     * Load and display results using the service
     */
    async loadResults() {
        try {
            const results = await resultsManagerService.fetchResults();
            // Results are already handled via service listeners
            logger.debug(`📊 Loaded ${results.length} results via service`);
        } catch (error) {
            logger.error('❌ Error loading results via service:', error);
            this.showError('Failed to load quiz results');
        }
    }

    /**
     * Refresh results data
     */
    async refreshResults() {
        try {
            await resultsManagerService.fetchResults(true); // Force refresh
            showSuccessAlert('Results refreshed successfully');
        } catch (error) {
            logger.error('❌ Error refreshing results:', error);
            showErrorAlert('Failed to refresh results');
        }
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
        if (!this.filteredResults) return;

        const stats = resultsManagerService.calculateSummaryStats(this.filteredResults);
        
        this.updateStatElement('total-quizzes', stats.totalQuizzes);
        this.updateStatElement('total-participants', stats.totalParticipants);
        this.updateStatElement('avg-score', `${stats.averageScore}%`);
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
        const allResults = Array.from(resultsManagerService.resultsCache.values());
        if (!allResults.length) return;

        const searchTerm = document.getElementById('search-results')?.value.toLowerCase() || '';
        const sortBy = document.getElementById('sort-results')?.value || 'date-desc';

        this.filteredResults = resultsManagerService.filterResults(allResults, searchTerm, sortBy);
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
                        <div class="download-options">
                            <button class="result-action-btn download" onclick="resultsViewer.showDownloadOptions('${result.filename}')">
                                💾 Download
                            </button>
                        </div>
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
    async quickDownload(filename, format = null) {
        try {
            logger.debug(`📊 Quick downloading result: ${filename}`);
            
            const exportFormat = format || this.currentExportFormat;
            logger.debug(`📊 Using ${exportFormat} format for download`);
            
            await resultsManagerService.downloadResult(filename, exportFormat, 'csv');
            return; // Service handles the download, so exit early
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
            
            await resultsManagerService.deleteResult(filename);
            
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

    /**
     * Show download options for a specific result
     */
    async showDownloadOptions(filename) {
        const result = this.filteredResults?.find(r => r.filename === filename);
        if (!result) {
            logger.error(`Result not found: ${filename}`);
            return;
        }

        // Get available formats for this result
        const formats = resultsManagerService.getAvailableFormats(result);
        
        if (formats.length <= 1) {
            // Only one format available, download directly
            await this.quickDownload(filename, formats[0]?.key || 'analytics');
            return;
        }

        // Show format selection modal/dropdown
        this.showFormatSelectionModal(filename, formats);
    }

    /**
     * Show format selection modal
     */
    showFormatSelectionModal(filename, formats) {
        // Create a simple modal for format selection
        const modal = document.createElement('div');
        modal.className = 'format-selection-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 500px;
        `;

        content.innerHTML = `
            <h3>Select Export Format</h3>
            <p>Choose how you'd like to download the results:</p>
            <div class="format-options" style="margin: 15px 0;">
                ${formats.map(format => `
                    <label style="display: block; margin: 8px 0; cursor: pointer;">
                        <input type="radio" name="export-format" value="${format.key}" 
                               ${format.key === this.currentExportFormat ? 'checked' : ''}>
                        <strong>${format.name}</strong><br>
                        <small style="color: #666; margin-left: 20px;">${format.description}</small>
                    </label>
                `).join('')}
            </div>
            <div style="text-align: right; margin-top: 20px;">
                <button id="format-cancel-btn" style="margin-right: 10px; padding: 8px 16px;">Cancel</button>
                <button id="format-download-btn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px;">Download</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Add event listeners
        const cancelBtn = content.querySelector('#format-cancel-btn');
        const downloadBtn = content.querySelector('#format-download-btn');

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        downloadBtn.addEventListener('click', async () => {
            const selectedFormat = content.querySelector('input[name="export-format"]:checked')?.value || 'analytics';
            document.body.removeChild(modal);
            await this.quickDownload(filename, selectedFormat);
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}

// Create and export singleton instance
export const resultsViewer = new ResultsViewer();

// Make available globally for onclick handlers
window.resultsViewer = resultsViewer;

export default resultsViewer;