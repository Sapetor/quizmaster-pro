/**
 * AI Question Generator Module
 * Handles AI-powered question generation from various providers
 * 
 * EXTRACTION NOTES:
 * - Extracted from script.js lines 4804-5572
 * - Includes all AI provider integrations: Ollama, OpenAI, Claude, HuggingFace
 * - Handles file uploads and content parsing
 * - Manages API keys and model selection
 * - Dependencies: translation-manager.js for translationManager.getTranslationSync()
 */

import { logger } from '../core/config.js';

import { translationManager } from '../utils/translation-manager.js';

export class AIQuestionGenerator {
    constructor() {
        this.providers = {
            ollama: {
                name: "Ollama (Local)",
                apiKey: false,
                endpoint: "http://localhost:11434/api/generate",
                models: ["qwen2.5:7b", "qwen2.5:3b", "llama3.1:8b", "phi3:mini"]
            },
            huggingface: {
                name: "Hugging Face",
                apiKey: true,
                endpoint: "https://api-inference.huggingface.co/models/google/flan-t5-large",
                models: ["google/flan-t5-large"]
            },
            openai: {
                name: "OpenAI",
                apiKey: true,
                endpoint: "https://api.openai.com/v1/chat/completions",
                models: ["gpt-3.5-turbo", "gpt-4"]
            },
            claude: {
                name: "Anthropic Claude", 
                apiKey: true,
                endpoint: "https://api.anthropic.com/v1/messages",
                models: ["claude-3-haiku", "claude-3-sonnet"]
            }
        };
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Provider selection change
        const providerSelect = document.getElementById('ai-provider');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                this.handleProviderChange(e.target.value);
            });
        }

        // Model selection change
        const modelSelect = document.getElementById('ollama-model');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    localStorage.setItem('ollama_selected_model', e.target.value);
                }
            });
        }

        // File upload handling
        const fileInput = document.getElementById('content-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files[0]);
            });
        }

        // Content type detection
        const contentTextarea = document.getElementById('source-content');
        if (contentTextarea) {
            contentTextarea.addEventListener('input', (e) => {
                this.detectContentType(e.target.value);
            });
        }

        // Generate questions button
        const generateBtn = document.getElementById('generate-questions');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateQuestions();
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-ai-generator');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
    }

    async generateQuestions() {
        const provider = document.getElementById('ai-provider')?.value;
        const content = document.getElementById('source-content')?.value?.trim();
        const questionCount = parseInt(document.getElementById('question-count')?.value) || 1;
        const difficulty = document.getElementById('difficulty-level')?.value || 'medium';
        
        if (!content) {
            alert(translationManager.getTranslationSync('please_provide_source_material'));
            return;
        }

        // Check for API key if required
        const needsApiKey = this.providers[provider]?.apiKey;
        if (needsApiKey) {
            const apiKey = localStorage.getItem(`ai_api_key_${provider}`);
            if (!apiKey) {
                alert(translationManager.getTranslationSync('please_enter_api_key'));
                return;
            }
        }

        // Show loading state
        const generateBtn = document.getElementById('generate-questions');
        const statusDiv = document.getElementById('generation-status');
        
        if (generateBtn) generateBtn.disabled = true;
        if (statusDiv) statusDiv.style.display = 'block';

        try {
            // Build prompt based on content type and settings
            const prompt = this.buildPrompt(content, questionCount, difficulty);
            
            let questions = [];
            switch (provider) {
                case 'ollama':
                    questions = await this.generateWithOllama(prompt);
                    break;
                case 'huggingface':
                    questions = await this.generateWithHuggingFace();
                    break;
                case 'openai':
                    questions = await this.generateWithOpenAI(prompt);
                    break;
                case 'claude':
                    questions = await this.generateWithClaude(prompt);
                    break;
            }

            if (questions && questions.length > 0) {
                this.processGeneratedQuestions(questions);
                this.closeModal();
                alert(translationManager.getTranslationSync('successfully_generated_questions', questions.length));
            } else {
                alert(translationManager.getTranslationSync('error_generating'));
            }

        } catch (error) {
            logger.error('Generation error:', error);
            alert(translationManager.getTranslationSync('error_generating_questions_detail', error.message));
        } finally {
            // Reset UI
            if (generateBtn) generateBtn.disabled = false;
            if (statusDiv) statusDiv.style.display = 'none';
        }
    }

    buildPrompt(content, questionCount, difficulty) {
        const contentType = this.detectContentType(content);
        const language = localStorage.getItem('language') || 'en';
        
        let basePrompt = '';
        if (language === 'es') {
            basePrompt = `Crea ${questionCount} preguntas de opción múltiple sobre el siguiente contenido. Dificultad: ${difficulty}.`;
        } else {
            basePrompt = `Create ${questionCount} multiple choice questions about the following content. Difficulty: ${difficulty}.`;
        }

        return `${basePrompt}\n\nContent: ${content}\n\nReturn only valid JSON array format with this structure:
        [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "type": "multiple-choice"}]`;
    }

    async generateWithOllama(prompt) {
        const model = localStorage.getItem('ollama_selected_model') || 'qwen2.5:3b';
        const timestamp = Date.now();
        const randomSeed = Math.floor(Math.random() * 10000);
        
        try {
            const enhancedPrompt = `[Session: ${timestamp}-${randomSeed}] ${prompt}

            Please respond with only valid JSON. Do not include explanations or additional text.`;

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: enhancedPrompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        seed: randomSeed
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseAIResponse(data.response);
        } catch (error) {
            logger.error('Ollama generation error:', error);
            throw error;
        }
    }

    async generateWithOpenAI(prompt) {
        const apiKey = localStorage.getItem('ai_api_key_openai');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI error: ${response.status}`);
        }

        const data = await response.json();
        return this.parseAIResponse(data.choices[0].message.content);
    }

    async generateWithHuggingFace() {
        // Placeholder for Hugging Face implementation
        throw new Error(translationManager.getTranslationSync('huggingface_integration_coming'));
    }

    async generateWithClaude(prompt) {
        const apiKey = localStorage.getItem('ai_api_key_claude');
        
        try {
            const response = await fetch('/api/claude/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    apiKey: apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`Claude API error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseAIResponse(data.content);
        } catch (error) {
            logger.error('Claude generation error:', error);
            throw error;
        }
    }

    parseAIResponse(responseText) {
        try {
            // Clean up the response text
            let cleanText = responseText.trim();
            
            // Extract JSON from markdown code blocks if present
            const jsonMatch = cleanText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (jsonMatch) {
                cleanText = jsonMatch[1];
            }
            
            // Try to parse as JSON
            const parsed = JSON.parse(cleanText);
            
            // Handle both single question object and array of questions
            return Array.isArray(parsed) ? parsed : [parsed];
            
        } catch (error) {
            logger.error('Error parsing AI response:', error);
            logger.debug('Raw response:', responseText);
            throw new Error('Invalid JSON response from AI provider');
        }
    }

    detectContentType(content) {
        if (!content) return 'general';
        
        // Mathematics indicators
        if (/\$.*\$|\\\w+{.*}|\\begin{|\\end{|\\frac|\\sqrt|\\sum|\\int/.test(content)) {
            return 'mathematics';
        }
        
        // Programming indicators  
        if (/def\s+\w+\(/.test(content) || /function\s+\w+\(/.test(content) || /class\s+\w+/.test(content)) {
            return 'programming';
        }
        
        // Physics indicators
        if (/newton|joule|watt|volt|ampere|velocity|acceleration|force|energy|momentum/i.test(content)) {
            return 'physics';
        }
        
        // Chemistry indicators
        if (/molecule|atom|bond|reaction|catalyst|pH|ion|electron|proton|neutron/i.test(content)) {
            return 'chemistry';
        }
        
        return 'general';
    }

    handleProviderChange(provider) {
        const apiKeySection = document.getElementById('api-key-section');
        const modelSelection = document.getElementById('model-selection');
        
        if (!apiKeySection || !modelSelection) return;
        
        const needsApiKey = this.providers[provider]?.apiKey;
        
        if (needsApiKey) {
            apiKeySection.style.display = 'block';
            // Load saved API key if exists
            const savedKey = localStorage.getItem(`ai_api_key_${provider}`);
            const apiKeyInput = document.getElementById('api-key');
            if (savedKey && apiKeyInput) {
                apiKeyInput.value = savedKey;
            }
        } else {
            apiKeySection.style.display = 'none';
        }
        
        // Show model selection for Ollama
        if (provider === 'ollama') {
            modelSelection.style.display = 'block';
            this.loadOllamaModels();
        } else {
            modelSelection.style.display = 'none';
        }
    }

    async loadOllamaModels() {
        const modelSelect = document.getElementById('ollama-model');
        if (!modelSelect) return;
        
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (response.ok) {
                const data = await response.json();
                const models = data.models || [];
                
                modelSelect.innerHTML = '<option value="">Select a model...</option>';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = `${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)`;
                    modelSelect.appendChild(option);
                });
                
                // Restore saved selection
                const savedModel = localStorage.getItem('ollama_selected_model');
                if (savedModel) {
                    modelSelect.value = savedModel;
                }
            }
        } catch (error) {
            logger.error('Error loading Ollama models:', error);
            modelSelect.innerHTML = '<option value="">Error loading models</option>';
        }
    }

    handleFileUpload(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const contentTextarea = document.getElementById('source-content');
            if (contentTextarea) {
                contentTextarea.value = content;
                this.detectContentType(content);
            }
        };
        reader.readAsText(file);
    }

    processGeneratedQuestions(questions) {
        // This method would be called by the main game class
        // For now, we'll dispatch a custom event
        const event = new CustomEvent('questionsGenerated', { 
            detail: { questions } 
        });
        document.dispatchEvent(event);
    }

    openModal() {
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Initialize provider change handler
            const provider = document.getElementById('ai-provider')?.value;
            if (provider) {
                this.handleProviderChange(provider);
            }
        }
    }

    closeModal() {
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// Global function for opening the AI generator modal (called from HTML)
export function openAIGeneratorModal() {
    const modal = document.getElementById('ai-generator-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Initialize provider change handler
        if (window.aiGenerator) {
            const provider = document.getElementById('ai-provider')?.value;
            if (provider) {
                window.aiGenerator.handleProviderChange(provider);
            }
        }
    }
}