# ══════════════════════════════════════════════════════════════════════════════
# §22  ONTOLOGICAL GRAMMAR — COMPUTED FROM VECTOR GEOMETRY (v3.14.0 NEW)
# ══════════════════════════════════════════════════════════════════════════════
# Replaces template-based grammar (GLM17) with COMPUTED grammar.
#
# The user's key insight: the UBP ontological layers (Reality, Information,
# Activation, Potential) map to grammatical categories:
#   Reality    (M_*)  → NOUN      (concrete things that exist)
#   Information (I_*) → ADJECTIVE  (relational qualities)
#   Activation (A_*)  → VERB       (processes, actions)
#   Potential  (P_*)  → OPERATOR   (logical/abstract relations)
#
# The 24-bit vector ALREADY ENCODES grammatical role in its quadrant
# structure.  We don't need templates — we READ the grammar from the geometry.
#
# THE GAP INSIGHT (user's second key idea):
#   The space between two nouns CONTAINS the verb that connects them.
#   The AND-intersection of two noun vectors tends to fall in the Activation
#   (VERB) quadrant (31.6% of CRG edges, the most common gap quadrant).
#   So the verb is COMPUTED as the nearest VERB-dominant word to the
#   gap vector — not looked up from a template.
#
# A SENTENCE IS A GEOMETRIC CONSTRUCTION:
#   Subject (NOUN, Reality-dominant)
#     → gap vector = AND(subject, object)
#       → Verb = nearest VERB-dominant word to the gap
#         → Object (NOUN, Reality-dominant)
#
# This is "thinking" — the system computes the verb from the geometry of
# the subject and object, rather than filling in a template slot.
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations
import re
from typing import List, Dict, Optional, Tuple, Any, Set
from dataclasses import dataclass

from GLM01_substrate import BLA, vector_to_hex_int, fast_hamming


# ── 1. QUADRANT → GRAMMAR MAP ────────────────────────────────────────────────

QUADRANT_NAMES = {0: "Reality", 1: "Information", 2: "Activation", 3: "Potential"}
GRAMMAR_ROLE = {0: "NOUN", 1: "ADJECTIVE", 2: "VERB", 3: "OPERATOR"}

# Sextet boundaries: Q0 = bits 0-5, Q1 = bits 6-11, Q2 = bits 12-17, Q3 = bits 18-23
QUADRANT_RANGES = [(0, 6), (6, 12), (12, 18), (18, 24)]


def dominant_quadrant(vec: List[int]) -> int:
    """Compute the dominant quadrant of a 24-bit vector.

    The dominant quadrant is the one with the highest bit weight.
    This IS the grammatical role of the concept.
    """
    if not vec or len(vec) != 24:
        return 0
    weights = [sum(vec[start:end]) for start, end in QUADRANT_RANGES]
    return weights.index(max(weights))


def quadrant_weights(vec: List[int]) -> List[int]:
    """Return the 4 quadrant weights of a vector."""
    if not vec or len(vec) != 24:
        return [0, 0, 0, 0]
    return [sum(vec[start:end]) for start, end in QUADRANT_RANGES]


def computed_role(word: str, vocab: Any) -> str:
    """Compute the grammatical role of a word from its vector geometry.

    This REPLACES the hand-assigned `role` field with a COMPUTED role
    derived from the dominant quadrant.  No templates, no lookup —
    pure geometry.
    """
    target = vocab.words if hasattr(vocab, 'words') else vocab
    entry = target.get(word)
    if not entry or not hasattr(entry, 'vector') or not entry.vector:
        return "NOUN"  # default
    q = dominant_quadrant(entry.vector)
    return GRAMMAR_ROLE[q]


# ── 2. GAP VECTOR COMPUTATION ────────────────────────────────────────────────

