// Web Worker for Pyodide Execution Environment
// Runs in the background to prevent main thread (browser UI) freezing

declare function importScripts(...urls: string[]): void;

const WORKSPACE = '/home/pyodide';
let pyodide: any = null;

// Handle messages from the main thread
self.onmessage = async (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  try {
    switch (action) {
      case 'init': {
        if (!pyodide) {
          // Dynamically load the Pyodide ES Module inside the module worker
          // @ts-ignore
          const { loadPyodide } = await import("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs");
          
          // Initialize Pyodide with explicit indexURL
          pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
          });
          
          // Load required packages
          await pyodide.loadPackage(["numpy", "pandas", "scipy", "matplotlib", "micropip", "sympy"]);
          
          // Ensure Workspace Directories
          try { pyodide.FS.mkdir(WORKSPACE); } catch (e) { /* ignore */ }
          try { pyodide.FS.mkdir(`${WORKSPACE}/output`); } catch (e) { /* ignore */ }
          
          // Configure sys.path and cwd
          await pyodide.runPythonAsync(`
            import sys
            import os
            workspace = "${WORKSPACE}"
            if not os.path.exists(workspace):
                os.makedirs(workspace)
            os.chdir(workspace)
            if workspace not in sys.path:
                sys.path.insert(0, workspace)
          `);

          // Create Standalone Visualization Module
          pyodide.FS.writeFile(`${WORKSPACE}/ubp_viz.py`, `
import json
import os

def save_scene_3d(data):
    """
    Saves 3D scene data to scene_3d.json and streams it to the frontend.
    """
    try:
        with open("scene_3d.json", "w") as f:
            json.dump(data, f)
            
        # Send live update to React frontend via Web Worker postMessage
        import js
        if hasattr(js, 'postMessage'):
            js.postMessage(json.dumps({"type": "scene_3d", "data": data}))
            
        print("[UBP VIZ] 3D Scene data exported to visual engine.")
    except Exception as e:
        print(f"[UBP VIZ ERROR] Failed to save scene: {e}")
`);

          // Create FastAPI and Websockets mock modules
          pyodide.FS.writeFile(`${WORKSPACE}/fastapi.py`, `
class WebSocket:
    async def accept(self): pass
    async def send_text(self, data):
        import js
        if hasattr(js, 'postMessage'):
            js.postMessage(json.dumps({"type": "scene_3d", "data": json.loads(data)}))
    async def receive_text(self):
        import asyncio
        await asyncio.sleep(100000)
        return "{}"

class FastAPI:
    def __init__(self, *args, **kwargs): pass
    def get(self, *args, **kwargs): return lambda f: f
    def post(self, *args, **kwargs): return lambda f: f
    def websocket(self, *args, **kwargs): return lambda f: f
`);

          pyodide.FS.writeFile(`${WORKSPACE}/ubp_browser_engine.py`, `
import asyncio
import json
import js

try:
    from ubp_space_v3 import Space
    space = Space()
    HAS_ENGINE = True
except ImportError:
    print("[UBP BROWSER ENGINE] ubp_space_v3.py not found. Running dummy simulation.")
    HAS_ENGINE = False

async def game_loop():
    if globals().get('_ubp_loop_running'):
        print("[UBP BROWSER ENGINE] Loop already running. Stopping previous loop.")
        globals()['_ubp_loop_running'] = False
        await asyncio.sleep(0.1)
        
    globals()['_ubp_loop_running'] = True
    print("[UBP BROWSER ENGINE] Starting live simulation loop...")
    tick = 0
    while globals().get('_ubp_loop_running'):
        if HAS_ENGINE:
            space.tick()
            scene_data = space.to_dict()
        else:
            import math
            scene_data = {
                "spheres": [
                    {"id": "1", "x": math.cos(tick*0.1)*5, "y": 0, "z": math.sin(tick*0.1)*5, "r": 1, "color": "#E31E24", "label": "Dummy Entity"}
                ],
                "points": [],
                "lines": []
            }
            
        if hasattr(js, 'postMessage'):
            js.postMessage(json.dumps({"type": "scene_3d", "data": scene_data}))
            
        tick += 1
        await asyncio.sleep(1/30)
    print("[UBP BROWSER ENGINE] Loop stopped.")

asyncio.ensure_future(game_loop())
print("[UBP BROWSER ENGINE] Loop scheduled.")
`);

          pyodide.FS.writeFile(`${WORKSPACE}/uvicorn.py`, `
def run(app, *args, **kwargs):
    print("[UBP BROWSER ENGINE] Intercepted uvicorn.run().")
`);

          pyodide.FS.writeFile(`${WORKSPACE}/websockets.py`, `
import json
class WebSocketServerProtocol:
    async def send(self, data):
        import js
        if hasattr(js, 'postMessage'):
            js.postMessage(json.dumps({"type": "scene_3d", "data": json.loads(data)}))
    async def recv(self):
        import asyncio
        await asyncio.sleep(100000)
        return "{}"

async def serve(*args, **kwargs):
    print("[UBP BROWSER ENGINE] Intercepted websockets.serve().")
    import asyncio
    class DummyServer:
        async def wait_closed(self):
            await asyncio.sleep(100000)
    return DummyServer()
`);

        }
        self.postMessage({ id, status: 'success' });
        break;
      }

      case 'writeFile': {
        const { filename, content } = payload;
        const resolvedPath = resolvePath(filename);
        ensureParentDirectories(resolvedPath);
        pyodide.FS.writeFile(resolvedPath, content);
        self.postMessage({ id, status: 'success' });
        break;
      }

      case 'writeBinaryFile': {
        const { filename, data } = payload;
        const resolvedPath = resolvePath(filename);
        ensureParentDirectories(resolvedPath);
        pyodide.FS.writeFile(resolvedPath, data);
        self.postMessage({ id, status: 'success' });
        break;
      }

      case 'readFile': {
        const { filename } = payload;
        const resolvedPath = resolvePath(filename);
        if (pyodide.FS.analyzePath(resolvedPath).exists) {
          const content = pyodide.FS.readFile(resolvedPath, { encoding: 'utf8' });
          self.postMessage({ id, status: 'success', result: content });
        } else {
          self.postMessage({ id, status: 'success', result: '' });
        }
        break;
      }

      case 'readBinaryFile': {
        const { filename } = payload;
        const resolvedPath = resolvePath(filename);
        if (pyodide.FS.analyzePath(resolvedPath).exists) {
          const data = pyodide.FS.readFile(resolvedPath);
          (self as any).postMessage({ id, status: 'success', result: data }, [data.buffer]);
        } else {
          self.postMessage({ id, status: 'success', result: null });
        }
        break;
      }

      case 'renameFile': {
        const { oldName, newName } = payload;
        const oldPath = resolvePath(oldName);
        const newPath = resolvePath(newName);
        pyodide.FS.rename(oldPath, newPath);
        self.postMessage({ id, status: 'success' });
        break;
      }

      case 'deleteFile': {
        const { filename } = payload;
        const resolvedPath = resolvePath(filename);
        const analyze = pyodide.FS.analyzePath(resolvedPath);
        if (analyze.exists) {
          const stat = pyodide.FS.stat(resolvedPath);
          if (pyodide.FS.isDir(stat.mode)) {
            pyodide.FS.rmdir(resolvedPath);
          } else {
            pyodide.FS.unlink(resolvedPath);
          }
        }
        self.postMessage({ id, status: 'success' });
        break;
      }

      case 'listFiles': {
        let rootFiles: string[] = [];
        try {
          rootFiles = pyodide.FS.readdir(WORKSPACE);
        } catch (e) {
          self.postMessage({ id, status: 'success', result: [] });
          return;
        }

        const filteredRoot = rootFiles.filter((f: string) => 
          f !== '.' && f !== '..' && f !== 'output' && f !== 'tmp' && f !== 'ubp_viz.py' && f !== 'fastapi.py' && f !== 'uvicorn.py' && f !== 'websockets.py'
        );
        
        let outputFiles: string[] = [];
        try {
          const out = pyodide.FS.readdir(`${WORKSPACE}/output`);
          outputFiles = out
            .filter((f: string) => f !== '.' && f !== '..')
            .map((f: string) => `output/${f}`);
        } catch (e) { }

        self.postMessage({ id, status: 'success', result: [...filteredRoot, ...outputFiles] });
        break;
      }

      case 'runPython': {
        const { code } = payload;
        const outputBuffer: string[] = [];

        pyodide.setStdout({
          batched: (msg: string) => {
            outputBuffer.push(msg);
            self.postMessage({ type: 'stdout_stream', data: msg });
          }
        });

        pyodide.setStderr({
          batched: (msg: string) => {
            outputBuffer.push(`ERR: ${msg}`);
            self.postMessage({ type: 'stderr_stream', data: msg });
          }
        });

        // Environment Safety check before every run
        try {
          await pyodide.runPythonAsync(`
            import os
            import sys
            if os.getcwd() != "${WORKSPACE}":
                os.chdir("${WORKSPACE}")
            if "${WORKSPACE}" not in sys.path:
                sys.path.insert(0, "${WORKSPACE}")
          `);
        } catch (e) { }

        const plotPath = `${WORKSPACE}/plot.png`;
        const scenePath = `${WORKSPACE}/scene_3d.json`;

        try {
          if (pyodide.FS.analyzePath(plotPath).exists) pyodide.FS.unlink(plotPath);
          if (pyodide.FS.analyzePath(scenePath).exists) pyodide.FS.unlink(scenePath);
        } catch (e) { }

        try {
          await pyodide.runPythonAsync(code);

          let image: string | undefined = undefined;
          let scene3d: any = undefined;

          if (pyodide.FS.analyzePath(plotPath).exists) {
            const imageBuffer = pyodide.FS.readFile(plotPath);
            const binary = String.fromCharCode.apply(null, Array.from(imageBuffer));
            image = btoa(binary);
          }

          if (pyodide.FS.analyzePath(scenePath).exists) {
            const sceneContent = pyodide.FS.readFile(scenePath, { encoding: 'utf8' });
            try {
              scene3d = JSON.parse(sceneContent);
            } catch (e) {
              outputBuffer.push("ERR: Failed to parse scene_3d.json");
            }
          }

          self.postMessage({
            id,
            status: 'success',
            result: {
              stdout: outputBuffer.join('\n'),
              stderr: '',
              image,
              scene3d
            }
          });
        } catch (err: any) {
          self.postMessage({
            id,
            status: 'success',
            result: {
              stdout: outputBuffer.join('\n'),
              stderr: err.toString(),
              error: err.toString()
            }
          });
        }
        break;
      }
    }
  } catch (err: any) {
    self.postMessage({ id, status: 'error', error: err.toString() });
  }
};

function resolvePath(filename: string): string {
  if (filename.startsWith('/')) return filename;
  return `${WORKSPACE}/${filename}`;
}

function ensureParentDirectories(filePath: string): void {
  if (!pyodide) return;
  const parts = filePath.split('/');
  let currentPath = '';
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === '') {
      currentPath += '/';
      continue;
    }
    currentPath += (currentPath.endsWith('/') ? '' : '/') + parts[i];
    try {
      const analyze = pyodide.FS.analyzePath(currentPath);
      if (!analyze.exists) {
        pyodide.FS.mkdir(currentPath);
      }
    } catch (e) { }
  }
}
