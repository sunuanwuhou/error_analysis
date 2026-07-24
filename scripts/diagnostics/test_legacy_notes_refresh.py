#!/usr/bin/env python3
"""Reproduce legacy xingce note persistence + refresh freeze via Playwright."""
from __future__ import annotations

import json
import sys
import time

BASE = "http://127.0.0.1:8088"


def read_idb(page):
    return page.evaluate(
        """async () => {
      const keys = [
        'xc_knowledge_tree', 'xc_knowledge_notes', 'xc_notes_by_type',
        'xc_errors', 'xc_knowledge_expanded'
      ];
      const openReq = indexedDB.open('xingce_db', 1);
      const db = await new Promise((resolve, reject) => {
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error);
      });
      const out = {};
      for (const key of keys) {
        out[key] = await new Promise((resolve) => {
          const tx = db.transaction('kv', 'readonly');
          const store = tx.objectStore('kv');
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? req.result.v : null);
          req.onerror = () => resolve(null);
        });
      }
      db.close();
      return out;
    }"""
    )


def summarize_notes(raw):
    tree = json.loads(raw.get("xc_knowledge_tree") or "null") if raw.get("xc_knowledge_tree") else None
    notes = json.loads(raw.get("xc_knowledge_notes") or "{}") if raw.get("xc_knowledge_notes") else {}
    notes_by_type = json.loads(raw.get("xc_notes_by_type") or "{}") if raw.get("xc_notes_by_type") else {}

    def walk(nodes, acc):
        for node in nodes or []:
            if not node:
                continue
            cid = str(node.get("id") or "")
            content = str(node.get("contentMd") or "").strip()
            if content:
                acc.append({"id": cid, "title": node.get("title"), "len": len(content), "src": "tree"})
            walk(node.get("children") or [], acc)

    tree_with_content = []
    if tree and isinstance(tree, dict):
        walk(tree.get("roots") or [], tree_with_content)

    map_with_content = []
    for nid, item in (notes or {}).items():
        content = str((item or {}).get("content") or "").strip()
        if content:
            map_with_content.append({"id": nid, "title": (item or {}).get("title"), "len": len(content), "src": "map"})

    legacy_type = []
    for key, item in (notes_by_type or {}).items():
        content = str((item or {}).get("content") or "").strip()
        if content:
            legacy_type.append({"key": key, "len": len(content), "src": "notesByType"})

    return {
        "tree_nodes_with_content": len(tree_with_content),
        "map_nodes_with_content": len(map_with_content),
        "legacy_type_notes": len(legacy_type),
        "samples": (tree_with_content + map_with_content + legacy_type)[:8],
        "tree_root_count": len((tree or {}).get("roots") or []) if tree else 0,
    }


def count_knowledge_nodes(page):
    return page.evaluate(
        """() => {
      if (typeof collectKnowledgeNodes === 'function') {
        return collectKnowledgeNodes().length;
      }
      if (typeof getKnowledgeRootNodes === 'function') {
        const roots = getKnowledgeRootNodes() || [];
        let n = 0;
        const walk = (nodes) => (nodes || []).forEach((node) => { n += 1; walk(node.children); });
        walk(roots);
        return n;
      }
      return -1;
    }"""
    )


