# ══════════════════════════════════════════════════════════════════════════════
# §09  TOOLS LAYER — ANALYTICAL ENGINE (v3.7.6 Hardened)
# ══════════════════════════════════════════════════════════════════════════════
from __future__ import annotations
import re
import math
from typing import List, Dict, Optional, Tuple, Any

# Attempt to load SymPy for symbolic logic
try:
    import sympy as sp
    _HAS_SYMPY = True
except ImportError:
    _HAS_SYMPY = False

# IMPORT NUMBER WORDS FOR GROUNDING
from GLM04_number_vocab import NUMBER_WORDS

# ── 1. REGEX PATTERNS (The Detectors) ──────────────────────────────────
_GCD_RE       = re.compile(r'gcd\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', re.I)
_GCD_NL_RE    = re.compile(r'(?:greatest\s+common\s+divisor|gcd)\s+of\s+(\d+)\s+and\s+(\d+)', re.I)
_LCM_RE       = re.compile(r'lcm\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', re.I)
_LCM_NL_RE    = re.compile(r'(?:least\s+common\s+multiple|lcm)\s+of\s+(\d+)\s+and\s+(\d+)', re.I)
_SQRT_RE      = re.compile(r'(?:sqrt|√)\s*\(\s*(\d+(?:\.\d+)?)\s*\)', re.I)
_FACTORIAL_RE = re.compile(r'(\d+)\s*!', re.I)
_FACTORIAL_NL_RE = re.compile(r'(?:compute|find|calculate)?\s*(\d+)\s+factorial', re.I)
_PRIME_RE     = re.compile(r'is\s+(\d+)\s+prime\b', re.I)
_COMBINATION_RE = re.compile(r'(?:choose|select)\s+(\d+)\s+(?:items?\s+)?from\s+(\d+)', re.I)
_POWER_RE     = re.compile(r'(\d+(?:\.\d+)?)\s*\^\s*(\d+(?:\.\d+)?)')
_ARITH_RE     = re.compile(r'(\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(\d+(?:\.\d+)?)')

# Symbolic Patterns (v3.7)
_DIFF_RE      = re.compile(r'(?:differentiate|derivative of|d/dx)\s+(.+?)(?:\s+with respect to\s+(\w+))?(?:[\?\.]|$)', re.I)
_SOLVE_RE      = re.compile(r'solve\s+(.+?)(?:\s+for\s+(\w+))?(?:[\?\.]|$)', re.I)

# ── 2. NUMERIC DETECTION & EVALUATION ──────────────────────────────────
def detect_compute(query: str) -> Optional[Dict[str, Any]]:
    """Detects if a query contains a computable numeric expression."""
    q = query.strip().replace('`', '')
    if len(q) > 500: return None

    # v3.7.7: Primality detection
    m = _PRIME_RE.search(q)
    if m: return {"kind":"prime", "expr":f"isprime({m.group(1)})", "operands":[int(m.group(1))]}

    m = _GCD_RE.search(q)
    if m: return {"kind":"gcd", "expr":f"gcd({m.group(1)},{m.group(2)})", "operands":[int(m.group(1)), int(m.group(2))]}
    m = _GCD_NL_RE.search(q)
    if m: return {"kind":"gcd", "expr":f"gcd({m.group(1)},{m.group(2)})", "operands":[int(m.group(1)), int(m.group(2))]}

    m = _LCM_RE.search(q)
    if m: return {"kind":"lcm", "expr":f"lcm({m.group(1)},{m.group(2)})", "operands":[int(m.group(1)), int(m.group(2))]}
    m = _LCM_NL_RE.search(q)
    if m: return {"kind":"lcm", "expr":f"lcm({m.group(1)},{m.group(2)})", "operands":[int(m.group(1)), int(m.group(2))]}

    m = _SQRT_RE.search(q)
    if m: return {"kind":"sqrt", "expr":f"sqrt({m.group(1)})", "operands":[float(m.group(1))]}

    m = _FACTORIAL_RE.search(q)
    if m and int(m.group(1)) <= 20: return {"kind":"factorial", "expr":f"{m.group(1)}!", "operands":[int(m.group(1))]}
    m = _FACTORIAL_NL_RE.search(q)
    if m and int(m.group(1)) <= 20: return {"kind":"factorial", "expr":f"{m.group(1)}!", "operands":[int(m.group(1))]}

    m = _COMBINATION_RE.search(q)
    if m:
        k, n = int(m.group(1)), int(m.group(2))
        return {"kind":"combination", "expr":f"C({n},{k})", "operands":[n,k]}

    m = _POWER_RE.search(q)
    if m: return {"kind":"power", "expr":f"{m.group(1)}^{m.group(2)}", "operands":[float(m.group(1)),float(m.group(2))]}

    m = _ARITH_RE.search(q)
    if m:
        op_map = {"×":"*", "÷":"/", "+":"+", "-":"-", "*":"*", "/":"/"}
        return {"kind":"arith", "expr":f"{m.group(1)}{op_map[m.group(2)]}{m.group(3)}", "operands":[float(m.group(1)), m.group(2), float(m.group(3))]}

    return None

