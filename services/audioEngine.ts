
import { SynthPatch } from '../types';

class AudioEngine {
  private context: AudioContext | null = null;
  
  // Signal Chain Nodes
  private masterGain: GainNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackNode: GainNode | null = null;
  private delayWetNode: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetNode: GainNode | null = null;
  private reverbDryNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Active notes map
  private activeNotes: Map<string, {
    osc: OscillatorNode;
    filter: BiquadFilterNode;
    amp: GainNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
  }> = new Map();

  public init() {
    if (this.context) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.context = new AudioContextClass();
    
    // Create Nodes
    this.masterGain = this.context.createGain();
    this.distortionNode = this.context.createWaveShaper();
    
    // Delay Setup
    this.delayNode = this.context.createDelay(5.0);
    this.delayFeedbackNode = this.context.createGain();
    this.delayWetNode = this.context.createGain();
    // Connect Delay Feedback Loop
    this.delayNode.connect(this.delayFeedbackNode);
    this.delayFeedbackNode.connect(this.delayNode);

    // Reverb Setup
    this.reverbNode = this.context.createConvolver();
    this.reverbWetNode = this.context.createGain();
    this.reverbDryNode = this.context.createGain();
    // Generate simple impulse response for reverb
    this.reverbNode.buffer = this.createImpulseResponse(2.0, 2.0);

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;

    // --- ROUTING CHAIN ---
    // Voices -> MasterGain -> Distortion
    this.masterGain.connect(this.distortionNode);
    
    // Distortion -> Delay Split
    const distOut = this.distortionNode;
    const delayInput = this.context.createGain(); // Split point
    distOut.connect(delayInput);

    // Delay -> Reverb Split
    const delayOut = this.context.createGain(); // Merge wet/dry delay
    
    // Delay Path
    delayInput.connect(this.delayNode); // to wet
    this.delayNode.connect(this.delayWetNode);
    this.delayWetNode.connect(delayOut);
    delayInput.connect(delayOut); // pass through dry signal from distortion

    // Reverb Path
    const reverbOut = this.analyser; // Final destination
    
    delayOut.connect(this.reverbNode); // to wet
    this.reverbNode.connect(this.reverbWetNode);
    this.reverbWetNode.connect(reverbOut);
    
    delayOut.connect(this.reverbDryNode); // dry
    this.reverbDryNode.connect(reverbOut);

    this.analyser.connect(this.context.destination);

    // Initial values
    this.masterGain.gain.value = 0.5;
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const rate = this.context!.sampleRate;
    const length = rate * duration;
    const impulse = this.context!.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = length - i;
        // Simple noise with exponential decay
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    
    if (amount === 0) {
        for (let i = 0; i < n_samples; ++i) curve[i] = (i * 2) / n_samples - 1;
        return curve;
    }

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  public setMasterVolume(val: number) {
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(val, this.context.currentTime, 0.01);
    }
  }

