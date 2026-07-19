
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { pyodideService } from './services/pyodideService';
import { GeminiService } from './services/geminiService';
import { LocalLLMService, createLocalLLMService } from './services/localLlmService';
import { 
    INITIAL_SYSTEM_KB,
    INITIAL_STUDY_KB,
    INITIAL_HASH_MEMORY_KB,
    INITIAL_BELIEFS_KB
} from './constants';
import { ChatMessage, FileTab, Scene3DData, RightPanelTab, AttachedDoc, MobileTab, Frame, ConsoleEntry } from './types';
import { CodeEditor } from './components/CodeEditor';
import { ConsoleOutput } from './components/ConsoleOutput';
import { ChatInterface } from './components/ChatInterface';
import { ThreeViewer } from './components/ThreeViewer';
import { MemoryStatus } from './components/MemoryStatus';
import { FOMStatus } from './components/FOMStatus';
import { AIProviderSelector } from './components/AIProviderSelector';
import { GLMChatInterface } from './components/GLMChatInterface';
import { GLMConstellation } from './components/GLMConstellation';
import { marked } from 'marked';
import { setIndexedDB, getIndexedDB, clearIndexedDB } from './lib/storage';

const UBPLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" className="drop-shadow-md">
    <defs>
      <clipPath id="hexClip">
        <polygon points="50,5 93.3,30 93.3,70 50,95 6.7,70 6.7,30" />
      </clipPath>
    </defs>
    <g clipPath="url(#hexClip)">
      <polygon points="50,50 6.7,30 50,5" fill="#E31E24" />
      <polygon points="50,50 50,5 93.3,30" fill="#F7941D" />
      <polygon points="50,50 93.3,30 93.3,70" fill="#FFF200" />
      <polygon points="50,50 93.3,70 50,95" fill="#39B54A" />
      <polygon points="50,50 50,95 6.7,70" fill="#00AEEF" />
      <polygon points="50,50 6.7,70 6.7,30" fill="#662D91" />
    </g>
    <polygon points="50,5 93.3,30 93.3,70 50,95 6.7,70 6.7,30" fill="none" stroke="black" strokeWidth="7" strokeLinejoin="round" />
  </svg>
);