def gap_vector(vec_a: List[int], vec_b: List[int], mode: str = "and") -> List[int]:
    """Compute the gap vector between two concept vectors.

    The gap represents the RELATION between the two concepts.

    Modes:
      "and"  — AND intersection (bits where BOTH are 1).  Tends to fall
               in the VERB quadrant (31.6% of CRG edges).  Represents
               the shared semantic content — the "action" that connects them.
      "xor"  — XOR difference (bits where they DIFFER).  Represents
               the transformation needed to go from A to B.
      "mid"  — Midpoint (majority vote).  Represents the average concept.

    The AND-gap is the default because it most often produces VERB-dominant
    vectors — the gap between two nouns contains the verb that connects them.
    """
    if mode == "and":
        return [a & b for a, b in zip(vec_a, vec_b)]
    elif mode == "xor":
        return [a ^ b for a, b in zip(vec_a, vec_b)]
    elif mode == "mid":
        return [1 if (a + b) >= 1 else 0 for a, b in zip(vec_a, vec_b)]
    else:
        return [a & b for a, b in zip(vec_a, vec_b)]


# ── 3. DETERMINISTIC GRAMMAR ENGINE ──────────────────────────────────────────

@dataclass
class ComputedSentence:
    """A sentence constructed from vector geometry, not templates."""
    subject: str
    verb: str
    object: str
    subject_role: str
    verb_role: str
    object_role: str
    gap_quadrant: int
    gap_mode: str
    verb_distance: int  # Hamming distance from verb to gap vector
    surface: str

    def __str__(self):
        return self.surface


class OntologicalGrammar:
    """Computes sentence structure from vector geometry.

    A sentence is a geometric construction:
      Subject (NOUN) → gap(subject, object) → Verb (nearest VERB to gap) → Object (NOUN)

    The verb is COMPUTED, not looked up.  This is the "thinking" the user
    wants — the system derives the verb from the spatial relationship
    between subject and object.
    """

    def __init__(self, vocab: Any, crg: Any = None):
        self.vocab = vocab
        self.crg = crg
        # Precompute hex ints and quadrant for all words
        self._word_data: Dict[str, Tuple[int, str, List[int]]] = {}
        target = vocab.words if hasattr(vocab, 'words') else vocab
        for w, entry in target.items():
            if hasattr(entry, 'vector') and entry.vector:
                try:
                    h = vector_to_hex_int(entry.vector)
                    q = dominant_quadrant(entry.vector)
                    role = GRAMMAR_ROLE[q]
                    self._word_data[w] = (h, role, entry.vector)
                except Exception:
                    pass

    def _words_by_role(self, role: str) -> List[str]:
        """Get all words with a computed grammatical role."""
        return [w for w, (_, r, _) in self._word_data.items() if r == role]

    def _nearest_word(self, target_vec: List[int], role: str,
                      exclude: Optional[Set[str]] = None) -> Optional[Tuple[str, int]]:
        """Find the nearest word of a specific grammatical role to a target vector."""
        exclude = exclude or set()
        target_hex = vector_to_hex_int(target_vec)
        best_w, best_d = None, 999
        for w, (h, r, _) in self._word_data.items():
            if r != role or w in exclude:
                continue
            d = fast_hamming(target_hex, h)
            if d < best_d:
                best_d = d
                best_w = w
        return (best_w, best_d) if best_w else None

    def construct_sentence(self, subject: str, obj: str,
                           gap_mode: str = "and") -> Optional[ComputedSentence]:
        """Construct a sentence: Subject → Verb → Object.

        The verb is COMPUTED from the gap between subject and object.
        No template lookup — pure geometric construction.
        """
        target = self.vocab.words if hasattr(self.vocab, 'words') else self.vocab
        s_entry = target.get(subject)
        o_entry = target.get(obj)
        if not s_entry or not o_entry or not s_entry.vector or not o_entry.vector:
            return None

        s_role = computed_role(subject, self.vocab)
        o_role = computed_role(obj, self.vocab)

        # Compute the gap vector
        gap = gap_vector(s_entry.vector, o_entry.vector, mode=gap_mode)
        gap_q = dominant_quadrant(gap)

        # Find the nearest VERB to the gap vector
        # If the gap itself is VERB-dominant, we're in luck — the geometry
        # naturally produces a verb.  If not, we still search for the nearest
        # verb to the gap.
        verb_result = self._nearest_word(gap, "VERB", exclude={subject, obj})
        if not verb_result:
            # No verbs in vocab — fall back to a relation word
            verb_result = self._nearest_word(gap, "OPERATOR", exclude={subject, obj})
        if not verb_result:
            return None

        verb, verb_dist = verb_result
        v_role = computed_role(verb, self.vocab)

        # Construct the surface form
        # Deterministic capitalization and punctuation
        surface = f"{subject.capitalize()} {verb} {obj}."

        return ComputedSentence(
            subject=subject, verb=verb, object=obj,
            subject_role=s_role, verb_role=v_role, object_role=o_role,
            gap_quadrant=gap_q, gap_mode=gap_mode,
            verb_distance=verb_dist,
            surface=surface,
        )

    def construct_paragraph(self, seed: str, n_sentences: int = 3,
                            gap_mode: str = "and") -> str:
        """Construct a multi-sentence paragraph by chaining computed sentences.

        Each sentence's object becomes the next sentence's subject,
        creating a chain of geometric reasoning.
        """
        if seed not in self._word_data:
            return ""

        sentences = []
        current_subject = seed
        used = {seed}

        for _ in range(n_sentences):
            # Find the nearest NOUN to the current subject that hasn't been used
            s_entry_data = self._word_data.get(current_subject)
            if not s_entry_data:
                break
            s_hex, _, s_vec = s_entry_data

            # Find nearest unused NOUN as the object
            best_obj, best_d = None, 999
            for w, (h, r, _) in self._word_data.items():
                if r != "NOUN" or w in used:
                    continue
                d = fast_hamming(s_hex, h)
                if 0 < d < best_d:  # 0 means same word
                    best_d = d
                    best_obj = w
            if not best_obj:
                break

            sent = self.construct_sentence(current_subject, best_obj, gap_mode)
            if sent:
                sentences.append(sent.surface)
                used.add(best_obj)
                current_subject = best_obj  # chain: object becomes next subject
            else:
                break

        return " ".join(sentences)

    def construct_from_crg(self, subject: str) -> List[ComputedSentence]:
        """Construct sentences using CRG edges from the subject.

        For each CRG edge from the subject, compute the sentence using
        the gap-vector method.  This combines the CRG's semantic relations
        with the geometric verb computation.
        """
        if not self.crg:
            return []
        sentences = []
        for edge in self.crg.out.get(subject, []):
            if edge.label in ("contradicts", "incompatible_with",
                              "auto_proposed", "lattice_adjacent"):
                continue
            sent = self.construct_sentence(subject, edge.dst)
            if sent:
                sentences.append(sent)
        return sentences


