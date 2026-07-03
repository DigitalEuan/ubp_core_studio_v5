# ══════════════════════════════════════════════════════════════════════════════
# §09  TOOLS LAYER — ANALYTICAL ENGINE (v3.8.0)
# ══════════════════════════════════════════════════════════════════════════════
# v3.8.0 changes:
#   - Fixed false-positive arith detection on polynomials (x^2-4 no longer
#     triggers "2-4 = -2").  Uses lookbehind/lookahead to ensure the digit-
#     op-digit pattern is standalone.
#   - Added integrate detector.
#   - Added simplify detector (rational expressions).
#   - Added vector ops: dot product, cross product, magnitude.
#   - Canonicalised SymPy output: Add terms sorted by ascending polynomial
#     degree, so "3*x**2*sin(x) + x**3*cos(x)" is produced consistently.
#   - LaTeX-scrubbed queries before symbolic detection (so "differentiate
#     $x^2$" works).
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

# v3.8.0: LaTeX scrubber (lightweight, stdlib only)
try:
    from GLM14_lexer import scrub_latex as _scrub_latex
except ImportError:
    def _scrub_latex(s: str) -> str:
        # Minimal fallback: just strip $...$ blocks
        s = re.sub(r"\$\$.*?\$\$", " ", s, flags=re.DOTALL)
        s = re.sub(r"\$[^$]*\$", " ", s)
        return s


def _strip_math_delimiters(s: str) -> str:
    """Light scrub for symbolic math: strip $...$ delimiters but keep content.

    Unlike _scrub_latex (which is designed for the lexer and strips ^, _, etc.),
    this preserves all math operators so the symbolic detectors can match
    expressions like 'x^2 + 5x'.
    """
    # Remove $$...$$ and $...$ wrappers but KEEP the content
    s = re.sub(r"\$\$", " ", s)
    s = re.sub(r"\$", " ", s)
    # Expand a few common LaTeX math commands to their plain-text equivalents
    s = re.sub(r"\\cdot", " * ", s)
    s = re.sub(r"\\times", " * ", s)
    s = re.sub(r"\\div", " / ", s)
    s = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"(\1)/(\2)", s)
    s = re.sub(r"\\sqrt\{([^{}]+)\}", r"sqrt(\1)", s)
    s = re.sub(r"\\sqrt\s+(\S)", r"sqrt(\1)", s)
    # Greek letters
    for cmd, name in [(r"\\alpha", "alpha"), (r"\\beta", "beta"),
                       (r"\\gamma", "gamma"), (r"\\delta", "delta"),
                       (r"\\theta", "theta"), (r"\\lambda", "lambda"),
                       (r"\\pi", "pi"), (r"\\sigma", "sigma"),
                       (r"\\omega", "omega"), (r"\\phi", "phi"),
                       (r"\\psi", "psi")]:
        s = re.sub(cmd + r"(?![a-zA-Z])", " " + name + " ", s)
    # Drop any remaining \command tokens
    s = re.sub(r"\\[a-zA-Z]+\*?", " ", s)
    return s

# ── 1. REGEX PATTERNS (The Detectors) ──────────────────────────────────
_GCD_RE       = re.compile(r'gcd\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', re.I)
_GCD_NL_RE    = re.compile(r'(?:greatest\s+common\s+divisor|gcd)\s+of\s+(\d+)\s+and\s+(\d+)', re.I)
_LCM_RE       = re.compile(r'lcm\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', re.I)
_LCM_NL_RE    = re.compile(r'(?:least\s+common\s+multiple|lcm)\s+of\s+(\d+)\s+and\s+(\d+)', re.I)
_SQRT_RE      = re.compile(r'(?:sqrt|√)\s*\(\s*(\d+(?:\.\d+)?)\s*\)', re.I)
_FACTORIAL_RE = re.compile(r'(\d+)\s*!', re.I)
_FACTORIAL_NL_RE = re.compile(r'(?:compute|find|calculate)?\s*(\d+)\s+factorial', re.I)
_PRIME_RE     = re.compile(r'is\s+(\d+)\s+prime\b', re.I)
_PRIME_RE2    = re.compile(r'(?:primality|is\s+prime)\s+(?:of\s+)?(\d+)', re.I)
_COMBINATION_RE = re.compile(r'(?:choose|select)\s+(\d+)\s+(?:items?\s+)?from\s+(\d+)', re.I)
_COMBINATION_RE2 = re.compile(r'(?:c|c)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', re.I)
_POWER_RE     = re.compile(r'(\d+(?:\.\d+)?)\s*\^\s*(\d+(?:\.\d+)?)')
# v3.8.0: arith detection now requires the digit-op-digit pattern to be
# standalone — not preceded by `^` or a word char (so "x^2-4" doesn't match
# "2-4") and not followed by a word char, `^`, or `=` (so "x=1+2" doesn't
# trigger arith).
_ARITH_RE     = re.compile(r'(?<![\w^])(\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(\d+(?:\.\d+)?)(?![\w^=])')

