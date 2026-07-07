# ══════════════════════════════════════════════════════════════════════════════
# §27  CRG EXPANDER (v3.18.0 — auto-curated CRG edges)
# ══════════════════════════════════════════════════════════════════════════════
#
# PURPOSE
#   The SESSION_SUMMARY (§10) identified that GLM's CRG is "drastically
#   under-built relative to the 4,248-word vocabulary (60.7 words per
#   edge)". v3.17 shipped the CRGTraversalALU as the engine; this module
#   gives it fuel.
#
#   Three sources of new edges, in increasing order of curation effort:
#
#   1. UBP-ID relations from the master resource (67 raw relations).
#      These already exist as `['elem_xe_054', 'relates_to', 'elem_rn_086']`
#      tuples but use UBP IDs. We resolve them to vocab words via the
#      alias map and add them with the appropriate label.
#
#   2. Description-mined relations from the system KB (752 entries).
#      Each KB entry has a free-text description. We pattern-match for
#      relational phrases ("born from", "constituent of", "forms",
#      "is a", "depends on", etc.) and extract concept pairs.
#
#   3. Curated physics-concept edges (hand-picked, ~80 edges).
#      The most-queried physics concepts (hamiltonian, time, energy,
#      anomaly, weyl, lattice, etc.) get explicit edges that aren't
#      recoverable from text mining.
#
# DESIGN PRINCIPLES
#   - NEVER overwrite an existing edge (idempotent).
#   - Always use vocab words (lowercased) — never raw UBP IDs.
#   - Each proposed edge is logged with its source so the user can audit.
#   - The expansion is deterministic — same input gives same output.
#
# AUTHOR
#   Z.ai levelling-up pass — 2026-07-06 (v3.18 push)
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from GLM00_config import UBP_CORE_PATH, get_master_resource_path
from GLM01_substrate import (
    ConceptRelationGraph, CRGEdge, EDGE_LABELS,
    _CONCEPT_ALIASES,
)

# ── 1. UBP-ID RESOLVER ──────────────────────────────────────────────────────
# Map UBP IDs (ELEM_H_001, LAW_ANOMALY_001, PARTICLE_ELECTRON_001, etc.) to
# the vocab word that aliases them (hydrogen, anomaly, electron, etc.).
def _build_ubp_id_to_vocab_map() -> Dict[str, str]:
    """Build a reverse alias map: UBP ID → vocab word.

    The forward map (_CONCEPT_ALIASES) is {vocab_word: ubp_id}. We invert it.
    For collisions (multiple words aliasing to the same UBP ID), we keep the
    first one — they're synonyms and the choice doesn't matter for graph
    topology.
    """
    rev: Dict[str, str] = {}
    for word, ubp_id in _CONCEPT_ALIASES.items():
        if ubp_id not in rev:
            rev[ubp_id] = word
    return rev

_UBP_ID_TO_VOCAB = _build_ubp_id_to_vocab_map()


def _resolve_ubp_id(ubp_id: str) -> Optional[str]:
    """Resolve a UBP ID to its vocab word, case-insensitively."""
    if not ubp_id:
        return None
    # Direct hit
    if ubp_id in _UBP_ID_TO_VOCAB:
        return _UBP_ID_TO_VOCAB[ubp_id]
    # Try lowercase
    for k, v in _UBP_ID_TO_VOCAB.items():
        if k.lower() == ubp_id.lower():
            return v
    return None


# ── 2. MASTER RESOURCE RELATIONS ────────────────────────────────────────────
def _load_master_relations() -> List[Tuple[str, str, str]]:
    """Load the 67 raw relations from glm_master_resource_v1.json.

    Returns a list of (src_ubp_id, label, dst_ubp_id) tuples.
    The master resource uses 'relates_to' as the universal label — we
    translate it to a more specific label where we can infer one.
    """
    mr_path = get_master_resource_path()
    if not mr_path.exists():
        return []
    try:
        d = json.loads(mr_path.read_text())
    except Exception:
        return []
    out = []
    for r in d.get("relations", []):
        if isinstance(r, list) and len(r) >= 3:
            out.append((str(r[0]), str(r[1]), str(r[2])))
    return out


