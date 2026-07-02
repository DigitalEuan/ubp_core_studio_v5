# ══════════════════════════════════════════════════════════════════════════════
# §10  RESPONSE COMPOSER — THE VOICE (v3.7.7 Rebuild)
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations
import re
from typing import List, Dict, Optional, Tuple, Any

# IMPORT SUBSTRATE & CONSTANTS
from GLM01_substrate import LEECH_ENGINE, _load_kb_safe, _load_system_kb, _build_alias_map
from GLM02_constants import _OP_SYNTAX_RE, PRONOUNS
from GLM00_config import KB_SYSTEM_PATH
from GLM13_deliberative_reasoning import format_deliberation

# ── 1. INTERNAL HELPERS ────────────────────────────────────────────────
def _kb_description(word: str, vocab: Any, kb: Dict[str, Any]) -> Tuple[str, float, float]:
    """Look up the KB description + metrics for a vocab word.

    v3.7.7: Uses alias map first (word → ubp_id → KB entry), then falls
    back to vector comparison. This fixes the issue where 'what is time?'
    returned the Water KB entry instead of Time.
    """
    target_dict = vocab.words if hasattr(vocab, 'words') else vocab
    entry = target_dict.get(word)
    if not entry: return ("", 0.0, 0.0)

    vec = entry.vector
    nrci = float(entry.nrci)
    try:
        tax = float(LEECH_ENGINE.calculate_symmetry_tax(vec))
    except:
        tax = 0.0

    desc = ""

    # v3.7.7: Try alias map FIRST (word → ubp_id → KB entry)
    try:
        alias_map = _build_alias_map()
        uid = alias_map.get(word.lower())
        if uid:
            # Load the full system KB with name/desc
            full_kb = _load_system_kb()
            kbe = full_kb.get(uid)
            if kbe:
                name = kbe.get("name", uid)
                d = kbe.get("desc", "")
                m = re.match(r"([^.]{12,}\.)", d)
                desc = f"{name}: {m.group(1).strip()}" if m else (f"{name}: {d[:90]}" if d else name)
                return (desc, nrci, tax)
    except Exception:
        pass

    # Fallback: vector comparison (for KB-derived words)
    vec_list = list(vec)
    for uid, kbe in kb.items():
        kbe_vec = kbe.get("vector")
        if kbe_vec and list(kbe_vec) == vec_list:
            name = kbe.get("name", uid)
            d = kbe.get("lexicon", "")
            m = re.match(r"([^.]{12,}\.)", d)
            desc = f"{name}: {m.group(1).strip()}" if m else f"{name}: {d[:90]}"
            break
    return (desc, nrci, tax)

def _verbalise_edge(e: Any) -> str:
    """Turns a CRG edge into a natural language string."""
    src = e.src if hasattr(e, 'src') else e.get('src', 'unknown')
    label = e.label if hasattr(e, 'label') else e.get('label', 'relates_to')
    dst = e.dst if hasattr(e, 'dst') else e.get('dst', 'unknown')
    
    label_text = label.replace("_", " ")
    m = {
        "is_a": f"{src} is a {dst}",
        "is_dual_to": f"{src} is dual to {dst}",
        "commutes_with": f"{src} commutes with {dst}",
        "generates": f"{src} generates {dst}",
        "scales_as": f"{src} scales as {dst}",
        "depends_on": f"{src} depends on {dst}",
        "measures": f"{src} measures {dst}",
        "auto_proposed": f"{src} relates to {dst}"
    }
    return m.get(label, f"{src} {label_text} {dst}")

# ── 2. MASTER COMPOSER ─────────────────────────────────────────────────
def compose_response(
    query: str, 
    content: List[Tuple[str, Any]], 
    unknown: List[str], 
    zone: Any, 
    manager: Any, 
    vocab: Any, 
    qtype: str,
    compute_result: Optional[Dict] = None, 
    symbolic_result: Optional[Dict] = None, 
    warm_start: Optional[Any] = None,
    deliberation: Optional[Dict] = None,
    recalled: Optional[List[Dict[str, Any]]] = None # <--- ADDED
) -> str:
    """Weaves internal state into a coherent multi-layered response."""
    
    kb = _load_kb_safe(KB_SYSTEM_PATH)
    parts: List[str] = []

    # A. Multi-Zone Header
    if manager is not None and hasattr(manager, 'zones') and len(manager.zones) > 1:
        parts.append(f"[Zones: {len(manager.zones)} | Active: {manager.active_idx}]")

    # B. Idea Status
    if zone is not None and hasattr(zone, 'evidence') and zone.evidence:
        parts.append(zone.status_line())

    # C. Warm-Start Alert
    if warm_start is not None:
        parts.append(f"[Warm-Start] Resembles prior idea: '{warm_start.thesis}'")

    # D. Crystallized Thesis
    if zone is not None and getattr(zone, 'crystallized', False) and zone.thesis:
        parts.append(f"[I get it] {zone.thesis}")

    # E. Math Results
    if compute_result:
        res = compute_result["result"]
        parts.append(f"[Computed] {compute_result['computation']['expr']} = {res['exact']}")
        if compute_result.get("grounded"):
            parts.append(f"-> Snapped to lattice point '{compute_result['grounded'][0]}'")

    if symbolic_result:
        res = symbolic_result["result"]
        parts.append(f"[Symbolic] {symbolic_result['computation']['kind']}: {res['exact']}")

    # F. Deliberation Block
    if deliberation:
        parts.append(format_deliberation(deliberation))

    # G. Reflexive Recall Block (NEW)
    if recalled:
        recall_parts = []
        for entry in recalled[:3]: # Show top 3 matches
            name = entry.get("name", entry.get("ubp_id", "Unknown"))
            recall_parts.append(name)
        if recall_parts:
            parts.append(f"[Recall] {', '.join(recall_parts)}")

    # H. Knowledge Base & Verification
    topic_word = getattr(zone, 'last_topic_noun', None) if zone else None
    if not topic_word and content:
        topic_word = content[0][0]
        
    if topic_word:
        desc, nrci, tax = _kb_description(topic_word, vocab, kb)
        if desc: parts.append(f"[KB] {desc}")
        parts.append(f"[Verify] NRCI={nrci:.3f} | Tax={tax:.2f}")

    # I. Structural Backbone
    if zone is not None and hasattr(zone, 'crg_backbone') and zone.crg_backbone:
        edges = [_verbalise_edge(e) for e in zone.crg_backbone[:2]]
        if edges: parts.append(f"[Backbone] {' | '.join(edges)}")

    # J. Gaps
    real_gaps = [u for u in unknown if u.lower() not in {"hello", "hi", "help"}]
    if real_gaps:
        parts.append(f"[Gap] No verified vector for: {', '.join(real_gaps[:3])}")

    # K. Fallback
    if not parts:
        parts.append("I am listening. Name a concept or provide a mathematical expression to begin.")

    return "  ".join(parts)