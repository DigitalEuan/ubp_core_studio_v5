from pathlib import Path
from GLM11_runtime import GLMRuntimeV37
# ══════════════════════════════════════════════════════════════════════════════
# §12  CLI / TEST ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════
def _run_tests():
    """Self-test harness covering all v3.4–v3.7 features (v3.7.4 build)."""
    import json
    mg = Path(".") / "idea_meta_graph.json"
    if mg.exists(): mg.unlink()
    print("="*80); print("GLM v3.7.4 SELF-TEST"); print("="*80)
    rt = GLMRuntimeV37()

    tests = []

    # A: basic chat + crystallisation
    print("\n[A] Basic chat + crystallisation")
    rt.reset_idea()
    r1 = rt.chat("Tell me about the hamiltonian and time.")
    r2 = rt.chat("What about symmetry?")
    st = rt.idea_state()
    # DEBUG
    print(f"DEBUG: st['manager']={st['manager']}, type={type(st['manager'])}")
    
    manager_state = st["manager"]
    if isinstance(manager_state, str):
        import json
        manager_state = json.loads(manager_state)
        
    z = manager_state["zones"][manager_state["active_idx"]]
    tests.append(("A_crystallise", z["crystallized"], z["thesis"]))
    print(f"  crystallized={z['crystallized']} thesis={z['thesis']!r}")

    # B: calculation tool + grounding
    print("\n[B] Calculation tool + grounding")
    rt.reset_idea()
    r = rt.chat("What is gcd(54, 24)?")
    d = rt.last_diag()
    grounded = d.get("compute",{}).get("grounded")
    tests.append(("B_calc_ground", grounded is not None, grounded[0] if grounded else None))
    print(f"  grounded={grounded[0] if grounded else None}")

    # C: symbolic tool (differentiate)
    print("\n[C] Symbolic tool (differentiate x^2)")
    rt.reset_idea()
    r = rt.chat("differentiate x^2 with respect to x")
    d = rt.last_diag()
    sym = d.get("symbolic")
    tests.append(("C_symbolic", sym is not None, sym["result"]["exact"] if sym else None))
    print(f"  result={sym['result']['exact'] if sym else None}")

    # D: symbolic solve
    print("\n[D] Symbolic solve (x^2 - 4 = 0)")
    rt.reset_idea()
    r = rt.chat("solve x^2 - 4 for x")
    d = rt.last_diag()
    sym = d.get("symbolic")
    tests.append(("D_solve", sym is not None, sym["result"]["exact"] if sym else None))
    print(f"  result={sym['result']['exact'] if sym else None}")

    # E: multi-zone
    print("\n[E] Multi-zone routing")
    rt.reset_idea()
    rt.chat("Tell me about the hamiltonian and time.")
    rt.chat("What about zero and one?")
    rt.chat("What about plus and minus?")
    st = rt.idea_state()
    tests.append(("E_multi_zone", st["manager"]["num_zones"] >= 2, st["manager"]["num_zones"]))
    print(f"  num_zones={st['manager']['num_zones']}")

    # F: contradiction
    print("\n[F] Contradiction detection")
    rt.reset_idea()
    rt.chat("Tell me about the boson.")
    rt.chat("And the fermion.")
    st = rt.idea_state()
    z = st["manager"]["zones"][st["manager"]["active_idx"]]
    tests.append(("F_contradiction", bool(z["contradictions"]), z["contradictions"]))
    print(f"  contradictions={z['contradictions']}")

    # G: autonomous maturation
    print("\n[G] Autonomous maturation")
    rt.reset_idea()
    rt.chat("Tell me about the hamiltonian.")
    st0 = rt.idea_state()
    rt.mature(5)
    st1 = rt.idea_state()
    z1 = st1["manager"]["zones"][0]
    tests.append(("G_maturation", len(z1["inferred_nouns"]) > 0, len(z1["inferred_nouns"])))
    print(f"  inferred_nouns={len(z1['inferred_nouns'])}")

    # H: warm-start
    print("\n[H] Warm-start")
    rt.reset_idea()
    r = rt.chat("Tell me about the hamiltonian and time.")
    d = rt.last_diag()
    tests.append(("H_warm_start", d.get("warm_start") is not None, d.get("warm_start")))
    print(f"  warm_start={d.get('warm_start')}")

    # I: determinism
    print("\n[I] Determinism")
    if mg.exists(): mg.unlink()
    def conv():
        rt.reset_idea()
        return [rt.chat("Tell me about the hamiltonian and time."),
                rt.chat("What about symmetry?")]
    r1 = conv()
    if mg.exists(): mg.unlink()
    r2 = conv()
    det = (r1 == r2)
    tests.append(("I_determinism", det, None))
    print(f"  deterministic={det}")

    # J: auto-expansion
    print("\n[J] CRG auto-expansion")
    tests.append(("J_auto_expand", len(rt.auto_expansions) > 0, len(rt.auto_expansions)))
    print(f"  auto_proposed edges={len(rt.auto_expansions)}")

    # K: contradiction-driven pivot (v3.7)
    print("\n[K] Contradiction-driven pivot")
    rt.reset_idea()
    rt.chat("Tell me about the boson.")
    rt.chat("And the fermion.")
    d = rt.last_diag()
    st = rt.idea_state()
    pivot_ok = d.get("pivot_spawned") is not None and st["manager"]["num_zones"] >= 2
    tests.append(("K_pivot", pivot_ok, d.get("pivot_spawned")))
    print(f"  pivot_spawned={d.get('pivot_spawned')} num_zones={st['manager']['num_zones']}")

    # L: cross-zone synthesis (v3.7)
    print("\n[L] Cross-zone synthesis")
    rt.reset_idea()
    m = rt.manager; m.reset()
    # zone 0: hamiltonian (commutes_with symmetry)
    m._spawn_zone(); m.zones[-1].set_crg(rt.crg); m.zones[-1].set_vocab(rt.glm.vocab)
    m.zones[-1].update([('hamiltonian', rt.glm.vocab.words['hamiltonian'])], 1)
    m.zones[-1].update([('time', rt.glm.vocab.words['time'])], 2)
    m.zones[-1].crystallized = True
    m.zones[-1].thesis = m.zones[-1]._synthesise_thesis()
    m.zones[-1].peak_coherence = 0.8
    # zone 1: anomaly (symmetry generates anomaly — shares 'symmetry')
    m._spawn_zone(); m.zones[-1].set_crg(rt.crg); m.zones[-1].set_vocab(rt.glm.vocab)
    m.zones[-1].update([('anomaly', rt.glm.vocab.words['anomaly'])], 1)
    m.zones[-1].crystallized = True
    m.zones[-1].thesis = m.zones[-1]._synthesise_thesis()
    m.zones[-1].peak_coherence = 0.75
    m.zones = m.zones[1:]; m.active_idx = 0
    mt = rt.synthesise()
    syn_ok = mt is not None and "symmetry" in (mt.thesis or "").lower()
    tests.append(("L_synthesis", syn_ok, mt.thesis if mt else None))
    print(f"  meta_thesis={mt.thesis if mt else None}")

    # summary
    print("\n" + "="*80); print("SUMMARY"); print("="*80)
    passed = 0
    for name, ok, detail in tests:
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}: {detail}")
        if ok: passed += 1
    print(f"\n  {passed}/{len(tests)} tests passed")

    # save results
    results = [{"name":n,"ok":ok,"detail":str(d)} for n,ok,d in tests]
    try:
        (Path(".") / "v37_test_results.json").write_text(json.dumps(results, indent=2))
        print("  results saved to v37_test_results.json")
    except Exception as e:
        print(f"Warning: Could not write test results: {e}")
    return passed == len(tests)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="UBP GLM v3.7.4 (Grown Build + Hex Optimization)")
    p.add_argument("--test", action="store_true", help="run self-test")
    p.add_argument("--chat", type=str, help="single chat query")
    p.add_argument("--state", action="store_true", help="dump idea state")
    args = p.parse_args()
    if args.test:
        _run_tests()
    elif args.chat:
        rt = GLMRuntimeV37()
        print(rt.chat(args.chat))
    elif args.state:
        rt = GLMRuntimeV37()
        print(json.dumps(rt.idea_state(), indent=2, default=str))
    else:
        p.print_help()