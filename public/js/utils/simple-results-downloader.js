/**
 * Simple Results Downloader
 * Simple tool to populate dropdown with available results and download CSV
 */

import { translationManager, showErrorAlert, showSuccessAlert } from './translation-manager.js';
import { errorHandler } from './error-handler.js';
import { logger } from '../core/config.js';

export class SimpleResultsDownloader {
    constructor() {
        this.resultsCache = null;
        this.isLoading = false;
        
        logger.debug('🔧 SimpleResultsDownloader initialized');
    }

    /**
     * Fetch with retry logic for handling temporary server issues
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
                
                // If it's a 404 and we have more attempts, wait and retry
                if (response.status === 404 && attempt < maxRetries) {
                    logger.warn(`📊 404 error on attempt ${attempt}, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // Return the response for other status codes or last attempt
                return response;
                
            } catch (error) {
                logger.error(`📊 Fetch attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Initialize the dropdown with available results
     */
    async initializeDropdown() {
        const dropdown = document.getElementById('results-dropdown');
        const downloadButton = document.getElementById('download-selected');
        
        if (!dropdown) {
            logger.warn('Results dropdown not found');
            return;
        }

        try {
            this.isLoading = true;
            
            // Clear existing options except the first placeholder
            dropdown.innerHTML = '<option value="" data-translate="select_results">Select results to download...</option>';
            
            // Fetch available results with retry logic
            logger.debug('📊 Fetching results from /api/results...');
            const response = await this.fetchWithRetry('/api/results', 3, 1000);
            logger.debug('📊 Response status:', response.status, 'Response OK:', response.ok);
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('📊 Error response:', errorText);
                throw new Error(`Failed to fetch results: ${response.status} - ${errorText}`);
            }
            
            const results = await response.json();
            this.resultsCache = results;
            
            if (results.length === 0) {
                const noResultsOption = document.createElement('option');
                noResultsOption.value = '';
                noResultsOption.textContent = translationManager.getTranslationSync('no_results_found') || 'No results found';
                noResultsOption.disabled = true;
                dropdown.appendChild(noResultsOption);
                
                if (downloadButton) {
                    downloadButton.disabled = true;
                }
                return;
            }
            
            // Populate dropdown with results (most recent first)
            results.forEach(result => {
                const option = document.createElement('option');
                option.value = result.filename;
                option.textContent = `${result.quizTitle} (PIN: ${result.gamePin}) - ${this.formatDate(result.saved)}`;
                dropdown.appendChild(option);
            });
            
            // Setup download button handler
            if (downloadButton) {
                downloadButton.onclick = () => this.downloadSelected();
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download CSV';
            }
            
            logger.debug(`📊 Populated dropdown with ${results.length} results`);
            
        } catch (error) {
            logger.error('❌ Error initializing results dropdown:', error);
            showErrorAlert('failed_fetch_results');
            
            // Show error in dropdown
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = 'Error loading results';
            errorOption.disabled = true;
            dropdown.appendChild(errorOption);
            
            if (downloadButton) {
                downloadButton.disabled = true;
            }
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Download the selected result
     */
    async downloadSelected() {
        const dropdown = document.getElementById('results-dropdown');
        const downloadButton = document.getElementById('download-selected');
        
        if (!dropdown || !dropdown.value) {
            showErrorAlert('Please select a result to download');
            return;
        }
        
        const filename = dropdown.value;
        
        try {
            if (downloadButton) {
                downloadButton.disabled = true;
                downloadButton.textContent = translationManager.getTranslationSync('loading') || 'Loading...';
            }
            
            logger.debug(`📊 Downloading result: ${filename}`);
            
            const response = await fetch(`/api/results/${filename}/export/csv`);
            if (!response.ok) {
                throw new Error(`Failed to export result: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Extract game PIN from filename for better naming
            const gamePin = filename.match(/results_(\d+)_/)?.[1] || 'unknown';
            const downloadFilename = `quiz_results_${gamePin}.csv`;
            
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
            logger.debug(`📊 Result downloaded successfully as ${downloadFilename}`);
            
        } catch (error) {
            logger.error('❌ Error downloading result:', error);
            showErrorAlert('failed_export_result');
        } finally {
            if (downloadButton) {
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download CSV';
            }
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
     * Show the download tool (called when final results are shown)
     */
    async showDownloadTool() {
        logger.debug('📊 showDownloadTool called');
        const downloadSection = document.querySelector('.download-results');
        if (downloadSection) {
            downloadSection.style.display = 'block';
            await this.initializeDropdown();
        } else {
            logger.error('📊 Download section not found in DOM');
        }
    }

    /**
     * Hide the download tool
     */
    hideDownloadTool() {
        const downloadSection = document.querySelector('.download-results');
        if (downloadSection) {
            downloadSection.style.display = 'none';
        }
    }
}

// Create and export singleton instance
export const simpleResultsDownloader = new SimpleResultsDownloader();

// Make available globally
window.simpleResultsDownloader = simpleResultsDownloader;

export default simpleResultsDownloader;