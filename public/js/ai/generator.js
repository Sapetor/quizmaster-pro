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

import { logger, AI, TIMING } from '../core/config.js';
import { translationManager, showAlert } from '../utils/translation-manager.js';
import { secureStorage } from '../services/secure-storage-service.js';
import { errorHandler, ErrorHandlingService } from '../services/error-handling-service.js';

export class AIQuestionGenerator {
    constructor() {
        this.providers = {
            ollama: {
                name: "Ollama (Local)",
                apiKey: false,
                endpoint: AI.OLLAMA_ENDPOINT,
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
                models: [AI.OPENAI_MODEL, "gpt-4"]
            },
            claude: {
                name: "Anthropic Claude", 
                apiKey: true,
                endpoint: "https://api.anthropic.com/v1/messages",
                models: ["claude-3-haiku", "claude-3-sonnet"]
            }
        };
        
        this.isGenerating = false; // Flag to prevent multiple simultaneous generations
        this.eventHandlers = {}; // Store event handler references for cleanup
        this.initializeEventListeners();
        this.initializeSecureStorage();
    }

    /**
     * Initialize secure storage and migrate existing API keys
     */
    async initializeSecureStorage() {
        return await errorHandler.wrapAsyncOperation(async () => {
            // Check if Web Crypto API is supported
            if (!secureStorage.constructor.isSupported()) {
                logger.warn('Web Crypto API not supported - API keys will not be encrypted');
                return;
            }

            // Migrate existing API keys to secure storage
            await secureStorage.migrateApiKeys();
            logger.debug('Secure storage initialized and API keys migrated');
        }, {
            errorType: ErrorHandlingService.ErrorTypes.SYSTEM,
            severity: ErrorHandlingService.Severity.LOW,
            context: 'secure-storage-initialization',
            userMessage: null, // Silent failure for initialization
            retryable: false,
            fallback: null
        });
    }

    initializeEventListeners() {
        const modal = document.getElementById('ai-generator-modal');
        const closeButton = document.getElementById('close-ai-generator');

        // Store handler references for cleanup
        this.eventHandlers.modalClick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };

        this.eventHandlers.closeButtonClick = () => {
            this.closeModal();
        };

