# GLM v3.9.0 — Change Log

**v3.8.0 → v3.9.0**: vocab **1498 → 5395 words** (+3900 dictionary entries), self-tests **18 → 24**, golden cases **28 → 41** (still 100%). The upgrade integrates the previously-unused 14.4 MB `glm_master_resource_v1.json`, adds frame-based natural-language generation, exposes the hex-colour signature of every concept, and adds 8 new math detectors.

---

## New Files

### `GLM16_master_resource.py` (NEW — 230 lines)
Loads the `glm_master_resource_v1.json` (~14.4 MB). In v3.8.0 this resource was sitting on disk but **completely unused**. v3.9.0 wires it in to:
- Inject 3897 general-English dictionary entries (with full definitions, NRCI scores, hex_ints) into the vocab. KB and physics-pack entries take precedence.
- Add the 67 element↔law `relates_to` edges to the CRG.
- Expose 55 spatial_nodes (3D positions + hex colours) for the Pyodide UI to render as a concept constellation.
- Provide `lookup_definition(word)` and `lookup_hex_colour(word)` helpers.

**Vocab growth**: 1498 → 5395 words (+3900, a 3.6× increase).

### `GLM17_semantic_frames.py` (NEW — 270 lines)
Adapted from `core/glm_semantic_frames.py`. Provides frame-based natural-language generation from CRG edges. Instead of only emitting tagged "[Backbone] a | b", the system can now compose fluent sentences:
- "Hamiltonian generates time."
- "Hamiltonian commutes with symmetry."
- "Ads is dual to bcft."

**10 frame templates** cover: `definition_isa`, `definition_property`, `scales_as`, `depends_on`, `commutes_with`, `dual_to`, `generates`, `measures`, `has_property`, `is_a`.

**Key functions**:
- `fill_frame_from_edge(edge)` → verbalises a single CRG edge
- `verbalise_backbone(backbone, max_sentences=3)` → multi-sentence paragraph
- `generate_explanation(zone, query)` → full NL explanation of zone state
- `select_frames_for_query(query)` → deterministic frame selection by query type

### `GLM18_hex_colour.py` (NEW — 230 lines)
Exposes the foundational UBP insight: **every 24-bit concept vector IS a #RRGGBB hex colour**. The 24 bits map directly to the R, G, B channels (8 bits each).

**Key functions**:
- `vector_to_colour(vec)` → "#RRGGBB"
- `word_to_colour(word, vocab)` → look up a word's colour
- `blend_colours(vectors, weights)` → mix multiple concept colours (for "idea auras")
- `colour_distance(c1, c2)` → Euclidean RGB distance for similarity ranking
- `idea_signature(zone)` → {primary, secondary, blend, nrci, mog, evidence_count}
- `render_palette(words, vocab)` → palette of {word, colour, nrci} for concept maps
- `rank_by_colour_proximity(query_word, vocab)` → top-N colour-adjacent concepts

**Example colours**: hamiltonian=`#044e46`, time=`#236074`, energy=`#3814fb`, weyl anomaly=`#c08320`, symmetry=`#900611`.

The Pyodide UI can use this to render a concept constellation where each concept is a coloured dot, and an idea "aura" that shifts colour as the zone evolves.

---

## Modified Files

### `GLM01_substrate.py`
- Added `inject_master_vocab(words)` call in `_build_vocabulary()` (after the physics pack injection, before the contradiction fallbacks). Lazy import to avoid circular dependency. Non-fatal if the master resource is missing.

### `GLM02_constants.py`
- **Extended `FUNCTION_WORDS`** with 80+ common English verbs (tell, about, discuss, consider, use, make, get, know, think, see, come, go, find, want, put, take, ask, try, work, play, feel, become, seem, turn, leave, call, keep, begin, start, stop, end, live, die, eat, drink, sleep, wake, walk, run, stand, sit, read, write, speak, talk, hear, listen, watch, study, learn, teach, + conjugations). These are in the master resource as dictionary entries but should still be filtered from topic_nouns.

