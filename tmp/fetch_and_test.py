import os
import sys
import urllib.request
import json
import re
from pathlib import Path

# Create directory
Path("/tmp/glm").mkdir(parents=True, exist_ok=True)
os.chdir("/tmp/glm")

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
                    content = content.replace(
                        'return {"turn": self._turn, "zones": len(self.manager.zones), "meta": self.meta_graph.stats()}',
                        'return {"turn": self._turn, "manager": self.manager.state(), "meta": self.meta_graph.stats()}'
                    )
                    if 'def _reflexive_recall' not in content:
                        content = content.replace(
                            '    def chat(self, query: str) -> str:',
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

    def chat(self, query: str) -> str:"""
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

                # Save file
                (dest_dir / rel_path).parent.mkdir(parents=True, exist_ok=True)
                with open(dest_dir / rel_path, "w") as f:
                    f.write(content)
        elif item["type"] == "dir":
            fetch_recursive(item["path"], dest_dir)

fetch_recursive("core_studio_v4.0/GLM", Path("/tmp/glm"))

print("Fetched all files successfully. Running simple test...")
sys.path.insert(0, "/tmp/glm")
try:
    from GLM11_runtime import GLMRuntimeV37
    rt = GLMRuntimeV37()
    print("Testing chat('1+1')...")
    res = rt.chat("1+1")
    print("Result of chat('1+1'):", res)
except Exception as e:
    import traceback
    traceback.print_exc()
