/**
 * Simple Results Downloader
 * Simple tool to populate dropdown with available results and download CSV
 */

import { translationManager, showErrorAlert, showSuccessAlert } from './translation-manager.js';
import { errorHandler } from './error-handler.js';
import { logger } from '../core/config.js';
import { resultsManagerService } from '../services/results-manager-service.js';

export class SimpleResultsDownloader {
    constructor() {
        this.currentExportFormat = 'simple'; // Default to simple format for this tool
        
        // Listen to results service updates
        resultsManagerService.addListener((event, data) => {
            this.handleServiceUpdate(event, data);
        });
        
        logger.debug('🔧 SimpleResultsDownloader initialized');
    }

    /**
     * Handle updates from the results manager service
     */
    handleServiceUpdate(event, data) {
        switch (event) {
            case 'resultsUpdated':
                this.onResultsUpdated(data);
                break;
            case 'downloadComplete':
                showSuccessAlert(`Downloaded: ${data.downloadFilename}`);
                break;
            case 'error':
                logger.error('Service error:', data);
                break;
        }
    }

    /**
     * Handle results update from service
     */
    onResultsUpdated(results) {
        // Update dropdown if it's currently visible
        const dropdown = document.getElementById('results-dropdown');
        if (dropdown && dropdown.style.display !== 'none') {
            this.populateDropdownWithResults(results);
        }
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
     * Initialize the dropdown with available results using the service
     */
    async initializeDropdown() {
        const dropdown = document.getElementById('results-dropdown');
        const downloadButton = document.getElementById('download-selected');
        
        if (!dropdown) {
            logger.warn('Results dropdown not found');
            return;
        }

        try {
            // Clear existing options except the first placeholder
            dropdown.innerHTML = '<option value="" data-translate="select_results">Select results to download...</option>';
            
            // Fetch available results using the service
            logger.debug('📊 Fetching results via service...');
            const results = await resultsManagerService.fetchResults();
            
            this.populateDropdownWithResults(results);
            
            // Setup download button handler
            if (downloadButton) {
                downloadButton.onclick = () => this.downloadSelected();
                downloadButton.disabled = results.length === 0;
                downloadButton.textContent = 'Download CSV';
            }
            
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
        }
    }

    /**
     * Populate dropdown with results data
     */
    populateDropdownWithResults(results) {
        const dropdown = document.getElementById('results-dropdown');
        const downloadButton = document.getElementById('download-selected');
        
        if (!dropdown) return;

        // Clear existing options except the first placeholder
        const placeholder = dropdown.querySelector('option[value=""]');
        dropdown.innerHTML = '';
        if (placeholder) {
            dropdown.appendChild(placeholder);
        } else {
            dropdown.innerHTML = '<option value="" data-translate="select_results">Select results to download...</option>';
        }

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
        
        if (downloadButton) {
            downloadButton.disabled = false;
        }
        
        logger.debug(`📊 Populated dropdown with ${results.length} results`);
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
                downloadButton.textContent = 'Loading...';
            }
            
            logger.debug(`📊 Downloading result: ${filename}`);
            
            // Simple direct API call - no over-engineered service layer
            const response = await fetch(`/api/results/${filename}/export/csv`);
            
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }
            
            // Create download
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
            
            logger.debug(`📊 Download completed: ${downloadFilename}`);
            
        } catch (error) {
            logger.error('❌ Download failed:', error);
            showErrorAlert('Download failed. Please try again.');
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
            this.addViewAllResultsButton();
        } else {
            logger.error('📊 Download section not found in DOM');
        }
    }

    /**
     * Add a "View All Results" button for cross-tool navigation
     */
    addViewAllResultsButton() {
        const downloadSection = document.querySelector('.download-results');
        if (!downloadSection) return;

        // Check if button already exists
        if (downloadSection.querySelector('.view-all-results-btn')) return;

        const viewAllBtn = document.createElement('button');
        viewAllBtn.className = 'view-all-results-btn';
        viewAllBtn.textContent = 'View All Results';
        viewAllBtn.style.cssText = `
            margin-left: 10px;
            padding: 8px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        viewAllBtn.addEventListener('click', () => {
            this.openFullResultsViewer();
        });

        // Add after the download button
        const downloadButton = downloadSection.querySelector('#download-selected');
        if (downloadButton && downloadButton.parentNode) {
            downloadButton.parentNode.insertBefore(viewAllBtn, downloadButton.nextSibling);
        }
    }

    /**
     * Open the full results viewer
     */
    openFullResultsViewer() {
        logger.debug('📊 Opening full results viewer from simple downloader');
        
        // Import and use the results viewer
        if (window.resultsViewer) {
            window.resultsViewer.showModal();
        } else {
            // Fallback - try to import dynamically
            import('./results-viewer.js').then(({ resultsViewer }) => {
                resultsViewer.showModal();
            }).catch(error => {
                logger.error('Failed to load results viewer:', error);
                showErrorAlert('Could not open detailed results viewer');
            });
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