// A dependency-free sound manager using the Web Audio API to generate sounds programmatically.

class SoundManager {
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    if (typeof window !== 'undefined' && !this.audioContext) {
      try {
        // Create AudioContext after a user gesture (e.g., click) for browser compatibility.
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.error("Web Audio API is not supported in this browser.", e);
      }
    }
  }

  // Ensures AudioContext is running, especially on browsers that require user interaction.
  private resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public play(sound: 'click' | 'success' | 'newSignal' | 'error') {
    this.initializeAudioContext(); // Ensure context exists
    this.resumeContext(); // Resume if suspended

    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    let oscillator: OscillatorNode;
    let gainNode: GainNode;

    switch (sound) {
      case 'click':
        // A sharp, quick, professional click
        oscillator = this.audioContext.createOscillator();
        gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        oscillator.start(now);
        oscillator.stop(now + 0.05);
        break;

      case 'success':
        // A clean, two-tone chime (C5 -> G5)
        gainNode = this.audioContext.createGain();
        gainNode.connect(this.audioContext.destination);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        const osc1 = this.audioContext.createOscillator();
        osc1.connect(gainNode);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.start(now);
        osc1.stop(now + 0.1);

        const osc2 = this.audioContext.createOscillator();
        osc2.connect(gainNode);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
        osc2.start(now + 0.1);
        osc2.stop(now + 0.2);
        break;

      case 'newSignal':
        // A subtle but clear "ping"
        oscillator = this.audioContext.createOscillator();
        gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, now);
        oscillator.frequency.setValueAtTime(900, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        oscillator.start(now);
        oscillator.stop(now + 0.25);
        break;
        
       case 'error':
        // Not requested, but good to have
        break;
    }
  }
}

export const soundManager = new SoundManager();