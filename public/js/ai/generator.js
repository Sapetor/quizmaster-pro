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

import { translationManager, showAlert } from '../utils/translation-manager.js';

export class AIQuestionGenerator {
    constructor() {
        this.providers = {
            ollama: {
                name: "Ollama (Local)",
                apiKey: false,
                endpoint: "http://localhost:11434/api/generate",
                models: ["llama3.2:latest", "codellama:13b-instruct", "codellama:7b-instruct", "codellama:7b-code"]
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
        
        this.isGenerating = false; // Flag to prevent multiple simultaneous generations
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

        // API key input change listener
        const apiKeyInput = document.getElementById('ai-api-key');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('blur', (e) => {
                const provider = document.getElementById('ai-provider')?.value;
                if (provider && e.target.value.trim()) {
                    localStorage.setItem(`ai_api_key_${provider}`, e.target.value.trim());
                    logger.debug(`API key saved for provider: ${provider}`);
                }
            });
        }
    }

    async generateQuestions() {
        // Prevent multiple simultaneous generations
        if (this.isGenerating) {
            logger.debug('Generation already in progress, ignoring request');
            return;
        }
        
        this.isGenerating = true;
        
        const provider = document.getElementById('ai-provider')?.value;
        const content = document.getElementById('source-content')?.value?.trim();
        const questionCount = parseInt(document.getElementById('question-count')?.value) || 1;
        const difficulty = document.getElementById('difficulty-level')?.value || 'medium';
        
        // Store the requested count for use throughout the process
        this.requestedQuestionCount = questionCount;
        
        if (!content) {
            showAlert('please_provide_source_material');
            this.isGenerating = false;
            return;
        }

        // Check for API key if required
        const needsApiKey = this.providers[provider]?.apiKey;
        if (needsApiKey) {
            const apiKey = localStorage.getItem(`ai_api_key_${provider}`);
            if (!apiKey) {
                showAlert('please_enter_api_key');
                this.isGenerating = false;
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
                // Double-check the count one more time before processing
                if (questions.length > this.requestedQuestionCount) {
                    questions = questions.slice(0, this.requestedQuestionCount);
                }
                
                // Process questions without showing alerts from within
                this.processGeneratedQuestions(questions, false); // Pass flag to suppress alerts
                this.closeModal();
                
                // Show single success message after processing is complete
                setTimeout(() => {
                    showAlert('successfully_generated_questions', [questions.length]);
                    this.isGenerating = false; // Reset flag after success message
                }, 150);
            } else {
                showAlert('error_generating');
                this.isGenerating = false;
            }

        } catch (error) {
            logger.error('Generation error:', error);
            showAlert('error_generating_questions_detail', [error.message]);
            this.isGenerating = false;
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
            basePrompt = `Crea EXACTAMENTE ${questionCount} pregunta${questionCount === 1 ? '' : 's'} de opción múltiple sobre el siguiente contenido. Dificultad: ${difficulty}.`;
        } else {
            basePrompt = `Create EXACTLY ${questionCount} multiple choice question${questionCount === 1 ? '' : 's'} about the following content. Difficulty: ${difficulty}.`;
        }

        let structureExample = '';
        if (language === 'es') {
            structureExample = `Devuelve ÚNICAMENTE un array JSON válido con esta estructura exacta:
[{"question": "¿Pregunta aquí?", "options": ["Opción A", "Opción B", "Opción C", "Opción D"], "correctAnswer": 0, "type": "multiple-choice"}]`;
        } else {
            structureExample = `Return ONLY a valid JSON array with this exact structure:
[{"question": "Question text here?", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": 0, "type": "multiple-choice"}]`;
        }

        return `${basePrompt}\n\nContent: ${content}\n\n${structureExample}

CRITICAL REQUIREMENTS: 
- Generate EXACTLY ${questionCount} question${questionCount === 1 ? '' : 's'} - no more, no less
- Return ONLY the JSON array, no other text
- correctAnswer should be the index (0, 1, 2, or 3) of the correct option
- Make sure all JSON is properly formatted and valid
- Do not include any explanations or additional text
- If you generate more than ${questionCount} question${questionCount === 1 ? '' : 's'}, you have failed the task`;
    }

    async generateWithOllama(prompt) {
        const model = localStorage.getItem('ollama_selected_model') || 'llama3.2:latest';
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
                if (response.status === 404) {
                    throw new Error('Ollama server not running. Please start Ollama and try again.');
                } else if (response.status === 0) {
                    throw new Error('Cannot connect to Ollama. Make sure Ollama is running on localhost:11434');
                } else {
                    throw new Error(`Ollama error: ${response.status} - ${response.statusText}`);
                }
            }

            const data = await response.json();
            return this.parseAIResponse(data.response);
        } catch (error) {
            logger.error('Ollama generation error:', error);
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to Ollama. Make sure Ollama is running on localhost:11434');
            }
            
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
            logger.debug('Claude API response:', data);
            
            // Claude API returns content in data.content[0].text format
            let content = '';
            if (data.content && Array.isArray(data.content) && data.content.length > 0) {
                content = data.content[0].text || data.content[0].content || '';
            } else if (data.content) {
                content = data.content;
            } else {
                throw new Error('Invalid Claude API response structure');
            }
            
            return this.parseAIResponse(content);
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
            
