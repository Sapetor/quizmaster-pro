/**
 * Results Manager Module
 * Handles quiz results operations: browse, view, export, and results management
 */

import { translationManager, showErrorAlert, showSuccessAlert } from './translation-manager.js';
import { errorHandler } from './error-handler.js';
import { errorBoundary } from './error-boundary.js';
import { logger } from '../core/config.js';
import { apiHelper } from './api-helper.js';

export class ResultsManager {
    constructor() {
        this.errorHandler = errorHandler;
        this.resultsCache = new Map();
        this.isLoading = false;
        
        // Memory management tracking
        this.eventListeners = new Map();
        this.documentListeners = [];
        
        // Bind cleanup methods
        this.cleanup = this.cleanup.bind(this);
        this.addDocumentListenerTracked = this.addDocumentListenerTracked.bind(this);
        
        logger.debug('🔧 ResultsManager initialized');
    }

    /**
     * Fetch all saved quiz results
     */
    async fetchResults() {
        try {
            this.isLoading = true;
            logger.debug('📊 Fetching quiz results...');
            
            const response = await fetch('/api/results');
            if (!response.ok) {
                throw new Error(`Failed to fetch results: ${response.status}`);
            }
            
            const results = await response.json();
            logger.debug(`📊 Fetched ${results.length} result files`);
            
            // Cache results for performance
            this.resultsCache.set('list', results);
            return results;
            
        } catch (error) {
            logger.error('❌ Error fetching results:', error);
            showErrorAlert('failed_fetch_results');
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Get specific quiz result by filename
     */
    async getResult(filename) {
        try {
            // Check cache first
            if (this.resultsCache.has(filename)) {
                return this.resultsCache.get(filename);
            }
            
            logger.debug(`📊 Fetching result file: ${filename}`);
            
            const response = await fetch(`/api/results/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch result: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Cache result
            this.resultsCache.set(filename, result);
            return result;
            
        } catch (error) {
            logger.error('❌ Error fetching result:', error);
            showErrorAlert('failed_fetch_result');
            return null;
        }
    }

    /**
     * Export quiz result in specified format
     */
    async exportResult(filename, format = 'csv') {
        try {
            logger.debug(`📊 Exporting result ${filename} as ${format}`);
            
            const response = await fetch(`/api/results/${filename}/export/${format}`);
            if (!response.ok) {
                throw new Error(`Failed to export result: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Extract game PIN from filename for better naming
            const gamePin = filename.match(/results_(\d+)_/)?.[1] || 'unknown';
            const extension = format.toLowerCase() === 'csv' ? 'csv' : 'json';
            const downloadFilename = `quiz_results_${gamePin}.${extension}`;
            
            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = downloadFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            
            showSuccessAlert('result_exported_successfully');
            logger.debug(`📊 Result exported successfully as ${downloadFilename}`);
            
        } catch (error) {
            logger.error('❌ Error exporting result:', error);
            showErrorAlert('failed_export_result');
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Format duration between start and end times
     */
    formatDuration(startTime, endTime) {
        if (!startTime || !endTime) return 'Unknown';
        
        try {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const durationMs = end - start;
            
            const minutes = Math.floor(durationMs / (1000 * 60));
            const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
            
            return `${minutes}m ${seconds}s`;
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Calculate average score from results
     */
    calculateAverageScore(results) {
        if (!results || !results.results || results.results.length === 0) {
            return 0;
        }
        
        const totalScore = results.results.reduce((sum, player) => sum + (player.score || 0), 0);
        return Math.round(totalScore / results.results.length);
    }

    /**
     * Get top scorer from results
     */
    getTopScorer(results) {
        if (!results || !results.results || results.results.length === 0) {
            return null;
        }
        
        return results.results.reduce((top, player) => {
            return (player.score || 0) > (top.score || 0) ? player : top;
        });
    }

    /**
     * Filter results based on search criteria
     */
    filterResults(results, searchTerm, dateFilter) {
        if (!results) return [];
        
        let filtered = results;
        
        // Text search filter
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(result => 
                result.quizTitle.toLowerCase().includes(term) ||
                result.gamePin.toString().includes(term)
            );
        }
        
        // Date filter
        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            
            switch (dateFilter) {
                case 'today':
                    filterDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    filterDate.setMonth(now.getMonth() - 1);
                    break;
                default:
                    return filtered;
            }
            
            filtered = filtered.filter(result => {
                const resultDate = new Date(result.saved);
                return resultDate >= filterDate;
            });
        }
        
        return filtered;
    }

    /**
     * Show results browser modal
     */
    async showResultsBrowser() {
        try {
            const modal = document.getElementById('results-browser-modal');
            if (!modal) {
                logger.error('❌ Results browser modal not found');
                return;
            }
            
            modal.classList.remove('hidden');
            modal.classList.add('show');
            
            // Load and display results
            await this.loadResultsTable();
            
            // Setup search and filter handlers
            this.setupResultsFilters();
            
        } catch (error) {
            logger.error('❌ Error showing results browser:', error);
            showErrorAlert('failed_show_results');
        }
    }

    /**
     * Hide results browser modal
     */
    hideResultsBrowser() {
        const modal = document.getElementById('results-browser-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    }

    /**
     * Load and populate results table
     */
    async loadResultsTable() {
        const tableBody = document.getElementById('results-table-body');
        const loadingIndicator = document.getElementById('results-loading');
        const emptyMessage = document.getElementById('results-empty');
        
        if (!tableBody) return;
        
        try {
            // Show loading
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');
            if (emptyMessage) emptyMessage.classList.add('hidden');
            tableBody.innerHTML = '';
            
            const results = await this.fetchResults();
            
            // Hide loading
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            
            if (results.length === 0) {
                if (emptyMessage) emptyMessage.classList.remove('hidden');
                return;
            }
            
            // Populate table
            results.forEach(result => {
                const row = this.createResultRow(result);
                tableBody.appendChild(row);
            });
            
        } catch (error) {
            logger.error('❌ Error loading results table:', error);
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
        }
    }

    /**
     * Create table row for a result
     */
    createResultRow(result) {
        const row = document.createElement('tr');
        row.className = 'results-table-row';
        
        const formattedDate = this.formatDate(result.saved);
        
        row.innerHTML = `
            <td class="results-table-cell" data-label="Quiz">${this.escapeHtml(result.quizTitle)}</td>
            <td class="results-table-cell" data-label="PIN">#${result.gamePin}</td>
            <td class="results-table-cell" data-label="Players">${result.participantCount}</td>
            <td class="results-table-cell" data-label="Date">${formattedDate}</td>
            <td class="results-table-cell results-actions" data-label="Actions">
                <button class="btn btn-sm btn-primary" onclick="resultsManager.previewResult('${result.filename}')"
                        data-translate="preview">Preview</button>
                <button class="btn btn-sm btn-secondary" onclick="resultsManager.exportResult('${result.filename}', 'csv')"
                        data-translate="export_csv">Export CSV</button>
                <button class="btn btn-sm btn-secondary" onclick="resultsManager.exportResult('${result.filename}', 'json')"
                        data-translate="export_json">Export JSON</button>
            </td>
        `;
        
        return row;
    }

    /**
     * Show result preview modal
     */
    async previewResult(filename) {
        try {
            const modal = document.getElementById('result-preview-modal');
            if (!modal) {
                logger.error('❌ Result preview modal not found');
                return;
            }
            
            const result = await this.getResult(filename);
            if (!result) return;
            
            // Populate preview modal
            this.populatePreviewModal(result);
            
            modal.classList.remove('hidden');
            modal.classList.add('show');
            
        } catch (error) {
            logger.error('❌ Error showing result preview:', error);
            showErrorAlert('failed_preview_result');
        }
    }

    /**
     * Populate preview modal with result data
     */
    populatePreviewModal(result) {
        // Quiz info
        const quizTitle = document.getElementById('preview-quiz-title');
        const gamePin = document.getElementById('preview-game-pin');
        const duration = document.getElementById('preview-duration');
        const averageScore = document.getElementById('preview-average-score');
        
        if (quizTitle) quizTitle.textContent = result.quizTitle || 'Untitled Quiz';
        if (gamePin) gamePin.textContent = `#${result.gamePin}`;
        if (duration) duration.textContent = this.formatDuration(result.startTime, result.endTime);
        if (averageScore) averageScore.textContent = `${this.calculateAverageScore(result)}%`;
        
        // Player results table
        const playersTableBody = document.getElementById('preview-players-table-body');
        if (playersTableBody && result.results) {
            playersTableBody.innerHTML = '';
            
            // Sort players by score (descending)
            const sortedPlayers = [...result.results].sort((a, b) => (b.score || 0) - (a.score || 0));
            
            sortedPlayers.forEach((player, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="preview-rank">${index + 1}</td>
                    <td class="preview-name">${this.escapeHtml(player.name)}</td>
                    <td class="preview-score">${player.score || 0}</td>
                    <td class="preview-answers">${player.answers ? player.answers.length : 0}</td>
                `;
                playersTableBody.appendChild(row);
            });
        }
    }

    /**
     * Setup search and filter handlers
     */
    setupResultsFilters() {
        const searchInput = document.getElementById('results-search');
        const dateFilter = document.getElementById('results-date-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
        }
        
        if (dateFilter) {
            dateFilter.addEventListener('change', () => this.applyFilters());
        }
    }

    /**
     * Apply search and date filters to results table
     */
    async applyFilters() {
        const searchTerm = document.getElementById('results-search')?.value || '';
        const dateFilter = document.getElementById('results-date-filter')?.value || 'all';
        
        // Get cached results or fetch new ones
        let results = this.resultsCache.get('list');
        if (!results) {
            results = await this.fetchResults();
        }
        
        // Apply filters
        const filteredResults = this.filterResults(results, searchTerm, dateFilter);
        
        // Update table
        const tableBody = document.getElementById('results-table-body');
        const emptyMessage = document.getElementById('results-empty');
        
        if (tableBody) {
            tableBody.innerHTML = '';
            
            if (filteredResults.length === 0) {
                if (emptyMessage) emptyMessage.classList.remove('hidden');
            } else {
                if (emptyMessage) emptyMessage.classList.add('hidden');
                filteredResults.forEach(result => {
                    const row = this.createResultRow(result);
                    tableBody.appendChild(row);
                });
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Track document event listeners for cleanup
     */
    addDocumentListenerTracked(event, handler, options = false) {
        document.addEventListener(event, handler, options);
        this.documentListeners.push({ event, handler, options });
    }

    /**
     * Clean up resources and event listeners
     */
    cleanup() {
        // Remove tracked document listeners
        this.documentListeners.forEach(({ event, handler, options }) => {
            document.removeEventListener(event, handler, options);
        });
        this.documentListeners = [];
        
        // Clear event listeners map
        this.eventListeners.clear();
        
        // Clear cache
        this.resultsCache.clear();
        
        logger.debug('🧹 ResultsManager cleanup completed');
    }
}

// Create and export singleton instance
export const resultsManager = new ResultsManager();

// Make available globally for onclick handlers
window.resultsManager = resultsManager;

export default resultsManager;