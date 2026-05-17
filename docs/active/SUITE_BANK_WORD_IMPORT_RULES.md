# 套卷题库 · Word（粉笔风格）导入规则（固化）

本文档固化当前仓库内「套卷 Word → PostgreSQL `suite_papers` / `suite_questions`」的实现假设与运维约定，便于后续扩展年份、省份或其它版式时对齐经验。

**代码入口（单一真相）：**

| 职责 | 路径 |
| --- | --- |
| 段落 / 表格 / 嵌入图抽取 | `tools/suite_bank/docx_paragraphs.py` |
| 小题块解析（题干 / 选项 / 答案行） | `tools/suite_bank/parse_fb_docx_blocks.py` |
| CLI：解析校验 + `replace_paper_bundle` | `tools/suite_bank/import_word_suite_bank.py` |
| 题库服务（整卷替换、搜索、`dedupe_key` 迁移合并） | `backend/services/suite_bank_service.py` |
| 建表与启动迁移链路 | `backend/database.py` 中 `init_suite_bank_tables()`（末尾调用 `migrate_suite_papers_schema`） |

**运维脚本**：单卷 §7 · 批量 `import_word_versions_batch.sh` · 清库重装 `rebuild_word_suite_bank.sh` · 合并重复卷 `cleanup_suite_duplicates.py`（§9）。

---

## 1. 素材目录约定

- 仓库内路径：`word版本/<大类>/<文件名>.docx`  
  - 例：`word版本/广东省考/2008年….docx`、`word版本/广东统考/….docx`
- **`source_rel_path`**：**文件级**唯一键（`UNIQUE`，与磁盘路径一致）；入库后整卷**逻辑**去重以 **`dedupe_key`** 为准（见 §5.1）。
- Docker：`docker-compose.yml` 已将 `./word版本` **只读挂载**到容器内 `/app/word版本`，导入脚本可使用容器内路径。

---

## 2. 粉笔块结构（小题粒度）

当前解析器假定 Word **导出文本顺序**符合下列重复单元（允许中间穿插版块说明段，不以小题头开头的行会被跳过直至匹配小题头）：

1. **小题头（必填）** — 正则见 `HEADER_RE`  
   - 形如：`N. 【标签】可选题干尾部`  
   - 例：`16. 【08广东省考.第16题】俄罗斯近年来数次切断…`
2. **题干延续**：小题头下一行至选项行前，凡不匹配下一小题头 / 正确答案 / 选项的行，并入 `stem`（含原生表格拆成的行）。
3. **选项（0～4 行）**：`OPTION_RE` — `A.`～`D.` 开头（半角）。
4. **答案行（必填）**：`ANSWER_RE` — `正确答案: X | …`  
   - `|` 后为粉笔统计文案；**考点**通过 `考点:` … `自定义备注:` 之间的片段写入 `type_label`。
5. **分隔线**：`DIVIDER_RE` — 一行 `-` 重复（可选跳过）。

**共用材料（资料分析常见）**：在上一个小题的答案行（及可选分隔线）之后、下一小题 **`HEADER_RE`** 之前，出现的若干段落 **不作为单独小题**，而是由 `parse_fenbi_paragraphs` 合并为 **`meta.shared_material`**（同一材料串会挂在随后的每一小题上，直到下一段「孤儿段落」刷新材料）。前端套卷练习页在题干上方固定展示「给定资料」，切换 86～90 等同材料小题时材料区保持不变。

若题干正文为空但有嵌入图，题干占位为「（见下图）」，图片写入 **`img_data`**（见下文）。

---

## 3. `document.xml` 抽取顺序（段落 + 表格 + 图）

### 3.1 顺序遍历 `w:body` 直接子节点