        this.eventHandlers.keydown = (e) => {
            if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
                this.closeModal();
            }
        };

        this.eventHandlers.providerChange = (e) => {
            this.handleProviderChange(e.target.value);
        };

        this.eventHandlers.modelChange = (e) => {
            if (e.target.value) {
                localStorage.setItem('ollama_selected_model', e.target.value);
            }
        };

        this.eventHandlers.fileChange = (e) => {
            this.handleFileUpload(e.target.files[0]);
        };

        this.eventHandlers.contentInput = (e) => {
            this.detectContentType(e.target.value);
        };

        this.eventHandlers.generateClick = () => {
            this.generateQuestions();
        };

        this.eventHandlers.cancelClick = () => {
            this.closeModal();
        };

        this.eventHandlers.apiKeyBlur = async (e) => {
            await errorHandler.wrapAsyncOperation(async () => {
                const provider = document.getElementById('ai-provider')?.value;
                if (provider && e.target.value.trim()) {
                    const success = await secureStorage.setSecureItem(`api_key_${provider}`, e.target.value.trim());
                    if (success) {
                        logger.debug(`API key securely saved for provider: ${provider}`);
                    } else {
                        throw new Error(`Failed to save API key for provider: ${provider}`);
                    }
                }
            }, {
                errorType: ErrorHandlingService.ErrorTypes.SYSTEM,
                severity: ErrorHandlingService.Severity.LOW,
                context: 'api-key-storage',
                userMessage: 'Failed to save API key securely. Please try again.',
                retryable: false
            });
        };

        // Add event listeners
        if (modal) {
            modal.addEventListener('click', this.eventHandlers.modalClick);
        }

        if (closeButton) {
            closeButton.addEventListener('click', this.eventHandlers.closeButtonClick);
        }

        document.addEventListener('keydown', this.eventHandlers.keydown);

        // Provider selection change
        const providerSelect = document.getElementById('ai-provider');
        if (providerSelect) {
            providerSelect.addEventListener('change', this.eventHandlers.providerChange);
        }

        // Model selection change
        const modelSelect = document.getElementById('ollama-model');
        if (modelSelect) {
            modelSelect.addEventListener('change', this.eventHandlers.modelChange);
        }

        // File upload handling
        const fileInput = document.getElementById('content-file');
        if (fileInput) {
            fileInput.addEventListener('change', this.eventHandlers.fileChange);
        }

        // Content type detection
        const contentTextarea = document.getElementById('source-content');
        if (contentTextarea) {
            contentTextarea.addEventListener('input', this.eventHandlers.contentInput);
        }

        // Generate questions button
        const generateBtn = document.getElementById('generate-questions');
        if (generateBtn) {
            generateBtn.addEventListener('click', this.eventHandlers.generateClick);
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-ai-generator');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.eventHandlers.cancelClick);
        }

        // API key input change listener
        const apiKeyInput = document.getElementById('ai-api-key');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('blur', this.eventHandlers.apiKeyBlur);
        }
    }

    /**
     * Clean up all event listeners to prevent memory leaks
     */
    cleanup() {
        const modal = document.getElementById('ai-generator-modal');
        const closeButton = document.getElementById('close-ai-generator');
        const providerSelect = document.getElementById('ai-provider');
        const modelSelect = document.getElementById('ollama-model');
        const fileInput = document.getElementById('content-file');
        const contentTextarea = document.getElementById('source-content');
        const generateBtn = document.getElementById('generate-questions');
        const cancelBtn = document.getElementById('cancel-ai-generator');
        const apiKeyInput = document.getElementById('ai-api-key');

        // Remove all event listeners
        if (modal && this.eventHandlers.modalClick) {
            modal.removeEventListener('click', this.eventHandlers.modalClick);
        }

        if (closeButton && this.eventHandlers.closeButtonClick) {
            closeButton.removeEventListener('click', this.eventHandlers.closeButtonClick);
        }

        if (this.eventHandlers.keydown) {
            document.removeEventListener('keydown', this.eventHandlers.keydown);
        }

        if (providerSelect && this.eventHandlers.providerChange) {
            providerSelect.removeEventListener('change', this.eventHandlers.providerChange);
        }

        if (modelSelect && this.eventHandlers.modelChange) {
            modelSelect.removeEventListener('change', this.eventHandlers.modelChange);
        }

        if (fileInput && this.eventHandlers.fileChange) {
            fileInput.removeEventListener('change', this.eventHandlers.fileChange);
        }

        if (contentTextarea && this.eventHandlers.contentInput) {
            contentTextarea.removeEventListener('input', this.eventHandlers.contentInput);
        }

        if (generateBtn && this.eventHandlers.generateClick) {
            generateBtn.removeEventListener('click', this.eventHandlers.generateClick);
        }

        if (cancelBtn && this.eventHandlers.cancelClick) {
            cancelBtn.removeEventListener('click', this.eventHandlers.cancelClick);
        }

        if (apiKeyInput && this.eventHandlers.apiKeyBlur) {
            apiKeyInput.removeEventListener('blur', this.eventHandlers.apiKeyBlur);
        }

        // Clear handler references
        this.eventHandlers = {};
        
        logger.debug('AI Generator event listeners cleaned up');
    }

    async generateQuestions() {
        return await errorHandler.wrapAsyncOperation(async () => {
            // Prevent multiple simultaneous generations
            if (this.isGenerating) {
                logger.debug('Generation already in progress, ignoring request');
                return;
            }
            
            this.isGenerating = true;
            
            // Validation wrapper for input validation
            const validationResult = errorHandler.wrapValidation(() => {
                const provider = document.getElementById('ai-provider')?.value;
                const content = document.getElementById('source-content')?.value?.trim();
                const questionCount = parseInt(document.getElementById('question-count')?.value) || 1;
                const difficulty = document.getElementById('difficulty-level')?.value || 'medium';
                
                // Get selected question types
                const selectedTypes = [];
                if (document.getElementById('type-multiple-choice')?.checked) {
                    selectedTypes.push('multiple-choice');
                }
                if (document.getElementById('type-true-false')?.checked) {
                    selectedTypes.push('true-false');
                }
                if (document.getElementById('type-multiple-correct')?.checked) {
                    selectedTypes.push('multiple-correct');
                }
                if (document.getElementById('type-numeric')?.checked) {
                    selectedTypes.push('numeric');
                }
                
                logger.debug('Selected question types:', selectedTypes);
                
                // Validate required fields
                errorHandler.validateRequired(provider, 'AI Provider');
                errorHandler.validateRequired(content, 'Source content');
                
                if (selectedTypes.length === 0) {
                    throw new Error('Please select at least one question type');
                }
                
                return { provider, content, questionCount, difficulty, selectedTypes };
            }, { context: 'input-validation' });
            
            if (!validationResult) {
                this.isGenerating = false;
                return;
            }
            
            const { provider, content, questionCount, difficulty, selectedTypes } = validationResult;
            
            // Store the requested count for use throughout the process
            this.requestedQuestionCount = questionCount;

            // Check for API key if required
            const needsApiKey = this.providers[provider]?.apiKey;
            if (needsApiKey) {
                const apiKey = await secureStorage.getSecureItem(`api_key_${provider}`);
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
                // Build prompt based on content type and settings, including selected question types
                const prompt = this.buildPrompt(content, questionCount, difficulty, selectedTypes);
                
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
                    await this.processGeneratedQuestions(questions, false);
                    this.closeModal();
                    
                    // Show single success message after processing is complete
                    setTimeout(() => {
                        showAlert('successfully_generated_questions', [questions.length]);
                        this.isGenerating = false;
                    }, TIMING.ANIMATION_DURATION);
                } else {
                    throw new Error('No questions generated by AI provider');
                }

            } finally {
                // Reset UI
                if (generateBtn) generateBtn.disabled = false;
                if (statusDiv) statusDiv.style.display = 'none';
                this.isGenerating = false;
            }
        }, {
            errorType: ErrorHandlingService.ErrorTypes.SYSTEM,
            severity: ErrorHandlingService.Severity.MEDIUM,
            context: 'question-generation',
            userMessage: 'Failed to generate questions. Please check your settings and try again.',
            retryable: false,
            fallback: null
        });
    }

    buildPrompt(content, questionCount, difficulty, selectedTypes) {
        const contentType = this.detectContentType(content);
        // Use translation manager to get current app language (more reliable than localStorage)
        const language = translationManager.getCurrentLanguage() || 'en';
        
        // Language name mapping for LLM instruction
        const languageNames = {
            'en': 'English',
            'es': 'Spanish', 
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese', 
            'pl': 'Polish',
            'ja': 'Japanese',
            'zh': 'Chinese'
        };
        
        const targetLanguage = languageNames[language] || 'English';
        
        // Build question type description (using English prompts - LLM will handle translation)
        let typeDescription = `Create EXACTLY ${questionCount} question${questionCount === 1 ? '' : 's'} about the following content. Difficulty: ${difficulty}.`;
        let structureExamples = [];
        
        if (selectedTypes.includes('multiple-choice')) {
            typeDescription += '\n- Some questions should be multiple choice (4 options, one correct)';
            structureExamples.push('{"question": "Question text here?", "type": "multiple-choice", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": 0, "timeLimit": 30}');
        }
        if (selectedTypes.includes('true-false')) {
            typeDescription += '\n- Some questions should be true/false (single factual statements about the content, not choices between opposites)';
            structureExamples.push('{"question": "Python is an interpreted programming language.", "type": "true-false", "options": ["True", "False"], "correctAnswer": "true", "timeLimit": 20}');
        }
        if (selectedTypes.includes('multiple-correct')) {
            typeDescription += '\n- Some questions should allow multiple correct answers (use "correctAnswers" array with indices)';
            structureExamples.push('{"question": "Which of the following statements are TRUE? (Select all that apply)", "type": "multiple-correct", "options": ["Statement A is correct", "Statement B is wrong", "Statement C is correct", "Statement D is also correct"], "correctAnswers": [0, 2, 3], "timeLimit": 35}');
        }
        if (selectedTypes.includes('numeric')) {
            typeDescription += '\n- Some questions should have numeric answers derived from the content (counts, dates, measurements, etc., NO generic math problems)';
            structureExamples.push('{"question": "In what year was Python first released?", "type": "numeric", "correctAnswer": 1991, "tolerance": 0, "timeLimit": 25}');
        }
        
        // Build structure example showing all selected types
        const structureExample = `Return ONLY a valid JSON array with structures EXACTLY like these:\n[${structureExamples.join(',\n')}]`;

        return `${typeDescription}\n\nContent: ${content}\n\n${structureExample}

CRITICAL REQUIREMENTS: 
- Generate ALL questions in ${targetLanguage} language
- Generate EXACTLY ${questionCount} question${questionCount === 1 ? '' : 's'} - no more, no less
- ALL questions MUST be directly related to the provided content - no off-topic questions
- Mix different question types from the selected types: ${selectedTypes.join(', ')}
- For true/false questions: Create single factual statements about the content, NOT binary choices between opposites (e.g., "Tom is a cat" not "Choose happy or sad")
- For numeric questions: Numbers must come from the content (dates, counts, measurements), NOT random math problems
- Return ONLY the JSON array, no other text
- Use EXACTLY these JSON structures:
  * Multiple-choice: correctAnswer as integer index (0, 1, 2, or 3), options array with 4 items
  * True-false: Single factual statement about content, options must be ["True", "False"], correctAnswer as string ("true" or "false")  
  * Multiple-correct: correctAnswers as array of indices [0, 1, 2, 3], options array
  * Numeric: Answer derived from content, NO options array, correctAnswer as number, tolerance as number
- All questions must have "timeLimit" field (15-40 seconds based on difficulty)
- Make sure all JSON is properly formatted and valid
- Do not include any explanations or additional text
- If you generate more than ${questionCount} question${questionCount === 1 ? '' : 's'}, you have failed the task`;
    }


    async generateWithOllama(prompt) {
        return await errorHandler.wrapNetworkRequest(async () => {
            const model = localStorage.getItem('ollama_selected_model') || AI.OLLAMA_DEFAULT_MODEL;
            const timestamp = Date.now();
            const randomSeed = Math.floor(Math.random() * 10000);
            
            const enhancedPrompt = `[Session: ${timestamp}-${randomSeed}] ${prompt}

            Please respond with only valid JSON. Do not include explanations or additional text.`;

            const response = await fetch(AI.OLLAMA_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: enhancedPrompt,
                    stream: false,
                    options: {
                        temperature: AI.DEFAULT_TEMPERATURE,
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
        }, {
            context: 'ollama-generation',
            userMessage: 'Failed to generate questions with Ollama. Please ensure Ollama is running and try again.',
            retryable: true
        });
    }

    async generateWithOpenAI(prompt) {
        return await errorHandler.wrapNetworkRequest(async () => {
            const apiKey = await secureStorage.getSecureItem('api_key_openai');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: AI.OPENAI_MODEL,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    temperature: AI.DEFAULT_TEMPERATURE
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Invalid OpenAI API key. Please check your credentials.');
                } else if (response.status === 429) {
                    throw new Error('OpenAI rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`OpenAI error: ${response.status}`);
                }
            }

            const data = await response.json();
            return this.parseAIResponse(data.choices[0].message.content);
        }, {
            context: 'openai-generation',
            userMessage: 'Failed to generate questions with OpenAI. Please check your API key and try again.',
            retryable: true
        });
    }

    async generateWithHuggingFace() {
        // Placeholder for Hugging Face implementation
        throw new Error(translationManager.getTranslationSync('huggingface_integration_coming'));
    }

    async generateWithClaude(prompt) {
        return await errorHandler.wrapNetworkRequest(async () => {
            const apiKey = await secureStorage.getSecureItem('api_key_claude');
            
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
                if (response.status === 401) {
                    throw new Error('Invalid Claude API key. Please check your credentials.');
                } else if (response.status === 429) {
                    throw new Error('Claude rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`Claude API error: ${response.status}`);
                }
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
        }, {
            context: 'claude-generation',
            userMessage: 'Failed to generate questions with Claude. Please check your API key and try again.',
            retryable: true
        });
    }

    parseAIResponse(responseText) {
        logger.debug('🔍 ParseAIResponse - Raw response length:', responseText.length);
        logger.debug('🔍 ParseAIResponse - Raw response preview:', responseText.substring(0, 200) + '...');
        
        try {
            // Clean up the response text
            let cleanText = responseText.trim();
            
            // Extract JSON from markdown code blocks if present
            const jsonMatch = cleanText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (jsonMatch) {
                cleanText = jsonMatch[1];
                logger.debug('🔍 ParseAIResponse - Extracted from code block');
            }
            
            // Try to extract JSON array from text even if not in code blocks
            const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
            if (arrayMatch && !jsonMatch) {
                cleanText = arrayMatch[0];
                logger.debug('🔍 ParseAIResponse - Extracted JSON array from text');
            }
            
            // Remove any text before the JSON array
            const startBracket = cleanText.indexOf('[');
            const endBracket = cleanText.lastIndexOf(']');
            if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
                cleanText = cleanText.substring(startBracket, endBracket + 1);
            }
            
            logger.debug('🔍 ParseAIResponse - Clean text for parsing:', cleanText.substring(0, 300) + '...');
            
            // Try to parse as JSON
            const parsed = JSON.parse(cleanText);
            logger.debug('🔍 ParseAIResponse - JSON parsed successfully');
            
            // Handle both single question object and array of questions
            let questions = Array.isArray(parsed) ? parsed : [parsed];
            logger.debug('🔍 ParseAIResponse - Questions after array handling:', questions.length);
            
            // Limit to requested count (in case AI generates more than requested)
            const requestedCount = this.requestedQuestionCount || 1;
            logger.debug('🔍 ParseAIResponse - Requested count:', requestedCount);
            
            if (questions.length > requestedCount) {
                logger.debug('🔍 ParseAIResponse - Truncating from', questions.length, 'to', requestedCount);
                questions = questions.slice(0, requestedCount);
            }
            
            logger.debug('🔍 ParseAIResponse - Final questions count:', questions.length);
            questions.forEach((q, i) => {
                logger.debug(`🔍 ParseAIResponse - Question ${i + 1}:`, {
                    type: q.type,
                    question: q.question?.substring(0, 50) + '...',
                    hasOptions: !!q.options,
                    optionsCount: q.options?.length,
                    correctAnswer: q.correctAnswer,
                    correctAnswers: q.correctAnswers
                });
            });
            
            return questions;
            
        } catch (error) {
            logger.error('🔍 ParseAIResponse - JSON parsing failed:', error);
            logger.debug('🔍 ParseAIResponse - Failed text:', responseText.substring(0, 500));
            
            // Try to extract questions manually if JSON parsing fails
            try {
                const manualQuestions = this.extractQuestionsManually(responseText);
                logger.debug('🔍 ParseAIResponse - Manual extraction succeeded, count:', manualQuestions.length);
                return manualQuestions;
            } catch (manualError) {
                logger.error('🔍 ParseAIResponse - Manual extraction also failed:', manualError);
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
        
        try {
            // Mathematics indicators
            if (AI.MATH_INDICATORS && AI.MATH_INDICATORS.test(content)) {
                return 'mathematics';
            }
            
            // Programming indicators  
            if (AI.PROGRAMMING_INDICATORS && AI.PROGRAMMING_INDICATORS.test(content)) {
                return 'programming';
            }
            
            // Physics indicators
            if (AI.PHYSICS_INDICATORS && AI.PHYSICS_INDICATORS.test(content)) {
                return 'physics';
            }
            
            // Chemistry indicators
            if (AI.CHEMISTRY_INDICATORS && AI.CHEMISTRY_INDICATORS.test(content)) {
                return 'chemistry';
            }
            
            return 'general';
        } catch (error) {
            logger.warn('Content type detection failed:', error.message);
            return 'general';
        }
    }

    async handleProviderChange(provider) {
        return await errorHandler.wrapAsyncOperation(async () => {
            // Prevent multiple simultaneous calls
            if (this.isChangingProvider) {
                logger.debug('HandleProviderChange - Already changing provider, ignoring call for:', provider);
                return;
            }
            
            this.isChangingProvider = true;
            logger.debug('HandleProviderChange called with provider:', provider);
            
            try {
                const apiKeySection = document.getElementById('api-key-section');
                const modelSelection = document.getElementById('model-selection');
                
                logger.debug('HandleProviderChange - Elements found:', { apiKeySection: !!apiKeySection, modelSelection: !!modelSelection });
                
                if (!apiKeySection || !modelSelection) return;
                
                const needsApiKey = this.providers[provider]?.apiKey;
                
                if (needsApiKey) {
                    apiKeySection.style.display = 'block';
                    // Load saved API key if exists
                    const savedKey = await secureStorage.getSecureItem(`api_key_${provider}`);
                    const apiKeyInput = document.getElementById('ai-api-key');
                    if (savedKey && apiKeyInput) {
                        apiKeyInput.value = savedKey;
                    }
                } else {
                    apiKeySection.style.display = 'none';
                }
                
                // Model selection visibility and loading
                if (provider === 'ollama') {
                    logger.debug('HandleProviderChange - Showing model selection for Ollama');
                    // Make sure it's visible (remove hidden class if it exists)
                    modelSelection.classList.remove('hidden');
                    modelSelection.style.display = 'block';
                    
                    // Load the models
                    await this.loadOllamaModels();
                } else {
                    logger.debug('HandleProviderChange - Hiding model selection for provider:', provider);
                    modelSelection.classList.add('hidden');
                }
            } finally {
                this.isChangingProvider = false;
            }
        }, {
            errorType: ErrorHandlingService.ErrorTypes.SYSTEM,
            severity: ErrorHandlingService.Severity.LOW,
            context: 'provider-change',
            userMessage: null, // Silent failure for UI operations
            retryable: false,
            fallback: () => {
                this.isChangingProvider = false; // Ensure flag is reset on error
            }
        });
    }

    async loadOllamaModels() {
        return await errorHandler.wrapAsyncOperation(async () => {
            const modelSelect = document.getElementById('ollama-model');
            const modelSelection = document.getElementById('model-selection');
            
            if (!modelSelect) {
                logger.debug('LoadOllamaModels - Model select element not found');
                return;
            }

            logger.debug('LoadOllamaModels - Starting model loading');
            
            // Ensure the parent div is visible first
            if (modelSelection) {
                modelSelection.classList.remove('hidden');
                modelSelection.style.display = 'block';
                logger.debug('LoadOllamaModels - Ensured model selection div is visible');
            }
            
            // Set initial loading state and disable the select element
            modelSelect.innerHTML = '<option value="">🔄 Loading models...</option>';
            modelSelect.disabled = true;
            
            try {
                logger.debug('LoadOllamaModels - Fetching from:', AI.OLLAMA_TAGS_ENDPOINT);
                
                const response = await fetch(AI.OLLAMA_TAGS_ENDPOINT);
                
                logger.debug('LoadOllamaModels - Fetch response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                logger.debug('LoadOllamaModels - Response data:', data);
                
                const models = data.models || [];
                logger.debug('LoadOllamaModels - Found models count:', models.length);
                
                // Clear existing options and populate with models
                modelSelect.innerHTML = ''; 
                
                if (models.length === 0) {
                    logger.debug('LoadOllamaModels - No models found, showing message');
                    modelSelect.innerHTML = '<option value="">No models found</option>';
                } else {
                    logger.debug('LoadOllamaModels - Populating select with models');
                    
                    models.forEach((model, index) => {
                        const option = document.createElement('option');
                        option.value = model.name;
                        option.textContent = `${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)`;
                        modelSelect.appendChild(option);
                        logger.debug(`LoadOllamaModels - Added model ${index + 1}:`, model.name);
                    });
                    
                    // Restore saved selection or set default
                    const savedModel = localStorage.getItem('ollama_selected_model');
                    if (savedModel && models.some(m => m.name === savedModel)) {
                        modelSelect.value = savedModel;
                        logger.debug('LoadOllamaModels - Set saved model:', savedModel);
                    } else if (models.length > 0) {
                        // Set default to first available model
                        modelSelect.value = models[0].name;
                        localStorage.setItem('ollama_selected_model', models[0].name);
                        logger.debug('LoadOllamaModels - Set default model:', models[0].name);
                    }
                }
                
                logger.debug('LoadOllamaModels - Final select options count:', modelSelect.options.length);
                
            } finally {
                modelSelect.disabled = false;
                
                // Force visibility again after loading
                if (modelSelection) {
                    modelSelection.classList.remove('hidden');
                    modelSelection.style.display = 'block';
                    logger.debug('LoadOllamaModels - Final visibility enforcement');
                }
                
                logger.debug('LoadOllamaModels - Enabled select, final state:', {
                    optionsCount: modelSelect.options.length,
                    selectedValue: modelSelect.value,
                    disabled: modelSelect.disabled,
                    parentVisible: modelSelection ? window.getComputedStyle(modelSelection).display : 'unknown'
                });
            }
        }, {
            errorType: ErrorHandlingService.ErrorTypes.NETWORK,
            severity: ErrorHandlingService.Severity.LOW,
            context: 'ollama-model-loading',
            userMessage: null, // Don't show alert for model loading failures
            retryable: false,
            fallback: () => {
                // Load fallback models on failure
                const modelSelect = document.getElementById('ollama-model');
                if (modelSelect) {
                    logger.debug('LoadOllamaModels - Loading fallback models');
                    const fallbackModels = this.providers.ollama.models;
                    if (fallbackModels && fallbackModels.length > 0) {
                        modelSelect.innerHTML = '';
                        fallbackModels.forEach(modelName => {
                            const option = document.createElement('option');
                            option.value = modelName;
                            option.textContent = `${modelName} (fallback)`;
                            modelSelect.appendChild(option);
                        });
                        
                        // Set first fallback as default
                        modelSelect.value = fallbackModels[0];
                        localStorage.setItem('ollama_selected_model', fallbackModels[0]);
                        logger.debug('LoadOllamaModels - Set fallback default:', fallbackModels[0]);
                    } else {
                        modelSelect.innerHTML = '<option value="">❌ Ollama not available</option>';
                    }
                }
            }
        });
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

    async processGeneratedQuestions(questions, showAlerts = true) {
        logger.debug('🔄 ProcessGeneratedQuestions - Starting with questions:', questions.length);
        
        // Add questions to the main quiz
        if (window.game && window.game.quizManager) {
            let validCount = 0;
            let invalidCount = 0;
            
            // Process questions SEQUENTIALLY to avoid race conditions with DOM creation
            for (let index = 0; index < questions.length; index++) {
                const questionData = questions[index];
                logger.debug(`🔄 ProcessGeneratedQuestions - Processing question ${index + 1}:`, {
                    type: questionData.type,
                    hasQuestion: !!questionData.question,
                    hasOptions: !!questionData.options,
                    optionsLength: questionData.options?.length,
                    correctAnswer: questionData.correctAnswer,
                    correctAnswers: questionData.correctAnswers
                });
                
                // Validate and add each question
                if (this.validateGeneratedQuestion(questionData)) {
                    logger.debug(`✅ ProcessGeneratedQuestions - Question ${index + 1} is valid, adding to quiz`);
                    
                    // Add question and wait for DOM updates to complete
                    await new Promise(resolve => {
                        // Check if this will create a new DOM element
                        const questionElements = document.querySelectorAll('.question-item');
                        const firstQuestion = questionElements[0];
                        const needsNewElement = !(firstQuestion && window.game.quizManager.isEmptyQuestion(firstQuestion));
                        
                        window.game.quizManager.addGeneratedQuestion(questionData, showAlerts);
                        
                        // Wait longer if we created a new DOM element
                        const waitTime = needsNewElement ? 400 : 50;
                        setTimeout(resolve, waitTime);
                    });
                    
                    validCount++;
                } else {
                    logger.warn(`❌ ProcessGeneratedQuestions - Question ${index + 1} is invalid, skipping:`, questionData);
                    invalidCount++;
                }
            }
            
            logger.debug('🔄 ProcessGeneratedQuestions - Summary:', {
                total: questions.length,
                valid: validCount,
                invalid: invalidCount
            });
            
        } else {
            logger.warn('🔄 ProcessGeneratedQuestions - Window.game.quizManager not available, using fallback');
            // Fallback: dispatch custom event
            const event = new CustomEvent('questionsGenerated', { 
                detail: { questions } 
            });
            document.dispatchEvent(event);
        }
    }

    validateGeneratedQuestion(question) {
        logger.debug('🔍 ValidateGeneratedQuestion - Validating:', {
            type: question.type,
            hasQuestion: !!question.question,
            hasOptions: !!question.options,
            optionsLength: question.options?.length,
            correctAnswer: question.correctAnswer,
            correctAnswers: question.correctAnswers
        });
        
        // Basic validation for generated questions
        if (!question.question || !question.type) {
            logger.debug('❌ ValidateGeneratedQuestion - Missing basic fields');
            return false;
        }
        
        // Type-specific validation
        if (question.type === 'multiple-choice') {
            if (!question.options || !Array.isArray(question.options) || 
                question.correctAnswer === undefined || 
                question.correctAnswer < 0 || 
                question.correctAnswer >= question.options.length) {
                logger.debug('❌ ValidateGeneratedQuestion - Multiple choice validation failed');
                return false;
            }
        } else if (question.type === 'multiple-correct') {
            // Auto-fix: If AI used "correctAnswer" instead of "correctAnswers"
            if (question.correctAnswer !== undefined && !question.correctAnswers) {
                logger.debug('🔧 ValidateGeneratedQuestion - Auto-fixing: converting correctAnswer to correctAnswers array');
                question.correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
                delete question.correctAnswer;
            }
            
            if (!question.options || !Array.isArray(question.options) ||
                !question.correctAnswers || !Array.isArray(question.correctAnswers) ||
                question.correctAnswers.length === 0) {
                logger.debug('❌ ValidateGeneratedQuestion - Multiple correct validation failed');
                return false;
            }
            
            // Validate that all correctAnswers indices are within bounds
            const invalidIndices = question.correctAnswers.filter(index => 
                index < 0 || index >= question.options.length
            );
            if (invalidIndices.length > 0) {
                logger.debug('❌ ValidateGeneratedQuestion - Multiple correct has invalid indices:', invalidIndices);
                return false;
            }
        } else if (question.type === 'true-false') {
            if (!question.options || !Array.isArray(question.options) || 
                question.options.length !== 2 ||
                (question.correctAnswer !== 'true' && question.correctAnswer !== 'false')) {
                logger.debug('❌ ValidateGeneratedQuestion - True/false validation failed', {
                    optionsLength: question.options?.length,
                    correctAnswer: question.correctAnswer,
                    correctAnswerType: typeof question.correctAnswer
                });
                return false;
            }
        } else if (question.type === 'numeric') {
            // Auto-fix: Remove options array if AI incorrectly added it
            if (question.options) {
                logger.debug('🔧 ValidateGeneratedQuestion - Auto-fixing: removing options from numeric question');
                delete question.options;
            }
            
            // Auto-fix: Convert string numbers to actual numbers
            if (typeof question.correctAnswer === 'string' && !isNaN(question.correctAnswer)) {
                logger.debug('🔧 ValidateGeneratedQuestion - Auto-fixing: converting string answer to number');
                question.correctAnswer = parseFloat(question.correctAnswer);
            }
            
            // Auto-fix: Add tolerance if missing
            if (question.tolerance === undefined) {
                logger.debug('🔧 ValidateGeneratedQuestion - Auto-fixing: adding default tolerance 0');
                question.tolerance = 0;
            }
            
            if (question.correctAnswer === undefined || isNaN(question.correctAnswer)) {
                logger.debug('❌ ValidateGeneratedQuestion - Numeric validation failed');
                return false;
            }
        } else {
            logger.debug('❌ ValidateGeneratedQuestion - Unknown question type:', question.type);
            return false;
        }
        
        logger.debug('✅ ValidateGeneratedQuestion - Question is valid');
        return true;
    }

    async openModal() {
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            logger.debug('🚀 OpenModal - START');
            modal.style.display = 'flex';

            // Set provider to 'ollama' immediately
            const providerSelect = document.getElementById('ai-provider');
            logger.debug('🚀 OpenModal - Provider select found:', !!providerSelect);
            if (providerSelect) {
                logger.debug('🚀 OpenModal - Provider select current value before:', providerSelect.value);
                providerSelect.value = 'ollama';
                logger.debug('🚀 OpenModal - Provider select set to:', providerSelect.value);
            }

            // Show the model selection div immediately
            const modelSelection = document.getElementById('model-selection');
            logger.debug('🚀 OpenModal - Model selection div found:', !!modelSelection);
            if (modelSelection) {
                logger.debug('🚀 OpenModal - Model selection current display before:', window.getComputedStyle(modelSelection).display);
                modelSelection.classList.remove('hidden');
                modelSelection.style.display = 'block';
                logger.debug('🚀 OpenModal - Model selection set to block, computed style now:', window.getComputedStyle(modelSelection).display);
            }

            // Show loading message immediately
            const modelSelect = document.getElementById('ollama-model');
            logger.debug('🚀 OpenModal - Model select found:', !!modelSelect);
            if (modelSelect) {
                logger.debug('🚀 OpenModal - Model select current innerHTML before:', modelSelect.innerHTML);
                modelSelect.innerHTML = '<option value="">🔄 Loading models...</option>';
                modelSelect.disabled = true;
                logger.debug('🚀 OpenModal - Model select set to loading, innerHTML now:', modelSelect.innerHTML);
                logger.debug('🚀 OpenModal - Model select disabled:', modelSelect.disabled);
            }

            // Clear previous content
            const contentTextarea = document.getElementById('source-content');
            if (contentTextarea && !contentTextarea.value.trim()) {
                contentTextarea.placeholder = 'Enter your content here (e.g., a passage of text, topics to generate questions about, or paste from a document). ..';
            }

            // Reset question count to default
            const questionCount = document.getElementById('question-count');
            if (questionCount) {
                questionCount.value = AI.DEFAULT_QUESTION_COUNT;
            }

            logger.debug('🚀 OpenModal - About to set timeout for delayed loading');
            
            // Trigger the actual model loading after a short delay to let everything settle
            setTimeout(async () => {
                logger.debug('🚀 OpenModal - TIMEOUT TRIGGERED - Delayed model loading starting');
                
                // Debug current state before loading
                const currentModelSelection = document.getElementById('model-selection');
                const currentModelSelect = document.getElementById('ollama-model');
                
                logger.debug('🚀 TIMEOUT - Model selection div exists:', !!currentModelSelection);
                logger.debug('🚀 TIMEOUT - Model selection computed display:', currentModelSelection ? window.getComputedStyle(currentModelSelection).display : 'NOT_FOUND');
                logger.debug('🚀 TIMEOUT - Model select exists:', !!currentModelSelect);
                logger.debug('🚀 TIMEOUT - Model select innerHTML:', currentModelSelect ? currentModelSelect.innerHTML : 'NOT_FOUND');
                
                await this.loadOllamaModels();
                logger.debug('🚀 OpenModal - TIMEOUT COMPLETED - Model loading finished');
            }, 100);
            
            logger.debug('🚀 OpenModal - END');
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
    if (window.aiGenerator) {
        window.aiGenerator.openModal();
    } else {
        const modal = document.getElementById('ai-generator-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
}