  // Updates parameters for all currently playing voices AND global effects
  public updateActiveParams(patch: SynthPatch) {
    if (!this.context) return;
    const t = this.context.currentTime;

    // Update Voices
    this.activeNotes.forEach(note => {
      // Filter
      note.filter.frequency.setTargetAtTime(patch.filterCutoff, t, 0.1);
      note.filter.Q.setTargetAtTime(patch.filterResonance, t, 0.1);
      
      // LFO Updates
      if (note.lfo.type !== patch.lfoWaveform) note.lfo.type = patch.lfoWaveform;
      note.lfo.frequency.setTargetAtTime(patch.lfoRate, t, 0.1);
      
      // Update LFO Gain (Depth)
      let gainValue = 0;
      if (patch.lfoTarget === 'cutoff') gainValue = patch.lfoDepth * 1000; 
      else if (patch.lfoTarget === 'pitch') gainValue = patch.lfoDepth * 100; 
      else if (patch.lfoTarget === 'amp') gainValue = patch.lfoDepth * 0.5;

      // Note: Changing target dynamically on active notes is complex due to disconnection. 
      // For simplicity in this update, we only update the gain amount. 
      // A full re-patching would be needed to change LFO target on sustained notes perfectly.
      // We assume the target stays consistent or we update the gain connected to the *current* target.
      // For this boilerplate, we simply update the gain value.
      note.lfoGain.gain.setTargetAtTime(gainValue, t, 0.1);
    });

    // Update Global Effects
    if (this.distortionNode) {
        this.distortionNode.curve = this.makeDistortionCurve(patch.distortionAmount);
        this.distortionNode.oversample = '4x';
    }
    
    if (this.delayNode && this.delayFeedbackNode && this.delayWetNode) {
        this.delayNode.delayTime.setTargetAtTime(patch.delayTime, t, 0.1);
        this.delayFeedbackNode.gain.setTargetAtTime(patch.delayFeedback, t, 0.1);
        // Simplified Delay Wet/Dry
        const delayWet = patch.delayTime > 0 ? 0.5 : 0;
        this.delayWetNode.gain.setTargetAtTime(delayWet, t, 0.1);
    }

    if (this.reverbDryNode && this.reverbWetNode) {
        // Equal power-ish crossfade
        const wet = patch.reverbMix;
        const dry = 1 - (wet * 0.4); 
        this.reverbWetNode.gain.setTargetAtTime(wet, t, 0.1);
        this.reverbDryNode.gain.setTargetAtTime(dry, t, 0.1);
    }
  }

  public triggerAttack(id: string, frequency: number, patch: SynthPatch) {
    if (!this.context || !this.masterGain) return;
    this.resume();
    this.triggerRelease(id);

    const t = this.context.currentTime;

    const osc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const amp = this.context.createGain();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();

    // Configure Oscillator
    osc.type = patch.oscType;
    osc.frequency.setValueAtTime(frequency, t);

    // Configure Filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(patch.filterCutoff, t);
    filter.Q.setValueAtTime(patch.filterResonance, t);

    // Configure Envelope (Amp)
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(1, t + patch.ampAttack);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.001, patch.ampSustain), t + patch.ampAttack + patch.ampDecay);

    // Configure LFO
    lfo.type = patch.lfoWaveform;
    lfo.frequency.setValueAtTime(patch.lfoRate, t);
    lfo.connect(lfoGain);

    // LFO Routing
    let lfoAmount = 0;
    if (patch.lfoTarget === 'cutoff') {
        lfoAmount = patch.lfoDepth * 2000; 
        lfoGain.connect(filter.frequency);
    } else if (patch.lfoTarget === 'pitch') {
        lfoAmount = patch.lfoDepth * 100;
        lfoGain.connect(osc.detune);
    } else if (patch.lfoTarget === 'amp') {
        lfoAmount = patch.lfoDepth * 0.5;
        lfoGain.connect(amp.gain);
    }
    
    lfoGain.gain.setValueAtTime(lfoAmount, t);
    lfo.start(t);

    // Routing: Osc -> Filter -> Amp -> Master
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.masterGain);

    osc.start(t);

    this.activeNotes.set(id, { osc, filter, amp, lfo, lfoGain });
  }

  public triggerRelease(id: string, patch?: SynthPatch) {
    if (!this.context) return;
    const note = this.activeNotes.get(id);
    if (!note) return;

    const t = this.context.currentTime;
    const releaseTime = patch ? patch.ampRelease : 0.5;

    // Release envelope
    note.amp.gain.cancelScheduledValues(t);
    note.amp.gain.setValueAtTime(note.amp.gain.value, t);
    note.amp.gain.exponentialRampToValueAtTime(0.001, t + releaseTime);

    note.osc.stop(t + releaseTime + 0.1);
    note.lfo.stop(t + releaseTime + 0.1);
    
    // Cleanup after release
    setTimeout(() => {
        note.osc.disconnect();
        note.filter.disconnect();
        note.amp.disconnect();
        note.lfo.disconnect();
        note.lfoGain.disconnect();
    }, (releaseTime + 0.2) * 1000);

    this.activeNotes.delete(id);
  }
}

export const audioEngine = new AudioEngine();
