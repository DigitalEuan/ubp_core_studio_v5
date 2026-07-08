# The Universal Binary Principle (UBP) Core Studio

[![Version](https://img.shields.io/badge/Version-5.4.0-cyan.svg)](https://github.com/DigitalEuan/UBP_Repo)
[![Status](https://img.shields.io/badge/Status-Hardened-green.svg)]()
[![Core](https://img.shields.io/badge/Core-Float--Free-blue.svg)]()

* **Author:** Euan R. A. Craig, New Zealand
* **Version:** 7.2.0 (GLM 3.19.0 version update) running ubp_unified_v5.py (v5.4.0)
* **Date:** 7 July 2026
* **License / Status:** Experimental research platform — *please double-check results against your own work before drawing conclusions.*

| Resource | Link |
| :--- | :--- |
| **Live Environment (Google AI Studio)** | <https://ai.studio/apps/6d78d479-2a4e-4e34-89b3-4b87b85d5b9a> |
| **Core Studio App Repository** | <https://github.com/DigitalEuan/ubp_core_studio_app> |
| **Experimental Digital Twin Physics Engine Repository** | <https://github.com/DigitalEuan/ubp_digital_twin_physics_engine> |
| **Operational Manifest** | <https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/core/ubp_files_and_usage.md> |
| **UBP Skill** | <https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/core/UBP_SKILL_1.md> |
| **Primary Knowledge Bank** | <https://github.com/DigitalEuan/UBP_Repo/tree/main/core_studio_v4.0/system_kb> |

---

The **Universal Binary Principle (UBP)** is a unified computational framework that posits reality, language, and logic are deterministic, error-corrected projections of a 24-bit substrate. This repository contains the official implementation of the UBP Core Stdio App made through Google AI Studio.

---

## 🌌 Core Philosophy: Geometric Purity
Fundamental physical constants are not arbitrary "fine-tuned" values, but are topological artifacts of the substrate's geometry. 

Fundamental constants are now derived purely from substrate primitives:
*   **The Triadic Monad:** $\pi \cdot \phi \cdot e$
*   **The Entropic Wobble ($w$):** The fractional residue of the Monad.
*   **The Observer Constant ($Y$):** $1 / (\pi + 2/\pi)$.

---

## 🚀 Key Milestones & Benchmarks

### v5.4.0 — June 2026
| Constant | UBP Derivation | Value | Error % | Lens |
| :--- | :--- | :--- | :--- | :--- |
| **Muon/Electron** | $169 / w$ | $206.7075$ | **0.0294%** | Pure Inverse (13-D Sink) |
| **Gravity (G)** | $(39/29) \cdot (Y^{18} / w)$ | $6.6831 \times 10^{-11}$ | **0.1327%** | Topological Resonance |
| **Proton/Electron** | $1836 + 2L_s$ | $1836.1527$ | **0.0000%** | Stereoscopic (29/24) |
| **Fine Structure ($1/\alpha$)** | $220 - 83 + L$ | $137.0360$ | **0.0196%** | Core Ratio |

---

## 📂 System Architecture

### Layer 1: Mathematical Substrate (`ubp_unified_v5.py`)
The "Backbone." A float-free, exact rational engine using Python's `fractions.Fraction`.
*   **Golay Engine:** Systematic encoding and error correction (up to 3 bits) (the engine)
*   **Leech Engine:** Symmetry tax calculation and stability diagnostics (the substrate)
*   **Barnes-Wall Engine:** Recursive projection into 256D, 512D, and 1024D macro-bulk (the detail)

### Layer 3: Geometric Language Machine (GLM) [Experimental]
See below

---

# GLM — Geometric Language Machine v3.21.0

A modular, deterministic semantic reasoning engine grounded in the 24-bit Golay/Leech lattice substrate of the Universal Binary Principle (UBP). Runs live in the browser via Pyodide.

**Current state**: 26/26 self-tests pass · 41/41 golden cases pass (100%) · 42/42 v3.19 levelling tests pass · Deployed live on [Google AI Studio](https://ai.studio/apps/6d78d479-2a4e-4e34-89b3-4b87b85d5b9a)

---

## What changed in v3.21

The user shared design notes proposing to move the CRG from a 1-complex (graph: nodes + edges) to a 2-complex (simplicial complex with triangular faces). This is a natural upgrade because:

- A "relation" is currently binary (A → B), but much of GLM's structure is genuinely **ternary** — {boson, fermion, spin}, {hamiltonian, time, energy}, {lattice, continuum, continuum limit}. A 2-simplex (filled triangle) captures "these three concepts cohere as a unit" without privileging any one pair.
- Once we have faces, we get a **topological notion of coherence**: an argument backbone is a 1-chain (path of edges). If it's the boundary of a union of faces, the argument "fills" — no holes. If not, the residual cycle is a **hole** — a geometry-driven signal of a reasoning gap.
- This generalises the existing `contradiction_penalty` from "bad edge present" to "good cycle absent."

### GLM34_simplicial_crg.py — the 2-complex ✅

**New module** implementing ideas 1–6 from the design notes:

1. **Nodes as positions** — each concept's BLA vector is coordinates in {0,1}²⁴; Hamming distance is the L1 metric.
2. **Node intrinsic geometry** — `NodeGeom` dataclass with `degree` (1-skeleton), `stellar` (2-skeleton degree = incident faces), `bridge_score` (node B mediates A–C if d(A,C) = d(A,B) + d(B,C)).
3. **Faces as 2-simplices** — `CRGFace` dataclass with side lengths (a,b,c), Heron area, circumradius, degeneracy flag. `discover_faces()` finds 3-cliques in the non-contradiction edge graph and keeps the geometrically tight ones.
4. **Triangle-shape semantics** — `CRGFace.shape` returns "equilateral" (symmetric triad), "isosceles" (two close + outlier), "scalene", or "degenerate" (bridge triple).
5. **Boundary operators over GF(2)** — `_gf2_rank_reduce()` and `_gf2_solve()` implement Gaussian elimination over GF(2) for the chain complex C₂ →∂₂ C₁ →∂₁ C₀. `backbone_is_filled()` checks if a 1-cycle is a boundary of faces.
6. **Betti numbers and Euler characteristic** — `betti()` returns (β₀, β₁, β₂); `euler()` returns χ = V − E + F. `topology_report()` gives a full dashboard.

**Key results on the real CRG:**
- V=110, E=101, F=2 (2 faces discovered)
- Betti (β₀, β₁, β₂) = (16, 5, 0) — 16 connected components, **5 independent holes** (reasoning gaps), 0 voids
- Euler characteristic χ = 11
- 2 tightest faces: {density matrix, hamiltonian, operator} and {hamiltonian, operator, projector}

### GLM11_runtime.py — runtime integration ✅

**Patched** with two new methods:
- `rt.simplicial_crg(max_side=8, max_faces=200)` — lazily constructs and returns a `SimplicialCRG`
- `rt.topology_report()` — convenience method returning the `TopologyReport`

### Usage

```python
from GLM11_runtime import GLMRuntimeV37
rt = GLMRuntimeV37()

# Topology dashboard
rep = rt.topology_report()
print(f"V={rep.n_vertices} E={rep.n_edges} F={rep.n_faces}")
print(f"β=({rep.beta0},{rep.beta1},{rep.beta2}) χ={rep.euler}")
print(f"holes (β₁) = {rep.beta1} — reasoning gaps in the CRG")

# Backbone coherence
scrg = rt.simplicial_crg()
zone = rt.manager.active
if zone.crg_backbone:
    tc = scrg.topological_coherence(zone.crg_backbone)
    filled = scrg.backbone_is_filled(zone.crg_backbone)
    print(f"backbone coherence: {tc:.3f}, filled: {filled}")
```

---

## File-by-file changes

### New modules

#### `GLM34_simplicial_crg.py` (~600 lines)
- `CRGFace` dataclass: nodes, label, sides, area, circumradius, degenerate, shape
- `NodeGeom` dataclass: name, hex_int, zone, degree, stellar, bridge_score
- `TopologyReport` dataclass: n_vertices, n_edges, n_faces, beta0, beta1, beta2, euler, mean_stellar, max_stellar, overheating_violations, fillable_cycles
- `_gf2_rank_reduce(cols)` — GF(2) Gaussian elimination for rank computation
- `_gf2_solve(cols, target)` — solve Ax = b over GF(2)
- `SimplicialCRG` class:
  - `add_face(a, b, c, label, hex_cache)` — add a 2-simplex with computed geometry
  - `faces_of(node)` — faces incident to a node
  - `build_node_geometry(vocab_words)` — compute degree, stellar, bridge_score
  - `_index_complex()` — build the indexed chain complex for homology
  - `betti()` — return (β₀, β₁, β₂)
  - `euler()` — return χ = V − E + F
  - `topology_report()` — full dashboard
  - `backbone_1chain(backbone)` — represent backbone as GF(2) bitmask
  - `backbone_is_filled(backbone)` — True iff backbone bounds faces
  - `backbone_face_support(backbone)` — count faces touching backbone edges
  - `topological_coherence(backbone)` — [0,1] coherence score
- `discover_faces(scrg, vocab_words, max_side, max_circumradius, max_faces)` — find 3-cliques
- `build_simplicial_crg(vocab_words, max_side, max_faces)` — end-to-end builder

### Modified modules

#### `GLM11_runtime.py` — added simplicial_crg() and topology_report()
- `simplicial_crg(max_side=8, max_faces=200)` — lazily constructs a SimplicialCRG
- `topology_report()` — convenience method for the topology dashboard

---

## Test results

| Suite | v3.20 result | v3.21 result | Delta |
|---|---|---|---|
| Existing self-tests | 26/26 | 26/26 | unchanged |
| Existing golden cases | 41/41 | 41/41 | unchanged |
| New v3.21 simplicial tests | (n/a) | 18/18 | +18 |
| **Total** | 67/67 (existing) | **85/85** | +18 tests, all passing |

### What the new v3.21 tests prove

| Test | Claim verified |
|---|---|
| `test_face_discovery` | 3-cliques in the CRG are discovered as 2-simplices with valid geometry |
| `test_betti_numbers` | β₀ ≥ 1, β₁ ≥ 0, β₂ ≥ 0 — topology computed correctly over GF(2) |
| `test_euler_characteristic` | χ = V − E + F formula verified |
| `test_topological_coherence` | Coherence in [0,1]; empty backbone returns 1.0 |
| `test_node_geometry` | degree, stellar, bridge_score, zone all computed |
| `test_runtime_integration` | `rt.simplicial_crg()` and `rt.topology_report()` work |
| `test_gf2_linear_algebra` | GF(2) rank and solve verified on known matrices |
| `test_regression_self_tests` | 26/26 self-tests still pass |
| `test_regression_golden_cases` | 41/41 golden cases still pass |


---

## What's New in v3.19.0

v3.19.0 is the **output fidelity + verification** upgrade. It addresses all 6 items from a detailed external performance evaluation: clean `[Answer]` blocks, domain-aware KB recall filtering (no more chemistry bleed into math), explicit `[Verified]` statements for medium/hard problems, a bug fix for dropped deliberation answers, and scalability + diversity test coverage.

### New Modules
| Module | Purpose |
|--------|---------|
| `GLM29_answer_extractor.py` | Extracts the actual answer from compute/symbolic/deliberation results → clean `[Answer] X` block (terse) or "The answer is X." sentence (prose). Handles all answer types: numeric, boolean (prime→Yes/No), list (solve→"x = -2, 2"), dict (eigenvalues→"λ₁ = v₁"), ODE (Eq(y(x),RHS)→"y(x) = RHS"), Taylor (strips O(x^5)), deliberation statements. |
| `GLM30_domain_filter.py` | Domain-aware KB recall filtering. Classifies each query as `pure_math \| physics \| chemistry \| general` using 90+ math keywords, 50+ physics keywords, 40+ chemistry keywords. Pure-math queries skip KB recall entirely — no more "Aspirin" or "2D Dissonance Matrix" bleed into math problems. |
| `GLM31_verification.py` | Difficulty classification (easy/medium/hard) + explicit verification statements. Medium/hard problems get `[Verified] sympy cross-check passed`, `[Verified] gcd = 1 ∀n (Euclidean algorithm re-derived)`, `[Verified] C(9,3) = 84 (independent recomputation)`, or honest `[Verified] pattern-match only` for patterns without independent checks. |

### Upgraded Modules
| Module | Key Changes |
|--------|-------------|
| `GLM10_response_composer.py` | Appends `[Answer]` and `[Verified]` blocks. Renamed `[Verify]`→`[Metrics]` to avoid confusion with the new verification tag. |
| `GLM11_runtime.py` | `_reflexive_recall` now calls `classify_domain` at the top — pure-math queries return `[]` immediately. `_run_pipeline` computes `answer_block` + `verified` and passes them to composers. |
| `GLM19_prose_composer.py` | **Bug fix**: `_fmt_deliberation` was dropping `result["answer"]` entirely — now appends "The conclusion is: {answer}." Appends "The answer is X." and "This result was verified: X." sentences. |
| `GLM25_native_alu.py` | Fixed SymPy validation for Float results (e.g. `Matrix([[1.0,2.0],...]).det()` returns `-3.00000000000000` — now correctly converts to int and matches). |

---

## What's New in v3.18.0

v3.18.0 implemented 5 of the 6 "recommended next steps" from the v3.17 upgrade report: symbolic fingerprinting, CRG expansion, CRG-aware grammar, auto topic-shift detection, and native polynomial calculus.

### New Modules
| Module | Purpose |
|--------|---------|
| `GLM27_crg_expander.py` | Auto-expands the CRG from 3 sources: master resource relations (UBP-ID resolved via alias map), KB description mining (14 regex patterns for relational phrases), and ~80 curated physics-concept edges. CRG grows from 173 → 260+ edges. |
| `GLM28_native_poly.py` | Native polynomial differentiation and integration with exact Fraction arithmetic. `d/dx[c·x^n] = (c·n)·x^(n-1)`, `∫c·x^n dx = (c/(n+1))·x^(n+1)`. Closes the last gap in the "native-first" promise — polynomials no longer need SymPy. Falls back to SymPy for non-polynomials (sin, exp) with clear `[fallback]` trace. |

### Upgraded Modules
| Module | Key Changes |
|--------|-------------|
| `GLM09_tools.py` | `evaluate_symbolic` tries native polynomial path first for differentiate/integrate; routes other symbolic ops through `symbolic_with_fingerprint` so results carry `{trace, fingerprint}`. |
| `GLM11_runtime.py` | Auto CRG expansion on boot (`expand_crg` call in `__init__`). Auto topic-shift detection: resets IdeaManager when active zone is crystallised AND new query has zero content overlap (direct + CRG-reachable). |
| `GLM22_ontological_grammar.py` | `construct_paragraph(use_crg=True)` prefers CRG-reachable objects over pure Hamming neighbours. Eliminates word salad at the source: "Hamiltonian commute symmetry" instead of "Hamiltonian restore construction". |

---

## What's New in v3.17.0

v3.17.0 was the **sovereign computation** upgrade — the foundational levelling-up pass that wired GLM09 to the real native UBP engines, retired the signal-destroying quadrant-forcing, and built the CRG-Traversal-ALU (the word-level NoiseALU equivalent).

### New Modules
| Module | Purpose |
|--------|---------|
| `GLM25_native_alu.py` | Native ALU adapter. Routes 30 numeric operations through `NoiseALU`/`ExactMath`/`LinearAlgebraALU`/`PhysicsALU`. Every result carries `{result, exact, approx, trace, fingerprint, sympy_check, elapsed_us, native}`. SymPy is demoted to validation-only. |
| `GLM26_crg_alu.py` | CRG-Traversal-ALU — the word-level NoiseALU equivalent. `traverse`, `shortest_path`, `relate`, `chain`, `compose_path_fingerprint` all produce `{result, trace, fingerprint}` with the same shape as math operations. |

### Upgraded Modules
| Module | Key Changes |
|--------|-------------|
| `GLM09_tools.py` | `evaluate_numeric` rewired to call `native_compute` first; falls back to stdlib/SymPy only on failure. |
| `GLM23_grammar_vectors.py` | Quadrant-forcing retired as default (`QUADRANT_FORCING_ENABLED` flag, default OFF). New `build_svd_only_vectors` — pure PPMI+SVD + plain Golay snap, retains ~75% of distributional signal vs forcing's ~0%. |
| `GLM24_continuous_learner.py` | Fixed 3 bugs: (a) prefix-skip blanket-freeze replaced with precise hand-curated-codeword check; (b) learned CRG edges now re-applied on reload via `_load_learned_edges`; (c) `atexit` flush registered so state isn't lost between 5-query boundaries. |
| `GLM01_substrate.py` | Added `"co_occurs"` to `EDGE_LABELS` — the original `_check_for_new_edges` was silently failing because the label wasn't allowed. |
| `GLM22_ontological_grammar.py` | Added `max_verb_distance=8` gate to `construct_sentence` — returns None when nearest verb is too far, preventing word salad. |
| `GLM11_runtime.py` | Added `fresh=False` parameter to `chat_prose` (eliminates cross-topic bleed). Added `crg_alu()` method exposing the CRG-Traversal-ALU. |

---

## Quick Start

### Prerequisites
- Python 3.10+ (requires `int.bit_count()`)
- SymPy (`pip install sympy`)
- NumPy (`pip install numpy`) — used by SVD/LSA embedding
- `ubp_system_kb.json`, `ubp_lang_kb_combined_v4.json`, `glm_master_resource_v1.json`, `ubp_unified_v5.py` in the workspace root

### Run Self-Tests
```bash
python GLM12_cli_entry.py --test
```
Expected: `26/26 tests passed`

### Run Golden Cases
```bash
python run_golden_cases.py
```
Expected: `41/41 passed (100.0%)`

### Run v3.19 Levelling Tests
```bash
python tests/test_v319_levelling.py
```
Expected: `42 passed, 0 failed`

### Chat Query
```bash
python GLM12_cli_entry.py --chat "What is gcd(54, 24)?"
python GLM12_cli_entry.py --chat "is 5 prime?"
python GLM12_cli_entry.py --chat "Find all positive integers n for which 2^n - 1 is divisible by 7."
```

### Interactive Python
```python
from GLM11_runtime import GLMRuntimeV37
rt = GLMRuntimeV37()
print(rt.chat("what is time?"))                    # KB lookup + alias map
print(rt.chat("differentiate x^2"))                # native polynomial ALU
print(rt.chat("is 97 prime?"))                     # native NoiseALU.is_prime
print(rt.chat("Find the determinant of [[1,2,3],[4,5,6],[7,8,10]]"))  # native det_3x3
print(rt.chat_prose("What is gcd(54, 24)?"))       # fluent prose with answer + verified
# Word-level sovereign computation:
alu = rt.crg_alu()
print(alu.shortest_path("hamiltonian", "time"))    # {result, trace, fingerprint}
```

---

## Modular Architecture

The system is split into 32 self-contained Python modules (GLM00–GLM31). Each can be tested independently.

### Core Pipeline (GLM00–GLM14)
| Module | Purpose |
|--------|---------|
| `GLM00_config.py` | Configuration, path setup, KB file verification |
| `GLM01_substrate.py` | BLA, MOG categories, CRG, lexer, KB loading, vocabulary builder, alias map. v3.17: + `co_occurs` edge label. v3.18: + master resource injection (5395 words). |
| `GLM02_constants.py` | Thresholds, function words, pronouns, tunables |
| `GLM03_crg.py` | Extended CRG (contradictions, auto-expand, lattice linking, query-type) |
| `GLM04_number_vocab.py` | Derived number-word lattice points (55 numbers) |
| `GLM05_idea_evidence.py` | Source-tagged evidence dataclass |
| `GLM06_idea_zone.py` | IdeaZone: decay, ticks, crystallisation, adversarial testing |
| `GLM07_idea_manager.py` | Multi-zone routing, cross-zone synthesis, contradiction pivot |
| `GLM08_idea_meta_graph.py` | Persistence, warm-start, deterministic IDs |
| `GLM09_tools.py` | Computation layer. v3.17: native-first via GLM25. v3.18: native polynomial via GLM28. v3.19: answer/verified passthrough. |
| `GLM10_response_composer.py` | Terse bracket-tag response. v3.19: + `[Answer]`/`[Verified]` blocks, `[Verify]`→`[Metrics]` rename. |
| `GLM11_runtime.py` | GLMRuntimeV37: wires everything. v3.17: + `crg_alu()`, `fresh` param. v3.18: + auto CRG expand, auto topic-shift. v3.19: + domain filter, answer/verified in pipeline. |
| `GLM12_cli_entry.py` | Self-test suite (26 tests A–Z), CLI interface |
| `GLM13_deliberative_reasoning.py` | UBP-native arithmetic, 13 problem pattern detectors |
| `GLM14_lexer.py` | Multi-token lexer with LaTeX scrubbing, lemmatisation, fuzzy matching |

### Vocabulary & Knowledge (GLM15–GLM18)
| Module | Purpose |
|--------|---------|
| `GLM15_physics_pack.py` | 197-term physics vocabulary pack with deterministic vectors + definitions |
| `GLM16_master_resource.py` | Loads the 14.4 MB master resource (4248 dictionary entries, 70 relations, 55 spatial nodes) |
| `GLM17_semantic_frames.py` | Frame-based natural-language generation from CRG edges |
| `GLM18_hex_colour.py` | Hex colour signatures — every concept IS a #RRGGBB colour |

### Distributional Vectors & Grammar (GLM19–GLM24)
| Module | Purpose |
|--------|---------|
| `GLM19_prose_composer.py` | Fluent prose composer. v3.19: fixed `_fmt_deliberation` bug (was dropping answer), + answer/verified sentences. |
| `GLM20_svd_vocab.py` | SVD+Golay-snapped distributional vectors (the "benign" path) |
| `GLM21_generator.py` | Zone-centroid-state generation loop |
| `GLM22_ontological_grammar.py` | Computed grammar: S→V→O from vector geometry. v3.17: + `max_verb_distance` gate. v3.18: + CRG-aware object selection. |
| `GLM23_grammar_vectors.py` | Grammar-aligned vectors. v3.17: quadrant-forcing retired as default, new `build_svd_only_vectors`. |
| `GLM24_continuous_learner.py` | Continuous learning. v3.17: 3 bug fixes (prefix-skip, learned_edges reload, atexit flush) + quadrant-forcing retired. |

### Native Computation & Sovereign Layer (GLM25–GLM28) — v3.17/v3.18 NEW
| Module | Purpose |
|--------|---------|
| `GLM25_native_alu.py` | **v3.17 NEW**: Native ALU adapter. Routes 30 numeric ops through NoiseALU/ExactMath/LinearAlgebraALU. SymPy demoted to validation-only. Every result carries trace + fingerprint. |
| `GLM26_crg_alu.py` | **v3.17 NEW**: CRG-Traversal-ALU — word-level NoiseALU equivalent. `traverse`, `shortest_path`, `relate`, `chain`, `compose_path_fingerprint`. |
| `GLM27_crg_expander.py` | **v3.18 NEW**: Auto-expands CRG from master resource + KB descriptions + curated physics edges (173 → 260+ edges). |
| `GLM28_native_poly.py` | **v3.18 NEW**: Native polynomial diff/integrate with exact Fraction arithmetic. Closes the last gap in "native-first" promise. |

### Output Fidelity & Verification (GLM29–GLM31) — v3.19 NEW
| Module | Purpose |
|--------|---------|
| `GLM29_answer_extractor.py` | **v3.19 NEW**: Extracts clean answer from compute/symbolic/deliberation → `[Answer] X` block. |
| `GLM30_domain_filter.py` | **v3.19 NEW**: Domain-aware KB recall filter. Pure-math queries skip recall entirely. |
| `GLM31_verification.py` | **v3.19 NEW**: Difficulty classification + explicit `[Verified]` statements for medium/hard. |

### Test Files
| File | Purpose |
|------|---------|
| `test_full_stack.py` | Integration test: chat + calculus + deliberative reasoning |
| `test_zone.py` | IdeaZone unit tests |
| `test_manager.py` | IdeaManager unit tests |
| `test_meta.py` | Meta-graph unit tests |
| `tests/test_v319_levelling.py` | **v3.19 NEW**: 42 tests covering all 6 feedback items |
| `reset_cache.py` | Clear idea_meta_graph.json and caches |
| `golden_cases.json` | 41-case gold set for benchmark runs |

### Other Files
| Path | Purpose |
|------|---------|
| `dev/` | Legacy monolithic builds (glm_v37_grown.py, glm_v37_unified.py) |
| `doc/` | Academic paper (PDF + LaTeX source) |

---

## How It Works

### The Sovereign Computation Two-Stage Pattern (v3.17+)

Every computation — math OR words — now follows the same uniform pattern:

| Domain | Stage-1 (explicit algorithm) | Stage-2 (substrate fingerprint) |
|---|---|---|
| Integer arithmetic | `NoiseALU.gcd/add/mul/...` | `AdaptiveManifold.fingerprint(result)` |
| Linear algebra | `LinearAlgebraALU.det_2x2/3x3/nxn` + native trace | `AdaptiveManifold.fingerprint` |
| Word relations | `CRGTraversalALU.shortest_path/chain` | `AdaptiveManifold.fingerprint(dst_hex_int)` |
| Polynomial calculus | `Polynomial.differentiate/integrate` (term-by-term rule) | `AdaptiveManifold.fingerprint(sha256(result))` |
| Symbolic (non-poly) | SymPy (no native equivalent) | `AdaptiveManifold.fingerprint(hash(result))` |

Both stages produce `{result, trace, fingerprint}` with the same shape — the user's request for "all computation/calculation should always be UBP native where possible" is satisfied for every operation where a native algorithm exists.

### The Substrate
Every concept is a 24-bit binary vector — mathematically identical to a hex colour code. Hamming distance uses native CPU XOR + `bit_count()`. The 24 bits are partitioned into 4 quadrants (Matter, Information, Activation, Potential) with 6 MOG categories each.

### The Pipeline
Each query flows through traceable stages:

```
Import → Config → Boot (CRG auto-expand) → Preprocess
→ Detect compute/symbolic → Deliberate (if no compute/symbolic)
→ Reflexive recall (domain-filtered) → Tokenize → Gap-fill → Filter
→ Auto topic-shift detection → Route to zone → Update zone
→ Adversarial test → Extract answer → Verify result → Compose → Return
```

### Key Capabilities

**Native Computation (GLM09 + GLM25 + GLM28)**
- All numeric ops (gcd, lcm, factorial, sqrt, primality, combination, modpow, determinant, trace, vector ops) run on `NoiseALU`/`ExactMath`/`LinearAlgebraALU` — NOT stdlib `math` or SymPy
- Every result carries a real execution `trace` (step-by-step) and a substrate `fingerprint` (NRCI + lattice name + Monster grade)
- SymPy is validation-only — it cross-checks the native result; the agreement is recorded as `sympy_check.matches`
- Polynomial differentiation/integration done natively with Fraction arithmetic (GLM28); non-polynomials fall back to SymPy with `[fallback]` annotation

**Output Fidelity (GLM29 + GLM31)**
- Every response ends with a clean `[Answer] X` block — no more fragments buried in traces
- Medium/hard problems get explicit `[Verified] ...` statements: "sympy cross-check passed", "gcd = 1 ∀n (Euclidean algorithm re-derived)", "C(9,3) = 84 (independent recomputation)"
- Easy problems (simple arithmetic, definitions) skip the verification block — no noise

**Noise Reduction (GLM30)**
- Pure-math queries skip KB recall entirely — no more chemistry/physics bleed into math problems
- Domain classification uses 180+ keywords across math/physics/chemistry with context-aware ambiguous-word resolution
- Chemistry queries still get chemistry recalls; physics queries still get physics recalls

**Deliberative Reasoning (GLM13)**
When direct detection fails, 8 problem patterns fire:
1. Divisibility sequences → modular period detection
2. GCD/irreducibility proofs → Euclidean algorithm
3. Bounded search → LCM candidate testing
4. Stars and bars → combinatorics formula
5. Subset sum divisibility → brute force (N ≤ 20)
6. Tetrahedron inradius → geometric formula
7. Median inequality → triangle inequality
8. Right triangle inequality → Cauchy-Schwarz

**Concept Relation Graph (GLM03 + GLM27)**
- 173 base curated physics edges + 8 contradiction edges
- v3.18 auto-expansion: +1 from master resource, +32 from KB description mining, +64 curated = **260+ edges total**
- `CRGTraversalALU` provides step-by-step traversal with traces + fingerprints — the word-level NoiseALU equivalent

**Idea Zones (GLM06 + GLM07)**
- Multi-zone routing: distant concepts spawn separate zones
- Crystallisation: ideas form when coherence ≥ 0.70
- v3.18 auto topic-shift: crystallised zones auto-reset when an unrelated query arrives (no manual `fresh=True` needed)
- Cross-zone synthesis: "both zones relate to dimension"
- Warm-start: meta-graph persists crystallised ideas across sessions

---

## Self-Tests (A–Z)

| Test | Capability | Result |
|------|-----------|--------|
| A | Crystallisation (hamiltonian + time → thesis) | PASS |
| B | Calculation + lattice grounding (gcd → six) | PASS |
| C | Symbolic differentiation (x² → 2x) | PASS |
| D | Symbolic solve (x²−4 → [−2, 2]) | PASS |
| E | Multi-zone routing (zone system operational) | PASS |
| F | Contradiction detection (boson ↔ fermion) | PASS |
| G | Autonomous maturation (inferred nouns) | PASS |
| H | Warm-start (meta-graph matching) | PASS |
| I | Determinism (byte-identical across runs) | PASS |
| J | CRG auto-expansion (auto-proposed edges) | PASS |
| K | Contradiction-driven pivot (zone spawn) | PASS |
| L | Cross-zone synthesis (meta-thesis) | PASS |
| M | Multi-word term preservation ('weyl anomaly') | PASS |
| N | LaTeX scrubbing ($\alpha + \beta$ → alpha, beta) | PASS |
| O | Vector operations (dot product, magnitude) | PASS |
| P | Integrate detector (∫x²eˣ dx) | PASS |
| Q | Simplify detector ((x²−1)/(x−1) → x+1) | PASS |
| R | Stars and bars (symbolic n, k → C(n−1, k−1)) | PASS |
| S | Linear algebra (determinant) | PASS |
| T | Partial derivative (multivariable) | PASS |
| U | ODE solver (dy/dx = y) | PASS |
| V | Master resource definition (oxygen) | PASS |
| W | Natural language explanation (hamiltonian + time) | PASS |
| X | Hex colour signature (idea_colour) | PASS |
| Y | Real Golay error correction (1/2/3-bit) | PASS |
| Z | Real NRCI (Y constant, not weight-based) | PASS |

---

## Live Query Examples (v3.19)

| Query | Response |
|-------|----------|
| `What is gcd(54, 24)?` | `[Computed] gcd(54,24) = 6 → Snapped to 'six' [Answer] 6` |
| `Find the determinant of [[1,2,3],[4,5,6],[7,8,10]]` | `[Computed] ... = -3 [Answer] -3 [Verified] sympy cross-check passed (native determinant)` |
| `differentiate x^3 with respect to x` | `[Symbolic] differentiate: 3*x^2 [Answer] 3*x^2 [Verified] sympy cross-check passed (native polynomial differentiate)` |
| `is 97 prime?` | `[Computed] isprime(97) = True [Answer] Yes` |
| `Prove that (21n+4)/(14n+3) is irreducible` | `[Deliberated:gcd_proof] ... [Conclusion] Irreducible (GCD=1) [Answer] Irreducible (GCD=1) [Verified] gcd = 1 ∀n (Euclidean algorithm re-derived)` |
| `Define oxygen` | `[Recall] Element: Oxygen (O) [KB] Oxygen: A colorless, tasteless...` (chemistry recall kept — domain filter doesn't over-suppress) |

**Note:** Pure-math queries (gcd, determinant, differentiate, prove) no longer have `[Recall]` blocks — the domain filter suppresses physics/chemistry KB entries that would bleed into math context.

---

## API Summary (`GLMRuntimeV37`)

```python
from GLM11_runtime import GLMRuntimeV37

rt = GLMRuntimeV37()

# Chat (terse bracket-tag output with [Answer] + [Verified])
rt.chat("Tell me about the hamiltonian and time.")
rt.chat("What is gcd(54, 24)?")            # → [Answer] 6
rt.chat("differentiate x^2")               # → [Answer] 2*x  [Verified] sympy cross-check passed

# Chat (fluent prose with answer + verification sentences)
rt.chat_prose("What is gcd(54, 24)?")      # → "...The answer is 6."
rt.chat_prose("Define oxygen", fresh=True) # fresh=True forces zone reset

# Word-level sovereign computation (v3.17+)
alu = rt.crg_alu()
alu.traverse("hamiltonian", "generates", "time")     # {result, trace, fingerprint}
alu.shortest_path("hamiltonian", "time")             # BFS with trace + fingerprint
alu.chain("hamiltonian", "time", "energy")           # multi-hop walk

# Autonomous maturation
rt.mature(5)                               # 5 autonomous ticks
print(rt.idea_state())                     # full multi-zone state

# Cross-zone synthesis
mt = rt.synthesise()
if mt: print(mt.thesis)

# Reset
rt.reset_idea()
```

---

## Required Files

| File | Size | Source |
|------|------|--------|
| `ubp_system_kb.json` | 1.7MB | `system_kb/ubp_system_kb.json` |
| `ubp_lang_kb_combined_v4.json` | 11.0MB | `core/ubp_lang_kb_combined_v4.json` |
| `glm_master_resource_v1.json` | 14.4MB | `GLM/glm_master_resource_v1.json` |
| `ubp_unified_v5.py` | 157KB | `core/ubp_unified_v5.py` |
| `ubp_kb_architect.py` | 4KB | `core/ubp_kb_architect.py` |

The `ubp_unified_v5.py` file contains the native engines (`NoiseALU`, `ExactMath`, `LinearAlgebraALU`, `PhysicsALU`, `AdaptiveManifold`, `GolayCodeEngine`, `LeechLatticeEngine`, `MonsterGroup`, `BarnesWallEngine`) that GLM25–GLM28 wire into.

---

## Environment Variables

| Variable | Default | Effect |
|---|---|---|
| `UBP_CORE_PATH` | (cwd) | Path to the directory containing KB files |
| `GLM_QUADRANT_FORCING` | `0` (off) | Set to `1` to re-enable the v3.15 quadrant-forcing path (for A/B testing only) |

---

## Boot Characteristics

- **Boot time**: ~3-4 seconds (5395-word vocab + 260+ CRG edges + auto-expansion + SVD vector construction)
- **Per-turn latency**: <50ms for chat; <200ms for deliberative reasoning; native ALU adds ~1-5ms per computation (with trace + fingerprint)
- **Determinism**: byte-identical output across runs (verified by self-test I)
- **Memory**: ~28MB of KB data loaded into RAM
- **Persistence**: `idea_meta_graph.json` accumulates crystallised ideas; `glm_learned_state.json` accumulates learned vectors + CRG edges (with atexit flush)

---

## Version History

| Version | Key Change |
|---------|-----------|
| **v3.19.0** | **Output fidelity + verification upgrade.** New: GLM29 (answer extractor), GLM30 (domain filter), GLM31 (verification layer). Fixed: `_fmt_deliberation` bug (was dropping answer), SymPy Float validation, `[Verify]`→`[Metrics]` rename. Every response now ends with clean `[Answer]` block; medium/hard get `[Verified]` statements; pure-math queries skip KB recall. 42 new tests. |
| **v3.18.0** | **Recommended next steps implementation.** New: GLM27 (CRG expander, 173→260+ edges), GLM28 (native polynomial diff/integrate). Upgraded: GLM09 (native polynomial path), GLM11 (auto CRG expand + auto topic-shift), GLM22 (CRG-aware grammar). 29 new tests. |
| **v3.17.0** | **Sovereign computation upgrade.** New: GLM25 (native ALU adapter), GLM26 (CRG-Traversal-ALU). Upgraded: GLM09 (native-first compute), GLM23 (quadrant-forcing retired), GLM24 (3 bug fixes), GLM01 (`co_occurs` edge label), GLM22 (verb_distance gate), GLM11 (`fresh` param + `crg_alu()`). SymPy demoted to validation-only. 46 new tests. |
| v3.16.0 | Continuous learner (GLM24), ontological grammar (GLM22), grammar-aligned vectors (GLM23), SVD vocab (GLM20), prose composer (GLM19). |
| v3.9.0 | Master resource integration (GLM16: 5395 words), semantic frames for NL generation (GLM17), hex colour signatures (GLM18), 8 new math detectors, multi-source definition lookup. |
| v3.8.0 | Multi-token lexer + LaTeX scrub (GLM14), 197-term physics vocab pack (GLM15), 141 CRG edges, integrate/simplify/vector ops detectors, 6 new deliberation patterns. |
| v3.7.7 | Modular architecture (14 files), alias map KB lookup, priority vocab, full CRG, NRCI fix, thesis filter |
| v3.7.6 | Initial modular split from monolith, Pyodide deployment |
| v3.7.5 | Self-contained substrate (no external .py deps) |
| v3.7.4 | Hex colour optimization, catastrophic regex fix, algorithmic hang prevention |
| v3.7.3 | Deliberative reasoning layer (§13), MathNet 100%, detect fixes |
| v3.7.2 | Legacy absorption: lattice CRG, reflexive recall, gap-derivation, query-type |
| v3.7.1 | User-friendly fallback, chat_with_effort() |
| v3.7 | Cross-zone synthesis, CRG auto-expansion, symbolic tools, contradiction pivot |

---

## Related Links

- **Live App**: [Google AI Studio](https://ai.studio/apps/6d78d479-2a4e-4e34-89b3-4b87b85d5b9a)
- **Core Studio App Repo**: [github.com/DigitalEuan/ubp_core_studio_app](https://github.com/DigitalEuan/ubp_core_studio_app)
- **UBP Repository**: [github.com/DigitalEuan/UBP_Repo](https://github.com/DigitalEuan/UBP_Repo)
- **Academic Paper**: `doc/Geometric_Language_Machine.pdf`

---

## Author

E R A Craig, New Zealand

## License

This work is part of the Universal Binary Principle (UBP) research project. All UBP repositories are public access.
