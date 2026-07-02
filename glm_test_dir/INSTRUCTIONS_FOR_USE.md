# GLM v3.7.3 — Instructions for Use

This document covers everything needed to run the grown Geometric Language
Machine. It is intentionally minimal: prerequisites, setup, three commands,
the API, confidence tags, and troubleshooting.

---

## Prerequisites

1. **Python 3.12+** (tested on 3.12.13 and 3.13)
2. **SymPy 1.14+** — `pip install sympy`
3. **The UBP_Repo on disk** — clone from `https://github.com/DigitalEuan/UBP_Repo`

That's it. No other dependencies. The engine is stdlib-only apart from SymPy.

---

## Setup

### 1. Clone the repo (if not already present)

```bash
git clone https://github.com/DigitalEuan/UBP_Repo.git
```

### 2. Co-locate the system KB

The runtime expects `ubp_system_kb.json` inside `/core/` (it loads it by
relative path). Copy it there from `system_kb/`:

```bash
cp UBP_Repo/core_studio_v4.0/system_kb/ubp_system_kb.json \
   UBP_Repo/core_studio_v4.0/core/ubp_system_kb.json
```

### 3. Set the path environment variable

Point `UBP_CORE_PATH` at your `/core/` directory:

```bash
export UBP_CORE_PATH=/path/to/your/UBP_Repo/core_studio_v4.0/core
```

(Or edit the `UBP_CORE_PATH` constant at the top of `glm_v37_grown.py`
line ~83 to point at your `/core/` directory — then you don't need the env
var.)

---

## Quick Start — Three Commands

### 1. Run the self-tests (verify the system works)

```bash
cd core_studio_v4.0/GLM
python3 glm_v37_grown.py --test
```

Expected output ends with `12/12 tests passed`. Tests A–L cover:
crystallisation, calculation + grounding, symbolic differentiation, symbolic
solve, multi-zone routing, contradiction detection, autonomous maturation,
warm-start, determinism, CRG auto-expansion, contradiction-driven pivot,
cross-zone synthesis.

### 2. Ask a single question

```bash
python3 glm_v37_grown.py --chat "What is gcd(54, 24)?"
python3 glm_v37_grown.py --chat "differentiate x^3 with respect to x"
python3 glm_v37_grown.py --chat "Tell me about the hamiltonian and time."
python3 glm_v37_grown.py --chat "Find all positive integers n for which 2^n - 1 is divisible by 7."
```

### 3. Interactive Python session

```python
import sys; sys.path.insert(0, '.')  # or your path to the script
from glm_v37_grown import GLMRuntimeV37

rt = GLMRuntimeV37()

# Basic chat — ideas accumulate, decay, crystallise
print(rt.chat("Tell me about the hamiltonian and time."))
print(rt.chat("What about symmetry?"))
print(rt.chat("What does it generate?"))          # 'it' -> hamiltonian

# Autonomous maturation (let it think between turns)
rt.mature(5)                                      # 5 autonomous ticks
print(rt.idea_state())                            # full multi-zone state

# Computation — results ground as lattice evidence
print(rt.chat("What is gcd(54, 24)?"))            # -> six (grounded)
print(rt.chat("Compute sqrt(144)."))              # -> twelve (grounded)
print(rt.chat("Find the greatest common divisor of 252 and 198."))  # -> 18

# Symbolic math
print(rt.chat("differentiate x^2 with respect to x"))   # -> 2*x
print(rt.chat("integrate 2*x dx"))                       # -> x^2
print(rt.chat("solve x^2 - 4 for x"))                    # -> [-2, 2]
print(rt.chat("simplify (x^2 - 1)/(x - 1)"))             # -> x + 1

# Vector ops (v3.7.3)
print(rt.chat("Compute the dot product of <3, -1, 4> and <2, 5, -3>."))  # -> -11
print(rt.chat("Find the magnitude of the vector <3, 4, 12>."))           # -> 13

# chat with effort — iteratively matures if not crystallized (v3.7.1)
print(rt.chat_with_effort("What is the Weyl anomaly?", max_ticks=5))

# Deliberative reasoning — the system "thinks" (v3.7.3 §13)
print(rt.chat("Find all positive integers n for which 2^n - 1 is divisible by 7."))
# -> [deliberated:divisibility_sequence] [method:modular_period_detection] ... [conclusion] n divisible by 3

print(rt.chat("Prove that the fraction (21n+4)/(14n+3) is irreducible."))
# -> [deliberated:gcd_proof] [method:euclidean_algorithm] ... [conclusion] gcd = 1

# CritPt code-generation challenges (v3.7.3)
results = rt.solve_critpt(limit=5, out_dir="out_critpt")
# Produces answer files in out_critpt/

# Cross-zone synthesis
mt = rt.synthesise()    # unify crystallised zones into a meta-thesis
if mt: print(mt.thesis)

# Reset for a new conversation (meta-graph persists for warm-start)
rt.reset_idea()
```

