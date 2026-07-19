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

    v3.8.0: If the word entry has a `definition` attribute (from the physics
    pack), use that directly — this gives multi-word terms like 'weyl anomaly'
    a real description without needing a KB entry.

    v3.9.0: Also consults the master resource (GLM16) for a full English
    dictionary definition.  If both a KB entry AND a master-resource
    definition exist, prefers the LONGER one (richer descriptions win).
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

    # Helper: format a name + definition pair
    def _fmt(name: str, definition: str) -> str:
        display = name
        # Take the first sentence (or first 120 chars if no period)
        m = re.match(r"([^.]{12,}\.)", definition)
        first_sentence = m.group(1).strip() if m else definition[:120]
        return f"{display}: {first_sentence}"

    # Helper: capitalise display name
    def _display_name(w: str) -> str:
        if ' ' in w or '-' in w:
            return ' '.join(p.capitalize() if not p[0].isupper() else p
                            for p in w.split() if p)
        return w.capitalize()

    # ── v3.9.0: Gather candidate definitions from multiple sources ──────
    candidates: List[Tuple[str, str, int]] = []  # (display_name, definition, priority)

    # Source 1: physics-pack definition (attached to the vocab entry)
    pack_def = getattr(entry, 'definition', None)
    if pack_def:
        candidates.append((_display_name(word), pack_def, 3))

    # Source 2: alias map → system KB
    try:
        alias_map = _build_alias_map()
        uid = alias_map.get(word.lower())
        if uid:
            full_kb = _load_system_kb()
            kbe = full_kb.get(uid)
            if kbe:
                name = kbe.get("name", uid)
                d = kbe.get("desc", "")
                if d:
                    candidates.append((name, d, 2))
    except Exception:
        pass

    # Source 3: vector comparison (KB-derived words with matching vector)
    vec_list = list(vec)
    for uid, kbe in kb.items():
        kbe_vec = kbe.get("vector")
        if kbe_vec and list(kbe_vec) == vec_list:
            name = kbe.get("name", uid)
            d = kbe.get("lexicon", "")
            if d:
                candidates.append((name, d, 1))
            break

    # Source 4: v3.9.0 — master resource dictionary definition
    try:
        from GLM16_master_resource import lookup_definition
        mr_def = lookup_definition(word.lower())
        if mr_def:
            candidates.append((_display_name(word), mr_def, 4))
    except Exception:
        pass

    if not candidates:
        return ("", nrci, tax)

    # v3.9.0: Pick the candidate with the longest first-sentence.
    # This prefers rich dictionary definitions over terse KB descriptions
    # like "Element: Oxygen (O): Oxygen (Z=8)."
    def _first_sentence_len(d: str) -> int:
        m = re.match(r"([^.]{12,}\.)", d)
        return len(m.group(1)) if m else len(d)

    best = max(candidates, key=lambda c: _first_sentence_len(c[1]))
    desc = _fmt(best[0], best[1])
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
    recalled: Optional[List[Dict[str, Any]]] = None, # <--- ADDED
    # v3.19.0: new kwargs for answer extraction + verification
    answer_block: Optional[Any] = None,
    verified: Optional[str] = None,
    # v3.25.0: GLM35 ParagraphComposer generated paragraph
    generated: Optional[str] = None,
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
    # v3.9.0: Prefer multi-word topic nouns (physics-pack terms) over single
    # words — they have richer definitions and are more likely to be the
    # actual subject of the query.  Falls back to last_topic_noun, then to
    # the first content token.
    topic_word = None
    if zone is not None:
        topic_nouns = getattr(zone, 'topic_nouns', [])
        # Pick the first multi-word noun (contains a space or hyphen)
        multi = [n for n in topic_nouns if ' ' in n or '-' in n]
        if multi:
            topic_word = multi[0]
        else:
            topic_word = getattr(zone, 'last_topic_noun', None)
    if not topic_word and content:
        topic_word = content[0][0]

    if topic_word:
        desc, nrci, tax = _kb_description(topic_word, vocab, kb)
        if desc: parts.append(f"[KB] {desc}")
        # v3.19.0: renamed [Verify] to [Metrics] to avoid confusion with
        # the new [Verified] answer-verification tag below.
        parts.append(f"[Metrics] NRCI={nrci:.3f} | Tax={tax:.2f}")

    # I. Structural Backbone
    if zone is not None and hasattr(zone, 'crg_backbone') and zone.crg_backbone:
        edges = [_verbalise_edge(e) for e in zone.crg_backbone[:2]]
        if edges: parts.append(f"[Backbone] {' | '.join(edges)}")

    # I-bis. v3.9.0: Natural-language explanation (semantic frames)
    # If the zone has a backbone, generate a fluent NL paragraph from it.
    # This is the natural-language ability upgrade: instead of only tagged
    # "[Backbone] a | b", we also emit "Hamiltonian generates time. ..."
    if zone is not None and hasattr(zone, 'crg_backbone') and zone.crg_backbone:
        try:
            from GLM17_semantic_frames import verbalise_backbone
            nl = verbalise_backbone(zone.crg_backbone, max_sentences=2)
            if nl:
                parts.append(f"[NL] {nl}")
        except Exception:
            pass

    # J. Gaps
    real_gaps = [u for u in unknown if u.lower() not in {"hello", "hi", "help"}]
    if real_gaps:
        parts.append(f"[Gap] No verified vector for: {', '.join(real_gaps[:3])}")

    # v3.19.0: [Answer] block — clean extracted answer, always last (before fallback)
    if answer_block is not None:
        try:
            from GLM29_answer_extractor import format_answer_terse
            ans_str = format_answer_terse(answer_block)
            if ans_str:
                parts.append(ans_str)
        except Exception:
            pass

    # v3.19.0: [Verified] block — explicit verification statement
    if verified is not None:
        try:
            from GLM31_verification import format_verified_terse
            ver_str = format_verified_terse(verified)
            if ver_str:
                parts.append(ver_str)
        except Exception:
            pass

    # K. v3.25.0: GLM35 ParagraphComposer generated paragraph
    if generated:
        parts.append(f"[Generated] {generated}")

    # L. Fallback
    if not parts:
        parts.append("I am listening. Name a concept or provide a mathematical expression to begin.")

    return "  ".join(parts)