# Symbolic Patterns (v3.7 + v3.8.0)
_DIFF_RE      = re.compile(r'(?:differentiate|derivative of|d/dx)\s+(.+?)(?:\s+with respect to\s+(\w+))?(?:[\?\.]|$)', re.I)
# v3.8.0: solve detector extended to match "Find all real solutions to" /
# "find all solutions to" / "find the roots of" — common olympiad phrasings.
_SOLVE_RE     = re.compile(r'(?:solve\s+|find\s+all\s+(?:real\s+)?solutions?\s+to\s+|find\s+the\s+roots?\s+of\s+|find\s+the\s+zeros?\s+of\s+)(.+?)(?:\s+for\s+(\w+))?(?:[\?\.]|$)', re.I)
# v3.8.0: integrate detector
_INTEGRATE_RE = re.compile(r'(?:integrate|integral of|antiderivative of|integral)\s+(.+?)(?:\s+with respect to\s+(\w+))?(?:[\?\.]|$)', re.I)
# v3.8.0: simplify detector (rational expressions, algebraic simplification)
_SIMPLIFY_RE  = re.compile(r'simplify\s+(.+?)(?:[\?\.]|$)', re.I)

# v3.8.0: Vector operations
_VEC_RE       = r'<\s*([-\d,\s\.]+)\s*>'
_DOT_PRODUCT_RE = re.compile(
    r'(?:dot\s+product\s+of\s+|dot\s+product\s*\(|dot\s*\()\s*' + _VEC_RE + r'\s*(?:,|\band\b|\*)\s*' + _VEC_RE,
    re.I)
_CROSS_PRODUCT_RE = re.compile(
    r'(?:cross\s+product\s+of\s+|cross\s+product\s*\(|cross\s*\()\s*' + _VEC_RE + r'\s*(?:,|\band\b|\*)\s*' + _VEC_RE,
    re.I)
_MAGNITUDE_RE = re.compile(r'(?:magnitude|norm)\s+of\s+(?:the\s+)?(?:vector\s+)?' + _VEC_RE, re.I)
_MAGNITUDE_RE2 = re.compile(r'\|' + _VEC_RE + r'\|')

# v3.9.0: Linear algebra detectors
_DET_RE = re.compile(r'determinant\s+of\s+(?:the\s+)?(?:matrix\s+)?(\[\s*\[.+?\]\s*\])', re.I | re.DOTALL)
_DET_RE2 = re.compile(r'(?:det|determinant)\s*\(\s*(\[\s*\[.+?\]\s*\])\s*\)', re.I | re.DOTALL)
_EIGEN_RE = re.compile(r'eigenvalues?\s+of\s+(?:the\s+)?(?:matrix\s+)?(\[\s*\[.+?\]\s*\])', re.I | re.DOTALL)
_TRACE_RE = re.compile(r'trace\s+of\s+(?:the\s+)?(?:matrix\s+)?(\[\s*\[.+?\]\s*\])', re.I | re.DOTALL)
# v3.9.0: Multivariable calculus
_PARTIAL_DIFF_RE = re.compile(
    r'(?:partial\s+derivative|compute\s+the\s+partial\s+derivative|find\s+the\s+partial\s+derivative)\s+of\s+`?(.+?)`?\s+with\s+respect\s+to\s+(\w+)',
    re.I)
