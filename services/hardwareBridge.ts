import { SynthPatch } from "../types";

export type HardwareMessage = 
  | { type: 'noteOn'; note: number; velocity: number }
  | { type: 'noteOff'; note: number }
  | { type: 'param'; key: string; value: number | string };

class HardwareBridge {
  private ws: WebSocket | null = null;
  public isConnected: boolean = false;
  private onDisconnectCallback: (() => void) | null = null;
  
  // Batching / Throttling
  private paramQueue: Map<string, number | string> = new Map();
  private flushTimer: number | null = null;
  private readonly FLUSH_INTERVAL = 50; // ms (max 20 updates per second)

  connect(ip: string, onConnect: () => void, onDisconnect: () => void, onError: (err: any) => void) {
    if (this.ws) {
      this.disconnect();
    }

    // Ensure ws:// protocol
    const url = ip.startsWith('ws://') || ip.startsWith('wss://') ? ip : `ws://${ip}`;

    try {
      this.ws = new WebSocket(url);
      this.onDisconnectCallback = onDisconnect;

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log("Hardware Connected");
        onConnect();
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log("Hardware Disconnected");
        if (this.onDisconnectCallback) this.onDisconnectCallback();
      };

      this.ws.onerror = (error) => {
        console.error("Hardware WebSocket Error:", error);
        onError(error);
      };

    } catch (e) {
      onError(e);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.paramQueue.clear();
  }

  // Immediate Send for timing-critical events (Notes)
  sendNote(type: 'noteOn' | 'noteOff', note: number, velocity: number = 127) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, note, velocity }));
    }
  }

  // Throttled Send for parameters (Knobs)
  sendParam(key: string, value: number | string) {
    if (!this.isConnected) return;

    this.paramQueue.set(key, value);

    if (this.flushTimer === null) {
      this.flushTimer = window.setTimeout(() => this.flushParams(), this.FLUSH_INTERVAL);
    }
  }

  // Sync entire patch at once (e.g. on load preset)
  syncFullPatch(patch: SynthPatch) {
    if (!this.isConnected) return;
    
    // Clear pending individual updates to avoid race conditions
    this.paramQueue.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Send all keys immediately
    Object.entries(patch).forEach(([key, value]) => {
       this.sendParam(key, value);
    });
    
    // Force flush immediately
    this.flushParams();
  }

  private flushParams() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.paramQueue.size > 0) {
      this.paramQueue.forEach((value, key) => {
        this.ws!.send(JSON.stringify({ type: 'param', key, value }));
      });
      this.paramQueue.clear();
    }
    this.flushTimer = null;
  }
}

export const hardwareBridge = new HardwareBridge();