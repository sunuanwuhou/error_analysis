"""
新旧版工作区可视化对比截图脚本
输出到 frontend/artifacts/visual-diff/
"""
import os, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8080"
OUT_DIR = Path(__file__).parent.parent / "frontend" / "artifacts" / "visual-diff"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CREDS = [
    ("wesly", "admin123456"),
    ("admin", "admin123456"),
    ("admin", "admin"),
]

def login(page, username, password):
    page.goto(f"{BASE_URL}/login.html", wait_until="domcontentloaded")
    time.sleep(1)
    inputs = page.locator("input").all()
    if len(inputs) >= 2:
        inputs[0].fill(username)
        inputs[1].fill(password)
    else:
        page.locator("input[type=text], input[name=username], input[placeholder*='用户']").first.fill(username)
        page.locator("input[type=password]").first.fill(password)
    page.locator("button[type=submit], button:text('登录'), input[type=submit]").first.click()
    page.wait_for_timeout(2000)
    return "login" not in page.url

def try_login(page):
    for user, pwd in CREDS:
        try:
            if login(page, user, pwd):
                print(f"  ✓ 登录成功: {user}")
                return True
        except Exception as e:
            print(f"  登录尝试 {user} 失败: {e}")
    return False

def ss(page, name, full=True):
    path = str(OUT_DIR / f"{name}.png")
    page.screenshot(path=path, full_page=full)
    print(f"  截图: {name}.png")
    return path

def wait_old_workspace(page):
    """等待旧版工作区完全加载"""
    # 旧版：body.app-view-workspace
    page.wait_for_function("document.body.classList.contains('app-view-workspace')", timeout=15000)
    page.wait_for_timeout(2000)

