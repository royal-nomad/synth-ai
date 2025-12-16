import React from 'react';

interface PianoKeysProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
}

export const PianoKeys: React.FC<PianoKeysProps> = ({ onNoteOn, onNoteOff }) => {
  const notes = [
    { note: 'C', type: 'white', midi: 60 },
    { note: 'C#', type: 'black', midi: 61 },
    { note: 'D', type: 'white', midi: 62 },
    { note: 'D#', type: 'black', midi: 63 },
    { note: 'E', type: 'white', midi: 64 },
    { note: 'F', type: 'white', midi: 65 },
    { note: 'F#', type: 'black', midi: 66 },
    { note: 'G', type: 'white', midi: 67 },
    { note: 'G#', type: 'black', midi: 68 },
    { note: 'A', type: 'white', midi: 69 },
    { note: 'A#', type: 'black', midi: 70 },
    { note: 'B', type: 'white', midi: 71 },
    { note: 'C', type: 'white', midi: 72 },
  ];

  return (
    <div className="flex relative h-32 justify-center select-none">
      {notes.map((n, i) => {
        if (n.type === 'white') {
          return (
            <div
              key={n.midi}
              onMouseDown={() => onNoteOn(n.midi)}
              onMouseUp={() => onNoteOff(n.midi)}
              onMouseLeave={() => onNoteOff(n.midi)}
              className="w-12 h-full bg-zinc-200 border border-zinc-400 rounded-b-md active:bg-zinc-300 active:h-[98%] transition-all cursor-pointer z-0 relative shadow-sm hover:bg-white"
            />
          );
        } else {
            // Black keys are absolutely positioned or interleaved. 
            // For simplicity in this flex layout, we use negative margins.
            return null; 
        }
      })}
      
      {/* Overlay Black Keys */}
      <div className="absolute top-0 left-0 w-full h-20 flex pointer-events-none justify-center">
         <div className="flex w-[calc(12*3rem)] relative"> 
             {/* Simple manual positioning for the demo octave */}
             <BlackKey midi={61} left="8%" onNoteOn={onNoteOn} onNoteOff={onNoteOff}/>
             <BlackKey midi={63} left="19%" onNoteOn={onNoteOn} onNoteOff={onNoteOff}/>
             <BlackKey midi={66} left="41%" onNoteOn={onNoteOn} onNoteOff={onNoteOff}/>
             <BlackKey midi={68} left="52%" onNoteOn={onNoteOn} onNoteOff={onNoteOff}/>
             <BlackKey midi={70} left="63%" onNoteOn={onNoteOn} onNoteOff={onNoteOff}/>
         </div>
      </div>
    </div>
  );
};

const BlackKey = ({ midi, left, onNoteOn, onNoteOff }: { midi: number, left: string, onNoteOn: any, onNoteOff: any }) => (
    <div
      style={{ left }}
      onMouseDown={(e) => { e.stopPropagation(); onNoteOn(midi); }}
      onMouseUp={(e) => { e.stopPropagation(); onNoteOff(midi); }}
      onMouseLeave={(e) => { e.stopPropagation(); onNoteOff(midi); }}
      className="absolute top-0 w-8 h-20 bg-zinc-900 border-b-4 border-zinc-950 rounded-b-sm active:border-b-0 active:h-[78px] transition-all cursor-pointer z-10 pointer-events-auto shadow-md"
    />
);
