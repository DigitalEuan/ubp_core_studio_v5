# ══════════════════════════════════════════════════════════════════════════════
# §11  RUNTIME — THE ORCHESTRATOR (v3.7.6 Hardened)
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations
import sys, os, json, time, re, hashlib
from typing import List, Dict, Optional, Tuple, Any

# IMPORT ALL MODULES
from GLM01_substrate import (BLA, LEECH_ENGINE, _build_vocabulary, build_default_crg,
                             WordEntry, _load_kb_safe, _load_system_kb, _build_alias_map,
                             _CONCEPT_ALIASES)
from GLM02_constants import *
from GLM03_crg import auto_expand_crg, lattice_auto_link, _enhanced_query_type, build_extended_crg
from GLM04_number_vocab import inject_number_vocab
from GLM07_idea_manager import IdeaManager
from GLM08_idea_meta_graph import IdeaMetaGraph
from GLM09_tools import detect_compute, evaluate_numeric, detect_symbolic, evaluate_symbolic, ground_result
from GLM10_response_composer import compose_response
from GLM13_deliberative_reasoning import deliberate
from GLM14_lexer import MultiTokenLexer, scrub_latex   # v3.8.0: multi-token + LaTeX
from GLM16_master_resource import inject_master_relations, master_resource_status  # v3.9.0
from GLM17_semantic_frames import generate_explanation, verbalise_backbone  # v3.9.0
from GLM18_hex_colour import idea_signature, word_to_colour  # v3.9.0
from GLM00_config import KB_SYSTEM_PATH

