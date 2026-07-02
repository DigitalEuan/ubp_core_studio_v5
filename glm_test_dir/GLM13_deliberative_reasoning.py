# ══════════════════════════════════════════════════════════════════════════════
# §13  DELIBERATIVE REASONING LAYER (v3.7.6 Hardened)
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations
import re
from typing import List, Dict, Optional, Tuple, Any
from math import gcd as _math_gcd

# Attempt to load SymPy
try:
    import sympy as sp
    _HAS_SYMPY = True
except ImportError:
    _HAS_SYMPY = False

# ── 1. UBP-NATIVE ARITHMETIC HELPERS ──────────────────────────────────
def ubp_repeated_multiply(a: int, b: int) -> int:
    """Multiply two integers via bit-shift decomposition (UBP lattice fold)."""
    if b < 0: return -ubp_repeated_multiply(a, -b)
    result, shift = 0, a
    while b > 0:
        if b & 1: result += shift
        shift <<= 1
        b >>= 1
    return result

def ubp_modular_sequence(base: int, mod: int, max_n: int = 30) -> List[Tuple[int, int]]:
    """Compute (base^n mod m) using modular multiplication."""
    sequence = []
    val = 1 % mod
    base_mod = base % mod
    for n in range(1, max_n + 1):
        val = ubp_repeated_multiply(val, base_mod) % mod
        sequence.append((n, val))
    return sequence

def ubp_gcd_euclidean(a_expr: str, b_expr: str, var='n'):
    """Run the Euclidean algorithm symbolically on two expressions."""
    if not _HAS_SYMPY: return {"gcd": None, "steps": []}
    try:
        n = sp.Symbol(var)
        # Normalize: 21n -> 21*n
        def _norm(s): return re.sub(r'(\d)([a-zA-Z])', r'\1*\2', str(s).replace('^', '**'))
        a, b = sp.sympify(_norm(a_expr)), sp.sympify(_norm(b_expr))
        steps = [f"gcd({a}, {b})"]
        for _ in range(10):
            if b == 0: break
            r = sp.simplify(sp.rem(a, b))
            if r == 0:
                steps.append(f"= {b}"); return {"gcd": b, "steps": steps, "answer": f"gcd = {b}"}
            steps.append(f"= gcd({b}, {r})")
            a, b = b, r
        return {"gcd": b, "steps": steps, "answer": f"gcd = {b}"}
    except: return {"gcd": None, "steps": []}

# ── 2. PATTERN DETECTORS ──────────────────────────────────────────────
_DIVISIBILITY_RE = re.compile(r'(\d+)\s*\^\s*n.*?divisible\s+by\s+(\d+)', re.I)
_IRREDUCIBLE_RE = re.compile(r'\(([^()]+)\)\s*/\s*\(([^()]+)\)', re.I)

def deliberate(query: str) -> Optional[Dict[str, Any]]:
    """Recognizes problem patterns and runs a multi-step plan."""
    if not _HAS_SYMPY or len(query) > 500: return None
    q = query.strip()

    # Pattern: Divisibility Sequence
    m = _DIVISIBILITY_RE.search(q)
    if m and ('find all' in q.lower() or 'for which' in q.lower()):
        base, mod = int(m.group(1)), int(m.group(2))
        if 1 < mod < 10000:
            seq = ubp_modular_sequence(base, mod, max_n=min(mod*2, 1000))
            for n, v in seq:
                if v == 1: # Period found
                    return {"pattern": "divisibility", "answer": f"n divisible by {n}", 
                            "trace": [f"Period {n} detected via modular sequence."], "method": "modular_period"}

    # Pattern: Irreducible Fraction
    m = _IRREDUCIBLE_RE.search(q)
    if m and ('irreducible' in q.lower() or 'prove' in q.lower()):
        res = ubp_gcd_euclidean(m.group(1), m.group(2))
        if res.get("gcd") == 1:
            return {"pattern": "gcd_proof", "answer": "Irreducible (GCD=1)", 
                    "trace": res["steps"], "method": "euclidean_algorithm"}

    return None

def format_deliberation(result: Dict[str, Any]) -> str:
    """Format a deliberation result for the composer."""
    trace = " -> ".join(result.get("trace", []))
    return f"[Deliberated:{result['pattern']}] [Method:{result['method']}] {trace} [Conclusion] {result['answer']}"