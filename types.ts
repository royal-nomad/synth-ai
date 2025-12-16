
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type LfoTarget = 'none' | 'cutoff' | 'pitch' | 'amp';
export type LfoWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SynthPatch {
  // OSC & ENV
  oscType: OscillatorType;
  filterCutoff: number; // Hz, 20 to 20000
  filterResonance: number; // Q, 0 to 20
  ampAttack: number; // Seconds
  ampDecay: number; // Seconds
  ampSustain: number; // 0 to 1 level
  ampRelease: number; // Seconds
  masterGain: number; // 0 to 1

  // LFO
  lfoWaveform: LfoWaveform;
  lfoRate: number; // Hz, 0.1 to 20
  lfoDepth: number; // 0 to 1
  lfoTarget: LfoTarget;

  // EFFECTS (Pedalboard)
  distortionAmount: number; // 0 to 100
  delayTime: number; // 0 to 1 seconds
  delayFeedback: number; // 0 to 0.95
  reverbMix: number; // 0 to 1
}

export interface Preset {
  id: string;
  name: string;
  patch: SynthPatch;
  createdAt: number;
}

export const DEFAULT_PATCH: SynthPatch = {
  oscType: 'sawtooth',
  filterCutoff: 2000,
  filterResonance: 1,
  ampAttack: 0.1,
  ampDecay: 0.2,
  ampSustain: 0.7,
  ampRelease: 1.0,
  masterGain: 0.5,

  lfoWaveform: 'sine',
  lfoRate: 5,
  lfoDepth: 0,
  lfoTarget: 'none',

  distortionAmount: 0,
  delayTime: 0.3,
  delayFeedback: 0.3,
  reverbMix: 0,
};

// Gemini Patch Generation Response Schema Helper
export interface GeminiPatchResponse {
  oscType: string;
  filterCutoff: number;
  filterResonance: number;
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  ampRelease: number;
  
  lfoWaveform: string;
  lfoRate: number;
  lfoDepth: number;
  lfoTarget: string;

  distortionAmount: number;
  delayTime: number;
  delayFeedback: number;
  reverbMix: number;

  description?: string;
}