---

## API Summary (`GLMRuntimeV37`)

| Method | Purpose |
|--------|---------|
| `rt = GLMRuntimeV37()` | Boot (engine + CRG + numbers + meta-graph) |
| `rt.chat(query)` | One NL turn; returns response string |
| `rt.chat_with_effort(query, max_ticks=5)` | **v3.7.1**: chat + iterative maturation if not crystallized |
| `rt.mature(n)` | Run `n` autonomous ticks across all zones |
| `rt.adversarial()` | Stress-test the active zone's thesis |
| `rt.synthesise()` | Cross-zone meta-thesis |
| `rt.idea_state()` | Full structured state (all zones + meta-graph) |
| `rt.save_idea()` | Persist active crystallised zone to meta-graph |
| `rt.reset_idea()` | Start fresh (meta-graph retained) |
| `rt.explain(a, b)` | Direct CRG relation between two concepts |
| `rt.reflexive_recall(query)` | **v3.7.2**: recall KB entries matching the query |
| `rt.solve_critpt(problem_id, limit)` | **v3.7.3**: solve CritPt code-generation challenges |
| `rt.last_diag()` | Last turn's diagnostics |

---

## Confidence Tags (in responses)

| Tag | Meaning |
|-----|---------|
| `[computed]` | SymPy numeric result (highest confidence) |
| `[computed→grounded]` | Result snapped to a lattice number-word |
| `[symbolic:differentiate]` | SymPy symbolic operation |
| `[symbolic:solve]` | SymPy equation solving |
| `[CRG:generates]` | Hand-curated Concept Relation Graph edge |
| `[CRG:auto]` | Auto-proposed edge (lower confidence) |
| `[lattice_adjacent_N]` | **v3.7.2**: lattice-discovered edge (weight N) |
| `[KB]` | Looked up from the system knowledge base |
| `[recall]` | **v3.7.2**: KB entries recalled via reflexive recall |
| `[inferred tick=N]` | Autonomous tick discovered this |
| `[verify]` | Ontological health (NRCI, symmetry tax) |
| `[CONTRADICTION]` | Backbone contains a contradicting edge |
| `[META-THESIS]` | Cross-zone unifying statement |
| `[I get it]` | Idea crystallised (coherence >= 0.70) |
| `[I get it — PROVISIONAL]` | Counter-query landed, confidence reduced |
| `[I get it — refined]` | Thesis refined after stronger edge arrived |
| `[warm-start]` | Matched a prior crystallised idea |
| `[forming]` | **v3.7.1**: idea has evidence but hasn't crystallized yet |
| `[qtype:computation]` | **v3.7.2**: query classified as computation |
| `[qtype:proof]` | **v3.7.2**: query classified as proof |
| `[deliberated:pattern]` | **v3.7.3**: deliberative reasoning layer solved this |
| `[method:...]` | **v3.7.3**: the deliberation method used |
| `[step]` | **v3.7.3**: a step in the reasoning trace |
| `[conclusion]` | **v3.7.3**: the deliberation's final answer |
| `[gap]` | No verified vector for these tokens |
| `[zones: N active=M]` | Multi-zone routing summary |

---

## Minimal Dependency List

### Knowledge Bases (2 files, both required)

| File | Size | Source | Purpose |
|------|------|--------|---------|
| `ubp_system_kb.json` | 1.7MB | `system_kb/ubp_system_kb.json` → copy to `/core/` | Primary UBP knowledge base (751 entries) |
| `ubp_lang_kb_combined_v4.json` | 11.0MB | `core/ubp_lang_kb_combined_v4.json` | Combined language KB (1041 entries) |

### Python Substrate (15 files, all in `/core/`)

These are imported (directly or transitively) by `glm_v37_grown.py`.
All must be present in the directory pointed to by `UBP_CORE_PATH`.

**Direct imports (6 files):**
- `ubp_unified_v5.py` — Golay/Leech engines, `BinaryLinearAlgebra`, `MOG_CATEGORIES`
- `glm_engine_v31.py` — `GLMSemanticEngine`, `create_semantic_engine`
- `ubp_critpt_sovereign_v3.py` — `GLMRulesEngine`, `SovereigntyRunner` (for solve_critpt)
- `glm_concept_relation_graph.py` — `ConceptRelationGraph`, `CRGEdge`, `build_default_crg`
- `glm_grammar_patch.py` — `_load_system_kb`, `_build_alias_map`, `_query_type`, alias patching
- `glm_multi_token_lexer.py` — `MultiTokenLexer`

