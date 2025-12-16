
import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_PATCH, SynthPatch, Preset, LfoTarget, LfoWaveform } from './types';
import { audioEngine } from './services/audioEngine';
import { generatePatchFromDescription } from './services/geminiService';
import { hardwareBridge } from './services/hardwareBridge';
import { Knob } from './components/Knob';
import { Oscilloscope } from './components/Oscilloscope';
import { PianoKeys } from './components/PianoKeys';

// Utility to convert MIDI note to Frequency
const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export default function App() {
  const [patch, setPatch] = useState<SynthPatch>(DEFAULT_PATCH);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Hardware Connection State
  const [showHardwarePanel, setShowHardwarePanel] = useState(false);
  const [hardwareIp, setHardwareIp] = useState('ws://192.168.4.1/ws');
  const [hwConnected, setHwConnected] = useState(false);
  const [hwError, setHwError] = useState<string | null>(null);

  // Cloud/Preset State
  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  // Load Presets on Mount
  useEffect(() => {
    const saved = localStorage.getItem('syntho_presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) { console.error("Failed to load presets"); }
    }
  }, []);

  const handleStartAudio = () => {
    audioEngine.init();
    audioEngine.resume();
    setIsPlaying(true);
  };

  const handleNoteOn = (midi: number) => {
    if (!isPlaying) handleStartAudio();
    
    // Local Web Audio
    audioEngine.triggerAttack(midi.toString(), midiToFreq(midi), patch);
    
    // External Hardware (Immediate)
    if (hwConnected) {
      hardwareBridge.sendNote('noteOn', midi, 127);
    }
  };

  const handleNoteOff = (midi: number) => {
    // Local Web Audio
    audioEngine.triggerRelease(midi.toString(), patch);

    // External Hardware (Immediate)
    if (hwConnected) {
      hardwareBridge.sendNote('noteOff', midi);
    }
  };

  const handlePatchChange = (key: keyof SynthPatch, value: number | string) => {
    const newPatch = { ...patch, [key]: value };
    setPatch(newPatch);
    
    // Update active voices in real-time
    audioEngine.updateActiveParams(newPatch);

    // Local Master Gain
    if (key === 'masterGain') {
      audioEngine.setMasterVolume(value as number);
    }

    // External Hardware (Throttled/Batched)
    if (hwConnected) {
      hardwareBridge.sendParam(key, value);
    }
  };

  const applyPatch = (newPatch: SynthPatch) => {
    setPatch(newPatch);
    audioEngine.updateActiveParams(newPatch); // Update sound immediately
    if (hwConnected) {
      hardwareBridge.syncFullPatch(newPatch); // Force full sync to hardware
    }
  };

  const handleGeneratePatch = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const newParams = await generatePatchFromDescription(aiPrompt);
      const updatedPatch = { ...patch, ...newParams };
      applyPatch(updatedPatch);
    } catch (e) {
      console.error(e);
      alert('Failed to generate patch. Check console and API Key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName,
      patch: { ...patch },
      createdAt: Date.now(),
    };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('syntho_presets', JSON.stringify(updatedPresets));
    setNewPresetName('');
  };

  const loadPreset = (preset: Preset) => {
    applyPatch(preset.patch);
    setShowCloudPanel(false);
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('syntho_presets', JSON.stringify(updated));
  };

  const toggleHardwareConnection = () => {
    if (hwConnected) {
      hardwareBridge.disconnect();
      setHwConnected(false);
    } else {
      setHwError(null);
      hardwareBridge.connect(
        hardwareIp,
        () => setHwConnected(true),
        () => setHwConnected(false),
        (err) => setHwError("Connection failed")
      );
    }
  };

  return (
    <div 
      className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-100 relative" 
      onClick={() => { setShowHardwarePanel(false); setShowCloudPanel(false); }}
    >
      
      {/* Main Synth Chassis */}
      <div className="w-full max-w-6xl bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col relative z-10" onClick={e => e.stopPropagation()}>
        
        {/* Header / Top Bar */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center select-none">
          <div className="flex items-center gap-3">
             <div className="w-4 h-4 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>
             <h1 className="text-2xl font-black tracking-tighter text-zinc-100">SYNTHO <span className="text-cyan-500">AI</span></h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Cloud/Presets Button */}
            <div className="relative">
              <button
                onClick={() => setShowCloudPanel(!showCloudPanel)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${showCloudPanel ? 'bg-zinc-800 border-zinc-600' : 'bg-transparent border-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                CLOUD SYNC
              </button>

              {/* Cloud Panel */}
              {showCloudPanel && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 z-50 flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Cloud Presets</h3>
                  
                  {/* Save Section */}
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300 outline-none focus:border-cyan-500"
                      placeholder="Preset Name..."
                      value={newPresetName}
                      onChange={e => setNewPresetName(e.target.value)}
                    />
                    <button onClick={savePreset} className="bg-zinc-800 hover:bg-cyan-600 text-white px-3 py-1 rounded text-xs font-bold">SAVE</button>
                  </div>

                  {/* List Section */}
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                    {presets.length === 0 && <div className="text-xs text-zinc-600 text-center py-4">No saved presets</div>}
                    {presets.map(p => (
                      <div key={p.id} className="group flex justify-between items-center bg-zinc-950/50 p-2 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
                        <div className="flex flex-col">
                           <span className="text-sm font-medium text-zinc-300">{p.name}</span>
                           <span className="text-[10px] text-zinc-600">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => loadPreset(p)} className="text-cyan-500 hover:text-cyan-400 text-xs font-bold">LOAD</button>
                          <button onClick={() => deletePreset(p.id)} className="text-red-500 hover:text-red-400 text-xs font-bold">DEL</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2 leading-tight">
                    Presets are synced to local storage and pushed to hardware upon load.
                  </div>
                </div>
              )}
            </div>

            {/* Hardware Toggle */}
            <div className="relative">
                <button 
                  onClick={() => setShowHardwarePanel(!showHardwarePanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${hwConnected ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${hwConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-zinc-500'}`}></div>
                  HW BRIDGE
                </button>

                {/* Hardware Connection Panel */}
                {showHardwarePanel && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 z-50">
                    <h3 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Hardware Sync</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-500">DEVICE IP / URL</label>
                        <input 
                          type="text" 
                          value={hardwareIp}
                          onChange={(e) => setHardwareIp(e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300 outline-none focus:border-cyan-500"
                        />
                      </div>
                      
                      {hwError && <div className="text-xs text-red-400">{hwError}</div>}

                      <button 
                        onClick={toggleHardwareConnection}
                        className={`w-full py-2 rounded text-xs font-bold uppercase ${hwConnected ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                      >
                        {hwConnected ? 'Disconnect' : 'Connect'}
                      </button>
                      
                      <div className="text-[10px] text-zinc-600 leading-tight">
                        <p>✓ Param Batching Active (50ms)</p>
                        <p>✓ Low-Latency Note Events</p>
                        <p>✓ Full Patch Sync on Load</p>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* AI Generator Section */}
            <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
              <input 
                type="text" 
                placeholder="Describe a sound..."
                className="bg-transparent border-none outline-none text-sm px-2 w-32 lg:w-48 text-zinc-300 placeholder-zinc-600"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGeneratePatch()}
              />
              <button 
                onClick={handleGeneratePatch}
                disabled={isGenerating}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"/>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
                GEN
              </button>
            </div>
          </div>
        </div>

        {/* Main Controls Area */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-zinc-900">
            
            {/* Left Col: Visuals & Input */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                <Oscilloscope />
                
                {/* Piano */}
                <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-800">
                   <PianoKeys onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
                   <div className="text-center mt-2 text-xs text-zinc-500 uppercase tracking-widest">Interactive Keyboard</div>
                </div>

                {/* Pedalboard / Effects Chain */}
                <div className="bg-zinc-950 rounded-lg p-6 border-t-4 border-zinc-800 relative shadow-inner">
                    <div className="absolute top-0 left-0 bg-zinc-800 px-3 py-1 text-[10px] font-bold text-zinc-400 rounded-br-lg">PEDALBOARD.IO</div>
                    <div className="flex justify-around items-end pt-4 gap-4">
                        
                        {/* Distortion Pedal */}
                        <div className="bg-orange-700/20 border border-orange-700/50 rounded p-3 flex flex-col items-center gap-2 w-28">
                            <span className="text-[10px] font-bold text-orange-500">DISTORTION</span>
                            <Knob label="Drive" value={patch.distortionAmount} min={0} max={100} onChange={(v) => handlePatchChange('distortionAmount', v)} size={40} color="#f97316" />
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_red] mt-1"></div>
                        </div>

                        {/* Arrow */}
                        <div className="text-zinc-700">→</div>

                        {/* Delay Pedal */}
                        <div className="bg-blue-700/20 border border-blue-700/50 rounded p-3 flex flex-col items-center gap-2 w-32">
                            <span className="text-[10px] font-bold text-blue-500">DIGITAL DELAY</span>
                            <div className="flex gap-1">
                                <Knob label="Time" value={patch.delayTime} min={0} max={1} onChange={(v) => handlePatchChange('delayTime', v)} size={32} color="#3b82f6" />
                                <Knob label="Fdbk" value={patch.delayFeedback} min={0} max={0.9} onChange={(v) => handlePatchChange('delayFeedback', v)} size={32} color="#3b82f6" />
                            </div>
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_blue] mt-1"></div>
                        </div>

                        {/* Arrow */}
                        <div className="text-zinc-700">→</div>

                        {/* Reverb Pedal */}
                        <div className="bg-purple-700/20 border border-purple-700/50 rounded p-3 flex flex-col items-center gap-2 w-28">
                            <span className="text-[10px] font-bold text-purple-500">REVERB</span>
                            <Knob label="Mix" value={patch.reverbMix} min={0} max={1} onChange={(v) => handlePatchChange('reverbMix', v)} size={40} color="#a855f7" />
                            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_purple] mt-1"></div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Right Col: Parameters Panel */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-4 content-start">
                
                {/* Oscillator Section */}
                <div className="col-span-2 bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/50">
                    <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">Oscillator</h3>
                    <div className="flex justify-around">
                        <div className="flex flex-col gap-2">
                            {['sine', 'square', 'sawtooth', 'triangle'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => handlePatchChange('oscType', type)}
                                    className={`text-[10px] uppercase font-bold py-1 px-3 rounded border ${patch.oscType === type ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <Knob 
                            label="Volume" 
                            value={patch.masterGain} 
                            min={0} max={1} 
                            onChange={(v) => handlePatchChange('masterGain', v)} 
                            color="#10b981" // emerald
                        />
                    </div>
                </div>

                {/* Filter Section */}
                <div className="col-span-2 bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/50">
                     <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">Filter</h3>
                     <div className="flex justify-around">
                        <Knob 
                            label="Cutoff" 
                            value={patch.filterCutoff} 
                            min={20} max={10000} 
                            onChange={(v) => handlePatchChange('filterCutoff', v)} 
                        />
                        <Knob 
                            label="Resonance" 
                            value={patch.filterResonance} 
                            min={0} max={20} 
                            onChange={(v) => handlePatchChange('filterResonance', v)} 
                        />
                     </div>
                </div>

                {/* Envelope Section */}
                <div className="col-span-2 bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/50">
                    <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">Envelope (ADSR)</h3>
                    <div className="grid grid-cols-4 gap-2">
                        <Knob label="A" value={patch.ampAttack} min={0} max={2} onChange={(v) => handlePatchChange('ampAttack', v)} size={48} color="#f472b6" />
                        <Knob label="D" value={patch.ampDecay} min={0} max={2} onChange={(v) => handlePatchChange('ampDecay', v)} size={48} color="#f472b6" />
                        <Knob label="S" value={patch.ampSustain} min={0} max={1} onChange={(v) => handlePatchChange('ampSustain', v)} size={48} color="#f472b6" />
                        <Knob label="R" value={patch.ampRelease} min={0} max={5} onChange={(v) => handlePatchChange('ampRelease', v)} size={48} color="#f472b6" />
                    </div>
                </div>

                {/* LFO Section */}
                <div className="col-span-2 bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/50">
                    <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">LFO Modulation</h3>
                    <div className="flex gap-4 mb-3">
                         <div className="flex-1 flex flex-col gap-1">
                             <label className="text-[10px] text-zinc-500 uppercase">Target</label>
                             <select 
                                value={patch.lfoTarget}
                                onChange={(e) => handlePatchChange('lfoTarget', e.target.value)}
                                className="bg-zinc-950 border border-zinc-700 rounded text-[10px] text-zinc-300 p-1 outline-none focus:border-cyan-500"
                             >
                                 <option value="none">None</option>
                                 <option value="cutoff">Filter Cutoff</option>
                                 <option value="pitch">Osc Pitch</option>
                                 <option value="amp">Amplitude</option>
                             </select>
                         </div>
                         <div className="flex-1 flex flex-col gap-1">
                             <label className="text-[10px] text-zinc-500 uppercase">Shape</label>
                             <select 
                                value={patch.lfoWaveform}
                                onChange={(e) => handlePatchChange('lfoWaveform', e.target.value)}
                                className="bg-zinc-950 border border-zinc-700 rounded text-[10px] text-zinc-300 p-1 outline-none focus:border-cyan-500"
                             >
                                 <option value="sine">Sine</option>
                                 <option value="triangle">Triangle</option>
                                 <option value="square">Square</option>
                                 <option value="sawtooth">Saw</option>
                             </select>
                         </div>
                    </div>
                    <div className="flex justify-around">
                        <Knob label="Rate" value={patch.lfoRate} min={0.1} max={20} onChange={(v) => handlePatchChange('lfoRate', v)} size={48} color="#eab308" />
                        <Knob label="Depth" value={patch.lfoDepth} min={0} max={1} onChange={(v) => handlePatchChange('lfoDepth', v)} size={48} color="#eab308" />
                    </div>
                </div>

            </div>
        </div>

        {/* Footer Status Bar */}
        <div className="bg-zinc-950 border-t border-zinc-800 p-2 px-4 flex justify-between items-center text-[10px] text-zinc-500 font-mono">
           <div>AUDIO ENGINE: {isPlaying ? <span className="text-green-500">ACTIVE</span> : <span className="text-red-500">SUSPENDED (Press Key)</span>}</div>
           <div className="flex gap-4">
             <span>Sample Rate: 44.1kHz</span>
             <span>Link: {hwConnected ? <span className="text-cyan-500 animate-pulse">SYNCED</span> : 'OFFLINE'}</span>
           </div>
        </div>

      </div>
    </div>
  );
}
