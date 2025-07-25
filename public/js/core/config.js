/**
 * Configuration constants for QuizMaster Pro
 */

// Development/Production Configuration
export const DEBUG = {
    // Set to false for production builds
    ENABLED: true,
    LEVELS: {
        ERROR: 1,
        WARN: 2, 
        INFO: 3,
        DEBUG: 4
    },
    CURRENT_LEVEL: 4 // Show errors and warnings only (1=errors, 2=warnings, 3=info, 4=debug)
};

// Debug utility functions
export const logger = {
    error: (message, ...args) => {
        if (DEBUG.ENABLED && DEBUG.CURRENT_LEVEL >= DEBUG.LEVELS.ERROR) {
            console.error(`❌ ${message}`, ...args);
        }
    },
    warn: (message, ...args) => {
        if (DEBUG.ENABLED && DEBUG.CURRENT_LEVEL >= DEBUG.LEVELS.WARN) {
            console.warn(`⚠️ ${message}`, ...args);
        }
    },
    info: (message, ...args) => {
        if (DEBUG.ENABLED && DEBUG.CURRENT_LEVEL >= DEBUG.LEVELS.INFO) {
            console.log(`ℹ️ ${message}`, ...args);
        }
    },
    debug: (message, ...args) => {
        if (DEBUG.ENABLED && DEBUG.CURRENT_LEVEL >= DEBUG.LEVELS.DEBUG) {
            console.log(`🔧 ${message}`, ...args);
        }
    }
};

export const TIMING = {
    DEFAULT_QUESTION_TIME: 20,
    TRANSLATION_DELAY: 50,
    LEADERBOARD_DISPLAY_TIME: 3000,
    QUESTION_START_DURATION: 0.3,
    RESULT_DISPLAY_DURATION: 4000, // 4 seconds for result feedback
    AUTO_SAVE_DELAY: 5000, // Auto-save delay after input changes
    DOM_UPDATE_DELAY: 100, // Standard delay for DOM updates
    DEBOUNCE_DELAY: 1000, // Standard debounce delay for user actions
    GAME_START_DELAY: 2000, // Delay before starting game
    DEBUG_ANALYSIS_DELAY: 5000, // Delay for debug analysis
    ANIMATION_FADE_DURATION: 300, // Standard fade animation duration
    SCROLL_THRESHOLD: 300, // Scroll threshold for back-to-top button
    MATHJAX_TIMEOUT: 100, // Standard MathJax rendering timeout
    MATHJAX_RETRY_TIMEOUT: 200, // MathJax retry timeout
    SHORT_DELAY: 10, // Very short delay for style updates
    
    // Gameplay timing constants
    SCREEN_TRANSITION_DELAY: 150, // Delay before MathJax rendering after screen change
    HOST_QUESTION_RENDER_DELAY: 200, // Delay for host question rendering
    HOST_OPTIONS_RENDER_DELAY: 250, // Delay for host options rendering
    PLAYER_RENDER_DELAY: 200, // Delay for player content rendering
    HOST_FINALIZE_DELAY: 150, // Delay for host display finalization
    PLAYER_FINALIZE_DELAY: 150, // Delay for player display finalization
    
    // UI interaction timing
    PREVIEW_UPDATE_DEBOUNCE: 150, // Debounce delay for preview updates
    SPLIT_VIEW_TOGGLE_DELAY: 500, // Delay for split view transitions
    MATHJAX_CHECK_INTERVAL: 50, // Polling interval for MathJax readiness
    MATHJAX_LOADING_TIMEOUT: 10000, // Maximum wait time for MathJax loading
    MATH_RENDERER_TIMEOUT: 5000, // Default timeout for math renderer
    
    // Audio timing constants
    SUCCESS_MELODY_DELAYS: [0, 150, 300], // Timing for success sound sequence
    VICTORY_BASS_DELAYS: [500, 1000], // Timing for victory bass sequence
    WRONG_ANSWER_DELAY: 200, // Delay for wrong answer sound
    
    // Animation and confetti timing
    CONFETTI_BURST_TIMES: [300, 600, 900, 1200, 1500], // Multiple confetti burst timings
};

export const SCORING = {
    BASE_POINTS: 100,
    MAX_BONUS_TIME: 10000,
};

export const LIMITS = {
    MAX_PLAYER_NAME_LENGTH: 20,
    MIN_TIME_LIMIT: 5, // Minimum time limit for questions (seconds)
    MAX_TIME_LIMIT: 300, // Maximum time limit for questions (seconds)
    MAX_PLAYER_NUMBER: 999, // Maximum player number for auto-generated names
};

export const AUDIO = {
    QUESTION_START_FREQ: 800,
    QUESTION_START_DURATION: 0.3,
    
    // Success melody frequencies and settings
    SUCCESS_FREQUENCIES: [523, 659, 784], // C, E, G notes
    SUCCESS_DURATIONS: [0.15, 0.15, 0.3],
    
    // Victory sound frequencies
    VICTORY_BASS_FREQUENCIES: [659, 784], // E, G bass notes
    VICTORY_BASS_DURATIONS: [1.0, 1.2],
    VICTORY_BASS_WAVEFORM: 'sawtooth',
    
    // Wrong answer sound
    WRONG_ANSWER_FREQ: 300,
    WRONG_ANSWER_DURATION: 0.3,
    WRONG_ANSWER_WAVEFORM: 'sawtooth',
};