- **`w:p`**：按 OOXML 顺序拼接 **`w:t`**（HTML escape）与同段 **`w:drawing`** / **VML `imagedata`** → **`<img class="sb-inline-img">`**；纯配图且无文本时保留占位说明。
- **`w:tbl`**：按行追加；单元格 **`w:tc`** 内对每个 **`w:p`** 使用与段落相同的 **mixed HTML** 抽取（支持单元格内插图），多段落 / 嵌套表用 **`<br/>`** 串联格内片段；行间仍以 **` | `** 拼接单元格（与其它题干行兼容）。

### 3.2 嵌入图片（粉笔图形题常见）

- 图形常为 **整段 PNG/JPEG**，而非 OOXML 原生表格。
- **DrawingML `a:blip`**（`embed`）与旧版 **VML `v:imagedata`**（关系 **`r:id`**）均尝试解析；二者任一指向 `document.xml.rels` 中的图片部件即可解压。
- **关系文件**：`word/_rels/document.xml.rels`  
  - 可能存在 **UTF-8 BOM**，读取后需 **`raw.startswith(b"\xef\xbb\xbf")` 则剔除**，否则首个 `<Relationship>` 可能解析异常。
- **Target 路径**：粉笔导出多为 **`/media/image.png`**（压缩包根下的 `media/`，不是 `word/media/`）。  
  - 解析规则：若以 **`media/`、`customXml/`、`docProps/`** 等包根一级目录开头，则 zip 路径 **不再加 `word/` 前缀**。
- **小题配图绑定**：同一小题头所在 **`w:p`** 内的首张图，记入 **`stem_images_by_header_line[题干行行号]`**，与 `parse_fenbi_paragraphs` 的小题头索引对齐。
- **入库**：`img_data` 存 **`data:<mime>;base64,...`** 全文（前端 `<img :src>` 直接用）。

### 3.3 选项 / 题干内的行内插图（公式或小字号数字图）

- Word 常在选项中间插入一小段 **`w:drawing`**（例如「20 °C」渲染成 PNG）。抽取时按 **`w:p` → `w:r` / `hyperlink` / `mc:AlternateContent` → …** 的顺序，把 **`w:t`** 与插图交错写成 **`stem` / 选项行字符串里的 HTML**：`<img class="sb-inline-img" src="data:…">`（文本片段仍做 HTML escape）。
- 若某段 **`w:p`** 已输出上述 **行内 `<img>`**，则不再把同段首张图记入 **`stem_images`**（避免整页大图与行内图重复）。
- 前端仅在 **选项按钮**（`.sb-opt-inner`）内把 **`sb-inline-img`** 限制为约 **`1em` 高**；题干与给定资料中的大图样式见 **§6**。

### 3.4 原生表格

- 逐行追加到线性文本列表；小题解析阶段与普通题干延续行同等对待。
- **单元格插图**：`_tc_cell_html` 遍历 **`tc`** 下 **`w:p` / `w:tbl`**，插图进入 **`stem` / `meta.shared_material`** 等字符串中的 **`<img>`**，便于资料分析「表内嵌截图」入库。

---

## 4. 版块标签 `meta.section_heading`

- 来源于 Word 中 **以小节前言开头的段落**（如「数理能力…」「言语理解与表达…」），详见 `parse_fb_docx_blocks.py` 中前缀表 `_SECTION_PREFIXES`。
- **广东省考 2008 行测约定（启发式）**：在「数理能力」且文案含「数字推理与数学运算」时，`question_no ≤ 5` → **数字推理**，`6～15` → **数学运算**；其后跟随下一小节前言切换。
- 其它试卷若无前言或规则不符：可按卷配置扩展映射表，勿硬编码过长魔法数字。

---

## 5. 数据库与列表接口约定

### 5.1 整卷替换与 `dedupe_key`