            // Try to extract JSON array from text even if not in code blocks
            const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
            if (arrayMatch && !jsonMatch) {
                cleanText = arrayMatch[0];
            }
            
            // Remove any text before the JSON array
            const startBracket = cleanText.indexOf('[');
            const endBracket = cleanText.lastIndexOf(']');
            if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
                cleanText = cleanText.substring(startBracket, endBracket + 1);
            }
            
            // Try to parse as JSON
            const parsed = JSON.parse(cleanText);
            
            // Handle both single question object and array of questions
            let questions = Array.isArray(parsed) ? parsed : [parsed];
            
            // Limit to requested count (in case AI generates more than requested)
            const requestedCount = this.requestedQuestionCount || 1;
            if (questions.length > requestedCount) {
                questions = questions.slice(0, requestedCount);
            }
            
            return questions;
            
        } catch (error) {
            logger.error('Error parsing AI response:', error);
            
            // Try to extract questions manually if JSON parsing fails
            try {
                return this.extractQuestionsManually(responseText);
            } catch (manualError) {
                throw new Error(`Invalid JSON response from AI provider. Response: ${responseText.substring(0, 100)}...`);
            }
        }
    }

    extractQuestionsManually(responseText) {
        // Try to find question-like patterns in the text
        const questionPattern = /(?:question|q\d+)[:\s]*(.+?)(?:options?|choices?)[:\s]*(.+?)(?:answer|correct)[:\s]*(.+?)(?=(?:question|q\d+|$))/gis;
        const matches = [...responseText.matchAll(questionPattern)];
        
        if (matches.length > 0) {
            let questions = matches.map(match => {
                const question = match[1].trim();
                const optionsText = match[2].trim();
                const answerText = match[3].trim();
                
                // Extract options (A, B, C, D format)
                const options = optionsText.split(/[ABCD][\):\.]?\s*/).filter(opt => opt.trim()).slice(0, 4);
                
                // Try to determine correct answer
                let correctAnswer = 0;
                if (answerText.match(/^[A]$/i)) correctAnswer = 0;
                else if (answerText.match(/^[B]$/i)) correctAnswer = 1;
                else if (answerText.match(/^[C]$/i)) correctAnswer = 2;
                else if (answerText.match(/^[D]$/i)) correctAnswer = 3;
                
                return {
                    question: question,
                    options: options.length >= 4 ? options.slice(0, 4) : ['Option A', 'Option B', 'Option C', 'Option D'],
                    correctAnswer: correctAnswer,
                    type: 'multiple-choice'
                };
            });
            
            // Limit to requested count
            const requestedCount = this.requestedQuestionCount || 1;
            if (questions.length > requestedCount) {
                questions = questions.slice(0, requestedCount);
            }
            
            return questions;
        }
        
        throw new Error('Could not extract questions from response');
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
            const apiKeyInput = document.getElementById('ai-api-key');
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
                
                // Restore saved selection or set default
                const savedModel = localStorage.getItem('ollama_selected_model');
                if (savedModel && models.some(m => m.name === savedModel)) {
                    modelSelect.value = savedModel;
                } else if (models.length > 0) {
                    // Set default to first available model
                    modelSelect.value = models[0].name;
                    localStorage.setItem('ollama_selected_model', models[0].name);
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            logger.error('Error loading Ollama models:', error);
            modelSelect.innerHTML = `<option value="">Ollama not available (${error.message})</option>`;
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

    processGeneratedQuestions(questions, showAlerts = true) {
        // Add questions to the main quiz
        if (window.game && window.game.quizManager) {
            questions.forEach(questionData => {
                // Validate and add each question
                if (this.validateGeneratedQuestion(questionData)) {
                    window.game.quizManager.addGeneratedQuestion(questionData, showAlerts);
                } else {
                    logger.warn('Invalid generated question skipped:', questionData);
                }
            });
        } else {
            // Fallback: dispatch custom event
            const event = new CustomEvent('questionsGenerated', { 
                detail: { questions } 
            });
            document.dispatchEvent(event);
        }
    }

    validateGeneratedQuestion(question) {
        // Basic validation for generated questions
        if (!question.question || !question.options || !Array.isArray(question.options)) {
            return false;
        }
        
        if (question.type === 'multiple-choice' && (question.correctAnswer === undefined || question.correctAnswer < 0 || question.correctAnswer >= question.options.length)) {
            return false;
        }
        
        return true;
    }

    openModal() {
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Wait a bit for the modal to be fully rendered
            setTimeout(() => {
                // Initialize provider change handler
                const providerSelect = document.getElementById('ai-provider');
                const provider = providerSelect?.value || 'ollama';
                
                // Set to ollama by default if not already set
                if (providerSelect && !providerSelect.value) {
                    providerSelect.value = 'ollama';
                }
                
                this.handleProviderChange(provider);
            }, 50);
            
            // Clear previous content
            const contentTextarea = document.getElementById('source-content');
            if (contentTextarea && !contentTextarea.value.trim()) {
                contentTextarea.placeholder = 'Enter your content here (e.g., a passage of text, topics to generate questions about, or paste from a document)...';
            }
            
            // Reset question count to 1
            const questionCount = document.getElementById('question-count');
            if (questionCount) {
                questionCount.value = 1;
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