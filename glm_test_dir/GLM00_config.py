# ══════════════════════════════════════════════════════════════════════════════
# §00  CONFIGURATION & PATHS (HARDENED v3.7.6)
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations
import sys, os, json, math
from pathlib import Path

# 1. STATIC PATH ANCHORING
# We use the current working directory as the root to avoid resolve() hangs
ROOT_DIR = Path(os.getcwd())

# 2. DYNAMIC PATH CONFIGURATION
# Check environment variable, or try to locate the KB files
core_env = os.environ.get('UBP_CORE_PATH')
if core_env:
    UBP_CORE_PATH = Path(core_env)
elif os.path.exists("/app/applet/glm_test_dir/ubp_system_kb.json"):
    UBP_CORE_PATH = Path("/app/applet/glm_test_dir")
else:
    UBP_CORE_PATH = ROOT_DIR

# 3. SYSTEM PATH INTEGRATION
# Add paths to sys.path only if they aren't already there
def _update_sys_path(target_path: Path):
    path_str = str(target_path.absolute())
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

_update_sys_path(ROOT_DIR)
if UBP_CORE_PATH != ROOT_DIR:
    _update_sys_path(UBP_CORE_PATH)

# 4. KB LOCATOR (Absolute referencing)
# Instead of chdir, we define absolute paths for the other modules to import
KB_SYSTEM_PATH = UBP_CORE_PATH / "ubp_system_kb.json"
KB_LANG_PATH = UBP_CORE_PATH / "ubp_lang_kb_combined_v4.json"

# Robust fallback locator for local executions, so no duplicate copies are needed inside the GLM folder:
if not KB_SYSTEM_PATH.exists():
    for candidate in [
        ROOT_DIR / "ubp_system_kb.json",
        ROOT_DIR.parent / "system_kb" / "ubp_system_kb.json",
        ROOT_DIR.parent / "ubp_system_kb.json",
    ]:
        if candidate.exists():
            KB_SYSTEM_PATH = candidate
            break

if not KB_LANG_PATH.exists():
    for candidate in [
        ROOT_DIR / "ubp_lang_kb_combined_v4.json",
        ROOT_DIR.parent / "core" / "ubp_lang_kb_combined_v4.json",
        ROOT_DIR.parent / "ubp_lang_kb_combined_v4.json",
    ]:
        if candidate.exists():
            KB_LANG_PATH = candidate
            break

def get_master_resource_path() -> Path:
    """Resolve the path to the master resource file, preferring the unified resource, and falling back to v1."""
    p = UBP_CORE_PATH / "glm_unified_resource.json"
    if p.exists():
        return p
    v1 = UBP_CORE_PATH / "glm_master_resource_v1.json"
    if v1.exists():
        return v1
    # Check parent and standard candidates
    for name in ["glm_unified_resource.json", "glm_master_resource_v1.json"]:
        for parent_cand in [ROOT_DIR, ROOT_DIR.parent, ROOT_DIR.parent / "core"]:
            cand = parent_cand / name
            if cand.exists():
                return cand
    return p # default fallback

# 5. DIAGNOSTIC STATUS
def status():
    """Report module status without side effects."""
    mr_path = get_master_resource_path()
    return {
        "module": "glm_config",
        "root_dir": str(ROOT_DIR),
        "core_path": str(UBP_CORE_PATH),
        "kb_system_exists": KB_SYSTEM_PATH.exists(),
        "kb_lang_exists": KB_LANG_PATH.exists(),
        "master_resource_path": str(mr_path),
        "master_resource_exists": mr_path.exists(),
        "cwd": os.getcwd(),
    }

if __name__ == "__main__":
    print("=== GLM Config Module (Hardened) ===")
    stat = status()
    for k, v in stat.items():
        print(f"  {k}: {v}")
    
    if not stat["kb_system_exists"]:
        print(f"!! CRITICAL: System KB not found at {KB_SYSTEM_PATH}")