def get_runtime_state(page):
    return page.evaluate(
        """() => ({
      selectedKnowledgeNodeId: typeof selectedKnowledgeNodeId !== 'undefined' ? selectedKnowledgeNodeId : null,
      noteEditing: typeof noteEditing !== 'undefined' ? noteEditing : null,
      hasRenderNotes: typeof renderNotesByType === 'function',
      hasEnsureKnowledgeState: typeof ensureKnowledgeState === 'function',
      notesContentText: (document.getElementById('notesContent') || {}).innerText?.slice(0, 400) || '',
      overlay: !!document.getElementById('_wsTabLoadingOverlay'),
      loadingOverlayText: (document.getElementById('_wsTabLoadingOverlay') || {}).textContent || '',
    })"""
    )


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed; run: pip install playwright && playwright install chromium")
        return 2

    report = {"steps": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        def log(step, data):
            report["steps"].append({"step": step, "data": data})
            print(f"\n=== {step} ===")
            print(json.dumps(data, ensure_ascii=False, indent=2)[:4000])

        # login
        login = context.request.post(
            f"{BASE}/api/auth/login",
            data={"username": "wesly", "password": "admin123456"},
        )
        log("login", {"ok": login.ok, "status": login.status})

        t0 = time.time()
        page.goto(f"{BASE}/?embed=1", wait_until="domcontentloaded", timeout=120000)
        try:
            page.wait_for_function(
                "() => typeof renderNotesByType === 'function' && document.getElementById('notesContent')",
                timeout=120000,
            )
        except Exception as exc:
            log("boot_timeout", {"error": str(exc), "elapsed_s": round(time.time() - t0, 2), "state": get_runtime_state(page)})
            browser.close()
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 1

        boot_elapsed = round(time.time() - t0, 2)
        log("boot_ok", {"elapsed_s": boot_elapsed, "state": get_runtime_state(page), "nodes": count_knowledge_nodes(page)})

        idb_before = read_idb(page)
        log("idb_before_refresh", summarize_notes(idb_before))

        # inject a test note into first leaf via runtime API
        injected = page.evaluate(
            """() => {
      if (typeof getKnowledgeRootNodes !== 'function') return { ok: false, reason: 'no getKnowledgeRootNodes' };
      const marker = '__REFRESH_TEST_' + Date.now();
      let target = null;
      const walk = (nodes) => {
        for (const node of nodes || []) {
          if (!node) continue;
          if (node.isLeaf || !(node.children && node.children.length)) {
            target = node;
            return;
          }
          walk(node.children);
          if (target) return;
        }
      };
      walk(getKnowledgeRootNodes());
      if (!target && typeof collectKnowledgeNodes === 'function') {
        const all = collectKnowledgeNodes();
        target = all.find(n => n && n.isLeaf) || all[0] || null;
      }
      if (!target) return { ok: false, reason: 'no target node' };
      selectedKnowledgeNodeId = target.id;
      target.contentMd = marker + '\\n\\n# 刷新测试笔记';
      target.updatedAt = new Date().toISOString();
      if (typeof syncKnowledgeNotesFromTree === 'function') syncKnowledgeNotesFromTree();
      else if (typeof syncKnowledgeNotesFromTreeSafe === 'function') syncKnowledgeNotesFromTreeSafe();
      if (typeof persistKnowledgeStateNow === 'function') {
        persistKnowledgeStateNow();
      } else if (typeof saveKnowledgeState === 'function') {
        saveKnowledgeState({ preserveTreeShape: true });
      }
      if (typeof renderNotesByType === 'function') renderNotesByType();
      return { ok: true, nodeId: target.id, title: target.title, marker };
    }"""
        )
        log("inject_note", injected)

        page.wait_for_timeout(1500)
        idb_after_inject = read_idb(page)
        log("idb_after_inject", summarize_notes(idb_after_inject))

        # refresh
        t1 = time.time()
        page.reload(wait_until="domcontentloaded", timeout=120000)
        try:
            page.wait_for_function(
                "() => typeof renderNotesByType === 'function' && document.getElementById('notesContent')",
                timeout=120000,
            )
        except Exception as exc:
            log("reload_timeout", {"error": str(exc), "elapsed_s": round(time.time() - t1, 2), "state": get_runtime_state(page)})
            browser.close()
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 1

        reload_elapsed = round(time.time() - t1, 2)
        state_after = get_runtime_state(page)
        idb_after_reload = read_idb(page)
        marker = injected.get("marker") if isinstance(injected, dict) else None
        marker_found_dom = False
        marker_found_idb = False
        if marker:
            marker_found_dom = page.evaluate(
                "(m) => (document.getElementById('notesContent')?.innerText || '').includes(m)",
                marker,
            )
            blob = json.dumps(idb_after_reload)
            marker_found_idb = marker in blob

        log(
            "after_reload",
            {
                "elapsed_s": reload_elapsed,
                "state": state_after,
                "nodes": count_knowledge_nodes(page),
                "idb": summarize_notes(idb_after_reload),
                "marker": marker,
                "marker_found_dom": marker_found_dom,
                "marker_found_idb": marker_found_idb,
            },
        )

        browser.close()

    passed = bool(marker_found_idb) if marker else False
    report["pass"] = passed
    print("\n=== SUMMARY ===")
    print(json.dumps(report["steps"][-1]["data"], ensure_ascii=False, indent=2))
    print(f"PASS={passed}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