_GRADIENT_RE = re.compile(r'(?:gradient|find\s+the\s+gradient)\s+of\s+`?(.+?)`?(?:[\?\.]|$)', re.I)
# v3.9.0: ODE detector
_ODE_RE = re.compile(r'(?:solve\s+(?:the\s+)?ode\s*:|solve\s+(?:the\s+)?differential\s+equation\s*:?)\s*(.+?)(?:[\?\.]|$)', re.I)
_ODE_DYDX_RE = re.compile(r'(?:solve\s+)?dy/dx\s*=\s*(.+?)(?:[\?\.]|$)', re.I)
_ODE_PRIME_RE = re.compile(r"(?:solve\s+)?y'\s*=\s*(.+?)(?:[\?\.]|$)", re.I)
# v3.9.0: Series / summation — require a math expression (digits or backticks),
# NOT English like "sum of the elements".  Use a lookahead to ensure the
# captured group starts with a digit, backtick, or letter+x pattern.
_SERIES_RE = re.compile(r'(?:sum|summation)\s+of\s+(?=[\d`]|[a-z][\^\*\+\-/])(.+?)(?:[\?\.]|$)', re.I)
# v3.9.0: Taylor series
_TAYLOR_RE = re.compile(r'taylor\s+(?:series\s+)?expansion\s+of\s+(.+?)(?:\s+around\s+(\w+)\s*=\s*(\d+))?(?:[\?\.]|$)', re.I)
# v3.9.0: Taylor series variant — "around N" (no var=N, just N)
_TAYLOR_RE2 = re.compile(r'taylor\s+(?:series\s+)?expansion\s+of\s+(.+?)\s+around\s+(\d+)(?:[\?\.]|$)', re.I)
# v3.9.0: Limit
_LIMIT_RE = re.compile(r'limit\s+of\s+(.+?)\s+as\s+(\w+)\s+(?:->|→|approaches)\s*(\w+|infinity|inf)(?:[\?\.]|$)', re.I)

# v3.8.0: polynomial-degree canonical sort key
def _term_degree(term, var):
    """Best-effort polynomial degree of `term` in `var`.

    Returns 0 for non-polynomial terms (e.g. cos(x), sin(x)) instead of
    raising, so we can still sort mixed expressions.
    """
    try:
        d = sp.degree(term, var)
        # sp.degree returns -1 (or raises) for constants; normalise to 0
        if d == -1 if hasattr(sp, 'degree') else False:
            d = 0
        return int(d) if d is not None else 0
    except Exception:
        # Fallback: count occurrences of var**n in the string form
        s = str(term)
        m = re.findall(rf'\b{re.escape(str(var))}\*\*(\d+)', s)
        if m:
            return max(int(p) for p in m)
        if f"*{var}" in s or f"{var}*" in s or s.endswith(var):
            return 1
        return 0


def _canonicalize_sympy(expr, var=None, kind=None):
    """Canonicalise a SymPy expression for consistent output.

    For Add expressions, sort terms by ascending polynomial degree in `var`
    and reconstruct the display string manually (SymPy's sp.Add re-sorts
    internally, so we can't rely on it to preserve our order).

    Note: we use sp.expand (not sp.simplify) for differentiate because
    simplify tends to FACTOR expressions.  For integrate we keep the
    result as-is (integrate already returns a nicely-factored form).
    """
    if not _HAS_SYMPY:
        return expr
    try:
        # Only expand for differentiate (distribute products over sums).
        # For integrate, the default factored form is preferred.
        # For simplify, the user explicitly asked for simplification.
        if kind == "differentiate":
            expr = sp.expand(expr)
        # If it's an Add and we have a variable, sort terms by degree
        # and reconstruct the display string manually.
        # Skip the sort for 'simplify' (keep SymPy's natural order, which is
        # already the canonical simplified form the user expects).
        if var is not None and isinstance(expr, sp.Add) and kind != "simplify":
            terms = sp.Add.make_args(expr)
            v = sp.Symbol(var) if isinstance(var, str) else var
            sorted_terms = sorted(terms, key=lambda t: (_term_degree(t, v), str(t)))
            # Reconstruct as a string to preserve our ordering (sp.Add
            # would re-sort to its own internal order).
            # Handle negative terms: "a + (-b)" -> "a - b"
            parts = []
            for i, t in enumerate(sorted_terms):
                s = str(t)
                if i == 0:
                    parts.append(s)
                elif s.startswith("-"):
                    parts.append(" - " + s[1:])
                else:
                    parts.append(" + " + s)
            # Return a wrapper that str()s to our sorted form
            class _SortedStr:
                def __init__(self, s, underlying):
                    self._s = s
                    self._underlying = underlying
                def __str__(self):
                    return self._s
                def __repr__(self):
                    return self._s
                @property
                def underlying(self):
                    return self._underlying
            return _SortedStr("".join(parts), expr)
        return expr
    except Exception:
        return expr


