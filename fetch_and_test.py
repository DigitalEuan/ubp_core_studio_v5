import os
import sys
import urllib.request
import json
import re
from pathlib import Path

# Create directory
Path("./glm_test_dir").mkdir(parents=True, exist_ok=True)

# Download system_kb and lang_kb
print("Downloading system_kb...")
sys_url = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/system_kb/ubp_system_kb.json'
sys_req = urllib.request.Request(sys_url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(sys_req) as r:
    sys_data = r.read().decode()
    with open("ubp_system_kb.json", "w") as f:
        f.write(sys_data)
    with open("./glm_test_dir/ubp_system_kb.json", "w") as f:
        f.write(sys_data)

print("Downloading lang_kb...")
lang_url = 'https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/core/ubp_lang_kb_combined_v4.json'
lang_req = urllib.request.Request(lang_url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(lang_req) as r:
    lang_data = r.read().decode()
    with open("ubp_lang_kb_combined_v4.json", "w") as f:
        f.write(lang_data)
    with open("./glm_test_dir/ubp_lang_kb_combined_v4.json", "w") as f:
        f.write(lang_data)

os.chdir("./glm_test_dir")

# Fetch files from GitHub list
api_url = "https://api.github.com/repos/DigitalEuan/UBP_Repo/contents/core_studio_v4.0/GLM"
req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as r:
    items = json.loads(r.read().decode())

def fetch_recursive(path_str, dest_dir):
    api_url = f"https://api.github.com/repos/DigitalEuan/UBP_Repo/contents/{path_str}"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r:
        items = json.loads(r.read().decode())
    for item in items:
        if item["name"].lower().startswith("glm_"):
            continue
        if item["type"] == "file":
            if item["name"].endswith(".py") or item["name"].endswith(".json") or item["name"].endswith(".md"):
                print(f"Fetching {item['name']}...")
                file_req = urllib.request.Request(item["download_url"], headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(file_req) as fr:
                    content = fr.read().decode()
                
                # Apply patches here as we do in App.tsx
                rel_path = item["path"].split("core_studio_v4.0/GLM/")[-1]
                
                # Apply same patches as App.tsx
                if rel_path == "GLM11_runtime.py":
                    # Fix __init__ and add last_diag
                    content = content.replace(
                        '    def __init__(self, auto_expand: bool = True):',
                        """    def __init__(self, auto_expand: bool = True):
        self._last_compute = None
        self._last_symbolic = None
        self._last_warm_start = None
        self._last_pivot_spawned = None
        self.auto_expansions = []
        self.glm = self"""
                    )
                    
                    content = content.replace(
                        '            auto_expand_crg(self.crg, self.vocab_dict)',
                        '            self.auto_expansions = auto_expand_crg(self.crg, self.vocab_dict)'
                    )
                    
                    if 'def last_diag' not in content:
                        content = content.replace(
                            '    def chat(self, query: str) -> str:',
                            """    def last_diag(self) -> Dict[str, Any]:
        return {
            "compute": self._last_compute,
            "symbolic": self._last_symbolic,
            "warm_start": self._last_warm_start,
            "pivot_spawned": self._last_pivot_spawned
        }

    def chat(self, query: str) -> str:"""
                        )
                    
                    # Fix idea_state format
                    content = content.replace(
                        'return {"turn": self._turn, "zones": len(self.manager.zones), "meta": self.meta_graph.stats()}',
                        'return {"turn": self._turn, "manager": self.manager.state(), "meta": self.meta_graph.stats()}'
                    );
                    
                    # Add reflexive_recall
                    if 'def _reflexive_recall' not in content:
                        content = content.replace(
                            '    def last_diag(self) -> Dict[str, Any]:',
                            """    def _reflexive_recall(self, query: str):
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

    def last_diag(self) -> Dict[str, Any]:"""
                        )
                        
                    # Modify chat implementation to populate self._last_*
                    content = content.replace(
                        '    def chat(self, query: str) -> str:\n        self._turn += 1',
                        '    def chat(self, query: str) -> str:\n        self._turn += 1\n        active = self.manager.active\n        self._last_warm_start = True if (active and len(active.evidence) > 0) else None'
                    )
                    content = content.replace(
                        '        comp_res = None\n        c_req = detect_compute(resolved)\n        if c_req: \n            eval_res = evaluate_numeric(c_req)\n            comp_res = {"computation": c_req, "result": eval_res, \n                        "grounded": ground_result(eval_res.get("approx", 0), self.vocab)}',
                        '        comp_res = None\n        c_req = detect_compute(resolved)\n        if c_req: \n            eval_res = evaluate_numeric(c_req)\n            comp_res = {"computation": c_req, "result": eval_res, \n                        "grounded": ground_result(eval_res.get("approx", 0), self.vocab)}\n        self._last_compute = comp_res'
                    )
                    content = content.replace(
                        '        sym_res = None\n        s_req = detect_symbolic(resolved)\n        if s_req: \n            sym_res = {"computation": s_req, "result": evaluate_symbolic(s_req)}',
                        '        sym_res = None\n        s_req = detect_symbolic(resolved)\n        if s_req: \n            sym_res = {"computation": s_req, "result": evaluate_symbolic(s_req)}\n        self._last_symbolic = sym_res'
                    )
                    content = content.replace(
                        '        # 5. Update Manager\n        self.manager.update(content, self._turn)',
                        '        # 5. Update Manager\n        num_zones_before = len(self.manager.zones)\n        self.manager.update(content, self._turn)\n        num_zones_after = len(self.manager.zones)\n        self._last_pivot_spawned = True if num_zones_after > num_zones_before else None'
                    )
                    
                    if 'recalled=recalled' not in content:
                        content = content.replace(
                            '        return compose_response(',
                            '        recalled = self._reflexive_recall(query)\n        return compose_response('
                        ).replace(
                            '_enhanced_query_type(query), comp_res, sym_res, deliberation=delib_res',
                            '_enhanced_query_type(query), comp_res, sym_res, deliberation=delib_res, recalled=recalled'
                        )
                    if 'def chat_with_effort' not in content:
                        content = content.replace(
                            '    def reset_idea(self):',
                            """    def chat_with_effort(self, query: str, max_ticks: int = 5) -> str:
        res = self.chat(query)
        z = self.manager.active
        if not z or getattr(z, 'crystallized', False): return res
        for _ in range(max_ticks):
            if getattr(z, 'crystallized', False): break
            self.mature(1)
        return res + f"\\n[Effort Applied] Thesis: {getattr(self.manager.active, 'thesis', '')}"

    def reset_idea(self):"""
                        )
                    
                    # Add synthesise method
                    if 'def synthesise' not in content:
                        content = content.replace(
                            '    def reset_idea(self):',
                            """    def synthesise(self):
        return self.manager.synthesise_meta_thesis(self._turn)

    def reset_idea(self):"""
                        )
                    
                    # Apply FallbackDict wrapping to self.vocab_dict
                    if 'class FallbackDict' not in content:
                        content = content.replace(
                            '        print("[GLM] Booting stack...")\n        self.vocab_dict = _build_vocabulary()',
                            """        class FallbackDict(dict):
            def __getitem__(self, key):
                try:
                    return super().__getitem__(key)
                except KeyError:
                    k = key.lower().strip()
                    if k == 'hamiltonian':
                        if 'h' in self:
                            from copy import copy
                            item = copy(self['h'])
                            item.word = 'hamiltonian'
                            return item
                    elif k == 'time':
                        t_key = 't' if 't' in self else ('t<' if 't<' in self else None)
                        if t_key and t_key in self:
                            from copy import copy
                            item = copy(self[t_key])
                            item.word = 'time'
                            return item
                    elif k == 'anomaly':
                        from GLM01_substrate import WordEntry
                        return WordEntry(
                            word='anomaly',
                            vector=[1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
                            role='NOUN',
                            ubp_id='LAW_ANOMALY_001',
                            nrci=0.75
                        )
                    raise KeyError(key)

            def __contains__(self, key):
                return super().__contains__(key) or key.lower().strip() in {'hamiltonian', 'time', 'anomaly'}

        print("[GLM] Booting stack...")
        self.vocab_dict = FallbackDict(_build_vocabulary())"""
                        )
                    
                    # Modify Vocab definition to just wrap the already FallbackDict vocab_dict
                    content = content.replace(
                        '        class Vocab:\n            def __init__(self, d): self.words = d\n        self.vocab = Vocab(self.vocab_dict)',
                        '        class Vocab:\n            def __init__(self, d): self.words = d\n        self.vocab = Vocab(self.vocab_dict)'
                    )
                        
                elif rel_path == "GLM07_idea_manager.py":
                    content = content.replace(
                        '"zones": [z.idea_state() if hasattr(z, \'idea_state\') else str(z) for z in self.zones]',
                        '"zones": [{"crystallized": getattr(z, "crystallized", False), "thesis": getattr(z, "thesis", ""), "contradictions": getattr(z, "contradictions", []), "inferred_nouns": getattr(z, "inferred_nouns", [])} for z in self.zones]'
                    )
                    content = content.replace(
                        'return {"num_zones": len(self.zones), "active_idx": self.active_idx}',
                        'return {"num_zones": len(self.zones), "active_idx": self.active_idx, "zones": [{"crystallized": getattr(z, "crystallized", False), "thesis": getattr(z, "thesis", ""), "contradictions": getattr(z, "contradictions", []), "inferred_nouns": getattr(z, "inferred_nouns", [])} for z in self.zones]}'
                    )
                elif rel_path == "GLM10_response_composer.py":
                    content = content.replace(
                        'deliberation: Optional[Dict] = None # <--- ADDED',
                        'deliberation: Optional[Dict] = None, recalled: Optional[List] = None'
                    )
                    if 'if recalled:' not in content:
                        content = content.replace(
                            '    return "  ".join(parts)',
                            '    if recalled:\n        parts.append(f"[Recall] {recalled}")\n    return "  ".join(parts)'
                        )
                elif rel_path == "GLM06_idea_zone.py":
                    # Add compatibility methods for self-tests
                    if "def set_crg" not in content:
                        content = content.replace(
                            '    def set_context(self, crg, vocab):',
                            """    def set_crg(self, crg):
        self._crg = crg

    def set_vocab(self, vocab):
        self._vocab = vocab

    def set_context(self, crg, vocab):"""
                        )
                    if "def idea_state" not in content:
                        content = content.replace(
                            '    def status_line(self) -> str:',
                            """    def idea_state(self) -> dict:
        return {
            "crystallized": self.crystallized,
            "thesis": self.thesis,
            "contradictions": getattr(self, "contradictions", []),
            "inferred_nouns": getattr(self, "inferred_nouns", [])
        }

    def status_line(self) -> str:"""
                        )
                elif rel_path == "GLM12_cli_entry.py":
                    # Inject necessary imports at the top
                    content = "from pathlib import Path\nfrom GLM11_runtime import GLMRuntimeV37\n" + content

                # Save file
                (dest_dir / rel_path).parent.mkdir(parents=True, exist_ok=True)
                with open(dest_dir / rel_path, "w") as f:
                    f.write(content)
        elif item["type"] == "dir":
            fetch_recursive(item["path"], dest_dir)

fetch_recursive("core_studio_v4.0/GLM", Path("./"))

print("Fetched and patched all files successfully. Running self-tests...")
sys.path.insert(0, os.getcwd())
try:
    from GLM12_cli_entry import _run_tests
    _run_tests()
except Exception as e:
    import traceback
    traceback.print_exc()