# ── 4. ISOLATION TEST ────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Testing Module 22: Ontological Grammar (v3.14.0) ===")
    from GLM01_substrate import _build_vocabulary
    from GLM03_crg import build_extended_crg

    vocab_dict = _build_vocabulary()
    class Vocab:
        def __init__(self, d): self.words = d
    vocab = Vocab(vocab_dict)
    crg = build_extended_crg()

    grammar = OntologicalGrammar(vocab, crg)

    # Test 1: Computed roles
    print("\nComputed grammatical roles (from vector geometry):")
    for w in ["hamiltonian", "time", "energy", "symmetry", "generates",
              "operator", "force", "plus", "equals"]:
        role = computed_role(w, vocab)
        print(f"  {w:15s}: {role}")

    # Test 2: Construct sentences
    print("\nComputed sentences (verb derived from gap geometry):")
    pairs = [
        ("hamiltonian", "time"),
        ("hamiltonian", "symmetry"),
        ("energy", "force"),
        ("propagator", "momentum"),
        ("entropy", "dimension"),
    ]
    for s, o in pairs:
        sent = grammar.construct_sentence(s, o)
        if sent:
            print(f"  {sent.surface:50s} (gap Q{sent.gap_quadrant}={QUADRANT_NAMES[sent.gap_quadrant]}, verb dist={sent.verb_distance})")

    # Test 3: Construct paragraph
    print("\nComputed paragraph (chained sentences):")
    para = grammar.construct_paragraph("hamiltonian", n_sentences=3)
    print(f"  {para}")

    # Test 4: CRG-driven sentences
    print("\nCRG-driven sentences with computed verbs:")
    for sent in grammar.construct_from_crg("hamiltonian")[:3]:
        print(f"  {sent.surface}")