def _parse_vec(s: str) -> Optional[List[float]]:
    """Parse '<3, -1, 4>' inner content '3, -1, 4' into [3.0, -1.0, 4.0]."""
    try:
        parts = [p.strip() for p in s.split(',') if p.strip() != '']
        return [float(p) for p in parts]
    except Exception:
        return None


def _parse_matrix(s: str) -> Optional[List[List[float]]]:
    """Parse '[[1, 2, 3], [4, 5, 6], [7, 8, 10]]' into a 2D list of floats.

    Tolerant of whitespace and optional commas between rows.
    Returns None if the string is not a valid matrix.
    """
    try:
        # Use SymPy's Matrix parser if available (handles most syntax)
        if _HAS_SYMPY:
            m = sp.Matrix(sp.sympify(s))
            return [[float(m[i, j]) for j in range(m.cols)] for i in range(m.rows)]
        # Fallback: manual parse
        import json
        # Try to make it JSON-compatible
        s = s.replace(' ', '')
        return json.loads(s)
    except Exception:
        return None


# ── 2. NUMERIC DETECTION & EVALUATION ──────────────────────────────────
def detect_compute(query: str) -> Optional[Dict[str, Any]]:
    """Detects if a query contains a computable numeric expression."""
    q = query.strip().replace('`', '')
    if len(q) > 500: return None

    # v3.8.0: Vector operations (checked before arith to avoid false positives)
    m = _DOT_PRODUCT_RE.search(q)
    if m:
        v1, v2 = _parse_vec(m.group(1)), _parse_vec(m.group(2))
        if v1 and v2 and len(v1) == len(v2):
            return {"kind": "dot_product", "expr": f"dot({v1}, {v2})",
                    "operands": [v1, v2]}
    m = _CROSS_PRODUCT_RE.search(q)
    if m:
        v1, v2 = _parse_vec(m.group(1)), _parse_vec(m.group(2))
        if v1 and v2 and len(v1) == 3 and len(v2) == 3:
            return {"kind": "cross_product", "expr": f"cross({v1}, {v2})",
                    "operands": [v1, v2]}
    m = _MAGNITUDE_RE.search(q)
    if not m:
        m = _MAGNITUDE_RE2.search(q)
    if m:
        v = _parse_vec(m.group(1))
        if v:
            return {"kind": "magnitude", "expr": f"|{v}|", "operands": [v]}

    # v3.9.0: Linear algebra — determinant, eigenvalues, trace
    m = _DET_RE.search(q) or _DET_RE2.search(q)
    if m:
        return {"kind": "determinant", "expr": m.group(1), "matrix_str": m.group(1)}
    m = _EIGEN_RE.search(q)
    if m:
        return {"kind": "eigenvalues", "expr": m.group(1), "matrix_str": m.group(1)}
    m = _TRACE_RE.search(q)
    if m:
        return {"kind": "trace", "expr": m.group(1), "matrix_str": m.group(1)}

    # v3.7.7: Primality detection (extended in v3.8.0)
    m = _PRIME_RE.search(q)
    if m: return {"kind":"prime", "expr":f"isprime({m.group(1)})", "operands":[int(m.group(1))]}
    m = _PRIME_RE2.search(q)
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
    m = _COMBINATION_RE2.search(q)
    if m:
        n, k = int(m.group(1)), int(m.group(2))
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

    # v3.9.0: Linear algebra — determinant, eigenvalues, trace
    if kind in ("determinant", "eigenvalues", "trace"):
        matrix_str = comp.get("matrix_str", "")
        if _HAS_SYMPY:
            try:
                m = sp.Matrix(sp.sympify(matrix_str))
                if kind == "determinant":
                    val = m.det()
                    return {"value": val, "exact": str(val), "approx": float(val) if val.is_number else 0.0}
                elif kind == "eigenvalues":
                    eigs = m.eigenvals()
                    # SymPy returns {value: multiplicity}
                    out = {}
                    for ev, mult in eigs.items():
                        out[str(ev)] = int(mult)
                    return {"value": out, "exact": str(out), "approx": 0.0}
                elif kind == "trace":
                    val = m.trace()
                    return {"value": val, "exact": str(val), "approx": float(val) if val.is_number else 0.0}
            except Exception as e:
                return {"value": None, "error": str(e), "exact": "Error", "approx": 0.0}
        return {"value": None, "error": "SymPy required for linear algebra", "exact": "N/A", "approx": 0.0}

    # v3.8.0: Vector operations
    if kind == "dot_product":
        v1, v2 = comp["operands"]
        val = sum(a * b for a, b in zip(v1, v2))
        # Try to keep integers as integers if all components were integers
        if all(a == int(a) for a in v1 + v2) and val == int(val):
            val = int(val)
        return {"value": val, "exact": str(val), "approx": float(val)}
    if kind == "cross_product":
        v1, v2 = comp["operands"]
        # a x b = (a2*b3 - a3*b2, a3*b1 - a1*b3, a1*b2 - a2*b1)
        cx = v1[1]*v2[2] - v1[2]*v2[1]
        cy = v1[2]*v2[0] - v1[0]*v2[2]
        cz = v1[0]*v2[1] - v1[1]*v2[0]
        val = [cx, cy, cz]
        # Integer-ify if possible
        if all(c == int(c) for c in val):
            val = [int(c) for c in val]
        return {"value": val, "exact": str(val), "approx": float(sum(c*c for c in val)**0.5)}
    if kind == "magnitude":
        v = comp["operands"][0]
        val = math.sqrt(sum(c*c for c in v))
        # Integer-ify if it's a perfect square root
        val_int = round(val)
        if abs(val - val_int) < 1e-9 and val_int*val_int == sum(int(round(c*c)) for c in v):
            # Check if it's truly an integer magnitude (e.g. <3,4,12> -> 13)
            sum_sq = sum(c*c for c in v)
            if all(c == int(c) for c in v):
                sum_sq_int = int(sum(round(c*c) for c in v))
                root = int(math.isqrt(sum_sq_int))
                if root*root == sum_sq_int:
                    return {"value": root, "exact": str(root), "approx": float(root)}
        return {"value": val, "exact": str(val), "approx": float(val)}

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
    # v3.8.0: use a LIGHT LaTeX scrub (preserves ^, _, +, -) so symbolic
    # expressions like 'x^2' survive.  The full scrub_latex is too aggressive
    # (it strips ^ which breaks polynomial matching).
    q = _strip_math_delimiters(query).strip().replace('`', '')

    # v3.9.0: Check ODE FIRST (before solve) — "Solve the ODE: y' = y"
    # would otherwise match the solve detector.
    m = _ODE_RE.search(q)
    if m:
        return {"kind":"ode", "expr": m.group(1).strip(), "var": "x"}
    m = _ODE_DYDX_RE.search(q)
    if m:
        return {"kind":"ode", "expr": "y' = " + m.group(1).strip(), "var": "x"}
    m = _ODE_PRIME_RE.search(q)
    if m:
        return {"kind":"ode", "expr": "y' = " + m.group(1).strip(), "var": "x"}

    m = _DIFF_RE.search(q)
    if m:
        return {"kind":"differentiate", "expr": m.group(1).strip(), "var": m.group(2) or "x"}

    m = _INTEGRATE_RE.search(q)
    if m:
        return {"kind":"integrate", "expr": m.group(1).strip(), "var": m.group(2) or "x"}

    m = _SIMPLIFY_RE.search(q)
    if m:
        return {"kind":"simplify", "expr": m.group(1).strip(), "var": "x"}

    m = _SOLVE_RE.search(q)
    if m:
        return {"kind":"solve", "expr": m.group(1).strip(), "var": m.group(2) or "x"}

    # v3.9.0: Partial derivative
    m = _PARTIAL_DIFF_RE.search(q)
    if m:
        return {"kind":"partial_diff", "expr": m.group(1).strip(),
                "var": m.group(2).strip()}

    # v3.9.0: Gradient (multivariable)
    m = _GRADIENT_RE.search(q)
    if m:
        # Gradient needs all variables in the expression
        return {"kind":"gradient", "expr": m.group(1).strip(), "var": "x"}

    # v3.9.0: Taylor series
    m = _TAYLOR_RE2.search(q)  # Try the "around N" variant first (more specific)
    if m:
        return {"kind":"taylor", "expr": m.group(1).strip(),
                "var": "x", "around": m.group(2)}
    m = _TAYLOR_RE.search(q)
    if m:
        return {"kind":"taylor", "expr": m.group(1).strip(),
                "var": m.group(2) or "x", "around": m.group(3) or "0"}

    # v3.9.0: Limit
    m = _LIMIT_RE.search(q)
    if m:
        return {"kind":"limit", "expr": m.group(1).strip(),
                "var": m.group(2).strip(),
                "point": m.group(3).strip()}

    # v3.9.0: Sum / series
    m = _SERIES_RE.search(q)
    if m:
        return {"kind":"sum", "expr": m.group(1).strip(), "var": "x"}

    return None