export const UI = {
    ANIMATION_DURATION: 300,
    MOBILE_BREAKPOINT: 768,
    
    // Font scaling system - expanded range for better readability
    FONT_SCALES: {
        small: 0.9,
        medium: 1.0,
        large: 1.3,
        xlarge: 1.6
    },
    
    // Preview and split view settings
    INITIAL_SPLIT_RATIO: 50, // Initial split ratio percentage for preview
    
    // UI spacing and layout constants
    PREVIEW_SPACING_DEFAULT: 8, // Default spacing for preview elements (px)
    CHECKBOX_MARGIN_BOTTOM: 8, // Consistent margin for checkbox options (px)
    
    // Visual feedback constants
    TRANSFORM_SCALE_HIGHLIGHT: 1.02, // Scale factor for highlighting elements
    OPACITY_HIGHLIGHT: 0.1, // Opacity for highlight backgrounds
    OPACITY_ERROR_PLACEHOLDER: 0.7, // Opacity for error placeholder text
    
    // Image and media constants
    MAX_IMAGE_WIDTH: '100%', // Maximum width for images
    
    // Button and control styling
    BUTTON_PADDING: '15px 30px',
    BUTTON_BORDER_RADIUS: '8px',
    BUTTON_FONT_SIZE: '16px',
    BUTTON_SHADOW: '0 4px 8px rgba(0,0,0,0.2)',
    BUTTON_POSITION_OFFSET: '20px', // For floating buttons
    
    // Border and decoration constants
    DASHED_BORDER_WIDTH: '2px',
    BORDER_RADIUS_STANDARD: '8px',
};

export const VALIDATION = {
    MIN_QUESTIONS: 1,
    MAX_QUESTIONS: 100,
    MIN_OPTIONS: 2,
    MAX_OPTIONS: 6,
};

export const DEFAULTS = {
    QUESTION_TIME: 20,
    DIFFICULTY: 'medium',
    QUESTION_TYPE: 'multiple-choice',
};

// AI Generation constants
export const AI = {
    // Generation settings
    DEFAULT_QUESTION_COUNT: 1,
    DEFAULT_TEMPERATURE: 0.7,
    
    // API endpoints and models
    OLLAMA_ENDPOINT: 'http://localhost:11434/api/generate',
    OLLAMA_TAGS_ENDPOINT: 'http://localhost:11434/api/tags',
    OLLAMA_DEFAULT_MODEL: 'llama3.2:latest',
    OPENAI_MODEL: 'gpt-3.5-turbo',
    
    // Content detection patterns
    MATH_INDICATORS: /\$.*\$|\\\\w+{.*}|\\begin{|\\end{|\\frac|\\sqrt|\\sum|\\int/,
    PROGRAMMING_INDICATORS: /def\s+\w+\(/,
    PHYSICS_INDICATORS: /newton|joule|watt|volt|ampere|velocity|acceleration|force|energy|momentum/i,
    CHEMISTRY_INDICATORS: /molecule|atom|bond|reaction|catalyst|pH|ion|electron|proton|neutron/i,
};

// Animation and confetti constants
export const ANIMATION = {
    // Confetti settings
    CONFETTI_PARTICLE_COUNT: 100,
    CONFETTI_BURST_PARTICLES: 50,
    CONFETTI_SPREAD: 70,
    CONFETTI_ORIGIN_Y: 0.6,
    CONFETTI_ANGLE_RANGE: [55, 125],
    
    // Visual effects
    PERCENTAGE_CALCULATION_BASE: 100, // For percentage calculations
};

export const API = {
    SAVE_QUIZ: '/api/save-quiz',
    LOAD_QUIZZES: '/api/quizzes',
    LOAD_QUIZ: '/api/quiz',
    SAVE_RESULTS: '/api/save-results',
    UPLOAD: '/upload',
    QR_CODE: '/api/qr',
    CLAUDE_GENERATE: '/api/claude/generate',
};

export const SOCKET_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    HOST_JOIN: 'host-join',
    PLAYER_JOIN: 'player-join',
    START_GAME: 'start-game',
    SUBMIT_ANSWER: 'submit-answer',
    NEXT_QUESTION: 'next-question',
    GAME_CREATED: 'game-created',
    GAME_AVAILABLE: 'game-available',
    GAME_STARTING: 'game-starting',
    QUESTION_START: 'question-start',
    QUESTION_END: 'question-end',
    GAME_END: 'game-end',
    SHOW_NEXT_BUTTON: 'show-next-button',
    HIDE_NEXT_BUTTON: 'hide-next-button',
    PLAYER_RESULT: 'player-result',
    ERROR: 'error',
};