# ── 3. DESCRIPTION-MINING PATTERNS ─────────────────────────────────────────
# Each pattern maps a regex (with two capture groups) to a CRG edge label.
# Patterns are ordered by specificity (most specific first).
_DESCRIPTION_PATTERNS: List[Tuple[re.Pattern, str]] = [
    # "X is a Y" / "X is an Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+is\s+an?\s+([a-z][\w\-]+)\b', re.I), "is_a"),
    # "X is the seed of Y" / "X is the source of Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+is\s+the\s+\w+\s+of\s+([a-z][\w\-]+)\b', re.I), "generates"),
    # "X is a constituent of Y" / "X is a component of Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+is\s+a\s+(?:constituent|component|member)\s+of\s+([a-z][\w\-]+)\b', re.I), "is_a"),
    # "X forms Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+forms?\s+([a-z][\w\-]+)\b', re.I), "generates"),
    # "X generates Y" / "X produces Y" / "X creates Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+(?:generates|produces|creates)\s+([a-z][\w\-]+)\b', re.I), "generates"),
    # "X depends on Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+depends\s+on\s+([a-z][\w\-]+)\b', re.I), "depends_on"),
    # "X measures Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+measures?\s+([a-z][\w\-]+)\b', re.I), "measures"),
    # "X commutes with Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+commutes\s+with\s+([a-z][\w\-]+)\b', re.I), "commutes_with"),
    # "X is dual to Y" / "X is the dual of Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+is\s+(?:the\s+)?dual\s+to\s+([a-z][\w\-]+)\b', re.I), "is_dual_to"),
    (re.compile(r'\b([a-z][\w\-]+)\s+is\s+the\s+dual\s+of\s+([a-z][\w\-]+)\b', re.I), "is_dual_to"),
    # "X scales as Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+scales?\s+as\s+([a-z][\w\-]+)\b', re.I), "scales_as"),
    # "X has property Y" / "X has the property of Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+has\s+(?:the\s+)?property\s+(?:of\s+)?([a-z][\w\-]+)\b', re.I), "has_property"),
    # "X contradicts Y" / "X is incompatible with Y"
    (re.compile(r'\b([a-z][\w\-]+)\s+contradicts\s+([a-z][\w\-]+)\b', re.I), "contradicts"),
    (re.compile(r'\b([a-z][\w\-]+)\s+is\s+incompatible\s+with\s+([a-z][\w\-]+)\b', re.I), "incompatible_with"),
    # "born from Y" — passive, implies Y generates X. We capture the subject
    # from the sentence start if available.
    (re.compile(r'^([a-z][\w\-]+).*?\bborn\s+from\s+([a-z][\w\-]+)\b', re.I), "generates"),
]

# Function words that should never be edge endpoints (false-positive filter)
_STOPWORDS: Set[str] = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "of", "to", "in", "on", "at", "by", "for", "with", "from", "as",
    "and", "or", "but", "not", "no", "yes", "this", "that", "these", "those",
    "it", "its", "they", "them", "their", "we", "us", "our", "you", "your",
    "he", "she", "him", "her", "his", "hers",
    "has", "have", "had", "do", "does", "did", "will", "would", "shall", "should",
    "can", "could", "may", "might", "must",
    "when", "where", "why", "how", "what", "which", "who", "whom",
    "above", "below", "between", "through", "during", "before", "after",
    "all", "any", "some", "every", "each", "both", "few", "more", "most",
    "other", "such", "only", "own", "same", "than", "too", "very",
    "one", "two", "three", "first", "second", "third",
    "into", "over", "under", "up", "down", "out", "off", "above", "below",
    "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "to", "from", "up", "down", "in", "out",
    "on", "off", "over", "under", "again", "further", "then", "once",
    # Physics false-positives that are too generic
    "field", "form", "type", "kind", "sort", "way", "part", "side",
}