- 一律使用 **`replace_paper_bundle`**（**三套键辨析见 §5.4**）：先按 **`dedupe_key`** 或 **`source_rel_path`** 删除可能存在的旧行，再插入当前文件，避免「同卷多路径」残留两条列表记录。
- **`dedupe_key`**：`sd_` + `sha256(normalize(folder) + "\\0" + normalize(title))` 截断（算法见 `suite_bank_service.compute_suite_dedupe_key`）。normalize 含 **Unicode NFKC + 折叠空白**，减少「看起来像同一套」却因零宽字符/全角符号不一致而未合并的情况。**同一文件夹 + 规范化后相同标题**视为同一套卷，重复导入会覆盖。
- **`paper_id`**：默认 `suite_` + `sha256(dedupe_key)` 截断，**与 Word 文件路径无关**；书签/链接在首次从「按路径派生 id」迁到本规则后可能变化，批处理重导一次即可对齐。可用 **`--paper-id`** 强制指定（慎用：若与另一条卷撞 id 会破坏数据）。
- 应用启动时 **`init_suite_bank_tables`** 之后会跑 **`migrate_suite_papers_schema`**：补列、按 `dedupe_key` 合并历史重复行（**优先 `word版本/` 路径**，同路径类下再保留小题数较多者）、再尝试 `UNIQUE(dedupe_key)` 与 `NOT NULL`。

### 5.2 `list_papers` 排序与 LIKE

- 优先展示 **`word版本/`** 导入卷：`ORDER BY … CASE WHEN source_rel_path LIKE 'word版本%%' THEN 0 ELSE 1 END`  
  - **注意**：经 `database.py` 的 `_adapt_sql` / psycopg 管线时，字符串里的 **`%` 必须写成 `%%`**，否则会触发 `ProgrammingError: ... got '%'`。

### 5.3 同名试卷重复

- 迁移后列表层以 **`dedupe_key`** 唯一；若仍有异常，可看 `meta.dedupe_key`、小题数与 `source_rel_path`，必要时 **`purge_suite_paper.py`** 或按路径重导覆盖。

### 5.4 三套键与时间线（固化理解）

| 键 | 作用 | 说明 |
| --- | --- | --- |
| `source_rel_path` | 表中 **路径唯一** | 必须与 `--source-rel-path` 一致（如 `word版本/广东省考/….docx`）。换路径会得到新 UNIQUE，但若 `folder + title` 相同则仍与旧行争同一 **`dedupe_key`**。 |
| `dedupe_key` | **逻辑一套卷一行** | 由 **规范化后的** `folder` + `title` 哈希得来；NFKC + 折叠空白。**重复导入**：`replace_paper_bundle` 会先 `DELETE` 命中 `dedupe_key`（或本条 `source_rel_path`）的旧行再插入。 |
| `paper_id` | API `/papers/{id}`、小题外键 | 默认由 **`dedupe_key`** 稳定派生，与物理路径脱钩（`import_word_suite_bank.py`，可 `--paper-id` 强行覆盖——易撞号，不推荐）。 |

**Word 徽章**：前端 `SuiteBankPage.vue` 以 `source_rel_path.startswith('word版本/')` 显示蓝色「Word」，与业务上「粉笔 Word 流水线正本」一致；若库里只剩非 `word版本/` 的行，徽章会消失——说明被错误合并或未走 Word 重导。

### 5.5 切勿回退的策略（血泪教训）

- **迁移 / `cleanup_suite_duplicates` 两条重复行并存时**：**必须优先保留 `source_rel_path` 以 `word版本/` 开头的行**。同一来源类里再用小题数、`created_at` 做次级排序。
- **错误先例**：若以「小题数多」为第一排序键，常会留下历史上从其它渠道批量灌入的超大题集，**删掉小题数较少的 Word 正本**，列表上 **Word 标志全部消失**。当前实现已改正；后续改迁移逻辑时请保留本约束。

---

## 6. 前端配套约定（非导入逻辑，但与呈现一致）