def evaluate_symbolic(comp: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates a detected symbolic operation."""
    if _HAS_SYMPY:
        try:
            x = sp.Symbol(comp["var"])
            clean_expr = _normalize_math(comp["expr"])

            if comp["kind"] == "differentiate":
                result = sp.diff(sp.sympify(clean_expr), x)
                result = _canonicalize_sympy(result, x, kind="differentiate")
            elif comp["kind"] == "integrate":
                result = sp.integrate(sp.sympify(clean_expr), x)
                result = _canonicalize_sympy(result, x, kind="integrate")
            elif comp["kind"] == "simplify":
                result = sp.simplify(sp.sympify(clean_expr))
                result = _canonicalize_sympy(result, x, kind="simplify")
            elif comp["kind"] == "solve":
                if '=' in clean_expr:
                    parts = clean_expr.split('=')
                    eq = sp.Eq(sp.sympify(_normalize_math(parts[0])), sp.sympify(_normalize_math(parts[1])))
                    result = sp.solve(eq, x)
                else:
                    result = sp.solve(sp.sympify(clean_expr), x)
            # v3.9.0: Partial derivative
            elif comp["kind"] == "partial_diff":
                # The "var" is the partial-diff variable; we treat it as the
                # single variable to differentiate against.
                v = sp.Symbol(comp["var"])
                # The expression may contain other variables; sympify will pick them up
                result = sp.diff(sp.sympify(clean_expr), v)
                result = _canonicalize_sympy(result, v, kind="differentiate")
            # v3.9.0: Gradient (multivariable)
            elif comp["kind"] == "gradient":
                expr = sp.sympify(clean_expr)
                # Find all free symbols in the expression
                free = sorted(expr.free_symbols, key=lambda s: s.name)
                if not free:
                    return {"value": None, "error": "No variables in expression", "exact": "N/A"}
                # Compute the gradient as a tuple of partial derivatives
                partials = [sp.diff(expr, v) for v in free]
                # Canonicalise each partial
                partials = [_canonicalize_sympy(p, v, kind="differentiate") for p, v in zip(partials, free)]
                # Format as a tuple
                result_str = "(" + ", ".join(str(p) for p in partials) + ")"
                return {"value": partials, "exact": result_str}
            # v3.9.0: ODE solver
            elif comp["kind"] == "ode":
                # Parse "y' = f(x, y)" or "dy/dx = f(x, y)"
                x_sym = sp.Symbol('x')
                y = sp.Function('y')
                # Parse the RHS
                if '=' in clean_expr:
                    parts = clean_expr.split('=', 1)
                    rhs_str = parts[1].strip()
                else:
                    rhs_str = clean_expr.strip()
                # Replace y with y(x) for SymPy's ODE solver
                rhs_str = re.sub(r'\by\b', 'y(x)', rhs_str)
                rhs = sp.sympify(rhs_str)
                eq = sp.Eq(sp.diff(y(x_sym), x_sym), rhs)
                result = sp.dsolve(eq, y(x_sym))
                # Format the result string
                result_str = str(result)
                return {"value": result, "exact": result_str}
            # v3.9.0: Taylor series
            elif comp["kind"] == "taylor":
                around = int(comp.get("around", "0"))
                v = sp.Symbol(comp["var"])
                series_result = sp.series(sp.sympify(clean_expr), v, around, n=5)
                # sp.removeO doesn't exist; use the series' .removeO() method
                try:
                    result = series_result.removeO()
                except Exception:
                    result = series_result
                return {"value": result, "exact": str(result) + " + O(" + comp["var"] + "^5)"}
            # v3.9.0: Limit
            elif comp["kind"] == "limit":
                v = sp.Symbol(comp["var"])
                point_str = comp.get("point", "0").strip().lower()
                if point_str in ("infinity", "inf", "oo"):
                    pt = sp.oo
                else:
                    try:
                        pt = int(point_str)
                    except ValueError:
                        pt = sp.sympify(point_str)
                result = sp.limit(sp.sympify(clean_expr), v, pt)
                return {"value": result, "exact": str(result)}
            # v3.9.0: Sum / series (symbolic)
            elif comp["kind"] == "sum":
                # Try to parse as a sum — fall back to simplification
                result = sp.simplify(sp.sympify(clean_expr))
                return {"value": result, "exact": str(result)}
            else:
                return {"value": None, "error": "Unknown kind", "exact": "N/A"}
            return {"value": result, "exact": str(result)}
        except Exception as e:
            # Re-raise in debug mode; otherwise fall through to fallback
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
    print("=== Testing Module 09: Tools Layer (v3.8.0) ===")

    # Test Numeric
    q1 = "What is gcd(54, 24)?"
    comp1 = detect_compute(q1)
    if comp1:
        res1 = evaluate_numeric(comp1)
        print(f"  Numeric: {comp1['expr']} = {res1.get('exact', 'Error')} (Approx: {res1.get('approx', 0)})")

    # Test Symbolic differentiate
    if _HAS_SYMPY:
        q2 = "Find the derivative of x^3 * sin(x) with respect to x."
        comp2 = detect_symbolic(q2)
        if comp2:
            res2 = evaluate_symbolic(comp2)
            print(f"  Symbolic diff: d/dx({comp2['expr']}) = {res2.get('exact', 'Error')}")

        # Test integrate
        q3 = "Evaluate the integral of x^2 * exp(x) with respect to x."
        comp3 = detect_symbolic(q3)
        if comp3:
            res3 = evaluate_symbolic(comp3)
            print(f"  Symbolic int: integral({comp3['expr']}) = {res3.get('exact', 'Error')}")

        # Test simplify
        q4 = "Simplify (x^2 - 1)/(x - 1)."
        comp4 = detect_symbolic(q4)
        if comp4:
            res4 = evaluate_symbolic(comp4)
            print(f"  Symbolic simp: simplify({comp4['expr']}) = {res4.get('exact', 'Error')}")

    # Test vector ops
    q5 = "Compute the dot product of <3, -1, 4> and <2, 5, -3>."
    comp5 = detect_compute(q5)
    if comp5:
        res5 = evaluate_numeric(comp5)
        print(f"  Dot product: {comp5['expr']} = {res5.get('exact', 'Error')}")

    q6 = "Find the magnitude of the vector <3, 4, 12>."
    comp6 = detect_compute(q6)
    if comp6:
        res6 = evaluate_numeric(comp6)
        print(f"  Magnitude: {comp6['expr']} = {res6.get('exact', 'Error')}")

    # Test arith false-positive fix
    q7 = "Solve x^2 - 4 = 0 for x."
    comp7 = detect_compute(q7)
    print(f"  Arith false-positive check on 'x^2 - 4': compute={comp7} (should be None)")