### `GLM09_tools.py`
- **Added 8 new detectors**:
  1. `determinant` — "Find the determinant of [[1,2,3],[4,5,6],[7,8,10]]"
  2. `eigenvalues` — "Find the eigenvalues of [[2,1],[1,2]]"
  3. `trace` — "Compute the trace of [[1,2],[3,4]]"
  4. `partial_diff` — "Compute the partial derivative of x^2*y with respect to y"
  5. `gradient` — "Find the gradient of x^2*y + y^2*z + z^2*x"
  6. `ode` — "Solve the ODE: dy/dx = y" or "Solve the ODE: y' = y"
  7. `taylor` — "Find the Taylor series expansion of exp(x) around 0"
  8. `limit` — "Find the limit of sin(x)/x as x -> 0"
- **Fixed ODE-vs-solve ordering bug**: the `_SOLVE_RE` regex was matching "Solve the ODE: y' = y" first (because "solve" appears), so the ODE detector never fired. Moved ODE detection BEFORE solve detection.
- **Fixed Taylor regex**: the original captured "exp(x) around 0" as the expression (including "around 0"). Added a second regex `_TAYLOR_RE2` that handles "around N" (no var=N) and tries it first.
- **Fixed `sp.removeO` bug**: `sp.removeO` doesn't exist; use `series_result.removeO()` method instead.
- **Fixed `_SERIES_RE` over-matching**: added a lookahead `(?=[\d`]|[a-z][\^\*\+\-/])` to require the captured group starts with a digit, backtick, or math expression — NOT English like "sum of the elements".
- Added `_parse_matrix(s)` helper using SymPy's Matrix parser.

### `GLM10_response_composer.py`
- **Multi-source definition lookup** in `_kb_description()`. Gathers candidates from 4 sources:
  1. Physics-pack definition (attached to vocab entry)
  2. Alias map → system KB
  3. Vector comparison (KB-derived words with matching vector)
  4. Master resource dictionary definition (NEW in v3.9.0)
  Picks the candidate with the **longest first-sentence** — this prefers rich dictionary definitions over terse KB descriptions like "Element: Oxygen (O): Oxygen (Z=8)."
- **Added `[NL]` block** to the response: if the zone has a CRG backbone, generate a 2-sentence NL paragraph via `verbalise_backbone()` and append it as `[NL] Hamiltonian generates time. Hamiltonian commutes with symmetry.`
- **Multi-word topic preference**: when selecting the topic word for the `[KB]` block, prefer multi-word nouns (physics-pack terms like "weyl anomaly") over single words. This ensures the rich physics definition is surfaced instead of a generic single-word KB entry.

### `GLM11_runtime.py`
- **Imports** `inject_master_relations`, `master_resource_status` from GLM16; `generate_explanation`, `verbalise_backbone` from GLM17; `idea_signature`, `word_to_colour` from GLM18.
- **`__init__`**: calls `inject_master_relations(self.crg)` to add the 70 element↔law edges. Caches `master_resource_status()` for diagnostics.
- **New public APIs**:
  - `explain(query="")` — generate a natural-language explanation of the current zone state via semantic frames.
  - `idea_colour()` — return the hex colour signature of the active zone.
  - `word_colour(word)` — look up the hex colour of a vocab word.
  - `master_status()` — report whether the master resource is loaded and its size.
- **`idea_state()`** now includes:
  - `colour`: the hex colour signature of the active zone (primary, secondary, blend, nrci, mog, evidence_count)
  - `master`: the master resource status (loaded, version, total_words, total_relations, etc.)

### `GLM12_cli_entry.py`
- **Added 6 new self-tests (S–X)**:
  - S: Linear algebra (determinant of [[1,2,3],[4,5,6],[7,8,10]] → -3)
  - T: Partial derivative (∂/∂y of x²y + y³z → x² + 3y²z)
  - U: ODE solver (dy/dx = y → C1·exp(x))
  - V: Master resource definition (oxygen → "colorless, tasteless, odorless...")
  - W: Natural language explanation (hamiltonian + time → "hamiltonian generates time")
  - X: Hex colour signature (idea_colour → #004044)
- Updated the test header from "v3.8.0" → "v3.9.0".

### `golden_cases.json`
- **Added 13 new golden cases** across 6 new suites:
  - `v39_linear_algebra` (3): determinant, eigenvalues, trace
  - `v39_multivariable` (2): partial derivative, gradient
  - `v39_differential_equations` (2): ODE (dy/dx and y' notations)
  - `v39_series` (2): Taylor series, limit
  - `v39_natural_language` (2): frame-based NL generation
  - `v39_definitions` (2): master resource dictionary definitions
- Updated `_meta.version` from "1.0" → "2.0", added `v3.9.0_updated` date, added new suites to the `suites` list and `sources` dict.

### `README.md`
- Updated version banner to v3.9.0.
- Added "What's New in v3.9.0" section with capability-gain table.
- Updated module table from 16 → 19 modules.
- Updated self-tests table from A–R (18) to A–X (24).
- Added v3.9.0 entry to version history.

---

## Files NOT Modified (deliberately)
- `GLM00_config.py`, `GLM03_crg.py`, `GLM04_number_vocab.py`, `GLM05_idea_evidence.py`, `GLM06_idea_zone.py`, `GLM07_idea_manager.py`, `GLM08_idea_meta_graph.py`, `GLM13_deliberative_reasoning.py`, `GLM14_lexer.py`, `GLM15_physics_pack.py` — no changes needed.
- `test_*.py` — unchanged (still pass).

---

## Test Results

| Suite | v3.8.0 | v3.9.0 |
|-------|--------|--------|
| Self-tests (A–R / A–X) | 18/18 | **24/24** |
| Golden: mathnet | 10/10 | **10/10** |
| Golden: mathnet_expanded | 10/10 | **10/10** |
| Golden: critpt | 1/1 | **1/1** |
| Golden: language | 4/4 | **4/4** |
| Golden: failure | 3/3 | **3/3** |
| Golden: v39_linear_algebra | — | **3/3** (NEW) |
| Golden: v39_multivariable | — | **2/2** (NEW) |
| Golden: v39_differential_equations | — | **2/2** (NEW) |
| Golden: v39_series | — | **2/2** (NEW) |
| Golden: v39_natural_language | — | **2/2** (NEW) |
| Golden: v39_definitions | — | **2/2** (NEW) |
| **Golden TOTAL** | **28/28 (100%)** | **41/41 (100%)** |

## How to Verify

```bash
cd /path/to/GLM_v3.9.0
# Make sure ubp_system_kb.json, ubp_lang_kb_combined_v4.json,
# and glm_master_resource_v1.json are present
python GLM12_cli_entry.py --test              # expect 24/24
python run_golden_cases.py                    # expect 41/41
```

## Pyodide Compatibility

All changes are pure-Python stdlib + SymPy (already used).  No new native dependencies.  The new modules (`GLM16_master_resource.py`, `GLM17_semantic_frames.py`, `GLM18_hex_colour.py`) import only from `GLM01_substrate` and stdlib, so they load cleanly in Pyodide.

## Boot Characteristics (v3.9.0)

- **Boot time**: ~3-4 seconds (loading the 14.4 MB master resource adds ~1-2s; vocab is now 5395 words).
- **Per-turn latency**: <50ms for chat; <200ms for deliberative reasoning; <100ms for NL explanation.
- **Determinism**: byte-identical output across runs (verified by self-test I).
- **Memory**: ~27 MB of KB + master resource data loaded into RAM (up from ~12.7 MB in v3.8.0).

## New APIs for the Pyodide UI

```python
rt = GLMRuntimeV37()

# v3.9.0: Natural-language explanation
rt.chat("Tell me about the hamiltonian and time.")
print(rt.explain())
# "Hamiltonian generates time. Hamiltonian commutes with density matrix."

# v3.9.0: Hex colour signature
sig = rt.idea_colour()
# {"primary": "#004044", "secondary": "#044e46", "blend": "#0a4a45",
#  "nrci": 0.75, "mog": "A_Energy", "evidence_count": 4}

# v3.9.0: Word colour lookup
print(rt.word_colour("weyl anomaly"))  # "#c08320"

# v3.9.0: Master resource status
print(rt.master_status())
# {"loaded": True, "total_words": 4256, "total_relations": 67, ...}

# v3.9.0: idea_state() now includes colour + master status
state = rt.idea_state()
# state["colour"]["primary"]  -> "#004044"
# state["master"]["total_words"]  -> 4256
```
