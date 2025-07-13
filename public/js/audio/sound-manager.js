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

export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;
        this.initializeSounds();
    }

    initializeSounds() {
        // Create AudioContext for sound effects
        this.audioContext = null;
        this.soundsEnabled = true;
        
        try {
            let AudioContextClass = window.AudioContext;
            if (!AudioContextClass && 'webkitAudioContext' in window) {
                AudioContextClass = window.webkitAudioContext;
            }
            
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass();
            } else {
                throw new Error('Web Audio API not supported');
            }
        } catch (e) {
            console.log('Web Audio API not supported');
            this.soundsEnabled = false;
        }
    }

    playSound(frequency, duration, type = 'sine') {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            // Validate parameters
            if (!isFinite(frequency) || frequency <= 0) {
                console.log('Invalid frequency:', frequency);
                return;
            }
            if (!isFinite(duration) || duration <= 0) {
                console.log('Invalid duration:', duration);
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
            console.log('Sound playback failed:', e);
        }
    }

    playVictorySound() {
        if (!this.soundsEnabled || !this.audioContext) return;
        
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
            console.log('Victory sound playback failed:', e);
        }
    }

    playGameEndingFanfare() {
        if (!this.soundsEnabled || !this.audioContext) return;
        
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
                setTimeout(() => this.playSound(659, 1.0, 'sawtooth'), 500); // Bass E
                setTimeout(() => this.playSound(784, 1.2, 'sawtooth'), 1000); // Bass G
            }, 1500);
            
        } catch (e) {
            console.log('Game ending fanfare playback failed:', e);
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
        console.log('🔊 Playing correct answer sound (original ascending notes: C-E-G)');
        // Original correct answer chord progression (ascending notes)
        setTimeout(() => this.playSound(523, 0.15), 0);   // C
        setTimeout(() => this.playSound(659, 0.15), 150); // E
        setTimeout(() => this.playSound(784, 0.3), 300);  // G
    }

    playIncorrectAnswerSound() {
        console.log('🔊 Playing incorrect answer sound (original descending sawtooth)');
        // Original incorrect answer descending tones
        this.playSound(400, 0.2, 'sawtooth');
        setTimeout(() => this.playSound(300, 0.3, 'sawtooth'), 200);
    }

    // Utility methods
    isEnabled() {
        return this.soundsEnabled && this.audioContext !== null;
    }

    enable() {
        this.soundsEnabled = true;
        if (!this.audioContext) {
            this.initializeSounds();
        }
    }

    disable() {
        this.soundsEnabled = false;
    }

    // Resume audio context if suspended (required for some browsers)
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            } catch (e) {
                console.log('Failed to resume audio context:', e);
            }
        }
    }
}