- **题干填空下划线**：对连续空白、`___` / `＿＿＿` 等在前端渲染为带底线的占位（见 `SuiteBankPage.vue`）。
- **答题卡**：按 **`meta.section_heading`** 分段跳转；作答状态仅存前端会话。
- **插图字号**：入库统一使用 **`sb-inline-img`**。**选项**内限制约 **`1em` 高**，避免撑大行距；**题干**与 **给定资料（`meta.shared_material`）** 内同一 class 按 **块状大图**（`max-width:100%`、`max-height` 视口比例）渲染，避免资料分析表格截图缩成一条线。
- **多选题**：参考答案为 **`A,B,D`**（逗号分隔）时，前端展示 **「多选」** 标签；作答可 **反复点选** 切换选项组合；揭晓后：**选对且选中的项**绿、**对应但未选**琥珀提示（`ok-miss`）、**误选**红；答题卡上以选项集合是否与参考答案集合完全一致判定绿/红。

---

## 7. 导入命令模板（容器内）

在项目根目录执行（确保 compose 能找到 **`word版本`** 挂载）：

```bash
docker compose exec -T app python3 /app/tools/suite_bank/import_word_suite_bank.py \
  --docx "/app/word版本/<大类>/<文件名>.docx" \
  --source-rel-path "word版本/<大类>/<文件名>.docx" \
  --folder "<大类>"
```

- **`import_word_suite_bank.py`** 会把 **`tools/suite_bank`** 加入 **`sys.path`**，无需再设 **`PYTHONPATH=/app/tools/suite_bank`**。  
  **切勿**仅用 **`PYTHONPATH=/app/tools/suite_bank`** 启动 **`python3`**（否则会打乱 **`site-packages`**，常见报错 **`ModuleNotFoundError: psycopg`**）。
- **`--dry-run`**：不写库，且不加载 **`backend`** 包（本机可无 **`psycopg`**）；仅打印解析统计与样本小题。
- **`--folder`**：省略时默认为 **`广东省考`**。
- 改导入逻辑或前端静态资源后：**必须**按 `AGENTS.md` 执行 **`scripts/wsl.ps1 -Action up -Service app`** 重建 **`app`** 镜像后再宣称容器内已更新。**完整运维顺序与坑位**：见 **§10**。
- **批量重导**：在仓库根目录执行 **`bash tools/suite_bank/import_word_versions_batch.sh`**（遍历 **`word版本/*/*.docx`**，跳过 Word 临时文件 **`~$*.docx`**；每项 **`--folder`** 取上级文件夹名，与现有入库约定一致）。
- **合并列表重复卷**（同款标题、多套路径 / 多套 `paper_id`）：部署 **含最新 `migrate_suite_papers_schema` 的后端镜像** 后，执行一次：
  ```bash
  docker compose exec -T app python3 /app/tools/suite_bank/cleanup_suite_duplicates.py
  ```
  （应用 **启动时** 也会跑一次迁移；本条用于补跑或运维确认终端输出。保留策略：**`word版本/` 优先**，同类下 **小题数较多** 次之。）

- **仅 Word 全量重建**：在仓库根目录执行 **`bash tools/suite_bank/rebuild_word_suite_bank.sh`**（先 **`DELETE FROM suite_papers`**，再跑 **`import_word_versions_batch.sh`**；列表将只含 `word版本/…` 导入，**Word** 标记与之一致）。

### 7.1（可选）仅清空套卷

```bash
docker compose exec -T app python3 <<'PY'
from backend.database import get_conn
with get_conn() as c:
    c.execute("DELETE FROM suite_papers")
print("cleared")
PY
```

---

## 8. 已知局限与后续可增强点

| 现象 | 说明 |
| --- | --- |
| 小节名与真题不完全一致 | Word 仅有合并前言时没有单独「数字推理」标题，依赖启发式或手工扩展规则。 |
| 同一小题多张图 | 当前仅取 **首张** `blip`。 |
| 选项字母超过 D / 非 `A.` 样式 | 需扩展 `OPTION_RE`。 |
| 答案行格式变化 | 若不含 `正确答案:` 或分隔符变化，需改 `ANSWER_RE` 或加分支版式簇。 |
| 小题头正则不匹配 | 新增地区年份时先在样本上跑 `debug_dump_docx.py`，再决定是否加新版式簇。 |
| 答案行为「正确答案: A,B,D \| …」多选 | `ANSWER_MULTI_RE`：入库 **`answer`** 为 **`A,B,D`**；前端支持多选作答与答题卡集合比对（见 §6）。 |
| 图表 / OLE 非嵌入式位图 | Word **原生图表**若未落成 **`blip` / `imagedata` → media**，当前管线可能抽不到图。 |

