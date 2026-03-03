class AudioManager {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.isInitialized = false;

        // Ensure audio context is lazily created on first user interaction
        this.init = () => {
            if (this.isInitialized) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;

                this.context = new AudioContext();
                this.masterGain = this.context.createGain();
                this.masterGain.gain.value = 0.2; // Keep it subtle by default
                this.masterGain.connect(this.context.destination);
                this.isInitialized = true;
            } catch (err) {
                console.warn("AudioManager could not initialize:", err);
            }
        };
    }

    playTypingSound(type) {
        if (!type || type === 'none') return;

        // Lazy initialize
        if (!this.isInitialized) {
            this.init();
        }

        if (!this.context) return;

        // Resume if suspended (browser auto-play policies)
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        const now = this.context.currentTime;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        // Connect chain: Osc -> Filter -> Gain -> Master
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        // Slightly vary pitch so it doesn't sound completely static
        const randomVary = Math.random() * 0.1 - 0.05;

        switch (type) {
            case 'mechanical':
                // High, sharp click replicating an MX Blue switch click-bar
                osc.type = 'square';
                osc.frequency.setValueAtTime(800 + (Math.random() * 200), now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

                filter.type = 'highpass';
                filter.frequency.value = 2000;

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

                osc.start(now);
                osc.stop(now + 0.06);
                break;

            case 'typewriter':
                // Deeper, chunky thud with slight resonance
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150 + (Math.random() * 50), now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

                filter.type = 'bandpass';
                filter.frequency.value = 800;
                filter.Q.value = 1.0;

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

                osc.start(now);
                osc.stop(now + 0.1);

                // Add a secondary immediate click for the 'clack' layer
                const osc2 = this.context.createOscillator();
                const gain2 = this.context.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1200 + (Math.random() * 300), now);
                osc2.frequency.exponentialRampToValueAtTime(200, now + 0.03);
                gain2.gain.setValueAtTime(0.3, now);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

                osc2.connect(gain2);
                gain2.connect(this.masterGain);
                osc2.start(now);
                osc2.stop(now + 0.03);
                break;

            case 'click':
                // Short, tight UI pop (similar to iOS keyboard clicks)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600 + (Math.random() * 100), now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);

                filter.type = 'lowpass';
                filter.frequency.value = 1500;

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

                osc.start(now);
                osc.stop(now + 0.04);
                break;

            case 'pop':
                // Hollow, bubbly plop
                osc.type = 'sine';
                osc.frequency.setValueAtTime(250 + (Math.random() * 40), now);
                osc.frequency.linearRampToValueAtTime(350, now + 0.05); // frequency goes UP

                filter.type = 'lowpass';
                filter.frequency.value = 1000;

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

                osc.start(now);
                osc.stop(now + 0.07);
                break;

            default:
                break;
        }
    }
}

export const audioManager = new AudioManager();
