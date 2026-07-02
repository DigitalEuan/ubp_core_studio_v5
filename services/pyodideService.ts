// @ts-ignore
import PyodideWorker from './pyodideWorker?worker';
import { ExecutionResult } from '../types';

class PyodideService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private initialized = false;
  private stdoutListeners = new Set<(msg: string) => void>();
  private stderrListeners = new Set<(msg: string) => void>();
  private sceneListeners = new Set<(data: any) => void>();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create the Web Worker using Vite's native classic worker loader
    this.worker = new (PyodideWorker as any)();

    this.worker.onmessage = (e: MessageEvent) => {
      const { id, status, result, error, type, data } = e.data;

      // Handle unprompted streams (stdout logs, 3D scene updates, etc.)
      if (type) {
        if (type === 'stdout_stream') {
          this.stdoutListeners.forEach(listener => listener(data));
        } else if (type === 'stderr_stream') {
          this.stderrListeners.forEach(listener => listener(data));
        } else if (type === 'scene_3d') {
          let parsedData = data;
          if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (err) {}
          }
          this.sceneListeners.forEach(listener => listener(parsedData));
          
          // Trigger the global window callback for backward compatibility
          if (typeof window !== 'undefined' && (window as any).updateScene3D) {
            try {
              (window as any).updateScene3D(typeof data === 'string' ? data : JSON.stringify(data));
            } catch (err) {}
          }
        }
        return;
      }

      // Handle standard request/response promise resolutions
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (status === 'success') {
          pending.resolve(result);
        } else {
          pending.reject(new Error(error || 'Unknown error in Pyodide Web Worker'));
        }
      }
    };

    // Trigger initialization on the worker thread
    await this.sendRequest('init', {});
    this.initialized = true;
    console.log("Pyodide Web Worker Service initialized successfully.");
  }

  private sendRequest(action: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker not initialized"));
        return;
      }
      const id = Math.random().toString(36).substring(2, 9);
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ id, action, payload });
    });
  }

  reset(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initialized = false;
    this.pendingRequests.clear();
  }

  get isReady(): boolean {
    return this.initialized;
  }

  async writeFile(filename: string, content: string): Promise<void> {
    await this.sendRequest('writeFile', { filename, content });
  }

  async writeBinaryFile(filename: string, data: Uint8Array): Promise<void> {
    await this.sendRequest('writeBinaryFile', { filename, data });
  }

  async readFile(filename: string): Promise<string> {
    return await this.sendRequest('readFile', { filename });
  }

  async readBinaryFile(filename: string): Promise<Uint8Array | null> {
    return await this.sendRequest('readBinaryFile', { filename });
  }

  async renameFile(oldName: string, newName: string): Promise<void> {
    await this.sendRequest('renameFile', { oldName, newName });
  }

  async deleteFile(filename: string): Promise<void> {
    await this.sendRequest('deleteFile', { filename });
  }

  async listFiles(): Promise<string[]> {
    return await this.sendRequest('listFiles', {});
  }

  async runPython(code: string): Promise<ExecutionResult> {
    return await this.sendRequest('runPython', { code });
  }

  // Stream subscription APIs
  onStdout(callback: (msg: string) => void) {
    this.stdoutListeners.add(callback);
    return () => this.stdoutListeners.delete(callback);
  }

  onStderr(callback: (msg: string) => void) {
    this.stderrListeners.add(callback);
    return () => this.stderrListeners.delete(callback);
  }

  onScene3D(callback: (data: any) => void) {
    this.sceneListeners.add(callback);
    return () => this.sceneListeners.delete(callback);
  }
}

export const pyodideService = new PyodideService();