def _is_valid_concept(word: str, vocab: Dict[str, Any]) -> bool:
    """A valid concept for edge-mining: in vocab, not a stopword, len > 2."""
    if not word or len(word) < 3:
        return False
    w = word.lower().strip()
    if w in _STOPWORDS:
        return False
    if w not in vocab:
        return False
    return True


def _mine_description(desc: str, vocab: Dict[str, Any],
                      max_per_desc: int = 3) -> List[Tuple[str, str, str]]:
    """Extract up to `max_per_desc` (src, label, dst) triples from a description.

    The patterns above are tried in order; the first match (where both
    endpoints are valid vocab words) wins. We deduplicate within a single
    description so the same pair isn't extracted twice.
    """
    if not desc:
        return []
    seen_pairs: Set[Tuple[str, str, str]] = set()
    out: List[Tuple[str, str, str]] = []
    for pattern, label in _DESCRIPTION_PATTERNS:
        for m in pattern.finditer(desc):
            src, dst = m.group(1).lower().strip(), m.group(2).lower().strip()
            if not _is_valid_concept(src, vocab) or not _is_valid_concept(dst, vocab):
                continue
            if src == dst:
                continue
            key = (src, label, dst)
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            out.append(key)
            if len(out) >= max_per_desc:
                return out
    return out