**Transitive dependencies (9 files):**
- `glm_zoned_lattice_embedding.py` — `ZonedVocabulary` (used by `glm_lang_database`)
- `glm_grammar_fsm.py` — FSM gatekeeper (used by `glm_engine_v31`)
- `ubp_grammatical_diffusion.py` — A* reasoning (used by `glm_engine_v31`)
- `glm_semantic_frames.py` — semantic frames (used by `glm_engine_v31`)
- `glm_strict_lang_builder.py` — strict vocab builder (used by `glm_engine_v31`)
- `glm_lang_database.py` — 574-word priority vocabulary (used by `glm_strict_lang_builder`)
- `glm_physics_vocab_pack.py` — physics term vector derivation (used by `glm_strict_lang_builder`)
- `ubp_v28_oracle.py` — SymPy oracle layer (used by `ubp_critpt_sovereign_v3`)
- `critpt_glm_patch.py` — CritPt solver patch (used by `ubp_critpt_sovereign_v3`)

### Files NOT Needed (safe to exclude from a minimal deployment)

These legacy files are NOT loaded during boot and are NOT required for the
runtime to function:

- `glm_strict_vocabulary.json` (11.9MB) — a snapshot; runtime rebuilds vocab fresh
- `hash_memory_kb.json` (253KB) — never opened
- `ubp_lexicon_v2_defs.json` (473KB) — never opened
- `ubp_beliefs_kb.json` (18KB) — never opened
- `ubp_python_kb.json` (116KB) — never opened
- `critpt.json` (113KB) — only loaded if you call `solve_critpt()` explicitly
- `ubp_semantic_engine.py`, `ubp_semantic_sovereign.py`, `ubp_phenomenology.py`, `ubp_observer_dynamics.py` — experimental, never imported
- `auto_trigger.py` — UBP-App-specific, never imported (recall logic absorbed into glm_v37_grown)
- `glm_runtime.py` — v3.3 entry point, superseded by `GLMRuntimeV37`

---

## Boot Characteristics

- **Boot time**: ~3 seconds (2,338-word vocab + 127-edge CRG + 6 auto + 150 lattice + 55 numbers)
- **Per-turn latency**: 15–30ms for chat, 50–200ms for deliberative reasoning
- **Memory**: loads ~12.7MB of KB data into RAM
- **Determinism**: same input → byte-identical output (verified by self-test I)
- **Persistence**: `idea_meta_graph.json` accumulates crystallised ideas across sessions. Delete it to start fresh.

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'X'`
The substrate is missing a file. Ensure all 15 Python files listed above are
in your `UBP_CORE_PATH` directory. Re-clone the repo or fetch the missing
file from GitHub.

### `FileNotFoundError: ubp_system_kb.json`
The runtime expects this file in the current working directory (which
`glm_v37_grown.py` sets to `UBP_CORE_PATH` on import). Copy it there:
```bash
cp UBP_Repo/core_studio_v4.0/system_kb/ubp_system_kb.json \
   UBP_Repo/core_studio_v4.0/core/ubp_system_kb.json
```

### Self-test fails
If any of the 12 self-tests fail, do NOT proceed with further development.
The baseline is broken. Check that:
1. You're using Python 3.12+
2. SymPy is installed (`pip install sympy`)
3. All 15 substrate files are present and unmodified
4. Both KB files are present and unmodified

### Non-deterministic output
Self-test I checks determinism. If it fails, the meta-graph may have
accumulated stale state. Delete `idea_meta_graph.json` and re-run.

### Deliberative layer doesn't fire
The deliberative layer (§13) only fires when `compute_result is None and
symbolic_result is None` — i.e., when direct detection fails. If a query
matches a detect_compute or detect_symbolic pattern, the deliberative layer
is skipped. Check the response tags: if you see `[computed]` or
`[symbolic:...]`, the deliberative layer wasn't needed.

---

## v3.7.3 Build Notes

This is the grown build, layered on the v3.7 unified build:

- **v3.7.1**: user-friendly "still forming" fallback + `chat_with_effort()`
- **v3.7.2**: lattice CRG auto-linking (+150 edges), reflexive recall, gap-derivation, enhanced query-type detection
- **v3.7.3**: fixed detect_compute/symbolic (NL forms, vector ops, backtick stripping), alias-map recall, `solve_critpt()`, §13 deliberative reasoning layer

**Verified**: 12/12 self-tests pass. Gold-set accuracy: 28/28 (100%) — up from 6/28 (21%) at baseline.
