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
            
        # Wrap vocab for manager
        class Vocab:
            def __init__(self, d): self.words = d
        self.vocab = Vocab(self.vocab_dict)
        
        self.manager = IdeaManager(vocab=self.vocab, crg=self.crg)
        self.meta_graph = IdeaMetaGraph()
        self._turn = 0
        self._kb_cache = None # Lazy load for recall

    def _reflexive_recall(self, query: str) -> List[Dict[str, Any]]:
        """Recall relevant KB entries using alias map + ID match + phrase match.

        v3.7.7: Added alias map consultation (word → ubp_id → KB entry).
        This fixes the issue where 'what is time?' didn't surface the
        Time KB entry because 'time' wasn't directly in any KB name.
        """
        if self._kb_cache is None:
            self._kb_cache = _load_system_kb()

        recalled = []
        ql = query.lower()

        # A. Direct ID Match (e.g., ELEM_H_001)
        ids_found = re.findall(r'\b[A-Z]+_[A-Z0-9_]+_\d+\b', query)
        for uid in ids_found:
            if uid in self._kb_cache:
                recalled.append(self._kb_cache[uid])

        # B. Alias map match (word → ubp_id → KB entry)
        try:
            alias_map = _build_alias_map()
            stop = {"the", "a", "an", "of", "is", "are", "what", "how", "tell",
                    "me", "about", "and", "in", "to", "for", "with", "explain",
                    "describe", "show", "find", "all", "positive", "integers"}
            query_words = set(w for w in re.findall(r'\b[a-z]{3,}\b', ql) if w not in stop)
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

        return recalled[:5]

    def last_diag(self) -> Dict[str, Any]:
        return {
            "compute": self._last_compute,
            "symbolic": self._last_symbolic,
            "warm_start": self._last_warm_start,
            "pivot_spawned": self._last_pivot_spawned
        }

    def chat(self, query: str) -> str:
        self._turn += 1
        # Between-turn maturation: decay + tick (adds inferred nouns, increases coherence)
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
        recalled = self._reflexive_recall(resolved)
            
        # 4. Linguistic Processing
        tokens = re.findall(r"\b[a-z_]+\b", resolved.lower())
        # Filter out function words BEFORE passing to manager — they pollute topic_nouns
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

        # 6. Update Manager
        num_zones_before = len(self.manager.zones)
        self.manager.update(content, self._turn)
        num_zones_after = len(self.manager.zones)
        self._last_pivot_spawned = True if num_zones_after > num_zones_before else None

        # 6b. Record crystallised ideas to meta-graph (for warm-start)
        zone = self.manager.active
        if zone.crystallized and zone.thesis:
            try:
                ci = self.meta_graph.record(zone)
                if not self._last_warm_start:
                    self._last_warm_start = None  # don't override existing
            except: pass

        # 7. Compose
        return compose_response(
            query, content, unknown, self.manager.active, self.manager, self.vocab,
            _enhanced_query_type(query), comp_res, sym_res, 
            deliberation=delib_res,
            recalled=recalled # <--- Pass the recalled entries
        )

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
        """Returns the full state of the short-term manager and long-term meta-graph."""
        return {
            "turn": self._turn, 
            "manager": self.manager.state(), 
            "meta": self.meta_graph.stats()
        }

    def mature(self, n: int = 3):
        self.manager.mature_all(n)