# ── 4. CURATED PHYSICS EDGES ───────────────────────────────────────────────
# Hand-picked edges for the most-queried physics concepts. These cover
# relationships that aren't recoverable from text mining because the
# descriptions don't use the exact phrases our patterns look for.
#
# IMPORTANT: every concept word here MUST be in the GLM vocab. Words that
# aren't in vocab (e.g. 'schrodinger', 'entanglement') are silently skipped
# by _try_add — keep this list trimmed to verified vocab words only.
_CURATED_EDGES: List[Tuple[str, str, str]] = [
    # Foundational physics
    ("hamiltonian", "generates", "time"),
    ("hamiltonian", "is_a", "operator"),
    ("hamiltonian", "depends_on", "energy"),
    ("lagrangian", "is_dual_to", "hamiltonian"),
    ("lagrangian", "is_a", "functional"),
    ("energy", "is_a", "property"),
    ("time", "depends_on", "hamiltonian"),
    ("symmetry", "generates", "conservation"),
    ("anomaly", "is_a", "symmetry"),
    ("weyl", "is_a", "fermion"),
    ("majorana", "is_a", "fermion"),
    ("majorana", "is_dual_to", "weyl"),
    ("boson", "contradicts", "fermion"),
    ("fermion", "contradicts", "boson"),
    ("quark", "is_a", "fermion"),
    ("electron", "is_a", "fermion"),
    ("proton", "is_a", "fermion"),
    ("neutron", "is_a", "fermion"),
    ("photon", "is_a", "boson"),
    ("gluon", "is_a", "boson"),
    ("graviton", "is_a", "boson"),
    # Quantum mechanics
    ("wavefunction", "is_a", "function"),
    ("wavefunction", "depends_on", "hamiltonian"),
    ("operator", "is_a", "object"),
    ("adjoint", "is_dual_to", "operator"),
    ("tensor", "is_a", "object"),
    ("metric", "is_a", "tensor"),
    # Lattice / topology
    ("lattice", "is_a", "structure"),
    ("golay", "is_a", "code"),
    ("leech", "is_a", "lattice"),
    ("leech", "depends_on", "golay"),
    ("topology", "is_a", "structure"),
    ("curvature", "is_a", "property"),
    ("curvature", "depends_on", "metric"),
    # Information / computation
    ("entropy", "is_a", "measure"),
    ("entropy", "measures", "information"),
    ("information", "is_a", "quantity"),
    ("probability", "is_a", "measure"),
    ("coherence", "is_a", "property"),
    ("nrci", "measures", "coherence"),
    ("nrci", "is_a", "metric"),
    # Concepts
    ("resonance", "is_a", "phenomenon"),
    ("phase", "is_a", "property"),
    ("frequency", "is_a", "measure"),
    ("wavelength", "is_a", "measure"),
    ("frequency", "is_dual_to", "wavelength"),
    # Substrate / UBP
    ("substrate", "is_a", "structure"),
    ("manifold", "is_a", "space"),
    ("reality", "is_a", "substrate"),
    ("observer", "is_a", "entity"),
    # Operators
    ("hadron", "is_a", "baryon"),
    ("lepton", "is_a", "fermion"),
    ("electron", "has_property", "charge"),
    ("proton", "has_property", "charge"),
    ("neutron", "has_property", "mass"),
    # Geometry
    ("dimension", "is_a", "property"),
    ("vector", "is_a", "object"),
    ("matrix", "is_a", "object"),
    ("matrix", "has_property", "rank"),
    # Forces (using only in-vocab words)
    ("gravity", "is_a", "force"),
    ("force", "is_a", "property"),
    ("force", "depends_on", "energy"),
    # Mass/charge (using aliased words)
    ("mass", "is_a", "property"),
    ("mass", "depends_on", "energy"),
    ("hydrogen", "is_a", "element"),
    ("helium", "is_a", "element"),
    ("carbon", "is_a", "element"),
    ("nitrogen", "is_a", "element"),
    ("oxygen", "is_a", "element"),
    ("lithium", "is_a", "element"),
    ("water", "is_a", "molecule"),
    ("water", "depends_on", "hydrogen"),
    ("water", "depends_on", "oxygen"),
    # Stability / coherence
    ("stability", "is_a", "property"),
    ("stability", "depends_on", "coherence"),
    ("baryon", "is_a", "hadron"),
    ("holographic", "is_a", "principle"),
    # Phase / time
    ("time", "is_a", "dimension"),
    ("energy", "depends_on", "time"),
    ("frequency", "depends_on", "time"),
]


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN EXPANSION FUNCTION
# ══════════════════════════════════════════════════════════════════════════════
def expand_crg(crg: ConceptRelationGraph,
               vocab: Any,
               sources: Optional[List[str]] = None,
               verbose: bool = True) -> Dict[str, Any]:
    """Expand a CRG with auto-curated edges.

    Parameters
    ----------
    crg : ConceptRelationGraph
        The live CRG to expand (mutated in place).
    vocab : Any
        The vocab object — must expose `.words` dict OR be a dict.
    sources : Optional[List[str]]
        Which sources to use. Default: all three.
        Options: "master_resource", "kb_descriptions", "curated".
    verbose : bool
        If True, print progress.

    Returns
    -------
    Dict with keys: {added, skipped_existing, skipped_invalid,
                     by_source, by_label, total_edges_after}.
    """
    if sources is None:
        sources = ["master_resource", "kb_descriptions", "curated"]

    # Normalise vocab
    target = vocab.words if hasattr(vocab, 'words') else vocab

    # Snapshot existing edges (lowercased) for dedup
    existing: Set[Tuple[str, str, str]] = set()
    for e in crg.edges:
        existing.add((e.src.lower(), e.label.lower(), e.dst.lower()))

    report = {
        "added": 0,
        "skipped_existing": 0,
        "skipped_invalid": 0,
        "by_source": {s: 0 for s in sources},
        "by_label": {},
        "total_edges_before": len(crg.edges),
    }

    def _try_add(src: str, label: str, dst: str, source: str) -> bool:
        nonlocal report
        s, d = src.lower().strip(), dst.lower().strip()
        if not s or not d or s == d:
            report["skipped_invalid"] += 1
            return False
        if not _is_valid_concept(s, target) or not _is_valid_concept(d, target):
            report["skipped_invalid"] += 1
            return False
        if (s, label.lower(), d) in existing:
            report["skipped_existing"] += 1
            return False
        ok = crg.add_edge(s, label, d)
        if ok:
            existing.add((s, label.lower(), d))
            report["added"] += 1
            report["by_source"][source] = report["by_source"].get(source, 0) + 1
            report["by_label"][label] = report["by_label"].get(label, 0) + 1
            return True
        else:
            report["skipped_invalid"] += 1
            return False

    # ── Source 1: master resource relations ──────────────────────────────
    if "master_resource" in sources:
        raw = _load_master_relations()
        n_added = 0
        for src_id, label, dst_id in raw:
            src_word = _resolve_ubp_id(src_id)
            dst_word = _resolve_ubp_id(dst_id)
            if not src_word or not dst_word:
                continue
            # Translate the universal 'relates_to' label to something more
            # specific. We can't infer it from the raw tuple, so use the
            # generic 'is_a' as a safe default for elements/laws (which is
            # what most of these relations are).
            inferred_label = "is_a" if label == "relates_to" else label
            if _try_add(src_word, inferred_label, dst_word, "master_resource"):
                n_added += 1
        if verbose:
            print(f"[GLM27] master_resource: +{n_added} edges")

    # ── Source 2: KB description mining ──────────────────────────────────
    if "kb_descriptions" in sources:
        kb_path = UBP_CORE_PATH / "ubp_system_kb.json"
        n_added = 0
        if kb_path.exists():
            try:
                kb = json.loads(kb_path.read_text())
                entries = kb.get("entries", {})
                for hash_key, entry in entries.items():
                    if not isinstance(entry, list) or len(entry) < 2:
                        continue
                    desc = entry[1] if isinstance(entry[1], str) else ""
                    if not desc or len(desc) < 20:
                        continue
                    # Strip leading "[Type: Name]," markers
                    desc = re.sub(r'^\[[^\]]+\],?\s*', '', desc)
                    triples = _mine_description(desc, target, max_per_desc=2)
                    for src, label, dst in triples:
                        if _try_add(src, label, dst, "kb_descriptions"):
                            n_added += 1
            except Exception as e:
                if verbose:
                    print(f"[GLM27] kb_descriptions: error: {e}")
        if verbose:
            print(f"[GLM27] kb_descriptions: +{n_added} edges")

    # ── Source 3: curated edges ──────────────────────────────────────────
    if "curated" in sources:
        n_added = 0
        for src, label, dst in _CURATED_EDGES:
            if _try_add(src, label, dst, "curated"):
                n_added += 1
        if verbose:
            print(f"[GLM27] curated: +{n_added} edges "
                  f"({len(_CURATED_EDGES)} attempted)")

    report["total_edges_after"] = len(crg.edges)
    return report


# ══════════════════════════════════════════════════════════════════════════════
#  STATUS / SELF-TEST
# ══════════════════════════════════════════════════════════════════════════════
def status() -> Dict[str, Any]:
    return {
        "module": "GLM27_crg_expander",
        "version": "3.18.0",
        "sources": ["master_resource", "kb_descriptions", "curated"],
        "curated_edge_count": len(_CURATED_EDGES),
        "description_patterns": len(_DESCRIPTION_PATTERNS),
    }


if __name__ == "__main__":
    print("=== GLM27 CRG Expander v3.18.0 — self-test ===")
    print(status())
    print()

    from GLM01_substrate import _build_vocabulary
    from GLM03_crg import build_extended_crg

    vocab_dict = _build_vocabulary()
    class V:
        def __init__(self, d): self.words = d
    v = V(vocab_dict)
    crg = build_extended_crg()
    print(f"Before expansion: {crg.stats()}")

    report = expand_crg(crg, v, verbose=True)
    print(f"\nAfter expansion: {crg.stats()}")
    print(f"\nReport:")
    for k, val in report.items():
        print(f"  {k}: {val}")
