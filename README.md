# UBP Core Studio v5

**A deterministic, geometry-first computational framework based on the Universal Binary Principle (UBP).**

[![Version](https://img.shields.io/badge/Version-5.4.0-cyan.svg)](https://github.com/DigitalEuan/UBP_Repo)
[![Status](https://img.shields.io/badge/Status-Hardened-green.svg)]()
[![Core](https://img.shields.io/badge/Core-Float--Free-blue.svg)]()

**Author:** Euan R. A. Craig, New Zealand
**License:** Experimental research platform — please double-check results against your own work before drawing conclusions.

---

## What is the UBP?

The **Universal Binary Principle (UBP)** is a computational framework built on a specific hypothesis: that computation, physics, and language can all be grounded in a single 24-bit geometric substrate — the [Golay code](https://en.wikipedia.org/wiki/Binary_Golay_code) `[24, 12, 8]` and the [Leech lattice](https://en.wikipedia.org/wiki/Leech_lattice) `Λ₂₄`.

This is **not** a standard neural network or probabilistic AI. The UBP is deterministic and exact: it uses Python's `fractions.Fraction` for all arithmetic (no floating-point approximation), and it derives physical constants from geometric primitives rather than measuring them.

### The three core ideas

1. **The 24-bit substrate.** The [extended binary Golay code](https://en.wikipedia.org/wiki/Binary_Golay_code) `[24, 12, 8]` is a perfect error-correcting code: 24-bit codewords that can correct any 3-bit error. The UBP treats this code as the foundational "geometry of information" — every concept, every computation, and every physical constant is represented as a point in this 24-dimensional space.

2. **The Leech lattice.** The [Leech lattice](https://en.wikipedia.org/wiki/Leech_lattice) `Λ₂₄` is a dense sphere-packing in 24 dimensions, built *from* the Golay code. It is one of the most symmetric structures in mathematics (its automorphism group is `Co₀`, order ~8×10¹⁸). The UBP uses the Leech lattice as the "stability landscape" — points on the lattice are stable, points off it are noisy.

3. **Geometric derivation of constants.** Physical constants (fine-structure constant, proton/electron mass ratio, gravitational constant) are derived from substrate geometry — specifically from three constants:
   - **The Triadic Monad:** π × φ × e (where φ is the golden ratio)
   - **The Entropic Wobble (w):** the fractional residue of the Monad
   - **The Observer Constant (Y):** 1 / (π + 2/π) ≈ 0.2647

---

## What is Core Studio?

UBP Core Studio is the interactive research environment for exploring this framework. It has two main components:

### 1. The Web Interface (Tab 1)

A browser-based workspace (deployed on [Google AI Studio](https://ai.studio/apps/6d78d479-2a4e-4e34-89b3-4b87b85d5b9a)) that provides:

- **In-browser Python execution** via Pyodide — run UBP scripts in a sandboxed virtual filesystem without installing anything
- **Hybrid AI architecture** — leverages Gemini for high-level reasoning and connects to local LLMs (Ollama, LM Studio) for private inference
- **Visualization** — integrated matplotlib plotting and Three.js 3D viewer for geometric domain exploration
- **Reflexive memory** — persistent knowledge bases (System, Language, Beliefs, Study) that evolve with your research

### 2. The Geometric Language Machine (Tab 2)

The GLM is the UBP's experimental deterministic AI engine. Instead of predicting the next token probabilistically (like standard LLMs), it grounds every concept as a 24-bit vector in the Golay/Leech substrate and reasons by computing geometric relationships between those vectors.

**The GLM has its own [dedicated README](https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/GLM/README.md)** with full documentation of its architecture, pipeline, and the new Refined NRCI.

---

## System Architecture

### Layer 1: The Mathematical Substrate (`ubp_unified_v5.py`)

The foundational engine. A float-free, exact-rational implementation using Python's `fractions.Fraction`.

| Engine | What it does |
|--------|-------------|
| **Golay Engine** | Systematic encoding and syndrome-based error correction (corrects up to 3-bit errors). 2,325-entry syndrome lookup table. All 4,096 codewords and 759 octads (weight-8 codewords) available. |
| **Leech Engine** | Computes the **Non-Random Coherence Index (NRCI)** — a stability metric for any 24-bit point. Points on the Leech lattice have high NRCI; noisy points have low NRCI. Uses the exact UBP Y constant. |
| **Barnes-Wall Engine** | Recursive projection into 256D, 512D, and 1024D for macro-scale stability analysis. |

### Layer 2: The Refined NRCI (`refined_nrci.py`)

**New in v5.4.0.** The original NRCI was sign-blind — all 128 sign-variants of an octad had identical NRCI, discarding 7 bits of information per octad. The Refined NRCI is a 5-shell system that recovers this lost structure:

| Shell | What it measures | Sign-sensitive? |
|-------|-----------------|-----------------|
| 0 — Golay | Hamming weight + norm (original NRCI) | No |
| 1 — Sign-parity | Balance of positive vs negative coordinates | Yes (5 unique values) |
| 2 — Sextet-balance | Evenness across 4 MOG tetrads | Partial |
| 3 — Coset-type | Golay syndrome weight | No |
| 4 — Sextet-signed | 4-tuple of signed sextet sums | Yes (24 unique patterns) |

The Refined NRCI breaks sign-blindness: 1 unique value across 128 octad variants becomes 9. See the [GLM README](https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/GLM/README.md#refined-nrci) for full documentation.

### Layer 3: The Geometric Language Machine (GLM)

The deterministic AI engine. See the [GLM README](https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/GLM/README.md) for complete documentation.

---

## Key Benchmarks

### v5.4.0 — Physical Constant Derivations

| Constant | UBP Derivation | Value | Error % | Method |
|----------|---------------|-------|---------|--------|
| Muon/Electron mass ratio | 169 / w | 206.7075 | 0.0294% | Pure inverse (13-D sink) |
| Gravitational constant (G) | (39/29) × (Y¹⁸ / w) | 6.6831 × 10⁻¹¹ | 0.1327% | Topological resonance |
| Proton/Electron mass ratio | 1836 + 2Lₛ | 1836.1527 | 0.0000% | Stereoscopic (29/24) |
| Fine-structure constant (1/α) | 220 − 83 + L | 137.0360 | 0.0196% | Core ratio |

These are derived from substrate geometry (π, φ, e, Y, w), not measured empirically. The sub-percent errors suggest the substrate captures real structure, though the framework remains experimental.

---

## Getting Started

### Option 1: Web Interface (no installation)

Access the deployed environment at [Google AI Studio](https://ai.studio/apps/6d78d479-2a4e-4e34-89b3-4b87b85d5b9a). It runs entirely in your browser.

### Option 2: Local Development

**Requirements:** Python 3.12+ (optimized for native bitwise operations)

**Dependencies:**
```bash
pip install numpy sympy
```
> SymPy is used for verification only, never for actual computation. All UBP computation uses exact rational arithmetic.

**Running the GLM engine:**
```bash
# Self-test
python3 core_studio_v4.0/GLM/GLM12_cli_entry.py --test

# Interactive chat
python3 core_studio_v4.0/GLM/GLM12_cli_entry.py --chat "what is hydrogen?"

# Prose-mode chat (longer, more fluent responses)
python3 core_studio_v4.0/GLM/GLM12_cli_entry.py --chat-prose "how does the hamiltonian generate time?"
```

### Option 3: Use the Refined NRCI in your own code

```python
from refined_nrci import RefinedNRCI
from ubp_unified_v5 import GOLAY_ENGINE

# Initialize with the real Golay engine (for Shell 3)
rnrci = RefinedNRCI(golay_engine=GOLAY_ENGINE)

# Compute on a 24-bit binary vector
nrci = rnrci.compute([1,0,1,1,0,0,1,0,1,1,0,1,0,1,1,0,1,0,0,1,1,0,1,0])

# Compute on a physical Leech point (±2 coordinates) — sign-sensitive
nrci_leech = rnrci.compute([2,-2,0,2,2,-2,0,0,0,0,2,-2,0,2,-2,0,2,0,0,-2,0,2,0,-2])

# Full breakdown of all shells
breakdown = rnrci.describe([2,-2,0,2,2,-2,0,0,0,0,2,-2,0,2,-2,0,2,0,0,-2,0,2,0,-2])
```

---

## Repository Structure

```
UBP_Repo/
├── core_studio_v4.0/
│   ├── core/
│   │   ├── ubp_unified_v5.py          # The mathematical substrate (Golay + Leech + Barnes-Wall)
│   │   └── refined_nrci.py            # The 5-shell sign-sensitive NRCI (new)
│   ├── GLM/                           # The Geometric Language Machine (see GLM/README.md)
│   │   ├── GLM11_runtime.py           # The orchestrator (8-step chat pipeline)
│   │   ├── GLM21_generator.py         # Word-chain generator (lattice walk)
│   │   ├── GLM22_ontological_grammar.py  # SVO grammar (computed from vector geometry)
│   │   ├── refined_nrci.py            # Drop-in NRCI module (also here for GLM use)
│   │   └── ... (34 modules total)
│   ├── system_kb/                     # Knowledge bases (746 entries, 420 Laws)
│   │   ├── ubp_system_kb.json
│   │   └── ...
│   └── studies/                       # Application studies (nuclear physics, etc.)
├── ubp_3.7/                           # Earlier UBP implementation (archive)
└── ... (research papers, studies)
```

---

## Core Concepts (for newcomers)

### What is the Golay code?

The [extended binary Golay code](https://en.wikipedia.org/wiki/Binary_Golay_code) `[24, 12, 8]` is a perfect error-correcting code. It encodes 12 bits of data into 24-bit codewords such that any 3-bit error can be detected and corrected. It was used in the Voyager spacecraft. The UBP treats it as the geometry of information itself.

### What is the Leech lattice?

The [Leech lattice](https://en.wikipedia.org/wiki/Leech_lattice) `Λ₂₄` is a dense sphere-packing in 24 dimensions. It is built from the Golay code: each Golay codeword lifts to 128 Leech lattice points (with different sign patterns). The Leech lattice is one of the most symmetric structures known — its automorphism group relates to the [Monster group](https://en.wikipedia.org/wiki/Monster_group).

### What is the NRCI?

The **Non-Random Coherence Index (NRCI)** measures how "stable" a point in the 24-bit substrate is. It is computed as:

```
tax = hw × Y + ns / 8
NRCI = 10 / (10 + tax)
```

where `hw` is the Hamming weight (count of nonzero coordinates), `ns` is the sum of squares, and `Y` is the Observer Constant (~0.2647). High NRCI means the point sits at a stable lattice position; low NRCI means it is noisy.

The **Refined NRCI** (new) adds 4 more shells to this, breaking the sign-blindness of the original. See the [GLM README](https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/GLM/README.md#refined-nrci) for details.

### What is the GLM?

The [Geometric Language Machine](https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/GLM/README.md) is the UBP's deterministic AI. Instead of predicting tokens probabilistically, it grounds every word as a 24-bit vector and reasons by computing geometric relationships (Hamming distance, NRCI, lattice position) between those vectors. It is experimental and under active development.

---

## Security & Privacy

- **Client-side execution:** Studio Python code runs entirely in your browser's sandbox
- **Local AI privacy:** Local LLM integration (Ollama, LM Studio) ensures sensitive prompts never leave your machine
- **Secure API handling:** User Gemini API keys are injected at runtime; they are never persisted in the codebase

---

## Related Repositories

| Resource | Link |
|----------|------|
| **Live Environment** | [Google AI Studio](https://ai.studio/apps/6d78d479-2a4e-4e34-89b3-4b87b85d5b9a) |
| **Core Studio App** | [github.com/DigitalEuan/ubp_core_studio_app](https://github.com/DigitalEuan/ubp_core_studio_app) |
| **Digital Twin Physics Engine** | [github.com/DigitalEuan/ubp_digital_twin_physics_engine](https://github.com/DigitalEuan/ubp_digital_twin_physics_engine) |
| **GLM Documentation** | [GLM/README.md](https://github.com/DigitalEuan/UBP_Repo/blob/main/core_studio_v4.0/GLM/README.md) |
| **Operational Manifest** | [`core/ubp_files_and_usage.md`](core/ubp_files_and_usage.md) |
| **Knowledge Bank** | [`system_kb/ubp_system_kb.json`](system_kb/ubp_system_kb.json) (746 entries, 420 Laws) |

---

## License

This project is part of the UBP research initiative by Euan R. A. Craig.