export const App: React.FC = () => {
  const [isPyodideReady, setIsPyodideReady] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'chat' | 'workspace' | 'tools'>('chat');

  // AI Provider Selection
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'lm-studio' | 'gpt4all' | 'glm'>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-pro-preview');
  const [localLLMService, setLocalLLMService] = useState<LocalLLMService | null>(null);
  const [localLLMStatus, setLocalLLMStatus] = useState<'available' | 'unavailable' | 'checking'>('checking');
  
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [files, setFiles] = useState<FileTab[]>([]);
  
  // Inline File Management State
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [fileToDelete, setFileToDelete] = useState<string | null>(null); // Track which file is pending deletion
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isResettingRef = useRef<boolean>(false);
  
  const [systemKb, setSystemKb] = useState("[]"); // Default empty JSON array
  const [langKb, setLangKb] = useState("[]");
  const [studyKb, setStudyKb] = useState(INITIAL_STUDY_KB);
  const [hashMemoryKb, setHashMemoryKb] = useState(INITIAL_HASH_MEMORY_KB);
  const [beliefsKb, setBeliefsKb] = useState(INITIAL_BELIEFS_KB);
  const [initialFomIndex, setInitialFomIndex] = useState<string | null>(null); // State for fetched FOM Index
  const [instructionManual, setInstructionManual] = useState("");
  
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [scene3dData, setScene3dData] = useState<Scene3DData | null>(null);
  
  const [activeOutputTab, setActiveOutputTab] = useState<'console' | 'visual' | 'memory' | 'fom'>('console');
  const [midColumnMode, setMidColumnMode] = useState<'files' | 'editor' | 'system' | 'study' | 'hash' | 'beliefs'>('files');

  // GPU Proxy Reference Store
  const gpuVectorStoreRef = useRef<{ id: string, vector: number[] }[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Welcome to UBP Core Studio v5.0. I am ready to assist with your studies.',
      timestamp: Date.now()
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // FOM State
  const [fomFrames, setFomFrames] = useState<Frame[]>([]);
  const [activeFrame, setActiveFrame] = useState<string>('');
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const loadStudyRef = useRef<HTMLInputElement>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // GLM (Geometric Language Machine) Workspace State
  const [currentStudioMode, setCurrentStudioMode] = useState<'ubp' | 'glm'>('ubp');
  const [glmFiles, setGLMFiles] = useState<FileTab[]>([]);
  const [activeGLMTabId, setActiveGLMTabId] = useState<string>('');
  const [glmMidColumnMode, setGLMMidColumnMode] = useState<'files' | 'editor'>('files');
  const [glmChatMessages, setGLMChatMessages] = useState<ChatMessage[]>([
    {
      id: 'glm-welcome',
      role: 'model',
      content: 'Welcome to the GLM Workspace. I am ready to interact with the Geometric Language Machine (v3.7.3 Grown Build).',
      timestamp: Date.now()
    }
  ]);
  const [isGLMChatLoading, setIsGLMChatLoading] = useState(false);
  const [glmConsoleLogs, setGLMConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [activeGLMOutputTab, setActiveGLMOutputTab] = useState<'console' | 'diagnostics' | 'visual'>('console');
  const [isGLMExecuting, setIsGLMExecuting] = useState(false);
  const [glmEffortTicks, setGLMEffortTicks] = useState<number>(3);
  const [glmChatMode, setGLMChatMode] = useState<'standard' | 'effort'>('standard');
  const [glmStatus, setGLMStatus] = useState<'offline' | 'booting' | 'online'>('offline');
  const [glmLastDiag, setGLMLastDiag] = useState<string>('');
  const [glmIdeaState, setGLMIdeaState] = useState<string>('');

  // Inline GLM File Management State
  const [isGLMCreatingFile, setIsGLMCreatingFile] = useState(false);
  const [newGLMFileName, setNewGLMFileName] = useState('');
  const [renamingGLMFile, setRenamingGLMFile] = useState<string | null>(null);
  const [renameGLMValue, setRenameGLMValue] = useState('');
  const [glmFileToDelete, setGLMFileToDelete] = useState<string | null>(null);

  const glmNewFileInputRef = useRef<HTMLInputElement>(null);
  const glmRenameInputRef = useRef<HTMLInputElement>(null);
  const glmUploadFileRef = useRef<HTMLInputElement>(null);

  const addGLMConsoleLog = (type: 'system' | 'stdout' | 'stderr' | 'error', content: string) => {
      setGLMConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type,
          content,
          timestamp: Date.now()
      }]);
  };

  const addConsoleLog = (type: 'system' | 'stdout' | 'stderr' | 'error', content: string) => {
      setConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type,
          content,
          timestamp: Date.now()
      }]);
  };

  const fetchGLMFolderRecursive = async (path: string): Promise<FileTab[]> => {
    try {
      const repoApiUrl = `https://api.github.com/repos/DigitalEuan/UBP_Repo/contents/${path}`;
      const res = await fetch(repoApiUrl);
      if (!res.ok) return [];
      const items = await res.json();
      
      let folderFiles: FileTab[] = [];
      const promises = items.map(async (item: any) => {
        // Filter out old glm_ prefixed scripts, but not the .json resource databases
        if (item.name.toLowerCase().startsWith('glm_') && !item.name.toLowerCase().endsWith('.json')) {
          return null;
        }
        if (item.type === 'file') {
          if (item.name.endsWith('.py') || item.name.endsWith('.json') || item.name.endsWith('.md')) {
            try {
              const fileRes = await fetch(item.download_url);
              if (fileRes.ok) {
                const relativePath = item.path.substring('core_studio_v4.0/GLM/'.length);
                let content = await fileRes.text();
                
                // Hot-patch the GitHub code to fix bugs
                if (relativePath === 'GLM11_runtime.py') {
                    // Fix idea_state format
                    content = content.replace(
                        'return {"turn": self._turn, "zones": len(self.manager.zones), "meta": self.meta_graph.stats()}',
                        'return {"turn": self._turn, "manager": self.manager.state(), "meta": self.meta_graph.stats()}'
                    );
                    
                    // Add reflexive_recall
                    if (!content.includes('def _reflexive_recall')) {
                        content = content.replace(
                            '    def chat(self, query: str) -> str:',
                            `    def _reflexive_recall(self, query: str):
        from GLM00_config import KB_SYSTEM_PATH
        from GLM01_substrate import _load_kb_safe
        
        system_kb = _load_kb_safe(KB_SYSTEM_PATH)
        aliases = {}
        for uid, entry in system_kb.items():
            aliases[uid.lower()] = uid
            aliases[entry.get("name", "").lower()] = uid
            for m in entry.get("aliases", []):
                 aliases[m.lower()] = uid
                 
        tokens = query.lower().replace("?","").replace(".","").split()
        recalled = []
        for t in tokens:
            if t in aliases:
                uid = aliases[t]
                if uid in system_kb:
                    recalled.append((t, uid, system_kb[uid].get('tags', [])))
        return recalled

    def chat(self, query: str) -> str:`
                        );
                    }
                    
                    // Pass recalled to compose_response
                    if (!content.includes('recalled=recalled')) {
                        content = content.replace(
                            '        return compose_response(',
                            '        recalled = self._reflexive_recall(query)\n        return compose_response('
                        ).replace(
                            '_enhanced_query_type(query), comp_res, sym_res, deliberation=delib_res',
                            '_enhanced_query_type(query), comp_res, sym_res, deliberation=delib_res, recalled=recalled'
                        );
                    }
                    
                    if (!content.includes('def chat_with_effort')) {
                        content = content.replace(
                            '    def reset_idea(self):',
                            `    def chat_with_effort(self, query: str, max_ticks: int = 5) -> str:
        res = self.chat(query)
        z = self.manager.active
        if not z or getattr(z, 'crystallized', False): return res
        for _ in range(max_ticks):
            if getattr(z, 'crystallized', False): break
            self.mature(1)
        return res + f"\\n[Effort Applied] Thesis: {getattr(self.manager.active, 'thesis', '')}"

    def reset_idea(self):`
                        );
                    }
                } else if (relativePath === 'GLM07_idea_manager.py') {
                    // Fix state() format for the tests
                    content = content.replace(
                        '"zones": [z.idea_state() if hasattr(z, \'idea_state\') else str(z) for z in self.zones]',
                        '"zones": [{"crystallized": getattr(z, "crystallized", False), "thesis": getattr(z, "thesis", ""), "contradictions": getattr(z, "contradictions", []), "inferred_nouns": getattr(z, "inferred_nouns", [])} for z in self.zones]'
                    );
                    content = content.replace(
                        'return {"num_zones": len(self.zones), "active_idx": self.active_idx}',
                        'return {"num_zones": len(self.zones), "active_idx": self.active_idx, "zones": [{"crystallized": getattr(z, "crystallized", False), "thesis": getattr(z, "thesis", ""), "contradictions": getattr(z, "contradictions", []), "inferred_nouns": getattr(z, "inferred_nouns", [])} for z in self.zones]}'
                    );
                } else if (relativePath === 'GLM10_response_composer.py') {
                    // Accept recalled argument
                    if (!content.includes('recalled: Optional[List')) {
                        content = content.replace(
                            'deliberation: Optional[Dict] = None # <--- ADDED',
                            'deliberation: Optional[Dict] = None, recalled: Optional[List] = None'
                        );
                    }
                    
                    if (!content.includes('if recalled:')) {
                        content = content.replace(
                            '    return "  ".join(parts)',
                            '    if recalled:\n        parts.append(f"[Recall] {recalled}")\n    return "  ".join(parts)'
                        );
                    }

                    // v3.25.0: Add generated parameter (GLM35 ParagraphComposer output)
                    if (!content.includes('generated: Optional[')) {
                        content = content.replace(
                            'verified: Optional[str] = None,\n) -> str:',
                            'verified: Optional[str] = None,\n    # v3.25.0: GLM35 ParagraphComposer generated paragraph\n    generated: Optional[str] = None,\n) -> str:'
                        );
                        if (!content.includes('[Generated]')) {
                            content = content.replace(
                                '    # K. Fallback',
                                '    # K. v3.25.0: GLM35 ParagraphComposer generated paragraph\n    if generated:\n        parts.append(f"[Generated] {generated}")\n\n    # L. Fallback'
                            );
                        }
                    }
                }

                return {
                  name: relativePath,
                  content: content,
                  type: relativePath.endsWith('.py') ? 'script' : 'data'
                } as FileTab;
              }
            } catch (e) {
              console.warn(`Failed to fetch file ${item.path}`, e);
            }
          }
        } else if (item.type === 'dir') {
          const folderName = item.name.toLowerCase();
          if (folderName === 'dev' || folderName === 'doc' || folderName === 'tests') {
            return null;
          }
          const subFiles = await fetchGLMFolderRecursive(item.path);
          folderFiles = [...folderFiles, ...subFiles];
        }
        return null;
      });
      
      const resolved = (await Promise.all(promises)).filter((f): f is FileTab => f !== null);
      return [...folderFiles, ...resolved];
    } catch (err) {
      console.error(`Error fetching GLM folder recursive from ${path}:`, err);
      return [];
    }
  };

  const refreshFileList = useCallback(async () => {
    if (!pyodideService.isReady) return;
    try {
        const fsFiles = await pyodideService.listFiles();
        
        // Map to hold new state to prevent duplicates
        const newFilesMap = new Map<string, FileTab>();

        // EXCLUDE LARGE KB FILES to prevent browser crash/stalls
        const EXCLUDED_FILES = [

        ];

        // Read all files from FS
        for (const name of fsFiles) {
            if (EXCLUDED_FILES.includes(name)) continue;

            try {
                const content = await pyodideService.readFile(name);
                let type: 'script' | 'core' | 'data' = 'data';
                if (name.endsWith('.py')) type = 'script';
                // Try to preserve existing type if file was already open (e.g., 'core')
                const existing = files.find(f => f.name === name);
                if (existing) type = existing.type;

                newFilesMap.set(name, { name, content, type });
            } catch (err) {
                console.warn(`Failed to read file ${name} during sync`, err);
            }
        }
        
        setFiles(Array.from(newFilesMap.values()));
    } catch (e) {
        console.error("Failed to list files", e);
    }
  }, [pyodideService.isReady, files]); // Depend on files to preserve types

  // Prevent accidental reloads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isResettingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Initialize GPU Proxy Bridge
  useEffect(() => {
    // 1. DATA LOADER: Python calls this once to load 1725 vectors
    window.ubp_gpu_load_data = (jsonString: string) => {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                gpuVectorStoreRef.current = data;
                addConsoleLog('system', `[GPU Proxy] Loaded ${data.length} vectors into Main Thread memory.`);
                return `OK:${data.length}`;
            }
            return "ERR:InvalidFormat";
        } catch (e: any) {
            console.error("GPU Load Error", e);
            return `ERR:${e.message}`;
        }
    };

    // 2. COMPUTE FUNCTION: Python calls this for every calculation
    window.ubp_gpu_compute = (r: number, g: number, b: number) => {
        const store = gpuVectorStoreRef.current;
        if (store.length === 0) return "ERR:NoData";

        let minDist = Infinity;
        let bestId = "UNKNOWN";
        
        // Optimized V8 Loop (Main Thread)
        // This is significantly faster than Pyodide Wasm loop
        for (let i = 0; i < store.length; i++) {
            const item = store[i];
            const v = item.vector;
            // Squared Euclidean Distance (avoids sqrt for speed)
            const d = (r - v[0]) ** 2 + (g - v[1]) ** 2 + (b - v[2]) ** 2;
            
            if (d < minDist) {
                minDist = d;
                bestId = item.id;
            }
        }
        return bestId;
    };

    return () => {
        // Cleanup
        window.ubp_gpu_load_data = undefined;
        window.ubp_gpu_compute = undefined;
    };
  }, []);

  // Initialize Pyodide
  useEffect(() => {
    const initKernel = async () => {
        try {
            addConsoleLog('system', "Initializing Pyodide Runtime...");
            
            if (typeof window !== 'undefined') {
                (window as any).addGLMConsoleLogFromPython = (type: string, msg: string) => {
                    addGLMConsoleLog(type as any, msg);
                };
                (window as any).addConsoleLogFromPython = (type: string, msg: string) => {
                    addConsoleLog(type as any, msg);
                };
            }

            await pyodideService.initialize();
            
            // Setup global monkey-patch for os.chdir to redirect non-existent local paths to /home/pyodide
            await pyodideService.runPython(`
import os
import sys

original_chdir = os.chdir
def patched_chdir(path):
    try:
        original_chdir(path)
    except Exception:
        original_chdir('/home/pyodide')
os.chdir = patched_chdir

os.environ['UBP_CORE_PATH'] = '/home/pyodide'
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')
`);

            // Initial Sync of basic files
            await pyodideService.writeFile('ubp_system_kb.json', systemKb); 
            await pyodideService.writeFile('ubp_lang_kb_combined_v4.json', langKb);
            await pyodideService.writeFile('ubp_beliefs_kb.json', beliefsKb);
            await pyodideService.writeFile('ubp_study_kb.md', studyKb);
            await pyodideService.writeFile('ubp_hash_memory_kb.json', hashMemoryKb);
            
            await syncFOMSystem();
            addConsoleLog('system', "FOM System Ready.");
            
            setIsPyodideReady(true); // Set this AFTER all core files are written
            addConsoleLog('system', "Pyodide Ready.");
            
            await fetchFOMState();
            // REMOVED refreshFileList() to prevent race condition wiping out GitHub files
        } catch (err: any) { 
            addConsoleLog('error', `Error initializing runtime: ${err.toString()}`); 
        }
    };
    initKernel();
  }, []);

  // Initialize Local LLM Services
  useEffect(() => {
    const initLocalLLMs = async () => {
      const ollama = createLocalLLMService('ollama');
      const lmStudio = createLocalLLMService('lm-studio');
      const gpt4all = createLocalLLMService('gpt4all');
      
      const ollamaAvailable = await ollama.isServiceAvailable();
      const lmStudioAvailable = await lmStudio.isServiceAvailable();
      const gpt4allAvailable = await gpt4all.isServiceAvailable();
      
      if (ollamaAvailable) {
        setLocalLLMService(ollama);
        setLocalLLMStatus('available');
      } else if (lmStudioAvailable) {
        setLocalLLMService(lmStudio);
        setLocalLLMStatus('available');
      } else if (gpt4allAvailable) {
        setLocalLLMService(gpt4all);
        setLocalLLMStatus('available');
      } else {
        setLocalLLMStatus('unavailable');
      }
    };
    initLocalLLMs();
  }, []);

  // Sync All Workspace Files to Pyodide - Triggered by Readiness OR File Loading
  useEffect(() => {
    if (isPyodideReady && files.length > 0) {
        const timeoutId = setTimeout(() => {
            const syncFiles = async () => {
                try {
                    for (const f of files) {
                       await pyodideService.writeFile(f.name, f.content);
                    }
                } catch (e) { console.error("Auto-sync error", e); }
            };
            syncFiles();
        }, 1000);
        return () => clearTimeout(timeoutId);
    }
  }, [isPyodideReady, files]);

  // Sync All GLM Files to Pyodide
  useEffect(() => {
    if (isPyodideReady && glmFiles.length > 0) {
        const timeoutId = setTimeout(() => {
            const syncGLM = async () => {
                try {
                    for (const f of glmFiles) {
                       await pyodideService.writeFile(f.name, f.content);
                    }
                } catch (e) { console.error("GLM Auto-sync error", e); }
            };
            syncGLM();
        }, 1000);
        return () => clearTimeout(timeoutId);
    }
  }, [isPyodideReady, glmFiles]);

  // Prune any existing old glm files from state once loaded
  useEffect(() => {
    if (hasLoadedInitialData && glmFiles.some(f => f.name.toLowerCase().startsWith('glm_') && !f.name.toLowerCase().endsWith('.json'))) {
      setGLMFiles(prev => prev.filter(f => !(f.name.toLowerCase().startsWith('glm_') && !f.name.toLowerCase().endsWith('.json'))));
    }
  }, [hasLoadedInitialData, glmFiles]);

  // Sync Knowledge Bases to Python File System whenever they change content
  useEffect(() => {
    if (isPyodideReady) {
        const timeoutId = setTimeout(() => {
            const syncKBs = async () => {
                try {
                    await pyodideService.writeFile('ubp_system_kb.json', systemKb);
                    await pyodideService.writeFile('ubp_lang_kb_combined_v4.json', langKb);
                    await pyodideService.writeFile('ubp_beliefs_kb.json', beliefsKb);
                    await pyodideService.writeFile('ubp_study_kb.md', studyKb);
                    await pyodideService.writeFile('ubp_hash_memory_kb.json', hashMemoryKb);
                } catch (e) {
                    console.error("Failed to sync KBs to Pyodide FS", e);
                }
            };
            syncKBs();
        }, 1000); // 1-second debounce to prevent OOM crashes on rapid typing
        
        return () => clearTimeout(timeoutId);
    }
  }, [systemKb, langKb, studyKb, hashMemoryKb, beliefsKb, isPyodideReady]);

  // Auto-save session to IndexedDB
  useEffect(() => {
    const saveSession = async () => {
      if (isResettingRef.current || !hasLoadedInitialData) return;
      try {
        const sessionData = {
          files,
          systemKb,
          bytes: undefined, // ensure no extra payload sizes
          langKb,
          studyKb,
          hashMemoryKb,
          beliefsKb,
          chatMessages,
          consoleLogs,
          activeTabId,
          midColumnMode,
          activeOutputTab,
          fomFrames,
          activeFrame,
          // GLM State
          currentStudioMode,
          glmFiles,
          activeGLMTabId,
          glmMidColumnMode,
          glmChatMessages,
          glmConsoleLogs,
          activeGLMOutputTab,
          glmEffortTicks,
          glmChatMode,
          glmStatus,
          glmLastDiag,
          glmIdeaState,
          timestamp: Date.now()
        };
        await setIndexedDB('ubp_auto_save', sessionData);
      } catch (e) {
        console.warn('Failed to auto-save session:', e);
      }
    };
    
    const timeoutId = setTimeout(saveSession, 3000);
    return () => clearTimeout(timeoutId);
  }, [
    files, systemKb, langKb, studyKb, hashMemoryKb, beliefsKb, chatMessages, consoleLogs, activeTabId, midColumnMode, activeOutputTab, fomFrames, activeFrame, hasLoadedInitialData,
    currentStudioMode, glmFiles, activeGLMTabId, glmMidColumnMode, glmChatMessages, glmConsoleLogs, activeGLMOutputTab, glmEffortTicks, glmChatMode, glmStatus, glmLastDiag, glmIdeaState
  ]);

  // Load Initial Resources from GitHub
  useEffect(() => {
    const loadResources = async () => {
      try {
        // Check for auto-save first from IndexedDB, fallback to localStorage
        let saved = await getIndexedDB('ubp_auto_save');
        if (!saved) {
           const local = localStorage.getItem('ubp_auto_save');
           if (local) {
               try { saved = JSON.parse(local); } catch (e) {}
           }
        }
        let hasAutoSave = false;
        if (saved) {
           const data = saved;
           const isKbValid = data.systemKb && data.systemKb !== "[]" && data.langKb && data.langKb !== "[]";
          if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000 && isKbValid) { // 24 hours
              hasAutoSave = true;
              if (data.files && data.files.length > 0) setFiles(data.files);
              if (data.systemKb) setSystemKb(data.systemKb);
              if (data.langKb) setLangKb(data.langKb);
              if (data.studyKb) setStudyKb(data.studyKb);
              if (data.hashMemoryKb) setHashMemoryKb(data.hashMemoryKb);
              if (data.beliefsKb) setBeliefsKb(data.beliefsKb);
              if (data.chatMessages && data.chatMessages.length > 0) setChatMessages(data.chatMessages);
              if (data.consoleLogs && data.consoleLogs.length > 0) setConsoleLogs(data.consoleLogs);
              if (data.activeTabId) setActiveTabId(data.activeTabId);
              if (data.midColumnMode) setMidColumnMode(data.midColumnMode);
              if (data.activeOutputTab) setActiveOutputTab(data.activeOutputTab);
              if (data.fomFrames && data.fomFrames.length > 0) {
                  setInitialFomIndex(JSON.stringify(data.fomFrames));
              }

              if (data.glmFiles && data.glmFiles.length > 0) {
                setGLMFiles(data.glmFiles.filter((f: any) => !(f.name.toLowerCase().startsWith('glm_') && !f.name.toLowerCase().endsWith('.json'))));
              }
              if (data.currentStudioMode) setCurrentStudioMode(data.currentStudioMode);
              if (data.activeGLMTabId) setActiveGLMTabId(data.activeGLMTabId);
              if (data.glmMidColumnMode) setGLMMidColumnMode(data.glmMidColumnMode);
              if (data.glmChatMessages && data.glmChatMessages.length > 0) setGLMChatMessages(data.glmChatMessages);
              if (data.glmConsoleLogs && data.glmConsoleLogs.length > 0) setGLMConsoleLogs(data.glmConsoleLogs);
              if (data.activeGLMOutputTab) setActiveGLMOutputTab(data.activeGLMOutputTab);
              if (data.glmEffortTicks) setGLMEffortTicks(data.glmEffortTicks);
              if (data.glmChatMode) setGLMChatMode(data.glmChatMode);
              if (data.glmStatus) setGLMStatus(data.glmStatus);
              if (data.glmLastDiag) setGLMLastDiag(data.glmLastDiag);
              if (data.glmIdeaState) setGLMIdeaState(data.glmIdeaState);

              addConsoleLog('system', 'Restored previous session from auto-save.');
              setHasLoadedInitialData(true);
           }
        }
        
        if (hasAutoSave) {
           return; // Skip loading from GitHub if we restored from auto-save
        }

        const ts = Date.now();
        const sysUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/system_kb/ubp_system_kb.json';
        const langUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_lang_kb_combined_v4.json';
        const beliefsUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/system_kb/ubp_beliefs_kb.json';
        const hashUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/system_kb/hash_memory_kb.json';
        const manualUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/README.md';
        const autoTriggerUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/auto_trigger.py';
        const fomManagerUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_fom_manager_v2.py';

        // Load Basic Resources
        const [sysRes, langRes, beliefsRes, hashRes, manualRes, autoTriggerRes, fomManagerRes] = await Promise.all([
            fetch(sysUrl).catch(() => null),
            fetch(langUrl).catch(() => null),
            fetch(beliefsUrl).catch(() => null),
            fetch(hashUrl).catch(() => null),
            fetch(manualUrl).catch(() => null),
            fetch(autoTriggerUrl).catch(() => null),
            fetch(fomManagerUrl).catch(() => null)
        ]);

        if (sysRes?.ok) {
            const text = await sysRes.text();
            setSystemKb(text);
        }
        if (langRes?.ok) {
            const text = await langRes.text();
            setLangKb(text);
        }
        if (beliefsRes?.ok) {
            const text = await beliefsRes.text();
            setBeliefsKb(text);
        }
        if (hashRes?.ok) {
            const text = await hashRes.text();
            setHashMemoryKb(text);
        }

        // LOAD FOM INDEX (Attempt multiple paths with cache busting)
        let fomIndexText: string | null = null;
        let fomSource = '';
        const fomCandidates = [
            `https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/system_kb/ubp_fom_index.json?t=${ts}`,
            `https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_fom_index.json?t=${ts}`
        ];

        for (const url of fomCandidates) {
            if (fomIndexText) break;
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const text = await res.text();
                    // Validate content is JSON
                    try {
                        const json = JSON.parse(text);
                        // Check if it's array (user's format) or dict
                        if (Array.isArray(json) || typeof json === 'object') {
                            fomIndexText = text;
                            fomSource = url;
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }

        if (fomIndexText) {
            setInitialFomIndex(fomIndexText);
            addConsoleLog('system', `Fetched FOM Index from ${fomSource}`);
        } else {
            console.warn("Could not auto-load FOM index from any candidate URL.");
        }
        
        let initialFiles: FileTab[] = [];
        if (manualRes?.ok) {
            const content = await manualRes.text();
            setInstructionManual(content);
            initialFiles.push({ name: 'README.md', content, type: 'data' });
        }

        if (autoTriggerRes?.ok) initialFiles.push({ name: 'auto_trigger.py', content: await autoTriggerRes.text(), type: 'core' });
        if (fomManagerRes?.ok) initialFiles.push({ name: 'ubp_fom_manager_v2.py', content: await fomManagerRes.text(), type: 'core' });

        try {
            const repoApiUrl = 'https://api.github.com/repos/DigitalEuan/UBP_Repo/contents/core_studio_v4.0/core';
            const repoRes = await fetch(repoApiUrl);
            if (repoRes.ok) {
                const items = await repoRes.json();
                const scriptPromises = items
                    .filter((item: any) => item.type === 'file' && (item.name.endsWith('.py') || item.name.endsWith('.md') || item.name.endsWith('.json')) && item.name !== 'auto_trigger.py' && item.name !== 'ubp_fom_manager_v2.py')
                    .map(async (item: any) => {
                        try {
                            const res = await fetch(item.download_url);
                            if (res.ok) return { name: item.name, content: await res.text(), type: item.name.endsWith('.py') ? 'script' : 'data' } as FileTab;
                        } catch (e) { }
                        return null;
                    });
                const fetchedScripts = (await Promise.all(scriptPromises))
                    .filter((f): f is FileTab => f !== null)
                    .filter(f => f.name.toLowerCase() !== 'scratch.py'); 

                fetchedScripts.forEach(f => initialFiles.push(f));
            }
        } catch (err) { }

        // Set files state
        setFiles(prev => {
            const combined = [...prev];
            initialFiles.forEach(f => {
                if (f.name.toLowerCase() === 'scratch.py') return; // FILTER
                const idx = combined.findIndex(c => c.name === f.name);
                if (idx >= 0) combined[idx] = f;
                else combined.push(f);
            });
            if (!activeTabId && combined.length > 0) {
                setActiveTabId(combined[0].name);
            }
            return combined.filter(f => f.name.toLowerCase() !== 'scratch.py'); // FINAL FILTER
        });

        // Fetch GLM Workspace files on fresh start
        addConsoleLog('system', 'Loading GLM Workspace files...');
        try {
            const localGLMFilesList = [
                'GLM00_config.py', 'GLM01_substrate.py', 'GLM02_constants.py', 'GLM03_crg.py',
                'GLM04_number_vocab.py', 'GLM05_idea_evidence.py', 'GLM06_idea_zone.py', 'GLM07_idea_manager.py',
                'GLM08_idea_meta_graph.py', 'GLM09_tools.py', 'GLM10_response_composer.py', 'GLM11_runtime.py',
                'GLM12_cli_entry.py', 'GLM13_deliberative_reasoning.py', 'GLM14_lexer.py', 'GLM15_physics_pack.py',
                'GLM16_master_resource.py', 'GLM17_semantic_frames.py', 'GLM18_hex_colour.py', 'GLM19_prose_composer.py',
                'GLM20_svd_vocab.py', 'GLM21_generator.py', 'GLM22_ontological_grammar.py', 'GLM23_grammar_vectors.py',
                'GLM24_continuous_learner.py', 'GLM25_native_alu.py', 'GLM26_crg_alu.py', 'GLM27_crg_expander.py',
                'GLM28_native_poly.py', 'GLM29_answer_extractor.py', 'GLM30_domain_filter.py', 'GLM31_verification.py',
                'GLM32_mode_algebra.py', 'GLM33_considered_response.py', 'GLM34_simplicial_crg.py',
                'GLM35_paragraph_composer.py',
                'test_v321_levelling.py', 'golden_cases.json', 'run_golden_cases.py',
                'glm_unified_resource.json', 'glm_master_resource_v1.json'
            ];
            
            let fetchedGLM: FileTab[] = [];
            let loadedLocally = true;
            
            for (const filename of localGLMFilesList) {
                try {
                    const res = await fetch(`/glm_test_dir/${filename}`);
                    if (res.ok) {
                        const content = await res.text();
                        fetchedGLM.push({
                            name: filename,
                            content: content,
                            type: filename.endsWith('.py') ? 'script' : 'data'
                        });
                    } else {
                        loadedLocally = false;
                        break;
                    }
                } catch (e) {
                    loadedLocally = false;
                    break;
                }
            }
            
            if (!loadedLocally || fetchedGLM.length === 0) {
                addConsoleLog('system', 'Local GLM files not found. Falling back to fetching from GitHub...');
                fetchedGLM = await fetchGLMFolderRecursive('core_studio_v4.0/GLM');
            } else {
                addConsoleLog('system', 'Successfully loaded GLM Workspace files from local workspace.');
            }

            if (fetchedGLM.length > 0) {
                setGLMFiles(fetchedGLM);
                setActiveGLMTabId(fetchedGLM[0].name);
            }
        } catch (e) {
            console.error("Failed to fetch GLM files on startup:", e);
        }

        setHasLoadedInitialData(true);

      } catch (e) { console.error("Resource load failed", e); }
    };
    loadResources();
  }, []);

  // Sync Initial FOM Index to Pyodide once fetched and ready
  useEffect(() => {
    if (isPyodideReady && initialFomIndex) {
        const loadFom = async () => {
            try {
                await pyodideService.writeFile('ubp_fom_index.json', initialFomIndex);
                // Force reload of FOM Manager index from disk
                await pyodideService.runPython(`
                    try:
                        from ubp_fom_system import FOM_MANAGER
                        FOM_MANAGER.load_index()
                        print("FOM Index reloaded successfully.")
                    except Exception as e:
                        print(f"Error reloading FOM Index: {e}")
                `);
                await fetchFOMState();
            } catch (e) {
                console.error("Failed to load initial FOM index", e);
            }
        };
        loadFom();
    }
  }, [isPyodideReady, initialFomIndex]);

  // Sync Knowledge Base files to Pyodide once ready or when updated
  useEffect(() => {
    if (isPyodideReady) {
        const syncKBs = async () => {
            try {
                if (systemKb) {
                    await pyodideService.writeFile('ubp_system_kb.json', systemKb);
                }
                if (langKb) {
                    await pyodideService.writeFile('ubp_lang_kb_combined_v4.json', langKb);
                }
                if (beliefsKb) {
                    await pyodideService.writeFile('ubp_beliefs_kb.json', beliefsKb);
                }
                if (hashMemoryKb) {
                    await pyodideService.writeFile('hash_memory_kb.json', hashMemoryKb);
                }
            } catch (e) {
                console.error("Failed to sync KB files to Pyodide", e);
            }
        };
        syncKBs();
    }
  }, [isPyodideReady, systemKb, langKb, beliefsKb, hashMemoryKb]);

  const syncFOMSystem = async () => {
    try {
      const fomCoreCode = `
# UBP Frame of Mind System v4.3.0
import json
import os
class FrameOfMind:
    def __init__(self, frame_id, description="", base_nrci=0.5):
        self.frame_id = frame_id
        self.description = description
        self.base_nrci = base_nrci
        self.weights = {}
        self.category_weights = {} # Octad category weights
    def set_weight(self, ubp_id, nrci): self.weights[ubp_id] = nrci
    def set_category_weight(self, category, nrci): self.category_weights[category] = nrci
    def get_weight(self, ubp_id, category=None):
        if ubp_id in self.weights: return self.weights[ubp_id]
        if category and category in self.category_weights: return self.category_weights[category]
        return self.base_nrci
    def to_dict(self): 
        return {
            'frame_id': self.frame_id, 
            'description': self.description, 
            'base_nrci': self.base_nrci, 
            'weights': self.weights,
            'category_weights': self.category_weights
        }
class FOMManager:
    def __init__(self, index_file='ubp_fom_index.json'):
        self.frames = {}; self.active_frame = None; self.index_file = index_file; self.load_index()
    def load_index(self):
        try:
            if os.path.exists(self.index_file):
                with open(self.index_file, 'r') as f:
                    data = json.load(f)
                    # Handle LIST of frames (Array)
                    if isinstance(data, list):
                        for frame_data in data:
                            fid = frame_data.get('frame_id')
                            if fid:
                                frame = FrameOfMind(fid, frame_data.get('description', ''), frame_data.get('base_nrci', 0.5))
                                frame.weights = frame_data.get('weights', {})
                                frame.category_weights = frame_data.get('category_weights', {})
                                self.frames[fid] = frame
                    # Handle DICTIONARY of frames
                    elif isinstance(data, dict):
                        for frame_id, frame_data in data.items():
                            frame = FrameOfMind(frame_data.get('frame_id', frame_id), frame_data.get('description', ''), frame_data.get('base_nrci', 0.5))
                            frame.weights = frame_data.get('weights', {})
                            frame.category_weights = frame_data.get('category_weights', {})
                            self.frames[frame_id] = frame
                            
                    if self.frames: self.active_frame = list(self.frames.keys())[0]
            else:
                 # Default if no file
                 default = FrameOfMind("FOM_DEFAULT", "Balanced Standard Bias", 0.5)
                 self.frames["FOM_DEFAULT"] = default
                 self.active_frame = "FOM_DEFAULT"
        except Exception as e: print(f"[FOM] Error loading index: {e}")
    def save_index(self):
        try:
             # Save as DICT to maintain standard, or could save as LIST if preferred
             data = {fid: f.to_dict() for fid, f in self.frames.items()}
             with open(self.index_file, 'w') as f: json.dump(data, f)
        except: pass
    def update_frame_from_dict(self, data):
        fid = data.get('frame_id')
        if not fid: return
        f = FrameOfMind(fid, data.get('description',''), data.get('base_nrci', 0.5))
        f.weights = data.get('weights', {})
        f.category_weights = data.get('category_weights', {})
        self.frames[fid] = f
        self.save_index()
    def delete_frame(self, fid):
        if fid in self.frames:
            del self.frames[fid]
            # If we deleted the active frame, switch to another valid one
            if self.active_frame == fid:
                self.active_frame = list(self.frames.keys())[0] if self.frames else None
            self.save_index()
            print(f"DEBUG: Deleted {fid}, active is now {self.active_frame}")
    def switch_frame(self, frame_id):
        if frame_id in self.frames: self.active_frame = frame_id; return True
        return False
    def get_active_frame(self): return self.frames[self.active_frame] if (self.active_frame and self.active_frame in self.frames) else None
    def get_mass(self, ubp_id, category=None): return self.get_active_frame().get_weight(ubp_id, category) if self.get_active_frame() else 0.5
    def list_frames(self): return list(self.frames.keys())
FOM_MANAGER = FOMManager()
`;
      await pyodideService.writeFile('ubp_fom_system.py', fomCoreCode);
    } catch (err) { console.warn("Failed to sync FOM system", err); }
  };

  const fetchFOMState = async () => {
    if (!pyodideService.isReady) return;
    try {
        const code = `
import json
from ubp_fom_system import FOM_MANAGER
result = {
    'frames': [f.to_dict() for f in FOM_MANAGER.frames.values()],
    'active': FOM_MANAGER.active_frame
}
print(json.dumps(result))
`;
        const res = await pyodideService.runPython(code);
        if (res.stdout) {
            try {
                const data = JSON.parse(res.stdout);
                setFomFrames(data.frames);
                setActiveFrame(data.active);
            } catch(e) { /* ignore parse errors */ }
        }
    } catch (e) {}
  };

  const handleImportFOM = async (jsonString: string) => {
      if (!isPyodideReady) return;
      try {
          await pyodideService.writeFile('fom_upload.json', jsonString);
          const code = `
import json
from ubp_fom_system import FOM_MANAGER
try:
    with open('fom_upload.json', 'r') as f:
        data = json.load(f)
    frames_to_load = []
    if isinstance(data, list): frames_to_load = data
    elif isinstance(data, dict):
        if 'frames' in data and isinstance(data['frames'], list): frames_to_load = data['frames']
        elif 'frame_id' in data: frames_to_load = [data]
        else: frames_to_load = [v for k,v in data.items()]
    count = 0
    for f_data in frames_to_load:
        FOM_MANAGER.update_frame_from_dict(f_data)
        count += 1
    print(f"SUCCESS: Imported {count} frames")
except Exception as e: print(f"ERROR: {e}")
`;
          const res = await pyodideService.runPython(code);
          if (res.stdout.includes("SUCCESS")) {
              addConsoleLog('system', res.stdout.trim());
              await fetchFOMState();
          } else {
              addConsoleLog('error', `Import failed: ${res.stdout}`);
          }
      } catch (e: any) {
          addConsoleLog('error', `Import error: ${e.message}`);
      }
  };

  const handleUpdateFOMJson = async (jsonString: string) => {
    if (!isPyodideReady) return;
    try {
         await pyodideService.writeFile('temp_fom_update.json', jsonString);
         const code = `
import json
from ubp_fom_system import FOM_MANAGER
try:
    with open('temp_fom_update.json', 'r') as f:
        data = json.load(f)
    FOM_MANAGER.update_frame_from_dict(data)
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
`;
         await pyodideService.runPython(code);
         addConsoleLog('system', "Frame saved.");
         await fetchFOMState();
    } catch (e: any) {
        addConsoleLog('error', `Failed to update FOM: ${e.message}`);
    }
  };

  const handleSwitchFrame = async (id: string) => {
      if (!isPyodideReady) return;
      await pyodideService.runPython(`FOM_MANAGER.switch_frame('${id}')`);
      await fetchFOMState();
  };

  const handleDeleteFrame = async (id: string) => {
      if (!isPyodideReady) return;
      try {
        await pyodideService.runPython(`FOM_MANAGER.delete_frame('${id}')`);
        await fetchFOMState();
        addConsoleLog('system', `Frame ${id} deleted.`);
      } catch (e: any) {
          addConsoleLog('error', `Delete failed: ${e.message}`);
      }
  };

  const handleRunCode = async () => {
    const activeFile = files.find(f => f.name === activeTabId);
    if (!activeFile || !isPyodideReady || isExecuting) return;

    setIsExecuting(true);
    setActiveOutputTab('console');
    addConsoleLog('system', `>>> Running ${activeFile.name}...`);
    
    // 1. Save active file to FS before running
    await pyodideService.writeFile(activeFile.name, activeFile.content);
    
    // 2. Run
    const result = await pyodideService.runPython(activeFile.content);
    
    if (result.stdout) addConsoleLog('stdout', result.stdout);
    if (result.stderr) addConsoleLog('stderr', result.stderr);
    if (result.error) addConsoleLog('error', result.error);
    
    if (result.image) {
        setGeneratedImage(result.image);
        setActiveOutputTab('visual');
    }
    
    if (result.scene3d) {
        setScene3dData(result.scene3d);
        setActiveOutputTab('visual');
    }

    setIsExecuting(false);
    
    // 3. Sync FS back to React State (catch any new files created by the script)
    await refreshFileList();
  };

  const handleSendMessage = async (text: string, attachments: AttachedDoc[]) => {
    if (isChatLoading) return;
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now(), attachments };
    setChatMessages(prev => [...prev, newUserMsg]);
    setIsChatLoading(true);
    try {
        let responseText = "";
        let thought: string | undefined = undefined;
        let groundingUrls: { title: string; uri: string }[] | undefined = [];

        if (aiProvider === 'gemini') {
            const apiKey = process.env.GEMINI_API_KEY || '';
            const gemini = new GeminiService(apiKey, selectedModel);
            const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
            const res = await gemini.generateStudyPlan(history, text, files, glmFiles, systemKb, langKb, studyKb, hashMemoryKb, beliefsKb, instructionManual, attachments);
            responseText = res.text;
            thought = res.thought;
            groundingUrls = res.groundingUrls;
        } else if (aiProvider === 'glm') {
            if (!isPyodideReady) {
                throw new Error("Cannot run GLM: Pyodide Kernel is not ready.");
            }
            if (glmStatus !== 'online') {
                addConsoleLog('system', "GLM is offline. Triggering auto-boot...");
                await bootGLMRuntime();
            }

            await pyodideService.writeFile('glm_query.txt', text);
            addConsoleLog('system', `>>> Sending query to GLM Reasoner: "${text.substring(0, 50)}..."`);

            const chatCode = `
import os
import sys

# Setup global monkey-patch for os.chdir to redirect non-existent local paths to /home/pyodide
if not hasattr(os, '_patched_for_ubp'):
    original_chdir = os.chdir
    def patched_chdir(path):
        try:
            original_chdir(path)
        except Exception:
            original_chdir('/home/pyodide')
    os.chdir = patched_chdir
    os._patched_for_ubp = True

os.environ['UBP_CORE_PATH'] = '/home/pyodide'
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')

try:
    with open('glm_query.txt', 'r') as f:
        query = f.read()
    
    if 'glm_rt' not in globals():
        # Clear module cache to ensure we load latest file content
        for k in list(sys.modules.keys()):
            if any(p in k.lower() for p in ['glm', 'bla', 'semantic', 'critpt', 'crg', 'concept', 'grammar', 'lexer', 'auto_trigger', 'ubp', 'fom', 'alu', 'poly', 'filter', 'verification']):
                sys.modules.pop(k, None)
        # Ensure ubp_unified_v5.py is available
        import os as _os
        _ubp_path = _os.path.join('/home/pyodide', 'ubp_unified_v5.py')
        if not _os.path.exists(_ubp_path):
            try:
                import urllib.request as _urllib
                _urllib.urlretrieve('https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_unified_v5.py', _ubp_path)
            except Exception:
                pass
        from GLM11_runtime import GLMRuntimeV37
        globals()['glm_rt'] = GLMRuntimeV37()
        
    rt = globals()['glm_rt']
    
    mode = "${glmChatMode}"
    ticks = ${glmEffortTicks}
    
    if mode == 'effort':
        response = rt.chat_with_effort(query, max_ticks=ticks)
    else:
        response = rt.chat(query)
        
    print("RESPONSE_START")
    print(response)
    print("RESPONSE_END")
except Exception as e:
    import traceback
    print(f"CHAT_ERR: {e}\\n{traceback.format_exc()}")
`;
            const res = await pyodideService.runPython(chatCode);
            if (res.stdout) {
                const match = res.stdout.match(/RESPONSE_START\s*([\s\S]*?)\s*RESPONSE_END/);
                if (match && match[1]) {
                    responseText = match[1].trim();
                    const lines = responseText.split('\n');
                    const traceLines = lines.filter(l => l.startsWith('[deliberated') || l.startsWith('[method') || l.startsWith('[step') || l.includes('deliberated:'));
                    if (traceLines.length > 0) {
                        thought = traceLines.join('\n');
                    }
                    addConsoleLog('stdout', responseText);
                } else if (res.stdout.includes("CHAT_ERR")) {
                    throw new Error(res.stdout);
                } else {
                    throw new Error("No response delimiter returned from GLM runtime.");
                }
            } else {
                throw new Error(res.error || res.stderr || "Empty output from GLM run.");
            }
            await updateGLMStates();
        } else {
             if (!localLLMService) throw new Error("Local LLM not ready");
             const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
             const res = await localLLMService.generateResponse(text, history, files, glmFiles, systemKb, langKb, studyKb, hashMemoryKb, instructionManual);
             responseText = res.text;
        }

        const newModelMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', content: responseText, timestamp: Date.now(), thought, groundingUrls };
        setChatMessages(prev => [...prev, newModelMsg]);
    } catch (e: any) {
        addConsoleLog('error', e.message);
         setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: `Error: ${e.message}`, timestamp: Date.now(), isError: true }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleExtractCode = async (code: string) => {
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      const name = `ubp_script_${timestamp}.py`;
      const newFile: FileTab = { name, content: code, type: 'script' };
      setFiles(prev => [...prev, newFile]);
      setActiveTabId(name);
      setMidColumnMode('editor');
      if (isPyodideReady) {
         try {
             await pyodideService.writeFile(name, code);
             addConsoleLog('system', `Extracted code to new file: ${name}`);
             await refreshFileList();
         } catch(e) { console.error(e); }
      }
  };

  const handleExtractToKB = (target: 'system' | 'study' | 'hash' | 'beliefs', content: string) => {
      if (target === 'system') {
          // JSON Merge Logic
          setSystemKb(prev => {
              try {
                  const prevJson = JSON.parse(prev);
                  const newContent = JSON.parse(content);
                  let merged;
                  if (Array.isArray(prevJson)) {
                      merged = [...prevJson, ...(Array.isArray(newContent) ? newContent : [newContent])];
                  } else {
                      merged = { ...prevJson, ...newContent };
                  }
                  return JSON.stringify(merged, null, 2);
              } catch (e) {
                  return prev + "\n" + content; // Fallback
              }
          });
          setMidColumnMode('system');
      } else if (target === 'beliefs') {
          setBeliefsKb(prev => {
              try {
                  const prevJson = JSON.parse(prev);
                  const newContent = JSON.parse(content);
                  let merged;
                  if (Array.isArray(prevJson)) {
                      merged = [...prevJson, ...(Array.isArray(newContent) ? newContent : [newContent])];
                  } else {
                      merged = { ...prevJson, ...newContent };
                  }
                  return JSON.stringify(merged, null, 2);
              } catch (e) {
                  return prev + "\n" + content;
              }
          });
          setMidColumnMode('beliefs');
      } else if (target === 'study') {
          setStudyKb(prev => prev + "\n" + content);
          setMidColumnMode('study');
      } else if (target === 'hash') {
          setHashMemoryKb(prev => {
              try {
                 const prevJson = JSON.parse(prev);
                 const newJson = JSON.parse(content);
                 const merged = { ...prevJson, ...newJson };
                 return JSON.stringify(merged, null, 2);
              } catch (e) { return prev + "\n" + content; }
          });
          setMidColumnMode('hash');
      }
      addConsoleLog('system', `Extracted content to ${target.toUpperCase()} KB.`);
  };

  const updateFileContent = (name: string, content: string) => {
      setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f));
  };

  const updateGLMFileContent = (name: string, content: string) => {
      setGLMFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f));
  };

  const bootGLMRuntime = async () => {
    if (!isPyodideReady) {
      addGLMConsoleLog('error', "Cannot boot GLM: Pyodide Kernel is not ready.");
      return;
    }
    setGLMStatus('booting');
    addGLMConsoleLog('system', "Booting Geometric Language Machine (GLM) v3.25.0...");
    
    const bootCode = `
import os
import sys

# Setup global monkey-patch for os.chdir to redirect non-existent local paths to /home/pyodide
if not hasattr(os, '_patched_for_ubp'):
    original_chdir = os.chdir
    def patched_chdir(path):
        try:
            original_chdir(path)
        except Exception:
            original_chdir('/home/pyodide')
    os.chdir = patched_chdir
    os._patched_for_ubp = True

os.environ['UBP_CORE_PATH'] = '/home/pyodide'
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')

import js
def log_to_js(msg):
    try:
        js.window.addGLMConsoleLogFromPython('system', f"⚙️ {msg}")
    except Exception:
        js.console.log("[GLM BOOT]", msg)

# Clear module cache to ensure we load latest file content
for k in list(sys.modules.keys()):
    if any(p in k.lower() for p in ['glm', 'bla', 'semantic', 'critpt', 'crg', 'concept', 'grammar', 'lexer', 'auto_trigger', 'ubp', 'fom', 'alu', 'poly', 'filter', 'verification']):
        sys.modules.pop(k, None)

try:
    # Ensure ubp_unified_v5.py is available (the core Golay/Leech math engine)
    import os
    ubp_path = os.path.join('/home/pyodide', 'ubp_unified_v5.py')
    if not os.path.exists(ubp_path):
        log_to_js("Fetching ubp_unified_v5.py engine from GitHub...")
        try:
            import urllib.request
            url = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_unified_v5.py'
            urllib.request.urlretrieve(url, ubp_path)
            log_to_js("ubp_unified_v5.py engine loaded.")
        except Exception as dl_err:
            log_to_js(f"Warning: Could not fetch ubp_unified_v5.py ({dl_err}). Using fallback stub — quality reduced.")

    log_to_js("Loading GLMRuntimeV37 from GLM11_runtime...")
    from GLM11_runtime import GLMRuntimeV37
    log_to_js("Instantiating GLMRuntimeV37...")
    globals()['glm_rt'] = GLMRuntimeV37()
    log_to_js("GLM Booted successfully!")
    print("SUCCESS")
except Exception as e:
    import traceback
    err_trace = traceback.format_exc()
    log_to_js(f"GLM Boot failed: {err_trace}")
    print(f"ERROR: {e}\\n{err_trace}")
`;
    try {
      const res = await pyodideService.runPython(bootCode);
      if (res.stdout.includes("SUCCESS")) {
        setGLMStatus('online');
        addGLMConsoleLog('system', "GLM v3.25.0 loaded successfully and is now ONLINE.");
        await updateGLMStates();
      } else {
        setGLMStatus('offline');
        addGLMConsoleLog('error', `GLM Boot failed: ${res.stdout || res.stderr || res.error}`);
      }
    } catch (e: any) {
      setGLMStatus('offline');
      addGLMConsoleLog('error', `GLM Boot exception: ${e.message}`);
    }
  };

  const updateGLMStates = async () => {
    if (!isPyodideReady) return;
    try {
      const diagCode = `
import json
try:
    if 'glm_rt' in globals():
        rt = globals()['glm_rt']
        
        # Check if methods exist and call them safely
        diag_val = {}
        if hasattr(rt, 'last_diag'):
            diag_val = rt.last_diag()
        elif hasattr(rt, 'get_diagnostics'):
            diag_val = rt.get_diagnostics()
            
        idea_val = {}
        if hasattr(rt, 'idea_state'):
            idea_val = rt.idea_state()
        elif hasattr(rt, 'get_idea_state'):
            idea_val = rt.get_idea_state()

        # Safely serialize using default=str fallback to prevent any type crashes
        print("DIAG_START")
        print(json.dumps(diag_val, indent=2, default=str))
        print("DIAG_END")
        
        print("IDEA_START")
        print(json.dumps(idea_val, indent=2, default=str))
        print("IDEA_END")
    else:
        print("STATE_ERR: GLM runtime not found in globals.")
except Exception as e:
    print(f"STATE_ERR: {e}")
`;
      const res = await pyodideService.runPython(diagCode);
      if (res.stdout) {
        const diagMatch = res.stdout.match(/DIAG_START\s*([\s\S]*?)\s*DIAG_END/);
        const ideaMatch = res.stdout.match(/IDEA_START\s*([\s\S]*?)\s*IDEA_END/);
        
        if (diagMatch && diagMatch[1]) setGLMLastDiag(diagMatch[1]);
        if (ideaMatch && ideaMatch[1]) setGLMIdeaState(ideaMatch[1]);
      }
    } catch (e) {
      console.error("Failed to update GLM states", e);
    }
  };

  const handleSendGLMMessage = async (text: string) => {
    if (isGLMChatLoading) return;
    
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setGLMChatMessages(prev => [...prev, newUserMsg]);
    setIsGLMChatLoading(true);
    setGLMMidColumnMode('editor');
    
    try {
      if (glmStatus !== 'online') {
        addGLMConsoleLog('system', "GLM is offline. Triggering auto-boot...");
        await bootGLMRuntime();
      }
      
      await pyodideService.writeFile('glm_query.txt', text);
      addGLMConsoleLog('system', `>>> Sending query to GLM: "${text.substring(0, 50)}..."`);
      
      const chatCode = `
import os
import sys

# Setup global monkey-patch for os.chdir to redirect non-existent local paths to /home/pyodide
if not hasattr(os, '_patched_for_ubp'):
    original_chdir = os.chdir
    def patched_chdir(path):
        try:
            original_chdir(path)
        except Exception:
            original_chdir('/home/pyodide')
    os.chdir = patched_chdir
    os._patched_for_ubp = True

os.environ['UBP_CORE_PATH'] = '/home/pyodide'
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')

try:
    with open('glm_query.txt', 'r') as f:
        query = f.read()
    
    if 'glm_rt' not in globals():
        # Clear module cache to ensure we load latest file content
        for k in list(sys.modules.keys()):
            if any(p in k.lower() for p in ['glm', 'bla', 'semantic', 'critpt', 'crg', 'concept', 'grammar', 'lexer', 'auto_trigger', 'ubp', 'fom', 'alu', 'poly', 'filter', 'verification']):
                sys.modules.pop(k, None)
        # Ensure ubp_unified_v5.py is available
        import os as _os
        _ubp_path = _os.path.join('/home/pyodide', 'ubp_unified_v5.py')
        if not _os.path.exists(_ubp_path):
            try:
                import urllib.request as _urllib
                _urllib.urlretrieve('https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_unified_v5.py', _ubp_path)
            except Exception:
                pass
        from GLM11_runtime import GLMRuntimeV37
        globals()['glm_rt'] = GLMRuntimeV37()
        
    rt = globals()['glm_rt']
    
    mode = "${glmChatMode}"
    ticks = ${glmEffortTicks}
    
    if mode == 'effort':
        response = rt.chat_with_effort(query, max_ticks=ticks)
    else:
        response = rt.chat(query)
        
    print("RESPONSE_START")
    print(response)
    print("RESPONSE_END")
except Exception as e:
    import traceback
    print(f"CHAT_ERR: {e}\\n{traceback.format_exc()}")
`;
      const res = await pyodideService.runPython(chatCode);
      
      if (res.stdout) {
        const match = res.stdout.match(/RESPONSE_START\s*([\s\S]*?)\s*RESPONSE_END/);
        if (match && match[1]) {
          const responseText = match[1].trim();
          
          let thought: string | undefined = undefined;
          const lines = responseText.split('\n');
          const traceLines = lines.filter(l => l.startsWith('[deliberated') || l.startsWith('[method') || l.startsWith('[step') || l.includes('deliberated:'));
          if (traceLines.length > 0) {
            thought = traceLines.join('\n');
          }
          
          const newModelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: responseText,
            timestamp: Date.now(),
            thought
          };
          setGLMChatMessages(prev => [...prev, newModelMsg]);
          addGLMConsoleLog('stdout', responseText);
        } else if (res.stdout.includes("CHAT_ERR")) {
          throw new Error(res.stdout);
        } else {
          throw new Error("No response delimiter returned from GLM runtime.");
        }
      } else {
        throw new Error(res.error || res.stderr || "Empty output from GLM run.");
      }
      
      await updateGLMStates();
      
    } catch (e: any) {
      addGLMConsoleLog('error', `GLM Chat failed: ${e.message}`);
      setGLMChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `GLM Execution Error:\n${e.message}`,
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setIsGLMChatLoading(false);
    }
  };

  const handleExportWorkspace = async () => {
    try {
      addGLMConsoleLog('system', "Bundling current development workspace backup...");
      let syncedFiles = [];
      if (isPyodideReady) {
        const workerFiles = await pyodideService.listFiles();
        for (const name of workerFiles) {
          if (name.endsWith('.py') || name.endsWith('.json') || name.endsWith('.md')) {
            try {
              const content = await pyodideService.readFile(name);
              syncedFiles.push({ name, content });
            } catch (e) {}
          }
        }
      }

      const backup = {
        version: "4.3.0",
        timestamp: Date.now(),
        files: files,
        glmFiles: glmFiles,
        pyodideFS: syncedFiles,
        systemKb,
        langKb,
        studyKb,
        hashMemoryKb,
        beliefsKb,
        fomFrames,
        activeFrame,
        glmChatMessages,
        glmConsoleLogs
      };

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ubp_workspace_dev_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addGLMConsoleLog('system', "Workspace backup downloaded successfully!");
    } catch (err: any) {
      addGLMConsoleLog('error', `Failed to export workspace: ${err.message}`);
    }
  };

  const handleImportWorkspace = async (file: File) => {
    try {
      addGLMConsoleLog('system', `Reading workspace backup: ${file.name}...`);
      const text = await file.text();
      const backup = JSON.parse(text);
      
      if (!backup || typeof backup !== 'object') {
        throw new Error("Invalid backup file format.");
      }

      if (backup.files) setFiles(backup.files);
      if (backup.glmFiles) setGLMFiles(backup.glmFiles);
      if (backup.systemKb) setSystemKb(backup.systemKb);
      if (backup.langKb) setLangKb(backup.langKb);
      if (backup.studyKb) setStudyKb(backup.studyKb);
      if (backup.hashMemoryKb) setHashMemoryKb(backup.hashMemoryKb);
      if (backup.beliefsKb) setBeliefsKb(backup.beliefsKb);
      if (backup.fomFrames) setFomFrames(backup.fomFrames);
      if (backup.activeFrame) setActiveFrame(backup.activeFrame);
      if (backup.glmChatMessages) setGLMChatMessages(backup.glmChatMessages);
      if (backup.glmConsoleLogs) setGLMConsoleLogs(backup.glmConsoleLogs);

      if (isPyodideReady && backup.pyodideFS) {
        for (const pyFile of backup.pyodideFS) {
          try {
            await pyodideService.writeFile(pyFile.name, pyFile.content);
          } catch (e) {}
        }
      }

      addGLMConsoleLog('system', "Workspace restored successfully and synchronized to sandbox environment!");
    } catch (err: any) {
      addGLMConsoleLog('error', `Import failed: ${err.message}`);
      alert(`Import failed: ${err.message}`);
    }
  };

  const runGLMSelfTests = async () => {
    if (!isPyodideReady || isGLMExecuting) return;
    setIsGLMExecuting(true);
    setActiveGLMOutputTab('console');
    addGLMConsoleLog('system', ">>> Running GLM 12 Self-Tests (A-L)...");
    
    const testCode = `
import sys

# Clear module cache to load latest content
for k in list(sys.modules.keys()):
    if any(p in k for p in ['glm', 'bla', 'semantic', 'critpt', 'crg', 'concept', 'grammar', 'lexer', 'auto_trigger']):
        sys.modules.pop(k, None)

old_argv = sys.argv
sys.argv = ['GLM12_cli_entry.py', '--test']

try:
    with open('GLM12_cli_entry.py', 'r') as f:
        code = f.read().replace('__file__', '"GLM12_cli_entry.py"')
    g = globals().copy()
    g['__file__'] = 'GLM12_cli_entry.py'
    from GLM11_runtime import GLMRuntimeV37
    g['GLMRuntimeV37'] = GLMRuntimeV37
    from pathlib import Path
    g['Path'] = Path
    g['__name__'] = '__main__'
    exec(code, g)
finally:
    sys.argv = old_argv
`;
    try {
      const res = await pyodideService.runPython(testCode);
      if (res.stdout) addGLMConsoleLog('stdout', res.stdout);
      if (res.stderr) addGLMConsoleLog('stderr', res.stderr);
      if (res.error) addGLMConsoleLog('error', res.error);
    } catch (e: any) {
      addGLMConsoleLog('error', `Self-tests failed: ${e.message}`);
    } finally {
      setIsGLMExecuting(false);
    }
  };

  const runGLMBenchmarks = async () => {
    if (!isPyodideReady || isGLMExecuting) return;
    setIsGLMExecuting(true);
    setActiveGLMOutputTab('console');
    addGLMConsoleLog('system', ">>> Running 28 Gold-Set Benchmarks...");
    
    const benchmarkCode = `
import sys

# Clear module cache to load latest content
for k in list(sys.modules.keys()):
    if any(p in k for p in ['glm', 'bla', 'semantic', 'critpt', 'crg', 'concept', 'grammar', 'lexer', 'auto_trigger']):
        sys.modules.pop(k, None)

old_argv = sys.argv
sys.argv = ['run_benchmark.py', '--suite', 'all', '--tag', 'v373', '--engine', 'grown']

try:
    with open('run_benchmark.py', 'r') as f:
        code = f.read().replace('__file__', '"run_benchmark.py"')
    g = globals().copy()
    g['__file__'] = 'run_benchmark.py'
    g['__name__'] = '__main__'
    exec(code, g)
finally:
    sys.argv = old_argv
`;
    try {
      const res = await pyodideService.runPython(benchmarkCode);
      if (res.stdout) addGLMConsoleLog('stdout', res.stdout);
      if (res.stderr) addGLMConsoleLog('stderr', res.stderr);
      if (res.error) addGLMConsoleLog('error', res.error);
    } catch (e: any) {
      addGLMConsoleLog('error', `Benchmarks run failed: ${e.message}`);
    } finally {
      setIsGLMExecuting(false);
    }
  };

  const handleRunGLMCode = async () => {
    const activeFile = glmFiles.find(f => f.name === activeGLMTabId);
    if (!activeFile || !isPyodideReady || isGLMExecuting) return;

    setIsGLMExecuting(true);
    setActiveGLMOutputTab('console');
    addGLMConsoleLog('system', `>>> Running GLM Script: ${activeFile.name}...`);
    
    await pyodideService.writeFile(activeFile.name, activeFile.content);
    
    const runCode = `
import sys

# Clear module cache to load latest content
for k in list(sys.modules.keys()):
    if any(p in k for p in ['glm', 'bla', 'semantic', 'critpt', 'crg', 'concept', 'grammar', 'lexer', 'auto_trigger']):
        sys.modules.pop(k, None)

old_argv = sys.argv
if "${activeFile.name}" == "run_benchmark.py":
    sys.argv = ['run_benchmark.py', '--suite', 'all', '--tag', 'v373', '--engine', 'grown']
elif "${activeFile.name}" == "GLM12_cli_entry.py":
    sys.argv = ['GLM12_cli_entry.py', '--test']
else:
    sys.argv = ["${activeFile.name}"]

try:
    with open("${activeFile.name}", 'r') as f:
        code = f.read().replace('__file__', '"${activeFile.name}"')
    g = globals().copy()
    g['__file__'] = "${activeFile.name}"
    if "${activeFile.name}" == "GLM12_cli_entry.py":
        from GLM11_runtime import GLMRuntimeV37
        g['GLMRuntimeV37'] = GLMRuntimeV37
        from pathlib import Path
        g['Path'] = Path
    g['__name__'] = '__main__'
    exec(code, g)
finally:
    sys.argv = old_argv
`;

    try {
      const result = await pyodideService.runPython(runCode);
      if (result.stdout) addGLMConsoleLog('stdout', result.stdout);
      if (result.stderr) addGLMConsoleLog('stderr', result.stderr);
      if (result.error) addGLMConsoleLog('error', result.error);
    } catch (e: any) {
      addGLMConsoleLog('error', `Execution exception: ${e.message}`);
    } finally {
      setIsGLMExecuting(false);
    }
  };

  const startCreateGLMFile = () => {
      setIsGLMCreatingFile(true);
      setNewGLMFileName('');
      setTimeout(() => glmNewFileInputRef.current?.focus(), 50);
  };

  const submitCreateGLMFile = async (e?: React.FormEvent) => {
      e?.preventDefault();
      let name = newGLMFileName.trim();
      if (!name) {
          setIsGLMCreatingFile(false);
          return;
      }
      if (!name.includes('.')) name += '.py';

      if (glmFiles.some(f => f.name === name)) {
          alert("File exists");
          return;
      }

      const newFile: FileTab = { name, content: '# New GLM Script\n', type: 'script' };
      setGLMFiles(prev => [...prev, newFile]);
      setIsGLMCreatingFile(false);
      setActiveGLMTabId(name);
      setGLMMidColumnMode('editor');

      if (isPyodideReady) {
          await pyodideService.writeFile(name, newFile.content);
          addGLMConsoleLog('system', `Created file: ${name}`);
      }
  };

  const startRenameGLM = (name: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setRenamingGLMFile(name);
      setRenameGLMValue(name);
      setTimeout(() => glmRenameInputRef.current?.focus(), 50);
  };

  const submitRenameGLM = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!renamingGLMFile) return;
      const oldName = renamingGLMFile;
      const newName = renameGLMValue.trim();
      
      if (!newName || newName === oldName) {
          setRenamingGLMFile(null);
          return;
      }

      setGLMFiles(prev => prev.map(f => f.name === oldName ? { ...f, name: newName } : f));
      if (activeGLMTabId === oldName) setActiveGLMTabId(newName);
      setRenamingGLMFile(null);

      if (isPyodideReady) {
          try {
             const fileData = glmFiles.find(f => f.name === oldName);
             await pyodideService.writeFile(newName, fileData?.content || "");
             try { await pyodideService.deleteFile(oldName); } catch(e) {}
             addGLMConsoleLog('system', `Renamed ${oldName} -> ${newName}`);
          } catch (e: any) {
             console.error(e);
          }
      }
  };

  const requestDeleteGLM = (name: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setGLMFileToDelete(name);
  };

  const confirmDeleteGLM = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!glmFileToDelete) return;
      
      const name = glmFileToDelete;
      setGLMFiles(prev => prev.filter(f => f.name !== name));
      if (activeGLMTabId === name) setActiveGLMTabId('');
      setGLMFileToDelete(null);

      if (isPyodideReady) {
          try {
              await pyodideService.deleteFile(name);
              addGLMConsoleLog('system', `Deleted ${name}`);
          } catch (e) { console.error("FS Delete failed", e); }
      }
  };

  const cancelDeleteGLM = (e: React.MouseEvent) => {
      e.stopPropagation();
      setGLMFileToDelete(null);
  };

  const handleUploadGLMFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) {
              const newFile: FileTab = { name: file.name, content: content, type: file.name.endsWith('.py') ? 'script' : 'data' };
              setGLMFiles(prev => {
                  if (prev.find(f => f.name === file.name)) return prev.map(f => f.name === file.name ? newFile : f);
                  return [...prev, newFile];
              });
              if (isPyodideReady) {
                  await pyodideService.writeFile(file.name, content);
                  addGLMConsoleLog('system', `Uploaded ${file.name}`);
              }
          }
      };
      reader.readAsText(file);
      if (glmUploadFileRef.current) glmUploadFileRef.current.value = '';
  };

  const openGLMFile = (name: string) => {
      setActiveGLMTabId(name);
      setGLMMidColumnMode('editor');
  };

  const handleDownloadGLMFile = (fileName: string, content: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // ------------------------------------------------------------------------
  // INLINE FILE HANDLING HANDLERS
  // ------------------------------------------------------------------------

  const startCreateFile = () => {
      setIsCreatingFile(true);
      setNewFileName('');
      // Use setTimeout to allow render before focusing
      setTimeout(() => newFileInputRef.current?.focus(), 50);
  };

  const submitCreateFile = async (e?: React.FormEvent) => {
      e?.preventDefault();
      let name = newFileName.trim();
      if (!name) {
          setIsCreatingFile(false);
          return;
      }
      if (!name.includes('.')) name += '.py';

      if (files.some(f => f.name === name)) {
          alert("File exists");
          return;
      }

      const newFile: FileTab = { name, content: '# New Script\n', type: 'script' };
      setFiles(prev => [...prev, newFile]);
      setIsCreatingFile(false);
      setActiveTabId(name);
      setMidColumnMode('editor');

      if (isPyodideReady) {
          await pyodideService.writeFile(name, newFile.content);
          addConsoleLog('system', `Created file: ${name}`);
      }
  };

  const startRename = (name: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Critical
      setRenamingFile(name);
      setRenameValue(name);
      setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const submitRename = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!renamingFile) return;
      const oldName = renamingFile;
      const newName = renameValue.trim();
      
      if (!newName || newName === oldName) {
          setRenamingFile(null);
          return;
      }

      setFiles(prev => prev.map(f => f.name === oldName ? { ...f, name: newName } : f));
      if (activeTabId === oldName) setActiveTabId(newName);
      setRenamingFile(null);

      if (isPyodideReady) {
          try {
             const fileData = files.find(f => f.name === oldName);
             await pyodideService.writeFile(newName, fileData?.content || "");
             try { await pyodideService.deleteFile(oldName); } catch(e) {}
             addConsoleLog('system', `Renamed ${oldName} -> ${newName}`);
          } catch (e: any) {
             console.error(e);
          }
      }
  };

  // ----- ROBUST DELETE LOGIC -----
  const requestDelete = (name: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFileToDelete(name);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!fileToDelete) return;
      
      const name = fileToDelete;
      
      // Update UI State
      setFiles(prev => prev.filter(f => f.name !== name));
      if (activeTabId === name) setActiveTabId('');
      
      setFileToDelete(null);

      // Async FS Operation
      if (isPyodideReady) {
          try {
              await pyodideService.deleteFile(name);
              addConsoleLog('system', `Deleted ${name}`);
          } catch (e) { console.error("FS Delete failed", e); }
      }
  };

  const cancelDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      setFileToDelete(null);
  };
  // -------------------------------

  const handleUploadWorkspaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) {
              const newFile: FileTab = { name: file.name, content: content, type: file.name.endsWith('.py') ? 'script' : 'data' };
              setFiles(prev => {
                  if (prev.find(f => f.name === file.name)) return prev.map(f => f.name === file.name ? newFile : f);
                  return [...prev, newFile];
              });
              if (isPyodideReady) {
                  await pyodideService.writeFile(file.name, content);
                  addConsoleLog('system', `Uploaded ${file.name}`);
              }
          }
      };
      reader.readAsText(file);
      if (uploadFileRef.current) uploadFileRef.current.value = '';
  };

  const openFile = (name: string) => {
      setActiveTabId(name);
      setMidColumnMode('editor');
  };

  const handleDownloadFile = (fileName: string, content: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleSaveStudy = () => {
      const studyData = { 
          timestamp: Date.now(), 
          files, 
          systemKb, 
          langKb, 
          studyKb, 
          hashMemoryKb, 
          beliefsKb, 
          chatMessages, 
          consoleLogs,
          // Support GLM States
          glmFiles,
          glmChatMessages,
          glmConsoleLogs,
          glmStatus,
          glmChatMode,
          glmEffortTicks
      };
      const blob = new Blob([JSON.stringify(studyData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ubp_study_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleLoadStudy = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              
              // Filter out KBs from the files list if they were accidentally saved there
              if (data.files) {
                  const EXCLUDED = ['ubp_system_kb.md', 'ubp_system_kb.json', 'ubp_beliefs_kb.json', 'ubp_hash_memory_kb.json', 'ubp_study_kb.md', 'ubp_hash_memory_kb.md'];
                  const cleanFiles = data.files.filter((f: FileTab) => !EXCLUDED.includes(f.name));
                  setFiles(cleanFiles);
                  
                  // If active tab was one of the excluded files, switch to first available
                  if (cleanFiles.length > 0) setActiveTabId(cleanFiles[0].name);
                  
                  // Sync files to Pyodide
                  if (isPyodideReady) {
                      for (const f of cleanFiles) await pyodideService.writeFile(f.name, f.content);
                  }
              }

              if (data.systemKb) {
                  setSystemKb(data.systemKb);
                  if (isPyodideReady) await pyodideService.writeFile('ubp_system_kb.json', data.systemKb);
              }
              if (data.langKb) {
                  setLangKb(data.langKb);
                  if (isPyodideReady) await pyodideService.writeFile('ubp_lang_kb_combined_v4.json', data.langKb);
              }
              if (data.beliefsKb) {
                  setBeliefsKb(data.beliefsKb);
                  if (isPyodideReady) await pyodideService.writeFile('ubp_beliefs_kb.json', data.beliefsKb);
              }
              if (data.studyKb) {
                  setStudyKb(data.studyKb);
                  if (isPyodideReady) await pyodideService.writeFile('ubp_study_kb.md', data.studyKb);
              }
              if (data.hashMemoryKb) {
                  setHashMemoryKb(data.hashMemoryKb);
                  if (isPyodideReady) await pyodideService.writeFile('ubp_hash_memory_kb.json', data.hashMemoryKb);
              }
              
              if (data.chatMessages) setChatMessages(data.chatMessages);
              if (data.consoleLogs) setConsoleLogs(data.consoleLogs);

              // Restore GLM states if present in the loaded study
              if (data.glmFiles) {
                  const cleanGlmFiles = data.glmFiles.filter((f: any) => !(f.name.toLowerCase().startsWith('glm_') && !f.name.toLowerCase().endsWith('.json')));
                  setGLMFiles(cleanGlmFiles);
                  if (cleanGlmFiles.length > 0) {
                      setActiveGLMTabId(cleanGlmFiles[0].name);
                  }
                  if (isPyodideReady) {
                      for (const f of cleanGlmFiles) await pyodideService.writeFile(f.name, f.content);
                  }
              }
              if (data.glmChatMessages) setGLMChatMessages(data.glmChatMessages);
              if (data.glmConsoleLogs) setGLMConsoleLogs(data.glmConsoleLogs);
              if (data.glmStatus) setGLMStatus(data.glmStatus);
              if (data.glmChatMode) setGLMChatMode(data.glmChatMode);
              if (data.glmEffortTicks) setGLMEffortTicks(data.glmEffortTicks);
              
              if (isPyodideReady) await fetchFOMState();
              
              alert("Study Loaded Successfully");
          } catch (err) { alert("Failed to load study: Invalid format."); }
      };
      reader.readAsText(file);
      if (loadStudyRef.current) loadStudyRef.current.value = '';
  };

  const downloadCurrentFile = () => {
    let content = "";
    let name = activeTabId;
    if (midColumnMode === 'editor' || midColumnMode === 'files') {
         content = files.find(f => f.name === activeTabId)?.content || "";
    } else if (midColumnMode === 'system') { content = systemKb; name = 'ubp_system_kb.json'; }
    else if (midColumnMode === 'beliefs') { content = beliefsKb; name = 'ubp_beliefs_kb.json'; }
    else if (midColumnMode === 'study') { content = studyKb; name = 'ubp_study_kb.md'; }
    else { content = hashMemoryKb; name = 'ubp_hash_memory_kb.json'; }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetKernel = () => {
    isResettingRef.current = true;
    localStorage.removeItem('ubp_auto_save');
    clearIndexedDB('ubp_auto_save').catch(() => {}).finally(() => {
      window.location.reload();
    });
  };

  const handleSyncKBsFromGitHub = async () => {
    try {
        const sysUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/system_kb/ubp_system_kb.json';
        const langUrl = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_lang_kb_combined_v4.json';
        
        const [sysRes, langRes] = await Promise.all([
            fetch(sysUrl).catch(() => null),
            fetch(langUrl).catch(() => null)
        ]);

        if (sysRes?.ok) {
            const text = await sysRes.text();
            setSystemKb(text);
            if (isPyodideReady) await pyodideService.writeFile('ubp_system_kb.json', text);
        }
        if (langRes?.ok) {
            const text = await langRes.text();
            setLangKb(text);
            if (isPyodideReady) await pyodideService.writeFile('ubp_lang_kb_combined_v4.json', text);
        }
        addConsoleLog('system', 'Successfully synced Knowledge Bases from GitHub.');
    } catch (err) {
        addConsoleLog('error', 'Failed to sync Knowledge Bases from GitHub.');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-white overflow-hidden font-sans">
      {/* GLOBAL HEADER */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between h-14 shrink-0">
        <div className="flex items-center gap-3">
          <UBPLogo />
          <div>
            <h1 className="text-lg font-bold text-cyan-400 leading-tight">UBP Core Studio v5</h1>
            <div className="text-[10px] text-gray-500">Reflexive Memory • Frame of Mind • Local AI</div>
          </div>
        </div>

        {/* WORKSPACE MODE SWITCHER */}
        <div className="flex bg-[#161412] rounded p-0.5 border border-[#2d251f]">
           <button 
              onClick={() => setCurrentStudioMode('ubp')} 
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${currentStudioMode === 'ubp' ? 'bg-cyan-600 text-black shadow-[0_0_10px_rgba(8,145,178,0.3)]' : 'text-gray-400 hover:text-white'}`}
           >
              🧬 UBP Studio
           </button>
           <button 
              onClick={() => setCurrentStudioMode('glm')} 
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${currentStudioMode === 'glm' ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-gray-400 hover:text-white'}`}
           >
              📐 GLM Workspace
           </button>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
                <button onClick={handleSaveStudy} className="px-3 py-1 text-xs hover:bg-gray-700 rounded flex items-center gap-1 text-gray-300">
                    💾 Save Study
                </button>
                <div className="w-px bg-gray-700 mx-1"></div>
                <button onClick={() => loadStudyRef.current?.click()} className="px-3 py-1 text-xs hover:bg-gray-700 rounded flex items-center gap-1 text-gray-300">
                    📂 Load Study
                </button>
                <div className="w-px bg-gray-700 mx-1"></div>
                <button onClick={() => setShowResetConfirm(true)} className="px-3 py-1 text-xs hover:bg-red-900/50 rounded flex items-center gap-1 text-red-400">
                    🔄 Reset
                </button>
                <input type="file" ref={loadStudyRef} onChange={handleLoadStudy} accept=".json" className="hidden" />
             </div>
             <div className={`px-2 py-1 rounded text-[10px] border ${isPyodideReady ? 'border-green-800 bg-green-900/30 text-green-400' : 'border-red-800 bg-red-900/30 text-red-400'}`}>
                {isPyodideReady ? 'KERNEL ONLINE' : 'INITIALIZING...'}
             </div>
        </div>
      </div>

      {/* MOBILE NAVIGATION BAR (Visible only on small screens) */}
      <div className="md:hidden flex border-b border-gray-800 bg-[#111]">
         <button onClick={() => setMobileTab('chat')} className={`flex-1 py-2 text-xs font-bold uppercase ${mobileTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}`}>Assistant</button>
         <button onClick={() => setMobileTab('workspace')} className={`flex-1 py-2 text-xs font-bold uppercase ${mobileTab === 'workspace' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>Workspace</button>
         <button onClick={() => setMobileTab('tools')} className={`flex-1 py-2 text-xs font-bold uppercase ${mobileTab === 'tools' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>Tools</button>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative">
      
        {currentStudioMode === 'ubp' ? (
          <>
            {/* LEFT COLUMN: CHAT */}
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-[30%] md:min-w-[350px] flex-col border-r border-gray-800 pb-2`}>
           <AIProviderSelector 
              selectedProvider={aiProvider}
              selectedModel={selectedModel}
              onProviderChange={setAiProvider}
              onModelChange={setSelectedModel}
           />
           <div className="flex-1 min-h-0 relative">
               <ChatInterface 
                  messages={chatMessages}
                  isLoading={isChatLoading}
                  onSendMessage={handleSendMessage}
                  onExtractCode={handleExtractCode}
                  onExtractToKB={handleExtractToKB}
                  onResetKernel={handleResetKernel}
               />
           </div>
        </div>

        {/* MIDDLE COLUMN: EDITOR / KB */}
        <div className={`${mobileTab === 'workspace' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-[300px] border-r border-gray-800 bg-[#151515] pb-2`}>
           {/* Mid Toolbar */}
           <div className="h-12 bg-[#1a1a1a] border-b border-gray-800 flex items-center px-2 justify-between">
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                  <button onClick={() => setMidColumnMode('files')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${midColumnMode === 'files' ? 'bg-[#252525] text-white border-t-2 border-gray-300' : 'text-gray-500 hover:text-gray-300'}`}>Files</button>
                  <button onClick={() => setMidColumnMode('editor')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${midColumnMode === 'editor' ? 'bg-[#252525] text-white border-t-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}>Editor</button>
                  <button onClick={() => setMidColumnMode('system')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${midColumnMode === 'system' ? 'bg-[#252525] text-white border-t-2 border-green-500' : 'text-gray-500 hover:text-gray-300'}`}>System</button>
                  <button onClick={() => setMidColumnMode('beliefs')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${midColumnMode === 'beliefs' ? 'bg-[#252525] text-white border-t-2 border-pink-500' : 'text-gray-500 hover:text-gray-300'}`}>Beliefs</button>
                  <button onClick={() => setMidColumnMode('study')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${midColumnMode === 'study' ? 'bg-[#252525] text-white border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>Study</button>
                  <button onClick={() => setMidColumnMode('hash')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${midColumnMode === 'hash' ? 'bg-[#252525] text-white border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Hash</button>
              </div>
              <div className="flex items-center gap-2">
                 {midColumnMode === 'editor' && (
                     <>
                        <button onClick={downloadCurrentFile} className="p-1 hover:bg-gray-700 rounded text-blue-400" title="Download Current File">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                        <button 
                          onClick={handleRunCode}
                          disabled={!isPyodideReady || isExecuting}
                          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(21,128,61,0.4)]"
                        >
                          {isExecuting ? 'Running...' : '▶ Run'}
                        </button>
                     </>
                 )}
              </div>
           </div>

           {/* Mid Content */}
           <div className="flex-1 overflow-hidden relative">
               {midColumnMode === 'files' && (
                   <div className="flex flex-col h-full bg-[#111] p-4">
                       <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                           <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Workspace Explorer</h3>
                           <div className="flex gap-2">
                               <button onClick={startCreateFile} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white border border-gray-600">
                                   + New Script
                               </button>
                               <button onClick={() => uploadFileRef.current?.click()} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-blue-300 border border-blue-900/50">
                                   ↑ Upload File
                               </button>
                               <input type="file" ref={uploadFileRef} onChange={handleUploadWorkspaceFile} className="hidden" accept=".py,.txt,.md,.json" />
                           </div>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto space-y-1 p-2">
                            {/* NEW FILE INPUT ROW */}
                            {isCreatingFile && (
                                <form onSubmit={submitCreateFile} className="flex items-center p-2 rounded bg-gray-800 border border-green-600 mb-2">
                                    <input 
                                        ref={newFileInputRef}
                                        type="text" 
                                        className="flex-1 bg-transparent text-xs text-white focus:outline-none font-mono"
                                        placeholder="script.py"
                                        value={newFileName}
                                        onChange={(e) => setNewFileName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Escape' && setIsCreatingFile(false)}
                                        onBlur={() => !newFileName && setIsCreatingFile(false)}
                                    />
                                    <div className="flex items-center gap-1">
                                        <button type="submit" className="text-green-400 hover:text-green-300 text-xs px-2">✓</button>
                                        <button type="button" onClick={() => setIsCreatingFile(false)} className="text-gray-500 hover:text-gray-300 text-xs px-1">✕</button>
                                    </div>
                                </form>
                            )}

                            {files.length === 0 && !isCreatingFile && (
                                <div className="text-center text-gray-600 italic mt-10">No files in workspace.</div>
                            )}
                            
                            {files.map(f => (
                                <div key={f.name} className={`flex items-center justify-between p-2 rounded group border ${activeTabId === f.name ? 'bg-gray-800 border-gray-600' : 'bg-[#151515] border-transparent hover:bg-[#1a1a1a] hover:border-gray-800'}`}>
                                    
                                    {/* DELETE CONFIRMATION MODE */}
                                    {fileToDelete === f.name ? (
                                        <div className="flex-1 flex items-center justify-between bg-red-900/20 rounded p-1">
                                            <span className="text-xs text-red-300 font-bold ml-1">Delete {f.name}?</span>
                                            <div className="flex gap-2">
                                                <button onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-0.5 rounded font-bold">Yes</button>
                                                <button onClick={cancelDelete} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-0.5 rounded">No</button>
                                            </div>
                                        </div>
                                    ) : renamingFile === f.name ? (
                                        <form onSubmit={submitRename} className="flex-1 flex items-center gap-2">
                                            <input
                                                ref={renameInputRef}
                                                type="text"
                                                className="flex-1 bg-black text-xs text-white border border-blue-500 rounded px-1 py-0.5 font-mono focus:outline-none"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Escape' && setRenamingFile(null)}
                                                onBlur={submitRename}
                                            />
                                        </form>
                                    ) : (
                                        <div 
                                            onClick={() => openFile(f.name)} 
                                            className="flex-1 cursor-pointer flex items-center gap-2 truncate pr-2 select-none"
                                        >
                                            <span className={`text-xs font-mono ${activeTabId === f.name ? 'text-white font-bold' : 'text-blue-400'}`}>
                                                {f.name}
                                            </span>
                                            <span className="text-[9px] text-gray-600 bg-black/30 px-1 rounded uppercase">{f.type}</span>
                                        </div>
                                    )}
                                    
                                    {/* ACTION BUTTONS */}
                                    <div className="flex items-center gap-1">
                                        {renamingFile === f.name || fileToDelete === f.name ? null : (
                                            <>
                                                <button 
                                                    onClick={(e) => handleDownloadFile(f.name, f.content, e)}
                                                    className="p-1.5 text-gray-500 hover:text-green-400 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer border border-transparent hover:border-gray-600"
                                                    title="Download"
                                                    type="button"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                </button>
                                                <button 
                                                    onClick={(e) => startRename(f.name, e)}
                                                    className="p-1.5 text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 rounded cursor-pointer border border-transparent hover:border-gray-600"
                                                    title="Rename"
                                                    type="button"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={(e) => requestDelete(f.name, e)}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-800 hover:bg-red-900/20 rounded cursor-pointer border border-transparent hover:border-red-900/30"
                                                    title="Delete"
                                                    type="button"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                   </div>
               )}

               {midColumnMode === 'editor' && (
                   <div className="flex flex-col h-full min-h-0">
                       <div className="flex-1 relative min-h-0">
                          {files.find(f => f.name === activeTabId) ? (
                              <CodeEditor code={files.find(f => f.name === activeTabId)?.content || ''} onChange={(val) => updateFileContent(activeTabId, val)} label={activeTabId} />
                          ) : (
                              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                                  <span>No file open.</span>
                                  <button onClick={() => setMidColumnMode('files')} className="text-blue-500 hover:underline">Go to Files</button>
                              </div>
                          )}
                       </div>
                   </div>
               )}
               {midColumnMode === 'system' && <CodeEditor code={systemKb} onChange={setSystemKb} label="ubp_system_kb.json" />}
               {midColumnMode === 'beliefs' && <CodeEditor code={beliefsKb} onChange={setBeliefsKb} label="ubp_beliefs_kb.json" />}
               {midColumnMode === 'study' && <CodeEditor code={studyKb} onChange={setStudyKb} label="ubp_study_kb.md" />}
               {midColumnMode === 'hash' && <CodeEditor code={hashMemoryKb} onChange={setHashMemoryKb} label="ubp_hash_memory_kb.json" />}
           </div>
        </div>

        {/* RIGHT COLUMN: OUTPUT / TOOLS */}
        <div className={`${mobileTab === 'tools' ? 'flex' : 'hidden'} md:flex w-full md:w-[25%] md:min-w-[300px] flex-col border-l border-gray-800 bg-[#111] pb-2`}>
            <div className="h-12 bg-[#1a1a1a] border-b border-gray-800 flex items-center px-2 gap-1">
               <button onClick={() => setActiveOutputTab('console')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase ${activeOutputTab === 'console' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Console</button>
               <button onClick={() => setActiveOutputTab('visual')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase ${activeOutputTab === 'visual' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Visual</button>
               <button onClick={() => setActiveOutputTab('memory')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase ${activeOutputTab === 'memory' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Mem Status</button>
               <button onClick={() => setActiveOutputTab('fom')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase ${activeOutputTab === 'fom' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>FOM</button>
            </div>

            <div className="flex-1 overflow-hidden p-2">
                {activeOutputTab === 'console' && <ConsoleOutput logs={consoleLogs} />}
                {activeOutputTab === 'visual' && (
                    <div className="h-full flex flex-col gap-2">
                        {scene3dData ? (
                            <div className="flex-1 border border-gray-700 rounded overflow-hidden">
                                <ThreeViewer data={scene3dData} />
                            </div>
                        ) : generatedImage ? (
                            <div className="flex-1 border border-gray-700 rounded overflow-hidden flex items-center justify-center bg-black">
                                <img src={`data:image/png;base64,${generatedImage}`} alt="Output" className="max-w-full max-h-full" />
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 mt-10">No Visualization Data</div>
                        )}
                    </div>
                )}
                {activeOutputTab === 'memory' && (
                    <MemoryStatus 
                        systemKb={systemKb} 
                        langKb={langKb} 
                        hashMemoryKb={hashMemoryKb} 
                        beliefsKb={beliefsKb} 
                        studyKb={studyKb} 
                        onSyncGitHub={handleSyncKBsFromGitHub}
                        setSystemKb={setSystemKb}
                        setLangKb={setLangKb}
                        setHashMemoryKb={setHashMemoryKb}
                        setBeliefsKb={setBeliefsKb}
                        setStudyKb={setStudyKb}
                    />
                )}
                {activeOutputTab === 'fom' && <FOMStatus isPyodideReady={isPyodideReady} frames={fomFrames} activeFrameId={activeFrame} onSwitchFrame={handleSwitchFrame} onUpdateFrameJson={handleUpdateFOMJson} onDeleteFrame={handleDeleteFrame} onRefresh={fetchFOMState} onExportFOM={() => { const blob = new Blob([JSON.stringify(fomFrames, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ubp_fom_index.json'; a.click(); }} onImportFOM={handleImportFOM} />}
            </div>
          </div>
        </>
      ) : (
        <>
            {/* GLM COLUMN 1: GLM Chat / Reasoner Interface */}
            <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-[30%] md:min-w-[350px] flex-col border-r border-amber-950/30 bg-[#0c0907] pb-2`}>
               {/* GLM Provider Selector / Mode Switcher */}
               <div className="bg-[#15110d] border-b border-amber-950/20 p-3">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">GLM Reasoner Mode</span>
                     <div className="flex bg-black rounded p-0.5 border border-amber-950/40">
                        <button 
                           onClick={() => setGLMChatMode('standard')} 
                           className={`px-2 py-1 rounded text-[10px] font-bold ${glmChatMode === 'standard' ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'text-gray-400'}`}
                        >
                           Standard
                        </button>
                        <button 
                           onClick={() => setGLMChatMode('effort')} 
                           className={`px-2 py-1 rounded text-[10px] font-bold ${glmChatMode === 'effort' ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'text-gray-400'}`}
                        >
                           With Effort
                        </button>
                     </div>
                  </div>
                  {glmChatMode === 'effort' && (
                     <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-950/10 text-[11px]">
                        <span className="text-gray-400">Max Maturation Ticks:</span>
                        <div className="flex items-center gap-2">
                           <input 
                              type="range" 
                              min="1" 
                              max="10" 
                              value={glmEffortTicks} 
                              onChange={(e) => setGLMEffortTicks(parseInt(e.target.value))} 
                              className="w-24 h-1 bg-amber-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                           />
                           <span className="font-mono text-amber-400 font-bold w-4">{glmEffortTicks}</span>
                        </div>
                     </div>
                  )}
               </div>

               {/* GLM Action Shortcuts */}
               <div className="p-2 bg-[#120f0c] border-b border-amber-950/20">
                  <button 
                     onClick={bootGLMRuntime} 
                     disabled={glmStatus === 'booting'}
                     className={`w-full py-2 text-xs font-bold uppercase rounded border transition-all ${glmStatus === 'online' ? 'bg-green-950/40 text-green-400 border-green-800/40' : 'bg-amber-950/20 text-amber-400 border-amber-900/30 hover:bg-amber-900/30'}`}
                  >
                     {glmStatus === 'online' ? '🟢 GLM Ready & Online' : glmStatus === 'booting' ? '⌛ Booting...' : '🔌 Boot GLM Runtime'}
                  </button>
               </div>

               {/* GLM Chat Interface */}
               <div className="flex-1 min-h-0 relative">
                   <GLMChatInterface 
                      messages={glmChatMessages}
                      isLoading={isGLMChatLoading}
                      onSendMessage={handleSendGLMMessage}
                      onResetGLM={async () => {
                        setGLMChatMessages([{ id: 'glm-welcome', role: 'model', content: 'GLM Chat reset. Boot GLM to start fresh.', timestamp: Date.now() }]);
                        addGLMConsoleLog('system', "Resetting GLM Session...");
                        await pyodideService.runPython("if 'glm_rt' in globals(): del globals()['glm_rt']");
                        setGLMStatus('offline');
                      }}
                      glmStatus={glmStatus}
                      chatMode={glmChatMode}
                       onExportWorkspace={handleExportWorkspace}
                       onImportWorkspace={handleImportWorkspace}
                   />
               </div>
            </div>

            {/* GLM COLUMN 2: GLM Workspace (Files & Script Editor) */}
            <div className={`${mobileTab === 'workspace' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-[300px] border-r border-amber-950/30 bg-[#0b0806] pb-2`}>
               {/* GLM Workspace Toolbar */}
               <div className="h-12 bg-[#120f0d] border-b border-amber-950/20 flex items-center px-2 justify-between">
                  <div className="flex gap-1 overflow-x-auto scrollbar-none">
                      <button onClick={() => setGLMMidColumnMode('files')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${glmMidColumnMode === 'files' ? 'bg-[#1b1511] text-amber-400 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>GLM Files</button>
                      <button onClick={() => setGLMMidColumnMode('editor')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${glmMidColumnMode === 'editor' ? 'bg-[#1b1511] text-amber-400 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>GLM Editor</button>
                  </div>

                  <div className="flex items-center gap-2">
                     {glmMidColumnMode === 'editor' && activeGLMTabId && (
                         <button
                            onClick={handleRunGLMCode}
                            disabled={isGLMExecuting}
                            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 shadow-[0_0_10px_rgba(217,119,6,0.2)]"
                         >
                            ▶️ Run Code
                         </button>
                     )}
                     <button 
                        onClick={runGLMSelfTests}
                        disabled={isGLMExecuting}
                        className="bg-amber-950/40 hover:bg-amber-900/50 text-amber-400 px-2.5 py-1 text-xs font-bold rounded border border-amber-900/30 flex items-center gap-1"
                        title="Execute the 12 built-in self-tests of GLM v3.7.3"
                     >
                        🧪 Self-Tests
                     </button>
                     <button 
                        onClick={async () => {
                          addGLMConsoleLog('system', "Syncing GLM files from GitHub...");
                          const fetched = await fetchGLMFolderRecursive('core_studio_v4.0/GLM');
                          if (fetched.length > 0) {
                            setGLMFiles(fetched);
                            addGLMConsoleLog('system', `Successfully pulled ${fetched.length} files.`);
                          }
                        }}
                        className="p-1 hover:bg-amber-950/30 text-amber-500/80 hover:text-amber-400 rounded transition-all"
                        title="Reload all GLM files from repository"
                     >
                        🔄
                     </button>
                  </div>
               </div>

               {/* GLM Workspace Content */}
               <div className="flex-1 min-h-0">
                   {glmMidColumnMode === 'files' ? (
                       <div id="glm-file-explorer" className="p-4 flex flex-col h-full overflow-y-auto">
                          <div className="flex justify-between items-center mb-3">
                             <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">GLM Files Workspace</h3>
                             <div className="flex gap-1.5">
                                 <button onClick={startCreateGLMFile} className="bg-amber-950/30 border border-amber-900/30 hover:bg-amber-900/40 text-amber-400 px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1">
                                     ➕ New File
                                 </button>
                                 <button onClick={() => glmUploadFileRef.current?.click()} className="bg-amber-950/30 border border-amber-900/30 hover:bg-amber-900/40 text-amber-400 px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1">
                                     📤 Upload
                                 </button>
                                 <input type="file" ref={glmUploadFileRef} onChange={handleUploadGLMFile} className="hidden" />
                             </div>
                          </div>

                          {isGLMCreatingFile && (
                              <form onSubmit={submitCreateGLMFile} className="mb-3 flex gap-2">
                                 <input 
                                    ref={glmNewFileInputRef}
                                    type="text" 
                                    placeholder="filename.py" 
                                    value={newGLMFileName} 
                                    onChange={(e) => setNewGLMFileName(e.target.value)} 
                                    className="flex-1 bg-black text-sm text-gray-100 rounded px-2 py-1 border border-amber-800"
                                 />
                                 <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-3 py-1 rounded text-xs">Create</button>
                                 <button type="button" onClick={() => setIsGLMCreatingFile(false)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">Cancel</button>
                              </form>
                          )}

                          <div className="flex-1 overflow-y-auto space-y-1">
                              {glmFiles.length === 0 ? (
                                  <div className="text-center text-xs text-gray-500 py-10">No GLM files loaded. Pull from repository or create one.</div>
                              ) : (
                                  glmFiles.map(file => {
                                      const isActive = activeGLMTabId === file.name;
                                      const isRenaming = renamingGLMFile === file.name;
                                      const isPendingDelete = glmFileToDelete === file.name;

                                      return (
                                          <div 
                                             key={file.name} 
                                             onClick={() => openGLMFile(file.name)}
                                             className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${isActive ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' : 'border-transparent text-gray-400 hover:bg-amber-950/10 hover:text-amber-300'}`}
                                          >
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                  <span className="text-sm">📁</span>
                                                  {isRenaming ? (
                                                      <form onSubmit={submitRenameGLM} onClick={e => e.stopPropagation()} className="flex-1 flex gap-1">
                                                          <input 
                                                             ref={glmRenameInputRef}
                                                             type="text" 
                                                             value={renameGLMValue} 
                                                             onChange={e => setRenameGLMValue(e.target.value)}
                                                             className="bg-black text-xs text-gray-100 rounded px-1.5 py-0.5 border border-amber-800 flex-1"
                                                          />
                                                          <button type="submit" className="text-[10px] bg-amber-600 text-black px-1.5 rounded font-bold">Ok</button>
                                                          <button type="button" onClick={() => setRenamingGLMFile(null)} className="text-[10px] bg-gray-800 text-gray-300 px-1.5 rounded">X</button>
                                                      </form>
                                                  ) : (
                                                      <span className="text-sm font-mono truncate">{file.name}</span>
                                                  )}
                                              </div>

                                              <div className="flex items-center gap-2 shrink-0 pl-2">
                                                  {isPendingDelete ? (
                                                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                          <button onClick={confirmDeleteGLM} className="text-[10px] text-red-400 font-bold bg-red-950/40 border border-red-900/30 px-1.5 py-0.5 rounded">Delete</button>
                                                          <button onClick={cancelDeleteGLM} className="text-[10px] text-gray-400 hover:text-gray-200">Cancel</button>
                                                      </div>
                                                  ) : (
                                                      <>
                                                          {/* Individual file download button */}
                                                          <button 
                                                             onClick={(e) => handleDownloadGLMFile(file.name, file.content, e)}
                                                             className="p-1 hover:bg-amber-900/20 text-amber-500 hover:text-amber-400 rounded transition-all"
                                                             title="Download individual file"
                                                          >
                                                             ⬇️
                                                          </button>
                                                          <button 
                                                             onClick={(e) => startRenameGLM(file.name, e)}
                                                             className="p-1 hover:bg-amber-900/20 text-gray-500 hover:text-amber-400 rounded transition-all text-xs"
                                                             title="Rename file"
                                                          >
                                                             ✏️
                                                          </button>
                                                          <button 
                                                             onClick={(e) => requestDeleteGLM(file.name, e)}
                                                             className="p-1 hover:bg-red-950/20 text-gray-500 hover:text-red-400 rounded transition-all text-xs"
                                                             title="Delete file"
                                                          >
                                                             🗑️
                                                          </button>
                                                      </>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })
                              )}
                          </div>
                       </div>
                   ) : (
                       <div id="glm-editor" className="flex flex-col h-full bg-[#070504]">
                          {activeGLMTabId ? (
                              <div className="flex-1 flex flex-col overflow-hidden">
                                 <div className="px-3 py-1.5 bg-[#120e0b] border-b border-amber-950/20 flex justify-between items-center shrink-0">
                                     <span className="text-xs font-mono text-amber-400/80 font-bold flex items-center gap-1">📝 Editing: {activeGLMTabId}</span>
                                     <button 
                                        onClick={(e) => handleDownloadGLMFile(activeGLMTabId, glmFiles.find(f => f.name === activeGLMTabId)?.content || "", e)}
                                        className="text-[10px] bg-amber-950/30 text-amber-400 hover:bg-amber-900/20 px-2 py-1 rounded border border-amber-900/30 flex items-center gap-1"
                                     >
                                        ⬇️ Download File
                                     </button>
                                 </div>
                                 <div className="flex-1 overflow-hidden relative">
                                     <CodeEditor 
                                        label={activeGLMTabId}
                                        code={glmFiles.find(f => f.name === activeGLMTabId)?.content || ""}
                                        onChange={(newVal) => updateGLMFileContent(activeGLMTabId, newVal)}
                                     />
                                 </div>
                              </div>
                          ) : (
                              <div className="flex-1 flex items-center justify-center text-xs text-gray-500 py-10 bg-black/40">
                                 Select a script from GLM Files to view or edit
                              </div>
                          )}
                       </div>
                   )}
               </div>
            </div>

            {/* GLM COLUMN 3: GLM Active Outputs & Logs (Interactive Diagnostics Engine) */}
            <div className={`${mobileTab === 'tools' ? 'flex' : 'hidden'} md:flex w-full md:w-[35%] md:min-w-[380px] flex-col bg-[#080604] pb-2`}>
               {/* Tab bar */}
               <div className="h-12 bg-[#120f0d] border-b border-amber-950/20 flex items-center px-2 justify-between shrink-0">
                  <div className="flex gap-1 overflow-x-auto scrollbar-none">
                      <button onClick={() => setActiveGLMOutputTab('console')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${activeGLMOutputTab === 'console' ? 'bg-[#1b1511] text-amber-400 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>Console Output</button>
                      <button onClick={() => setActiveGLMOutputTab('diagnostics')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${activeGLMOutputTab === 'diagnostics' ? 'bg-[#1b1511] text-amber-400 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>Live Diagnostics</button>
                      <button onClick={() => setActiveGLMOutputTab('visual')} className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider ${activeGLMOutputTab === 'visual' ? 'bg-[#1b1511] text-amber-400 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>Constellation</button>
                  </div>
                  <div className="flex items-center gap-1.5 pr-1">
                     {activeGLMOutputTab === 'console' && (
                         <button 
                            onClick={() => setGLMConsoleLogs([])} 
                            className="text-[10px] bg-amber-950/20 hover:bg-amber-900/20 border border-amber-900/20 text-amber-500 hover:text-amber-400 px-2 py-0.5 rounded"
                         >
                            Clear
                         </button>
                     )}
                     <button 
                        onClick={updateGLMStates} 
                        className="p-1 hover:bg-amber-950/30 text-amber-500/80 hover:text-amber-400 rounded transition-all"
                        title="Refresh diagnostics variables"
                     >
                        🔄
                     </button>
                  </div>
               </div>

               {/* Content area */}
               <div className="flex-1 min-h-0 relative">
                  {activeGLMOutputTab === 'console' && (
                      <div id="glm-console" className="h-full flex flex-col bg-black overflow-hidden relative font-mono text-xs text-amber-400">
                         <div className="flex-1 overflow-y-auto p-3 space-y-1 select-text scrollbar-thin">
                            {glmConsoleLogs.length === 0 ? (
                                <div className="text-gray-600 text-[11px] italic">{">>>"} Console inactive. Executing operations or boot will output logs here...</div>
                            ) : (
                                glmConsoleLogs.map((log) => {
                                   let color = "text-amber-400";
                                   let prefix = ">>>";
                                   if (log.type === "stderr" || log.type === "error") { color = "text-red-400"; prefix = "⚠️"; }
                                   else if (log.type === "system") { color = "text-amber-500 font-bold"; prefix = "⚙️"; }
                                   
                                   return (
                                       <div key={log.id} className={`${color} leading-relaxed whitespace-pre-wrap`}>
                                           <span className="opacity-50 select-none mr-2">{prefix}</span>
                                           {log.content}
                                       </div>
                                   );
                                })
                            )}
                         </div>
                      </div>
                  )}
                  {activeGLMOutputTab === 'diagnostics' && (
                      <div id="glm-diagnostics" className="h-full overflow-y-auto p-4 space-y-4 bg-[#0a0806] scrollbar-thin">
                          {/* Active Zone State */}
                          <div className="border border-amber-900/30 bg-amber-950/5 rounded-lg p-3">
                             <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2 font-mono flex items-center gap-1.5">🎛️ Geometric Last Diagnostics</h4>
                             <div className="bg-black/40 border border-amber-900/20 rounded p-2.5 max-h-56 overflow-y-auto font-mono text-[11px] text-amber-300/80">
                                {glmLastDiag ? (
                                    <pre className="whitespace-pre-wrap">{glmLastDiag}</pre>
                                ) : (
                                    <span className="text-gray-600 italic">No diagnostic state captured. Ask the reasoner a question or boot the machine to fetch variables.</span>
                                )}
                             </div>
                          </div>

                          {/* Active Idea Matrix */}
                          <div className="border border-amber-900/30 bg-amber-950/5 rounded-lg p-3">
                             <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2 font-mono flex items-center gap-1.5">🗺️ Current Metatheoretical State</h4>
                             <div className="bg-black/40 border border-amber-900/20 rounded p-2.5 max-h-56 overflow-y-auto font-mono text-[11px] text-amber-300/80">
                                {glmIdeaState ? (
                                    <pre className="whitespace-pre-wrap">{glmIdeaState}</pre>
                                ) : (
                                    <span className="text-gray-600 italic">No metatheoretical state captured.</span>
                                )}
                             </div>
                          </div>
                      </div>
                  )}
                  {activeGLMOutputTab === 'visual' && (
                      <div id="glm-visual" className="h-full overflow-y-auto p-4 space-y-4 bg-[#0a0806] scrollbar-thin flex flex-col items-center justify-center">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-amber-500 mb-2 font-mono flex items-center gap-1.5">✨ Concept Constellation Visualization</h4>
                          
                          {glmIdeaState ? (
                              <div className="w-full flex-1 flex flex-col items-center justify-center border border-amber-900/30 bg-black/40 rounded-lg p-4">
                                  <GLMConstellation stateJson={glmIdeaState} />
                              </div>
                          ) : (
                              <div className="text-gray-600 italic font-mono text-xs">No data to visualize. Fetch idea state first.</div>
                          )}
                      </div>
                  )}
               </div>
            </div>
        </>
      )}
    </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-red-400 mb-2">Reset Session?</h3>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to reset the session? All unsaved progress will be lost and the default GitHub files will be restored.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={handleResetKernel}
                className="px-4 py-2 rounded text-sm bg-red-900/80 hover:bg-red-800 text-white"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
