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
    CURRENT_LEVEL: 4 // Show all logs in development (1=errors, 2=warnings, 3=info, 4=debug)
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
};

export const SCORING = {
    BASE_POINTS: 100,
    MAX_BONUS_TIME: 10000,
};

export const LIMITS = {
    MAX_PLAYER_NAME_LENGTH: 20,
};

export const AUDIO = {
    QUESTION_START_FREQ: 800,
    QUESTION_START_DURATION: 0.3,
};

export const UI = {
    ANIMATION_DURATION: 300,
    MOBILE_BREAKPOINT: 768,
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
    GAME_STARTING: 'game-starting',
    QUESTION_START: 'question-start',
    QUESTION_END: 'question-end',
    GAME_END: 'game-end',
    SHOW_NEXT_BUTTON: 'show-next-button',
    HIDE_NEXT_BUTTON: 'hide-next-button',
    PLAYER_RESULT: 'player-result',
    ERROR: 'error',
};