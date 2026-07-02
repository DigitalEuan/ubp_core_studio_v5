#!/usr/bin/env python3
"""
benchmarks/run_benchmark.py
===========================
Runs the gold-set benchmark against glm_v37 and writes a results JSON.

Usage:
    # Run all suites, tag the result as 'baseline'
    python benchmarks/run_benchmark.py --suite all --tag baseline

    # Run only the mathnet suite
    python benchmarks/run_benchmark.py --suite mathnet --tag v1

    # Dry run (load gold set + boot runtime, but don't run cases)
    python benchmarks/run_benchmark.py --suite all --tag dryrun --dry-run

Output:
    benchmarks/results/<tag>_<suite>_<date>.json

The output JSON has the structure:
    {
      "tag": str,
      "suite": str,
      "timestamp": ISO 8601,
      "git_sha": str (optional, from `git rev-parse HEAD`),
      "boot_time_ms": float,
      "total_latency_ms": float,
      "correct": int,
      "total": int,
      "cases": [
        {id, suite, category, difficulty, query, expected, actual,
         correct, latency_ms, match_mode},
        ...
      ]
    }
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Make the GLM root importable
THIS_DIR = Path(__file__).resolve().parent
GLM_ROOT = THIS_DIR.parent
if str(GLM_ROOT) not in sys.path:
    sys.path.insert(0, str(GLM_ROOT))

UBP_CORE_PATH = os.environ.get(
    "UBP_CORE_PATH",
    "/home/z/my-project/ubp_experiment/UBP_Repo/core_studio_v4.0/core",
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_gold_set(path: Path) -> Dict[str, Any]:
    """Load the gold set JSON."""
    if not path.exists():
        print(f"[run_benchmark] Gold set not found: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def boot_runtime(ubp_core_path: str, verbose: bool = False, engine: str = "unified"):
    """Boot GLMRuntimeV37. Returns (runtime, boot_time_ms).
    engine: 'unified' for glm_v37_unified.py, 'grown' for glm_v37_grown.py"""
    if str(Path(ubp_core_path)) not in sys.path:
        sys.path.insert(0, str(ubp_core_path))
    try:
        if engine == "grown":
            import GLM11_runtime as glm_mod  # noqa: F401
        else:
            import glm_v37_unified as glm_mod  # noqa: F401
        t0 = time.perf_counter()
        rt = glm_mod.GLMRuntimeV37()
        boot_ms = (time.perf_counter() - t0) * 1000
        if verbose:
            print(f"[run_benchmark] Booted {engine} in {boot_ms:.0f}ms")
        return rt, boot_ms
    except Exception as exc:
        print(f"[run_benchmark] Boot failed: {exc}", file=sys.stderr)
        return None, 0.0


def match(actual: str, expected: str, mode: str) -> bool:
    """Check whether actual matches expected under the given mode."""
    if not actual:
        return False
    a = actual.strip().lower()
    e = expected.strip().lower()
    if mode == "exact":
        return a == e
    if mode == "regex":
        import re
        try:
            return bool(re.search(e, a))
        except re.error:
            return False
    # Default: substring
    return e in a


def run_case(rt, case: Dict[str, Any]) -> Dict[str, Any]:
    """Run a single gold-set case against the runtime."""
    case_id = case.get("id", "?")
    query = case.get("query", "")
    expected = case.get("expected", "")
    match_mode = case.get("match", "substring")

    rt.reset_idea()
    t0 = time.perf_counter()
    try:
        actual = rt.chat(query)
        if not isinstance(actual, str):
            actual = str(actual)
    except Exception as exc:
        actual = f"[ERROR: {exc}]"
    latency_ms = (time.perf_counter() - t0) * 1000

    is_correct = match(actual, expected, match_mode) if expected else len(actual) > 0

    return {
        "id": case_id,
        "suite": case.get("suite", ""),
        "category": case.get("category", ""),
        "difficulty": case.get("difficulty", ""),
        "query": query,
        "expected": expected,
        "actual": actual[:1000],  # truncate for JSON size
        "correct": is_correct,
        "latency_ms": round(latency_ms, 2),
        "match_mode": match_mode,
    }


def get_git_sha() -> Optional[str]:
    """Return the current git SHA, or None if not in a git repo."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
            cwd=str(GLM_ROOT),
        )
        if result.returncode == 0:
            return result.stdout.strip()[:12]
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────���────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Run the GLM gold-set benchmark."
    )
    parser.add_argument("--suite", type=str, default="all",
                        choices=["all", "mathnet", "mathnet_expanded",
                                 "critpt", "language", "failure"],
                        help="Gold-set suite to run.")
    parser.add_argument("--tag", type=str, required=True,
                        help="Tag for this run (e.g. 'baseline', 'v1', 'lexer_adapter'). "
                             "Used in the output filename.")
    parser.add_argument("--ubp-core-path", type=str, default=UBP_CORE_PATH,
                        help="Path to UBP_Repo/core_studio_v4.0/core/.")
    parser.add_argument("--engine", type=str, default="unified",
                        choices=["unified", "grown"],
                        help="Which engine to use: 'unified' (glm_v37_unified.py) or 'grown' (glm_v37_grown.py)")
    parser.add_argument("--gold-set", type=str, default=None,
                        help="Path to golden_cases.json. "
                             "Default: benchmarks/golden_cases.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="Boot + load gold set, but don't run cases.")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Verbose output.")
    args = parser.parse_args()

    # Load gold set
    gold_path = Path(args.gold_set) if args.gold_set else (THIS_DIR / "golden_cases.json")
    gold = load_gold_set(gold_path)

    all_cases = gold.get("cases", [])
    if args.suite != "all":
        cases = [c for c in all_cases if c.get("suite") == args.suite]
    else:
        cases = all_cases

    if args.verbose:
        print(f"[run_benchmark] Gold set: {len(all_cases)} total, {len(cases)} in suite '{args.suite}'")

    # Boot runtime
    rt, boot_ms = boot_runtime(args.ubp_core_path, verbose=args.verbose, engine=args.engine)
    if rt is None:
        print("[run_benchmark] Failed to boot runtime", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print(f"[run_benchmark] Dry run OK. Boot: {boot_ms:.0f}ms. {len(cases)} cases would run.")
        return

    # Run cases
    results: List[Dict[str, Any]] = []
    total_latency = 0.0
    for i, case in enumerate(cases):
        if args.verbose:
            print(f"[run_benchmark] ({i+1}/{len(cases)}) {case.get('id', '?')}")
        result = run_case(rt, case)
        results.append(result)
        total_latency += result["latency_ms"]

    correct = sum(1 for r in results if r["correct"])
    total = len(results)

    # Build output
    output = {
        "tag": args.tag,
        "suite": args.suite,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "git_sha": get_git_sha(),
        "ubp_core_path": args.ubp_core_path,
        "boot_time_ms": round(boot_ms, 2),
        "total_latency_ms": round(total_latency, 2),
        "correct": correct,
        "total": total,
        "accuracy": round(correct / total, 4) if total else 0.0,
        "cases": results,
    }

    # Write output
    results_dir = THIS_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_path = results_dir / f"{args.tag}_{args.suite}_{date_str}.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Print summary
    print(f"\n{'='*60}")
    print(f"  tag:    {args.tag}")
    print(f"  suite:  {args.suite}")
    print(f"  result: {correct}/{total} correct ({output['accuracy']*100:.1f}%)")
    print(f"  boot:   {boot_ms:.0f}ms")
    print(f"  total:  {total_latency:.0f}ms ({total_latency/total:.0f}ms/case avg)" if total else "")
    print(f"  output: {out_path}")
    print(f"{'='*60}")

    # Per-suite breakdown if 'all'
    if args.suite == "all":
        by_suite: Dict[str, List[bool]] = {}
        for r in results:
            by_suite.setdefault(r["suite"], []).append(r["correct"])
        print(f"\nPer-suite:")
        for s, rs in sorted(by_suite.items()):
            c = sum(rs)
            t = len(rs)
            print(f"  {s}: {c}/{t} ({c/t*100:.0f}%)" if t else f"  {s}: 0/0")


if __name__ == "__main__":
    main()