class GLMRuntimeV37:
    def __init__(self, auto_expand: bool = True):
        self._last_compute = None
        self._last_symbolic = None
        self._last_warm_start = None
        self._last_pivot_spawned = None
        self.auto_expansions = []
        self.glm = self
        class FallbackDict(dict):
            def __getitem__(self, key):
                try:
                    return super().__getitem__(key)
                except KeyError:
                    k = key.lower().strip()
                    if k == 'hamiltonian':
                        if 'h' in self:
                            from copy import copy
                            item = copy(self['h'])
                            item.word = 'hamiltonian'
                            return item
                        from GLM01_substrate import WordEntry
                        return WordEntry(
                            word='hamiltonian',
                            vector=[0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
                            role='NOUN',
                            ubp_id='LAW_PHYSICAL_HAMILTONIAN_001',
                            nrci=0.75
                        )
                    elif k == 'time':
                        t_key = 't' if 't' in self else ('t<' if 't<' in self else None)
                        if t_key and t_key in self:
                            from copy import copy
                            item = copy(self[t_key])
                            item.word = 'time'
                            return item
                        from GLM01_substrate import WordEntry
                        return WordEntry(
                            word='time',
                            vector=[1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
                            role='NOUN',
                            ubp_id='LAW_PHYSICAL_TIME_001',
                            nrci=0.75
                        )
                    elif k == 'anomaly':
                        from GLM01_substrate import WordEntry
                        return WordEntry(
                            word='anomaly',
                            vector=[1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
                            role='NOUN',
                            ubp_id='LAW_ANOMALY_001',
                            nrci=0.75
                        )
                    elif k == 'plus':
                        from GLM01_substrate import WordEntry
                        return WordEntry(
                            word='plus',
                            vector=[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
                            role='NOUN',
                            ubp_id='NUM_PLUS',
                            nrci=0.5
                        )
                    elif k == 'minus':
                        from GLM01_substrate import WordEntry
                        return WordEntry(
                            word='minus',
                            vector=[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                            role='NOUN',
                            ubp_id='NUM_MINUS',
                            nrci=0.5
                        )
                    raise KeyError(key)

            def __contains__(self, key):
                return super().__contains__(key) or key.lower().strip() in {'hamiltonian', 'time', 'anomaly', 'plus', 'minus'}

        print("[GLM] Booting stack...")
        self.vocab_dict = FallbackDict(_build_vocabulary())
        self.crg = build_extended_crg()

        # Inject Numbers
        inject_number_vocab(self.vocab_dict)

        # Expand Graph
        if auto_expand:
            self.auto_expansions = auto_expand_crg(self.crg, self.vocab_dict)
            lattice_auto_link(self.crg, self.vocab_dict)
            # v3.18.0: also expand from the master resource, KB descriptions,
            # and curated physics edges. SESSION_SUMMARY §10 noted the CRG is
            # "drastically under-built relative to the 4,248-word vocabulary".
            # This triples the edge count (~170 → ~260+ edges).
            try:
                from GLM27_crg_expander import expand_crg
                self.crg_expansion = expand_crg(self.crg, self.vocab_dict,
                                                verbose=True)
            except Exception as _e:
                self.crg_expansion = {"error": str(_e)}

        # Wrap vocab for manager
        class Vocab:
            def __init__(self, d): self.words = d
        self.vocab = Vocab(self.vocab_dict)

        # v3.8.0: Build a multi-token lexer from the live vocabulary.
        # This preserves multi-word concepts like 'weyl anomaly' and scrubs
        # LaTeX ($\alpha$ -> 'alpha') before tokenisation.
        self.lexer = MultiTokenLexer(self.vocab_dict.keys())

        # v3.9.0: Inject the 70 element↔law `relates_to` edges from the
        # master resource.  Non-fatal if the resource is missing.
        try:
            inject_master_relations(self.crg)
        except Exception:
            pass

        self.manager = IdeaManager(vocab=self.vocab, crg=self.crg)
        self.meta_graph = IdeaMetaGraph()
        self._turn = 0
        self._kb_cache = None # Lazy load for recall
        # v3.9.0: cache the master resource status for diagnostics
        self._master_status = master_resource_status()
        # v3.16.0: Continuous learner — vectors improve as the system processes queries
        try:
            from GLM24_continuous_learner import ContinuousLearner
            self.learner = ContinuousLearner(self.vocab, self.crg)
        except Exception:
            self.learner = None

    def _reflexive_recall(self, query: str, qtype: str = "",
                          comp_res: Any = None, sym_res: Any = None,
                          delib_res: Any = None) -> List[Dict[str, Any]]:
        """Recall relevant KB entries using alias map + ID match + phrase match.

        v3.7.7: Added alias map consultation (word → ubp_id → KB entry).
        This fixes the issue where 'what is time?' didn't surface the
        Time KB entry because 'time' wasn't directly in any KB name.

        v3.8.0: Also consults the multi-token lexer output so multi-word
        physics terms like 'weyl anomaly' contribute to recall.  And adds
        direct vocab-definition recall for terms that have a physics-pack
        definition but no KB entry.

        v3.19.0: Added domain-aware filtering (GLM30). Pure-math queries
        skip KB recall entirely — no more chemistry/physics bleed into
        math problems. Other domains filter recalled entries by ubp_id
        prefix.
        """
        if self._kb_cache is None:
            self._kb_cache = _load_system_kb()

        # v3.19.0: Domain-aware filtering
        try:
            from GLM30_domain_filter import (classify_domain,
                                              should_suppress_recall,
                                              filter_recalled_by_domain)
            domain = classify_domain(query, qtype, comp_res, sym_res, delib_res)
            if should_suppress_recall(domain):
                return []  # pure_math — skip KB recall entirely
        except Exception:
            domain = "general"  # fallback: no filtering

        recalled = []
        ql = query.lower()

        # A. Direct ID Match (e.g., ELEM_H_001)
        ids_found = re.findall(r'\b[A-Z]+_[A-Z0-9_]+_\d+\b', query)
        for uid in ids_found:
            if uid in self._kb_cache:
                recalled.append(self._kb_cache[uid])

        # B. Alias map match (word → ubp_id → KB entry)
        # v3.8.0: use lexer output (preserves multi-word phrases) + fallback
        # to simple word extraction.
        try:
            alias_map = _build_alias_map()
            stop = {"the", "a", "an", "of", "is", "are", "what", "how", "tell",
                    "me", "about", "and", "in", "to", "for", "with", "explain",
                    "describe", "show", "find", "all", "positive", "integers"}
            # Use the lexer to get clean tokens (includes multi-word phrases)
            try:
                lexer_tokens = self.lexer.tokenise(ql)
            except Exception:
                lexer_tokens = re.findall(r'\b[a-z]{3,}\b', ql)
            query_words = set()
            for t in lexer_tokens:
                # Split multi-word phrases so each component also gets a chance
                query_words.add(t)
                for part in t.split():
                    if len(part) >= 3:
                        query_words.add(part)
            query_words -= stop
            for word in query_words:
                uid = alias_map.get(word)
                if uid and uid in self._kb_cache:
                    entry = self._kb_cache[uid]
                    if entry not in recalled:
                        recalled.append(entry)
        except Exception:
            pass

        # C. Phrase Match (KB names found in query)
        for uid, entry in self._kb_cache.items():
            name = entry.get("name", "").lower()
            if name and len(name) > 3 and name in ql:
                if entry not in recalled:
                    recalled.append(entry)
            if len(recalled) >= 5: break

        # D. v3.8.0: Vocab-definition recall for physics-pack terms.
        # If the query contains a multi-word physics term that's in the vocab
        # but not the KB, fabricate a minimal "recalled" entry from the
        # physics-pack definition so the response composer can surface it.
        try:
            for tok in self.lexer.tokenise(ql):
                entry = self.vocab_dict.get(tok)
                if entry and hasattr(entry, 'definition') and entry.definition:
                    # Build a synthetic recalled entry
                    synth = {
                        "ubp_id": getattr(entry, 'ubp_id', f"PV_{tok}"),
                        "name": tok.title() if ' ' in tok else tok.capitalize(),
                        "desc": entry.definition,
                        "vector": entry.vector,
                        "nrci": float(entry.nrci),
                        "_source": "physics_pack",
                    }
                    if synth not in recalled:
                        recalled.append(synth)
                    if len(recalled) >= 5: break
        except Exception:
            pass

        # v3.19.0: Apply domain filter to the recalled entries
        try:
            from GLM30_domain_filter import filter_recalled_by_domain
            # Extract query words for the "always keep direct matches" rule
            query_words = []
            try:
                for tok in self.lexer.tokenise(ql):
                    query_words.append(tok)
            except Exception:
                query_words = re.findall(r'\b[a-z]{3,}\b', ql)
            recalled = filter_recalled_by_domain(recalled, domain, query_words)
        except Exception:
            pass

        return recalled[:5]

    def last_diag(self) -> Dict[str, Any]:
        return {
            "compute": self._last_compute,
            "symbolic": self._last_symbolic,
            "warm_start": self._last_warm_start,
            "pivot_spawned": self._last_pivot_spawned
        }

    def _run_pipeline(self, query: str) -> dict:
        """Shared pipeline for both chat() and chat_prose().

        v3.11.0: Extracted from chat() so both composers can use the same
        pipeline state.  Returns a dict of all pipeline results.
        """
        self._turn += 1
        # Between-turn maturation: decay + tick
        if self.manager.zones:
            self.manager.decay_all(age_turns=1.0)
            self.manager.tick_all()
        active = self.manager.active
        # Warm-start: check if current content matches any prior crystallised idea
        self._last_warm_start = None
        active = self.manager.active
        resolved, subs = active.resolve_anaphora(query)

        # 1. Tools
        comp_res = None
        c_req = detect_compute(resolved)
        if c_req:
            eval_res = evaluate_numeric(c_req)
            comp_res = {"computation": c_req, "result": eval_res,
                        "grounded": ground_result(eval_res.get("approx", 0), self.vocab)}
        self._last_compute = comp_res

        sym_res = None
        s_req = detect_symbolic(resolved)
        if s_req:
            sym_res = {"computation": s_req, "result": evaluate_symbolic(s_req)}
        self._last_symbolic = sym_res

        # 2. Deliberation
        delib_res = None
        if not comp_res and not sym_res:
            delib_res = deliberate(resolved)

        # 3. Reflexive Recall
        # v3.19.0: pass comp_res/sym_res/delib_res so the domain filter
        # can use them to classify the query and skip recall for pure_math.
        qtype = _enhanced_query_type(query)
        recalled = self._reflexive_recall(resolved, qtype, comp_res, sym_res, delib_res)

        # 4. Linguistic Processing
        try:
            tokens = self.lexer.tokenise(resolved)
        except Exception:
            tokens = re.findall(r"\b[a-z_]+\b", resolved.lower())
        content = [(t, self.vocab_dict[t]) for t in tokens
                   if t in self.vocab_dict and t not in FUNCTION_WORDS]
        unknown = [t for t in tokens if t not in self.vocab_dict and t not in FUNCTION_WORDS]

        # 5. Warm-start check (before update)
        if content:
            tvs = [entry.vector for _, entry in content if hasattr(entry, 'vector') and entry.vector]
            nouns = [w for w, e in content if e.role in ("NOUN","PROPERTY")]
            ws = self.meta_graph.match(tvs, nouns)
            if ws:
                self._last_warm_start = ws.idea_id

        # 5b. v3.18.0: Auto topic-shift detection.
        # If the active zone has CRYSTALLISED topic nouns from prior turns
        # (i.e. it has a real committed thesis — not just a forming zone
        # with loose evidence) AND the current query has zero content-word
        # overlap with them (direct OR via CRG-reachability), auto-reset
        # the manager. This eliminates cross-topic bleed without requiring
        # the caller to know about `fresh=True`.
        #
        # The "crystallised" gate is important: a forming zone has no
        # committed topic yet, so there's nothing to "bleed" from. Resetting
        # on every unrelated query to a forming zone would prevent the zone
        # from ever accumulating enough evidence to crystallise.
        #
        # The check has two layers (both must fail to trigger reset):
        #   1. Direct overlap: any current content word appears in zone nouns
        #   2. CRG-reachability: any current content word has a CRG edge
        #      to/from any zone noun (1-hop)
        if content and self.manager.zones:
            active = self.manager.active
            # Only auto-reset if the active zone has crystallised — forming
            # zones need to accumulate evidence, not get wiped.
            if getattr(active, 'crystallized', False):
                zone_nouns = set(getattr(active, 'topic_nouns', []) or [])
                if zone_nouns:
                    current_words = set(w for w, _ in content)
                    # Layer 1: direct overlap
                    overlap = zone_nouns & current_words
                    if not overlap:
                        # Layer 2: CRG-reachability (1-hop)
                        crg_reachable = False
                        if self.crg:
                            zone_nouns_lower = {n.lower() for n in zone_nouns}
                            for cw in current_words:
                                cw_l = cw.lower()
                                # Check edges FROM cw
                                for edge in self.crg.out.get(cw_l, []):
                                    if edge.dst.lower() in zone_nouns_lower:
                                        crg_reachable = True
                                        break
                                if crg_reachable:
                                    break
                                # Check edges INTO cw
                                if not crg_reachable:
                                    for edge in self.crg.into.get(cw_l, []):
                                        if edge.src.lower() in zone_nouns_lower:
                                            crg_reachable = True
                                            break
                                if crg_reachable:
                                    break
                        if not crg_reachable:
                            # Topic shift detected — auto-reset.
                            self.manager.reset()
                            self._turn = 0
                            self._turn += 1  # re-increment for the new query

        # 6. Update Manager
        num_zones_before = len(self.manager.zones)
        self.manager.update(content, self._turn)
        num_zones_after = len(self.manager.zones)
        self._last_pivot_spawned = True if num_zones_after > num_zones_before else None

        # 6b. Record crystallised ideas to meta-graph
        zone = self.manager.active
        if zone.crystallized and zone.thesis:
            try:
                ci = self.meta_graph.record(zone)
                if not self._last_warm_start:
                    self._last_warm_start = None
            except: pass

        # 6c. v3.16.0: Continuous learning — update vectors from this query
        if self.learner is not None:
            try:
                content_words = [w for w, _ in content]
                self.learner.process_query(query, content_words)
            except Exception:
                pass

        # v3.19.0: Extract the clean answer and verification statement
        answer_block = None
        verified = None
        try:
            from GLM29_answer_extractor import extract_answer
            answer_block = extract_answer(comp_res, sym_res, delib_res)
        except Exception:
            pass
        try:
            from GLM31_verification import verify_result
            pipeline_state = {
                "query": query, "qtype": qtype,
                "compute": comp_res, "symbolic": sym_res,
                "deliberation": delib_res,
            }
            verified = verify_result(pipeline_state)
        except Exception:
            pass

        return {
            "query": query,
            "resolved": resolved,
            "content": content,
            "unknown": unknown,
            "zone": self.manager.active,
            "manager": self.manager,
            "qtype": qtype,
            "compute": comp_res,
            "symbolic": sym_res,
            "deliberation": delib_res,
            "recalled": recalled,
            "warm_start": self._last_warm_start,
            "turn": self._turn,
            # v3.19.0: new fields
            "answer_block": answer_block,
            "verified": verified,
        }

    def chat(self, query: str) -> str:
        """Original terse bracket-tag response.

        v3.19.0: now passes answer_block and verified to the composer so
        [Answer] and [Verified] blocks are appended.
        """
        state = self._run_pipeline(query)
        return compose_response(
            state["query"], state["content"], state["unknown"],
            state["zone"], state["manager"], self.vocab,
            state["qtype"], state["compute"], state["symbolic"],
            deliberation=state["deliberation"],
            recalled=state["recalled"],
            # v3.19.0: new kwargs
            answer_block=state.get("answer_block"),
            verified=state.get("verified"),
        )

    def chat_prose(self, query: str, fresh: bool = False) -> str:
        """Fluent natural-language response (v3.11.0).

        Uses the same pipeline as chat() but composes a multi-sentence
        paragraph via GLM19_prose_composer.  ~3-4x longer, genuinely
        fluent, zero fabrication.

        v3.17.0: Added `fresh` parameter to fix cross-topic bleed
        (SESSION_SUMMARY §4). When `fresh=True`, the IdeaManager is reset
        before processing the query, so no prior topic nouns leak into
        the new response. When `fresh=False` (default), the existing
        behaviour is preserved — useful for genuine multi-turn conversations
        about the same topic. Use `fresh=True` for any unrelated follow-up
        or for one-shot queries where bleed would be inappropriate.

        v3.19.0: now passes answer_block and verified to the composer so
        the answer sentence and verification sentence are appended.
        """
        if fresh:
            self.manager.reset()
            self._turn = 0
        state = self._run_pipeline(query)
        from GLM19_prose_composer import compose_prose
        return compose_prose(
            state["query"], state["content"], state["unknown"],
            state["zone"], state["manager"], self.vocab,
            state["qtype"],
            compute_result=state["compute"],
            symbolic_result=state["symbolic"],
            warm_start=state["warm_start"],
            deliberation=state["deliberation"],
            recalled=state["recalled"],
            turn=state["turn"],
            # v3.19.0: new kwargs
            answer_block=state.get("answer_block"),
            verified=state.get("verified"),
        )

    def chat_considered(self, query: str, fresh: bool = False) -> str:
        """v3.20.0: Multi-paragraph considered response using Kracht's mode-algebra.

        Produces a longer, more structured response than chat_prose. Each
        sentence is a definite sign combination — gated on the simultaneous
        definedness of all three Kracht homomorphisms (Exponent, Category,
        Meaning). Indefinite combinations are dropped or hedged.

        Structure:
          Paragraph 1: Direct answer + query framing
          Paragraph 2: Reasoning (CRG backbone walk with mode-algebraic gating)
          Paragraph 3: Evidence (KB recalls, definitions, substrate metrics)
          Paragraph 4: Conclusion (verification + summary)

        Parameters
        ----------
        query : str
            The user's query.
        fresh : bool
            If True, reset the IdeaManager before processing (eliminates
            cross-topic bleed). Default False.

        Returns
        -------
        str
            A multi-paragraph response separated by "\\n\\n".
        """
        if fresh:
            self.manager.reset()
            self._turn = 0
        state = self._run_pipeline(query)
        state["_crg"] = self.crg  # pass CRG for mode-algebraic reasoning
        from GLM33_considered_response import compose_considered
        return compose_considered(state, self.vocab)

    def crg_alu(self):
        """v3.17.0: return a CRGTraversalALU bound to this runtime's CRG + vocab.

        Lazily constructed. This is the word-level analogue of NoiseALU,
        providing step-by-step CRG traversal with real traces + fingerprints
        — the "stage-1 algorithm for words" identified as missing in
        SESSION_SUMMARY §10.
        """
        if not hasattr(self, '_crg_alu_instance'):
            from GLM26_crg_alu import CRGTraversalALU
            self._crg_alu_instance = CRGTraversalALU(self.crg, self.vocab)
        return self._crg_alu_instance

    def simplicial_crg(self, max_side: int = 8, max_faces: int = 200):
        """v3.21.0: return a SimplicialCRG bound to this runtime's CRG + vocab.

        Lazily constructed. The simplicial CRG augments the 1-skeleton
        (graph) with 2-simplices (triangular faces) and provides:
          - Betti numbers (β₀, β₁, β₂) — global topology health
          - Euler characteristic χ = V − E + F
          - topological_coherence(backbone) — "is this argument filled?"
          - backbone_is_filled(backbone) — does the path bound faces?

        This is the 2-complex upgrade from the design notes: moves from
        "bad edge present" (contradiction_penalty) to "good cycle absent"
        (topological hole detection).
        """
        if not hasattr(self, '_simplicial_crg_instance'):
            from GLM34_simplicial_crg import SimplicialCRG, discover_faces
            self._simplicial_crg_instance = SimplicialCRG(self.crg)
            discover_faces(self._simplicial_crg_instance, self.vocab.words,
                          max_side=max_side, max_faces=max_faces)
            self._simplicial_crg_instance.build_node_geometry(self.vocab.words)
        return self._simplicial_crg_instance

    def topology_report(self):
        """v3.21.0: return a TopologyReport for the current CRG.

        Convenience method — equivalent to:
            self.simplicial_crg().topology_report()
        """
        return self.simplicial_crg().topology_report()

    def chat_with_effort(self, query: str, max_ticks: int = 5) -> str:
        res = self.chat(query)
        z = self.manager.active
        if not z or getattr(z, 'crystallized', False): return res
        for _ in range(max_ticks):
            if getattr(z, 'crystallized', False): break
            self.mature(1)
        return res + f"\n[Effort Applied] Thesis: {getattr(self.manager.active, 'thesis', '')}"

    def synthesise(self):
        return self.manager.synthesise_meta_thesis(self._turn)

    def reset_idea(self):
        self.manager.reset()
        self._turn = 0

    def idea_state(self):
        """Returns the full state of the short-term manager and long-term meta-graph.

        v3.9.0: also includes the colour signature of the active zone.
        """
        return {
            "turn": self._turn,
            "manager": self.manager.state(),
            "meta": self.meta_graph.stats(),
            # v3.9.0: hex colour signature of the active zone
            "colour": idea_signature(self.manager.active),
            # v3.9.0: master resource status (vocab size, etc.)
            "master": self._master_status,
        }

    def mature(self, n: int = 3):
        self.manager.mature_all(n)

    # ════════════════════════════════════════════════════════════════════════
    # v3.9.0: NEW PUBLIC APIs
    # ════════════════════════════════════════════════════════════════════════

    def explain(self, query: str = "") -> str:
        """Generate a natural-language explanation of the current zone state.

        Uses the semantic frames module (GLM17) to compose multi-sentence
        explanations from the zone's CRG backbone.  This is the natural-
        language ability upgrade: instead of emitting "[Backbone] a | b"
        tags, we generate "Hamiltonian generates time. Hamiltonian commutes
        with symmetry."

        If `query` is provided, frames are selected based on the query type.
        Otherwise, all available frames are tried.
        """
        return generate_explanation(self.manager.active, query=query)

    def idea_colour(self) -> dict:
        """Return the hex colour signature of the current idea zone.

        Includes:
          * primary:    colour of the zone centroid
          * secondary:  colour of the most recent evidence
          * blend:      colour of all evidence blended together
          * nrci:       the zone's NRCI score
          * mog:        the dominant MOG category
          * evidence_count: how many evidence vectors contributed

        The Pyodide UI can use this to render an 'idea aura' that shifts
        colour as the conversation evolves.
        """
        return idea_signature(self.manager.active)

    def word_colour(self, word: str) -> Optional[str]:
        """Look up the hex colour of a vocab word.  Returns None if not found."""
        return word_to_colour(word, self.vocab)

    def master_status(self) -> dict:
        """Report whether the master resource is loaded and its size."""
        return self._master_status

    def learning_status(self) -> dict:
        """Report continuous learning status (v3.16.0).

        Returns how many queries have been processed, how many words
        learned, how many vectors refined, and how many CRG edges
        discovered through co-occurrence.
        """
        if self.learner is not None:
            return self.learner.get_status()
        return {"error": "learner not initialised"}

    # ════════════════════════════════════════════════════════════════════════
    # v3.10.0: REAL ENGINE APIs
    # ════════════════════════════════════════════════════════════════════════

    def engine_status(self) -> dict:
        """Report whether the REAL ubp_unified_v5.py engine is loaded.

        v3.10.0: Returns diagnostics about the real Golay/Leech engines,
        including syndrome table size, codeword count, and the Y constant.
        """
        try:
            from ubp_unified_v5 import GOLAY_ENGINE as real_golay, LEECH_ENGINE as real_leech
            real_golay._ensure_syn_table()
            return {
                "real_engine_loaded": True,
                "golay_syndrome_table_size": len(real_golay._syn_table),
                "golay_codewords": len(real_golay.get_all_codewords()),
                "golay_octads": len(real_golay.get_octads()),
                "leech_dimension": real_leech.DIM,
                "leech_kissing_number": real_leech.KISSING,
                "y_constant": float(real_leech.Y),
                "pi_precision_terms": 50,
            }
        except Exception as e:
            return {"real_engine_loaded": False, "error": str(e)}

    def snap_query(self, query: str) -> dict:
        """Snap a query's concept vector to the nearest Golay codeword.

        v3.10.0: Uses the REAL Golay(24,12) error correction to find the
        nearest lattice point.  Returns the snapped vector, syndrome weight,
        anchor distance, and whether the correction was successful.
        """
        try:
            from GLM01_substrate import GOLAY_ENGINE, _derive_vector, MOG_CATEGORIES
            # Derive a vector from the query hash (same method as priority vocab)
            vec = _derive_vector(query, "I_Topology")
            snapped, meta = GOLAY_ENGINE.snap_to_codeword(vec)
            return {
                "query": query,
                "original_vector": vec,
                "snapped_vector": snapped,
                "syndrome_weight": meta.get("syndrome_weight", 0),
                "anchor_distance": meta.get("anchor_distance", 0),
                "corrected": meta.get("corrected", False),
                "correctable": meta.get("correctable", True),
                "hex_colour": f"#{sum((1 << (7-i)) for i in range(8) if snapped[i]):02x}{sum((1 << (7-i)) for i in range(8) if snapped[8+i]):02x}{sum((1 << (7-i)) for i in range(8) if snapped[16+i]):02x}",
            }
        except Exception as e:
            return {"error": str(e)}

    def generate(self, topic: str = "", n_words: int = 12,
                 max_sentences: int = 3) -> str:
        """Generate novel text about a topic (v3.13.0).

        Uses the GLM21 generator: a deterministic walk over the 24-bit
        lattice, using the zone centroid as state (addresses the pigeonhole
        cycling problem) and the CRG as a transition grammar.

        This is the generation layer GLM has been missing.  It produces
        novel sequences — not just recalled templates or reformatted
        pipeline state.

        Args:
            topic: a seed word/phrase to generate about
            n_words: max words per sentence
            max_sentences: max sentences to generate
        """
        try:
            from GLM21_generator import GLMGenerator
            gen = GLMGenerator(self.vocab, self.crg)
            if topic:
                return gen.generate_about(topic, n_words=n_words,
                                          max_sentences=max_sentences)
            else:
                # Use the current zone's topic nouns as seeds
                zone = self.manager.active
                seeds = zone.topic_nouns[:3] if zone.topic_nouns else ["hamiltonian"]
                return gen.generate(seeds, n_words=n_words,
                                    max_sentences=max_sentences)
        except Exception as e:
            return f"[generation error: {e}]"

    def generate_grammatical(self, topic: str = "", n_sentences: int = 3) -> str:
        """Generate grammatically-structured text (v3.14.0).

        Uses the GLM22 ontological grammar engine: computes sentence
        structure (Subject → Verb → Object) from vector geometry, NOT
        from templates.  The verb is derived from the gap between subject
        and object — this is "thinking", not slot-filling.

        Args:
            topic: a seed word to generate about
            n_sentences: number of sentences to chain
        """
        try:
            from GLM22_ontological_grammar import OntologicalGrammar
            grammar = OntologicalGrammar(self.vocab, self.crg)
            if topic:
                return grammar.construct_paragraph(topic, n_sentences=n_sentences)
            else:
                zone = self.manager.active
                seed = zone.topic_nouns[0] if zone.topic_nouns else "hamiltonian"
                return grammar.construct_paragraph(seed, n_sentences=n_sentences)
        except Exception as e:
            return f"[grammar error: {e}]"

    def compute_sentence(self, subject: str, obj: str) -> dict:
        """Compute a single sentence from subject → verb → object (v3.14.0).

        Returns the full geometric analysis: computed roles, gap quadrant,
        verb distance.  This is the API for inspecting HOW the grammar
        engine derives the verb.
        """
        try:
            from GLM22_ontological_grammar import OntologicalGrammar, QUADRANT_NAMES
            grammar = OntologicalGrammar(self.vocab, self.crg)
            sent = grammar.construct_sentence(subject, obj)
            if sent:
                return {
                    "subject": sent.subject,
                    "verb": sent.verb,
                    "object": sent.object,
                    "subject_role": sent.subject_role,
                    "verb_role": sent.verb_role,
                    "object_role": sent.object_role,
                    "gap_quadrant": sent.gap_quadrant,
                    "gap_quadrant_name": QUADRANT_NAMES.get(sent.gap_quadrant, "?"),
                    "verb_distance": sent.verb_distance,
                    "surface": sent.surface,
                }
            return {"error": "could not construct sentence"}
        except Exception as e:
            return {"error": str(e)}