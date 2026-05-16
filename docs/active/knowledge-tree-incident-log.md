# Knowledge Tree Incident Log

## Goal

Track knowledge-tree structure regressions, confirmed-good or confirmed-bad backups, and the code paths most likely involved.

## Current Status

- User manually re-migrated the tree and created a latest local backup at `2026-05-09T07:31:04+08:00`.
- Backup directory: [manual_20260509_073104](</E:/IdeaProject/git/xingce_v3_lab/data/backups/5759eb632cf113d6b9b47edd/manual_20260509_073104>)
- Backup summary from [meta.json](/E:/IdeaProject/git/xingce_v3_lab/data/backups/5759eb632cf113d6b9b47edd/manual_20260509_073104/meta.json):
  - `errors=316`
  - `notesByType=61`
  - `knowledgeNodes=134`

## Latest Verification

Verified [snapshot.json](/E:/IdeaProject/git/xingce_v3_lab/data/backups/5759eb632cf113d6b9b47edd/manual_20260509_073104/snapshot.json).

Result:

- The tree is still structurally incorrect inside the backup file.
- Root count is `40`, which is too high for the canonical top-level tree.
- Root titles include both canonical roots and many nodes that should be children:
  - `言语理解与表达`
  - `判断推理`
  - `数量关系`
  - `资料分析`
  - `常识判断`
  - `未分类`
  - `4321`
  - `条件推理`
  - `比例法`
  - `串串`
  - `二级数列`
  - `翻译推理`
  - `星期日期`
  - `行程问题`
  - `植树问题`
- `数量关系 > 星期日期` is not present.
- `星期日期` appears as a root-level node instead of a child under `数量关系`.

## Earlier Backup Checks

Checked these backups and they were also already bad:

- [manual_20260508_223304/snapshot.json](/E:/IdeaProject/git/xingce_v3_lab/data/backups/5759eb632cf113d6b9b47edd/manual_20260508_223304/snapshot.json)
- [before_restore_20260508_224638/snapshot.json](/E:/IdeaProject/git/xingce_v3_lab/data/backups/5759eb632cf113d6b9b47edd/before_restore_20260508_224638/snapshot.json)

Observed bad-shape symptoms:

- roots like `二级数列`, `数字推理`, `片段阅读`, `翻译推理`, `逻辑判断`, `4321`, `容斥`, `比例法`
- missing `数量关系 > 星期日期`

Also checked:

- [manual_20260417_200000_recovered.tar.gz](</E:/IdeaProject/git/xingce_v3_lab/data/backups/5759eb632cf113d6b9b47edd/manual_20260417_200000_recovered.tar.gz>)
- [backup_user_5759eb632cf113d6b9b47edd_20260411_175708.json](/E:/IdeaProject/git/xingce_v3_lab/data/backup_user_5759eb632cf113d6b9b47edd_20260411_175708.json)

Those are not valid candidates for the current correct full tree either.

## Cloud Backup Findings

Checked `user_backups.payload_json` in PostgreSQL for user `5759eb632cf113d6b9b47edd`.

Confirmed:

- the cloud backup currently stored in DB is also already bad
- it contains `星期日期`
- it contains the text path `数量关系 > 星期日期`
- but the actual root array in the stored JSON starts with flattened child nodes such as:
  - `二级数列`
  - `数字推理`
  - `片段阅读`
  - `翻译推理`
  - `逻辑判断`
  - `4321`
  - `判断推理`
  - `容斥`
  - `比例法`

This means the problem is not only display-side. A bad tree shape has already been written into backup storage.

## Relevant Commits

High-signal tree-related commits on `2026-05-08`:

- `4eed936` at `2026-05-08 17:44:48 +08:00`
  - message: `fix(xingce): harden knowledge-tree move flow and freeze node baseline`
- `23edd00` at `2026-05-08 22:31:33 +08:00`
  - message: `feat(xingce): lock root stability while allowing controlled node growth`

## Likely Risk Areas

- [30-directory-management.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/30-directory-management.js)
  - `ensureKnowledgeState(...)`
- [05-persistence.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/05-persistence.js)
  - `saveKnowledgeState(...)`
- [30t-knowledge-tree-baseline-freeze.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/knowledge/30t-knowledge-tree-baseline-freeze.js)
  - baseline freeze / remap behavior
- [05q-apply-remote-ops.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/persistence/05q-apply-remote-ops.js)
  - remote knowledge-node ops intentionally ignored
- [27-backup-restore.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/27-backup-restore.js)
  - full restore / cloud restore behavior

## What We Changed

Already added a `preserveTreeShape` path so full restore and cloud restore do not auto-merge or auto-collapse the restored tree.

Files changed:

- [05-persistence.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/05-persistence.js)
- [30-directory-management.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/30-directory-management.js)
- [27-backup-restore.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/27-backup-restore.js)

This protects correct incoming trees, but it does not repair backups that were already saved in a bad shape.

## Next Steps

- Find the last truly good tree source, if one still exists in operations history or older backup storage.
- If no good serialized tree exists, rebuild from the user’s manually fixed latest local state and then overwrite cloud backup with that corrected tree.
- Keep appending future findings to this file.

## 2026-05-09 Additional Findings

### Runtime Tree Is Correct

The user verified the live browser runtime with `getKnowledgeRootNodes()`.

Confirmed direct children under `数量关系`:

- `和差倍比`
- `比例法`
- `混合`
- `鸡兔`
- `年龄问题`
- `容斥`
- `数列`
- `数推`
- `植树问题`
- `最不利`
- `核心思维-纯笔记`
- `方程列式`
- `概率`
- `数字推理`
- `星期日期`
- `行程问题`
- `溶液浓度`

This proves:

- the live in-page runtime tree is correct after manual move
- `星期日期` is correctly nested under `数量关系` in runtime
- the later corruption happens during export / backup serialization, not in the visible UI tree itself

Also confirmed:

- `window.knowledgeTree === null` in the same page session
- the visible tree is driven by internal helpers such as `getKnowledgeRootNodes()`, not by `window.knowledgeTree`

### Backup Path Is Not Reading The Visible Tree Directly

Current high-confidence code-path finding:

- local backup snapshots are created in [backup_service.py](/E:/IdeaProject/git/xingce_v3_lab/app/services/backup_service.py)
- the service uses `build_workspace_snapshot_from_entities(user_id, conn)`
- that snapshot is reconstructed from backend `state_entities` in [workspace_entity_service.py](/E:/IdeaProject/git/xingce_v3_lab/app/services/workspace_entity_service.py)
- knowledge nodes are rebuilt from flattened `knowledge_node` entity records via `build_knowledge_tree_snapshot(...)`

Frontend sync path involved:

- [05e-sync-snapshots.js](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/modules/main/persistence/05e-sync-snapshots.js)
- `flattenKnowledgeNodesForSync(...)`
- `buildKnowledgeNodeSyncSnapshot(...)`

### Best Current Root-Cause Hypothesis

The strongest current explanation is a split between:

- correct browser runtime tree
- stale or reshaped backend `knowledge_node` entities used by backup generation

That means a node move can look correct on screen while backup files remain wrong if:

- the move updated local runtime / IndexedDB only
- pending sync ops were not fully pushed into backend `state_entities`
- or the entity/export path reshaped the tree before final serialization
