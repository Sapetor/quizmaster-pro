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

    playEnhancedSound(frequency, duration, type = 'sine', volume = 0.1) {
        if (!this.soundsEnabled) return;
        
        // Create AudioContext on first use (after user interaction)
        if (!this.audioContext && this.audioContextClass) {
            try {
                this.audioContext = new this.audioContextClass();
                logger.debug('AudioContext created on first use for enhanced sound');
            } catch (e) {
                logger.debug('Failed to create AudioContext for enhanced sound:', e);
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
            
            // Enhanced volume envelope for smoother, more pleasant sounds
            const startTime = this.audioContext.currentTime;
            const endTime = startTime + duration;
            
            // Quick fade in
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
            
            // Sustain
            gainNode.gain.setValueAtTime(volume, endTime - 0.1);
            
            // Smooth fade out
            gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        } catch (e) {
            logger.debug('Enhanced sound playback failed:', e);
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
            // Simplified victory melody - fewer notes for better performance
            const notes = [
                { freq: 523, time: 0, duration: 0.3 },     // C
                { freq: 659, time: 0.15, duration: 0.3 },  // E
                { freq: 784, time: 0.3, duration: 0.4 },   // G
                { freq: 1047, time: 0.5, duration: 0.5 }   // C (higher) - finale
            ];
            
            notes.forEach(note => {
                setTimeout(() => {
                    this.playEnhancedSound(note.freq, note.duration, 'triangle', 0.12);
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
                setTimeout(() => this.playSound(AUDIO.SUCCESS_FREQUENCIES[1], 1.0, 'sawtooth'), 500);
                setTimeout(() => this.playSound(AUDIO.SUCCESS_FREQUENCIES[2], 1.2, 'sawtooth'), 1000);
            }, 1500);
            
        } catch (e) {
            logger.debug('Game ending fanfare playback failed:', e);
        }
    }

    // Convenience methods for common sound effects
    playQuestionStartSound() {
        // Attention-getting but pleasant question start sound
        this.playEnhancedSound(800, 0.25, 'triangle', 0.1); // Warmer triangle wave
    }

    playAnswerSubmissionSound() {
        // Pleasant confirmation sound for answer submission
        this.playEnhancedSound(600, 0.15, 'sine', 0.12); // Softer, shorter confirmation
    }

    playCorrectAnswerSound() {
        logger.debug('🔊 Playing correct answer sound (pleasant ascending melody)');
        // Beautiful correct answer melody - uplifting and rewarding
        // Play a pleasant ascending melody with harmonics
        const correctMelody = [
            { freq: 523, time: 0, duration: 0.25, type: 'sine' },      // C4
            { freq: 659, time: 0.1, duration: 0.25, type: 'sine' },    // E4
            { freq: 784, time: 0.2, duration: 0.4, type: 'sine' },     // G4
            { freq: 1047, time: 0.35, duration: 0.5, type: 'triangle' } // C5 (octave higher)
        ];
        
        correctMelody.forEach(note => {
            setTimeout(() => {
                this.playEnhancedSound(note.freq, note.duration, note.type, 0.15);
            }, note.time * 1000);
        });
        
        // Add a subtle harmonic accompaniment
        setTimeout(() => {
            this.playEnhancedSound(523, 0.6, 'triangle', 0.08); // Bass C
        }, 100);
    }

    playIncorrectAnswerSound() {
        logger.debug('🔊 Playing incorrect answer sound (gentle disappointed tone)');
        // Gentle incorrect answer sound - not harsh, just mildly disappointed
        // Two-tone descending pattern that's informative but not punishing
        const incorrectTones = [
            { freq: 400, time: 0, duration: 0.3, type: 'sine' },       // F4 (softer than original)
            { freq: 350, time: 0.2, duration: 0.4, type: 'triangle' }  // F3 (gentler descent)
        ];
        
        incorrectTones.forEach(note => {
            setTimeout(() => {
                this.playEnhancedSound(note.freq, note.duration, note.type, 0.12);
            }, note.time * 1000);
        });
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