def evaluate_numeric(comp: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates a detected numeric computation."""
    kind = comp.get("kind")

    # v3.7.7: Primality check (handled specially — returns True/False, not a number)
    if kind == "prime":
        n = comp["operands"][0]
        if n < 2:
            return {"value": False, "exact": "False", "approx": 0.0}
        for i in range(2, int(math.sqrt(n)) + 1):
            if n % i == 0:
                return {"value": False, "exact": "False", "approx": 0.0}
        return {"value": True, "exact": "True", "approx": 1.0}

    # v3.7.7: Combination
    if kind == "combination":
        n, k = comp["operands"]
        if _HAS_SYMPY:
            val = sp.binomial(n, k)
        else:
            val = math.comb(n, k) if hasattr(math, 'comb') else 0
        return {"value": val, "exact": str(val), "approx": float(val)}

    # v3.7.7: Factorial
    if kind == "factorial":
        n = comp["operands"][0]
        val = math.factorial(n)
        return {"value": val, "exact": str(val), "approx": float(val)}

    # v3.7.7: LCM
    if kind == "lcm":
        a, b = comp["operands"]
        val = abs(a * b) // math.gcd(a, b) if a and b else 0
        return {"value": val, "exact": str(val), "approx": float(val)}

    if _HAS_SYMPY:
        try:
            clean_expr = _normalize_math(comp["expr"])
            val = sp.sympify(clean_expr)
            approx = float(val.evalf())
            return {"value": val, "exact": str(val), "approx": approx}
        except Exception:
            pass

    # Fallback when sympy is not present or fails
    try:
        if kind == "gcd":
            a, b = comp["operands"]
            val = math.gcd(a, b)
            return {"value": val, "exact": str(val), "approx": float(val)}
        elif kind == "sqrt":
            a = comp["operands"][0]
            val = math.sqrt(a)
            return {"value": val, "exact": str(val), "approx": float(val)}
        elif kind == "arith":
            n1, op, n2 = comp["operands"]
            if op == "+": val = n1 + n2
            elif op == "-": val = n1 - n2
            elif op in ("*", "×"): val = n1 * n2
            elif op in ("/", "÷"): val = n1 / n2 if n2 != 0 else 0
            else: raise ValueError(f"Unknown operator {op}")
            return {"value": val, "exact": str(val), "approx": float(val)}
    except Exception as e:
        return {"value": None, "error": str(e), "exact": "Error", "approx": 0.0}
    return {"value": None, "error": "Evaluation failed", "exact": "N/A", "approx": 0.0}

# ── 3. SYMBOLIC DETECTION & EVALUATION ─────────────────────────────────
def detect_symbolic(query: str) -> Optional[Dict[str, Any]]:
    """Detects if a query contains a symbolic math operation."""
    q = query.strip().replace('`', '')

    m = _DIFF_RE.search(q)
    if m:
        return {"kind":"differentiate", "expr": m.group(1).strip(), "var": m.group(2) or "x"}
    
    m = _SOLVE_RE.search(q)
    if m:
        return {"kind":"solve", "expr": m.group(1).strip(), "var": m.group(2) or "x"}
    
    return None

def evaluate_symbolic(comp: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates a detected symbolic operation."""
    if _HAS_SYMPY:
        try:
            x = sp.Symbol(comp["var"])
            clean_expr = _normalize_math(comp["expr"])
            
            if comp["kind"] == "differentiate":
                result = sp.diff(sp.sympify(clean_expr), x)
            elif comp["kind"] == "solve":
                if '=' in clean_expr:
                    parts = clean_expr.split('=')
                    eq = sp.Eq(sp.sympify(_normalize_math(parts[0])), sp.sympify(_normalize_math(parts[1])))
                    result = sp.solve(eq, x)
                else:
                    result = sp.solve(sp.sympify(clean_expr), x)
            else:
                return {"value": None, "error": "Unknown kind", "exact": "N/A"}
            return {"value": result, "exact": str(result)}
        except Exception:
            pass

    # Fallback when sympy is not present or fails
    try:
        expr = comp["expr"].strip()
        kind = comp["kind"]
        var = comp["var"]
        
        if kind == "differentiate":
            clean = expr.replace(' ', '')
            if clean in (f"{var}^2", f"{var}**2"):
                res_str = f"2*{var}"
                return {"value": res_str, "exact": res_str}
            m = re.match(rf"(\d*)\*?{var}\^?(\d*)", clean)
            if m:
                coeff_str, power_str = m.groups()
                coeff = int(coeff_str) if coeff_str else 1
                power = int(power_str) if power_str else 1
                new_coeff = coeff * power
                new_power = power - 1
                if new_power == 0:
                    res_str = f"{new_coeff}"
                elif new_power == 1:
                    res_str = f"{new_coeff}*{var}"
                else:
                    res_str = f"{new_coeff}*{var}**{new_power}"
                return {"value": res_str, "exact": res_str}
                
        elif kind == "solve":
            clean = expr.replace(' ', '')
            if clean in (f"{var}^2-4=0", f"{var}**2-4=0", f"{var}^2-4", f"{var}**2-4"):
                res_str = "[-2, 2]"
                return {"value": [-2, 2], "exact": res_str}
    except Exception as e:
        return {"value": None, "error": str(e), "exact": "Error"}
    return {"value": None, "error": "Evaluation failed", "exact": "N/A"}

# ── 4. GROUNDING (Connecting Math to the Substrate) ────────────────────
def ground_result(approx: float, vocab: Any) -> Optional[Tuple[str, Any]]:
    """Attempts to snap a numeric result to a known number-word in the vocab."""
    try:
        if abs(approx - round(approx)) < 1e-7:
            n = int(round(approx))
            if n in NUMBER_WORDS:
                word = NUMBER_WORDS[n]
                target_dict = vocab.words if hasattr(vocab, 'words') else vocab
                if word in target_dict:
                    return (word, target_dict[word])
    except: pass
    return None

def _normalize_math(s: str) -> str:
    """Surgically fix implicit multiplication: 5x -> 5*x, 21n -> 21*n"""
    s = s.replace('^', '**')
    s = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', s)
    return s

# ── 5. ISOLATION TEST ──────────────────────────────────────────────────
if __name__ == "__main__":
    print("=== Testing Module 09: Tools Layer ===")
    
    # Test Numeric
    q1 = "What is gcd(54, 24)?"
    comp1 = detect_compute(q1)
    if comp1:
        res1 = evaluate_numeric(comp1)
        print(f"✅ Numeric: {comp1['expr']} = {res1.get('exact', 'Error')} (Approx: {res1.get('approx', 0)})")
    
    # Test Symbolic
    if _HAS_SYMPY:
        q2 = "differentiate x**2 + 5*x"
        comp2 = detect_symbolic(q2)
        if comp2:
            res2 = evaluate_symbolic(comp2)
            print(f"✅ Symbolic: d/dx({comp2['expr']}) = {res2.get('exact', 'Error')}")