
import { GoogleGenAI, Type } from "@google/genai";
import { SynthPatch } from "../types";

const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export const generatePatchFromDescription = async (description: string): Promise<Partial<SynthPatch>> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a synthesizer patch based on this description: "${description}".
      
      Include parameters for Oscillator, Filter, Envelope, LFO (Modulation), and Effects (Pedalboard).
      
      Constraints:
      - oscType: "sine", "square", "sawtooth", "triangle"
      - filterCutoff: 20-20000
      - filterResonance: 0-20
      - ampAttack, ampDecay, ampRelease: 0-5
      - ampSustain: 0-1
      - lfoWaveform: "sine", "square", "sawtooth", "triangle"
      - lfoRate: 0.1-20
      - lfoDepth: 0-1
      - lfoTarget: "none", "cutoff", "pitch", "amp"
      - distortionAmount: 0-100
      - delayTime: 0-1
      - delayFeedback: 0-0.9
      - reverbMix: 0-1
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            oscType: { type: Type.STRING, enum: ["sine", "square", "sawtooth", "triangle"] },
            filterCutoff: { type: Type.NUMBER },
            filterResonance: { type: Type.NUMBER },
            ampAttack: { type: Type.NUMBER },
            ampDecay: { type: Type.NUMBER },
            ampSustain: { type: Type.NUMBER },
            ampRelease: { type: Type.NUMBER },
            
            lfoWaveform: { type: Type.STRING, enum: ["sine", "square", "sawtooth", "triangle"] },
            lfoRate: { type: Type.NUMBER },
            lfoDepth: { type: Type.NUMBER },
            lfoTarget: { type: Type.STRING, enum: ["none", "cutoff", "pitch", "amp"] },

            distortionAmount: { type: Type.NUMBER },
            delayTime: { type: Type.NUMBER },
            delayFeedback: { type: Type.NUMBER },
            reverbMix: { type: Type.NUMBER },
          },
          required: ["oscType", "filterCutoff", "filterResonance", "ampAttack", "ampDecay", "ampSustain", "ampRelease"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const data = JSON.parse(text);
    return data as Partial<SynthPatch>;

  } catch (error) {
    console.error("Error generating patch:", error);
    throw error;
  }
};
