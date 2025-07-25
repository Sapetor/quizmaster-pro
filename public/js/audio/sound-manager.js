/**
 * Sound Manager Module
 * Handles all audio and sound effects for the quiz application
 * 
 * EXTRACTION NOTES:
 * - Extracted from script.js lines 2069-2130, 3708-3773
 * - Includes Web Audio API integration with fallbacks
 * - Manages question start sounds, answer submission feedback, and victory fanfares
 * - Browser compatibility handling for webkit audio contexts
 * - Dependencies: None (standalone module)
 */

import { logger, AUDIO, TIMING } from '../core/config.js';

export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;
        this.initializeSounds();
    }

    initializeSounds() {
        // Don't create AudioContext immediately - wait for user interaction
        this.audioContext = null;
        this.soundsEnabled = true;
        this.audioContextClass = null;
        
        try {
            // Check if Web Audio API is supported without creating context
            if (window.AudioContext) {
                this.audioContextClass = window.AudioContext;
            } else if (window.webkitAudioContext) {
                this.audioContextClass = window.webkitAudioContext;
            } else {
                throw new Error('Web Audio API not supported');
            }
            
            logger.debug('Web Audio API supported, AudioContext will be created on first use');
        } catch (e) {
            logger.debug('Web Audio API not supported');
            this.soundsEnabled = false;
        }
    }

    playSound(frequency, duration, type = 'sine') {
        if (!this.soundsEnabled) return;
        
        // Create AudioContext on first use (after user interaction)
        if (!this.audioContext && this.audioContextClass) {
            try {
                this.audioContext = new this.audioContextClass();
                logger.debug('AudioContext created on first use');
            } catch (e) {
                logger.debug('Failed to create AudioContext on first use:', e);
                this.soundsEnabled = false;
                return;
            }
        }
        
        if (!this.audioContext) return;
        
        try {
            // Validate parameters
            if (!isFinite(frequency) || frequency <= 0) {
                logger.debug('Invalid frequency:', frequency);
                return;
            }
            if (!isFinite(duration) || duration <= 0) {
                logger.debug('Invalid duration:', duration);
                return;
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime); // Original volume
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            logger.debug('Sound playback failed:', e);
        }
    }

    playVictorySound() {
        if (!this.soundsEnabled) return;
        
        // Ensure AudioContext exists before playing
        if (!this.audioContext && this.audioContextClass) {
            this.playSound(0, 0); // This will create the context
        }
        if (!this.audioContext) return;
        
        try {
            // Play a victory melody
            const notes = [
                { freq: 523, time: 0 },     // C
                { freq: 659, time: 0.15 },  // E
                { freq: 784, time: 0.3 },   // G
                { freq: 1047, time: 0.45 }, // C (higher)
                { freq: 784, time: 0.6 },   // G
                { freq: 1047, time: 0.75 }  // C (higher)
            ];
            
            notes.forEach(note => {
                setTimeout(() => {
                    this.playSound(note.freq, 0.2);
                }, note.time * 1000);
            });
        } catch (e) {
            logger.debug('Victory sound playback failed:', e);
        }
    }

    playGameEndingFanfare() {
        if (!this.soundsEnabled) return;
        
        // Ensure AudioContext exists before playing
        if (!this.audioContext && this.audioContextClass) {
            this.playSound(0, 0); // This will create the context
        }
        if (!this.audioContext) return;
        
        try {
            // Play an elaborate game ending fanfare (triumph-like melody)
            const fanfareNotes = [
                // Opening triumphant notes
                { freq: 523, time: 0, duration: 0.3 },     // C
                { freq: 659, time: 0.1, duration: 0.3 },   // E
                { freq: 784, time: 0.2, duration: 0.3 },   // G
                { freq: 1047, time: 0.3, duration: 0.4 },  // C (higher)
                
                // Rising sequence
                { freq: 659, time: 0.8, duration: 0.2 },   // E
                { freq: 784, time: 1.0, duration: 0.2 },   // G
                { freq: 1047, time: 1.2, duration: 0.2 },  // C
                { freq: 1319, time: 1.4, duration: 0.4 },  // E (higher)
                
                // Grand finale
                { freq: 1047, time: 2.0, duration: 0.3 },  // C
                { freq: 1319, time: 2.2, duration: 0.3 },  // E
                { freq: 1568, time: 2.4, duration: 0.6 },  // G (highest)
                { freq: 2093, time: 2.8, duration: 0.8 }   // C (very high)
            ];
            
            fanfareNotes.forEach(note => {
                setTimeout(() => {
                    this.playSound(note.freq, note.duration, 'triangle');
                }, note.time * 1000);
            });
            
            // Add some harmonic accompaniment
            setTimeout(() => {
                this.playSound(523, 1.5, 'sawtooth'); // Bass C
                setTimeout(() => this.playSound(AUDIO.VICTORY_BASS_FREQUENCIES[0], AUDIO.VICTORY_BASS_DURATIONS[0], AUDIO.VICTORY_BASS_WAVEFORM), TIMING.VICTORY_BASS_DELAYS[0]);
                setTimeout(() => this.playSound(AUDIO.VICTORY_BASS_FREQUENCIES[1], AUDIO.VICTORY_BASS_DURATIONS[1], AUDIO.VICTORY_BASS_WAVEFORM), TIMING.VICTORY_BASS_DELAYS[1]);
            }, 1500);
            
        } catch (e) {
            logger.debug('Game ending fanfare playback failed:', e);
        }
    }

    // Convenience methods for common sound effects
    playQuestionStartSound() {
        this.playSound(800, 0.3); // Question start frequency and duration
    }

    playAnswerSubmissionSound() {
        this.playSound(600, 0.2); // Answer submission sound
    }

    playCorrectAnswerSound() {
        logger.debug('🔊 Playing correct answer sound (original ascending notes: C-E-G)');
        // Original correct answer chord progression (ascending notes)
        setTimeout(() => this.playSound(AUDIO.SUCCESS_FREQUENCIES[0], AUDIO.SUCCESS_DURATIONS[0]), TIMING.SUCCESS_MELODY_DELAYS[0]);
        setTimeout(() => this.playSound(AUDIO.SUCCESS_FREQUENCIES[1], AUDIO.SUCCESS_DURATIONS[1]), TIMING.SUCCESS_MELODY_DELAYS[1]);
        setTimeout(() => this.playSound(AUDIO.SUCCESS_FREQUENCIES[2], AUDIO.SUCCESS_DURATIONS[2]), TIMING.SUCCESS_MELODY_DELAYS[2]);
    }

    playIncorrectAnswerSound() {
        logger.debug('🔊 Playing incorrect answer sound (original descending sawtooth)');
        // Original incorrect answer descending tones
        this.playSound(400, 0.2, 'sawtooth');
        setTimeout(() => this.playSound(AUDIO.WRONG_ANSWER_FREQ, AUDIO.WRONG_ANSWER_DURATION, AUDIO.WRONG_ANSWER_WAVEFORM), TIMING.WRONG_ANSWER_DELAY);
    }

    // Utility methods
    isEnabled() {
        return this.soundsEnabled && (this.audioContext !== null || this.audioContextClass !== null);
    }

    enable() {
        this.soundsEnabled = true;
        // AudioContext will be created on first sound play
        // This prevents the browser warning about AudioContext not being allowed to start
    }

    disable() {
        this.soundsEnabled = false;
    }

    // Resume audio context if suspended (required for some browsers)
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                logger.debug('Audio context resumed');
            } catch (e) {
                logger.debug('Failed to resume audio context:', e);
            }
        }
    }
}