def switch_to_workspace_old(page):
    """旧版切换到工作区"""
    # 尝试点侧栏工作区按钮
    try:
        btn = page.locator("#sidebarWorkspaceBtn, button:text('工作台'), button:text('工作区')").first
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(1500)
            return
    except:
        pass
    # 直接调 JS
    try:
        page.evaluate("switchAppView('workspace')")
        page.wait_for_timeout(2000)
    except:
        pass

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--window-size=1400,900"]
        )
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()

        print("\n== 登录 ==")
        ok = try_login(page)
        if not ok:
            # 尝试直接访问，可能已有 session
            page.goto(BASE_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
            if "login" in page.url:
                print("  ✗ 登录失败，终止")
                browser.close()
                return

        results = {}

        # ─── 旧版截图 ───
        print("\n== 旧版截图 ==")
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        # 旧版首页
        ss(page, "old-01-home")

        # 切到工作区
        switch_to_workspace_old(page)
        page.wait_for_timeout(3000)
        ss(page, "old-02-workspace-notes")   # 默认应该是笔记 tab

        # 切到错题 tab
        try:
            page.evaluate("typeof switchTab === 'function' && switchTab('errors')")
            page.wait_for_timeout(1500)
        except:
            pass
        ss(page, "old-03-workspace-errors")

        # 旧版侧栏截图
        try:
            sidebar = page.locator(".sidebar")
            if sidebar.is_visible():
                sidebar.screenshot(path=str(OUT_DIR / "old-04-sidebar.png"))
                print("  截图: old-04-sidebar.png")
        except:
            ss(page, "old-04-sidebar-fallback")

        # 旧版错题卡片（展开一张）
        try:
            page.evaluate("switchTab('errors')")
            page.wait_for_timeout(1000)
            card = page.locator(".error-card").first
            if card.is_visible():
                card.click()
                page.wait_for_timeout(800)
                card.screenshot(path=str(OUT_DIR / "old-05-error-card-expanded.png"))
                print("  截图: old-05-error-card-expanded.png")
        except Exception as e:
            print(f"  旧版卡片截图跳过: {e}")

        # 旧版批量操作
        try:
            page.evaluate("typeof toggleBatchMode === 'function' && toggleBatchMode()")
            page.wait_for_timeout(800)
            ss(page, "old-06-batch-mode")
            page.evaluate("typeof toggleBatchMode === 'function' && toggleBatchMode()")
        except:
            pass

        # 旧版 Cloud 详情
        try:
            toggle = page.locator("#cloudDetailsToggle")
            if toggle.is_visible():
                toggle.click()
                page.wait_for_timeout(500)
                page.locator(".sidebar-cloud-controls").screenshot(
                    path=str(OUT_DIR / "old-07-cloud-detail.png")
                )
                print("  截图: old-07-cloud-detail.png")
        except Exception as e:
            print(f"  旧版 Cloud 详情截图跳过: {e}")

        # 旧版更多菜单
        try:
            more_btn = page.locator("#moreMenu button").first
            if more_btn.is_visible():
                more_btn.click()
                page.wait_for_timeout(500)
                page.locator(".more-menu").screenshot(
                    path=str(OUT_DIR / "old-08-more-menu.png")
                )
                print("  截图: old-08-more-menu.png")
                page.keyboard.press("Escape")
        except Exception as e:
            print(f"  旧版更多菜单截图跳过: {e}")

        # 旧版知识树
        try:
            nav = page.locator("#navScroll")
            if nav.is_visible():
                nav.screenshot(path=str(OUT_DIR / "old-09-knowledge-tree.png"))
                print("  截图: old-09-knowledge-tree.png")
        except Exception as e:
            print(f"  旧版知识树截图跳过: {e}")

        # ─── 新版截图 ───
        print("\n== 新版截图 ==")
        page.goto(f"{BASE_URL}/new/xingce/workspace", wait_until="domcontentloaded")
        try:
            page.wait_for_selector(".xc-workspace:not(.xc-loading)", timeout=15000)
        except:
            page.wait_for_timeout(5000)
        page.wait_for_timeout(2000)

        # 新版默认（笔记 tab）
        ss(page, "new-01-workspace-notes")

        # 侧栏单独截图
        try:
            page.locator(".xc-sidebar").screenshot(path=str(OUT_DIR / "new-02-sidebar.png"))
            print("  截图: new-02-sidebar.png")
        except Exception as e:
            print(f"  新版侧栏截图跳过: {e}")

        # 练习面板
        try:
            page.locator(".pp").screenshot(path=str(OUT_DIR / "new-03-practice-panel.png"))
            print("  截图: new-03-practice-panel.png")
        except Exception as e:
            print(f"  新版练习面板截图跳过: {e}")

        # Cloud 展开详情
        try:
            details_btn = page.locator(".pp-cloud-details-btn")
            if details_btn.is_visible():
                details_btn.click()
                page.wait_for_timeout(500)
                page.locator(".pp-cloud-card").screenshot(
                    path=str(OUT_DIR / "new-04-cloud-detail.png")
                )
                print("  截图: new-04-cloud-detail.png")
        except Exception as e:
            print(f"  新版 Cloud 详情截图跳过: {e}")

        # 切到错题 tab
        try:
            page.locator("[data-testid=workspace-tab-errors]").click()
            page.wait_for_timeout(1000)
        except:
            pass
        ss(page, "new-05-workspace-errors")

        # 错题 tab 截图 ErrorsWorkspacePanel
        try:
            page.locator(".ewp").screenshot(path=str(OUT_DIR / "new-06-errors-panel.png"))
            print("  截图: new-06-errors-panel.png")
        except Exception as e:
            print(f"  新版错题面板截图跳过: {e}")

        # 批量操作模式
        try:
            page.locator("button:text('批量操作')").first.click()
            page.wait_for_timeout(600)
            ss(page, "new-07-batch-mode")
            page.locator("button:text('完成')").first.click()
        except Exception as e:
            print(f"  新版批量截图跳过: {e}")

        # 更多菜单
        try:
            page.locator("button:text('更多')").first.click()
            page.wait_for_timeout(500)
            page.locator(".mm").screenshot(path=str(OUT_DIR / "new-08-more-menu.png"))
            print("  截图: new-08-more-menu.png")
            page.keyboard.press("Escape")
        except Exception as e:
            print(f"  新版更多菜单截图跳过: {e}")

        # 知识树
        try:
            page.locator(".kt").screenshot(path=str(OUT_DIR / "new-09-knowledge-tree.png"))
            print("  截图: new-09-knowledge-tree.png")
        except Exception as e:
            print(f"  新版知识树截图跳过: {e}")

        # 切回笔记 tab，展开一个错题卡片
        try:
            page.locator("[data-testid=workspace-tab-errors]").click()
            page.wait_for_timeout(800)
            card = page.locator(".ec").first
            if card.is_visible():
                # 点展开
                card.locator(".ec-toggle, button:text('展开'), .ec-expand").first.click()
                page.wait_for_timeout(800)
                card.screenshot(path=str(OUT_DIR / "new-10-error-card-expanded.png"))
                print("  截图: new-10-error-card-expanded.png")
        except Exception as e:
            print(f"  新版卡片截图跳过: {e}")

        # 高级筛选面板
        try:
            page.locator(".fs-advanced-toggle").click()
            page.wait_for_timeout(500)
            page.locator(".xc-sidebar").screenshot(path=str(OUT_DIR / "new-11-filter-open.png"))
            print("  截图: new-11-filter-open.png")
        except Exception as e:
            print(f"  新版高级筛选截图跳过: {e}")

        # 笔记 tab + 选一个知识节点
        try:
            page.locator("[data-testid=workspace-tab-notes]").click()
            page.wait_for_timeout(500)
            first_node = page.locator(".kt-node-row").first
            if first_node.is_visible():
                first_node.click()
                page.wait_for_timeout(800)
                page.locator(".nwp").screenshot(path=str(OUT_DIR / "new-12-notes-panel.png"))
                print("  截图: new-12-notes-panel.png")
        except Exception as e:
            print(f"  新版笔记面板截图跳过: {e}")

        # 完整页最终截图
        ss(page, "new-13-final-full")

        browser.close()

        summary = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "output_dir": str(OUT_DIR),
            "files": sorted([f.name for f in OUT_DIR.glob("*.png")]),
        }
        (OUT_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
        print(f"\n✓ 完成，截图目录: {OUT_DIR}")
        print(f"  共 {len(summary['files'])} 张截图")

if __name__ == "__main__":
    main()