---

## 9. 调试工具

| 脚本 | 用途 |
| --- | --- |
| `tools/suite_bank/debug_dump_docx.py` | 打印线性文本行号 + 嵌入图行索引 |
| `tools/suite_bank/verify_paper.py <paper_id>` | 抽检题库中小题 meta / 题干前缀 |
| `tools/suite_bank/cleanup_suite_duplicates.py` | 合并 **`dedupe_key`** 重复套卷（需容器内已为最新后端） |
| `tools/suite_bank/rebuild_word_suite_bank.sh` | 清空 **`suite_papers`** 后对 **`word版本/*/*.docx`** 批量重导（恢复 **Word** 标记） |
| `tools/suite_bank/import_word_versions_batch.sh` | 批量：`word版本/*/*.docx` → `import_word_suite_bank.py` |
| `tools/suite_bank/list_suite_guangdong.py` | 按标题过滤罗列卷（示例） |
| `tools/suite_bank/purge_suite_paper.py` | 按 `suite_papers.id` 删除单卷（小题 CASCADE）；用于定点纠错 |

---

## 10. 导入与运维经验（固化 checklist）

以下内容来自实际踩坑后的约定，扩容省份 / 换人接手时请先过一遍。

1. **正本数据源**：题库以仓库 **`word版本/<大类>/<文件>.docx`** 为准；**`--folder`** 取 **直接上级目录名**（与批量脚本一致：`广东省考`、`广东统考`…），前端按 folder 归类「省考 / 统考」。
2. **改代码再入库**：凡是改 **`backend/`** 或 **`tools/suite_bank/*.py`** 的行为，必须先按仓库 **`AGENTS.md`** **`wsl.ps1 -Action up -Service app`** 重建 **`app` 镜像**；否则容器里仍是旧逻辑，「本地改了、线上没变」会产生误判。
3. **单列 vs 批量**：抽检用 **`--dry-run`**（无需 DB）；入库用单卷命令 §7；全目录用 **`import_word_versions_batch.sh`**。
4. **脏数据收口**：  
   - 仅 **`dedupe_key` 维度**多行：**`cleanup_suite_duplicates.py`**（启动时也会跑迁移，本条用于确认输出）。  
   - 混入非 Word、或合并策略曾被误删 Word：**`rebuild_word_suite_bank.sh`**（清库 → 仅从 `word版本/` 重装，58+ 份量级约数分钟）。
5. **多选答案**：粉笔行 `正确答案: A,B,D` → 解析器 **`ANSWER_MULTI_RE`**，库存 **`answer='A,B,D'`**，前端 §6；新增版式时注意别拆成单字母。
6. **解析失败**：先 **`debug_dump_docx.py`** 看行序与题干头；小题头不匹配再改 **`HEADER_RE` / `parse_fb_docx_blocks`**；答案行不匹配改 **`ANSWER_RE` / `ANSWER_MULTI_RE`**。
7. **环境**：本仓库 **WSL-first**；勿在 Windows 宿主混跑 `docker`/`python` 与路径混用。**`DATABASE_URL`** 须指向 compose 栈内正在跑的 Postgres（本地常用容器内默认值即可）。
8. **多环境与线上**：笔记本 Docker 里的「已清库并重导」**不会自动**同步到你部署的远端库；远端需 **同样部署后端镜像**，并在指向 **该环境数据库** 的 compose/主机上执行与 §7、§9 一致的脚本。

**文档版本**：与仓库脚本保持一致演进；修改导入行为时请同步 §2～§5、§7、§9、§10。
