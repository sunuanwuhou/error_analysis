<template>
  <main class="workspace-shell legacy-home-shell">
    <aside class="workspace-sidebar legacy-sidebar">
      <div class="legacy-logo panel">
        <div class="legacy-brand">Ashore</div>
        <div class="legacy-runtime">{{ runtimeInfo?.label ?? '正在加载运行时信息...' }}</div>
      </div>

      <nav class="legacy-nav">
        <a class="legacy-nav-button is-active" href="/next">行测工作台</a>
        <a class="legacy-nav-button" href="/next/workspace/errors">错题工作台</a>
        <a class="legacy-nav-button" href="/next/shenlun">申论工作台</a>
      </nav>

      <section class="panel legacy-quick-card">
        <div class="legacy-tool-row">
          <a class="legacy-primary-link" :href="legacyActionHref('quickadd')">＋ 添加</a>
          <button class="legacy-secondary-link" type="button" @click.stop="toggleMoreMenu">更多</button>
        </div>
        <div v-if="moreMenuOpen" class="legacy-more-tools-menu" @click.stop>
          <a class="legacy-more-tools-item" :href="legacyActionHref('quick_import')" @click="closeMoreMenu">⬆ 导入错题</a>
          <a class="legacy-more-tools-item" href="/next/tools/export" @click="closeMoreMenu">⬇ 导出</a>
          <button class="legacy-more-tools-item" type="button" @click="clearCurrentModuleErrors">🧹 清空当前模块</button>
          <button class="legacy-more-tools-item" type="button" @click="clearAllErrorsData">🗑 清空全部错题</button>
          <button class="legacy-more-tools-item" type="button" @click="resetAllStudyData">♻ 重置全部学习数据</button>
          <a class="legacy-more-tools-item" :href="legacyActionHref('dashboard')" @click="closeMoreMenu">📊 统计</a>
          <a class="legacy-more-tools-item" :href="legacyActionHref('codex')" @click="closeMoreMenu">🧾 Codex</a>
          <a class="legacy-more-tools-item" href="/next/tools/claude-helper" @click="closeMoreMenu">🤖 导入Claude题</a>
          <a class="legacy-more-tools-item" href="/next/tools/claude-bank" @click="closeMoreMenu">📚 Claude 题库</a>
          <button class="legacy-more-tools-item" type="button" @click="printList">🖨 打印</button>
          <div class="legacy-more-tools-divider">扩展工具</div>
          <a class="legacy-more-tools-item" href="/next/actions/daily" @click="closeMoreMenu">▶ 开始练习</a>
          <a class="legacy-more-tools-item" href="/next/tools/ai" @click="closeMoreMenu">🤖 AI 识别并分析</a>
          <button class="legacy-more-tools-item" type="button" @click="clearAllFilters">🧼 一键清除筛选</button>
          <button class="legacy-more-tools-item" type="button" @click="refreshWorkspace">🔄 手动刷新</button>
          <a class="legacy-more-tools-item" href="/next/tools/note-viewer" @click="closeMoreMenu">📖 查看笔记</a>
          <a class="legacy-more-tools-item" href="/next/tools/remarks" @click="closeMoreMenu">📝 系统备注</a>
          <a class="legacy-more-tools-item" href="/next/tools/journal" @click="closeMoreMenu">📅 学习日志</a>
          <a class="legacy-more-tools-item" href="/next/tools/type-rules" @click="closeMoreMenu">🧩 题型规则</a>
          <a class="legacy-more-tools-item" href="/next/tools/directory" @click="closeMoreMenu">🗂 知识目录</a>
          <a class="legacy-more-tools-item" href="/next/tools/knowledge-move" @click="closeMoreMenu">🧭 批量改挂载</a>
          <a class="legacy-more-tools-item" href="/next/tools/search" @click="closeMoreMenu">🔎 全局搜索</a>
          <a class="legacy-more-tools-item" href="/next/tools/backup/create" @click="closeMoreMenu">💾 创建本地备份</a>
          <a class="legacy-more-tools-item" href="/next/tools/backup/refresh" @click="closeMoreMenu">🗃 刷新本地备份</a>
          <a class="legacy-more-tools-item" href="/next/tools/process-image" @click="closeMoreMenu">🖼 过程图编辑</a>
        </div>
      </section>

      <section class="panel legacy-cloud-card">
        <div class="legacy-cloud-title">
          <span>云端账号：{{ authStore.user?.username ?? '访客' }}</span>
          <span class="legacy-cloud-badge">{{ backupMeta?.exists ? '已同步' : '无备份' }}</span>
        </div>
        <div class="legacy-cloud-status-line">
          <span class="legacy-cloud-origin-hint">本地缓存按来源隔离。</span>
          <button class="legacy-secondary-link" type="button" @click="cloudDetailsOpen = !cloudDetailsOpen">
            {{ cloudDetailsOpen ? '收起详情' : '详情' }}
          </button>
        </div>
        <ul v-if="cloudDetailsOpen" class="result-list legacy-cloud-origin-list">
          <li v-for="line in cloudOriginRows" :key="line.key">
            <strong>{{ line.label }}</strong>
            <span>{{ line.value }}</span>
          </li>
        </ul>
        <div class="legacy-cloud-meta">
          <div>本地来源：{{ backupMeta?.currentOrigin ?? publicEntry?.origin ?? '加载中' }}</div>
          <div>最近云备份：{{ backupMeta?.updatedAt || workspaceSummary.latestUpdatedAt || '暂无记录' }}</div>
          <div>错题总数：{{ backupMeta?.summary?.errors ?? workspaceSummary.errors ?? 0 }} 题</div>
          <div>知识节点：{{ backupMeta?.summary?.knowledgeNodes ?? workspaceSummary.knowledgeNodes ?? 0 }} 个</div>
        </div>
        <div class="legacy-cloud-actions">
          <a class="legacy-small-link" :href="legacyActionHref('cloud_load')">Cloud Load</a>
          <a class="legacy-small-link" :href="legacyActionHref('cloud_save')">Cloud Save</a>
          <button class="legacy-small-link" type="button" @click="handleLogout">退出登录</button>
        </div>
        <div class="legacy-subsection">
          <div class="sidebar-card-title">本地备份</div>
          <ul class="result-list legacy-task-list">
            <li v-for="item in localBackups.slice(0, 3)" :key="item.id">
              <strong>{{ item.label || item.id }}</strong>
              <span>{{ buildLocalBackupReason(item) }}</span>
              <span class="legacy-inline-actions">
                <a class="legacy-secondary-link" :href="buildRestoreBackupHref(item.id)">恢复</a>
                <a class="legacy-secondary-link" :href="buildDeleteBackupHref(item.id)">删除</a>
              </span>
            </li>
            <li v-if="!localBackups.length">当前没有本地备份快照。</li>
          </ul>
        </div>
      </section>

      <section class="panel legacy-practice-card">
        <a class="legacy-practice-button is-red" :href="legacyActionHref('daily')">
          <span>今日复习</span>
          <strong>{{ practiceDaily.items.length }}</strong>
        </a>
        <a class="legacy-practice-button is-blue" :href="legacyActionHref('full')">
          <span>全量练习</span>
          <strong>{{ practiceOverview.totalErrors }}</strong>
        </a>
        <div class="legacy-progress">
          <div class="legacy-progress-label">
            <span>今日进度</span>
            <span>{{ practiceDaily.practicedTodayCount }}/{{ dailyProgressDenominator }}</span>
          </div>
          <div class="legacy-progress-bar">
            <div class="legacy-progress-fill" :style="{ width: `${dailyProgressPercent}%` }" />
          </div>
        </div>
      </section>

      <section class="panel legacy-knowledge-card">
        <div class="legacy-search-row legacy-search-row--tree">
          <span class="legacy-search-icon">🔎</span>
          <input
            ref="knowledgeSearchInputRef"
            v-model.trim="searchKeyword"
            type="text"
            placeholder="搜索知识树节点..."
            @input="runKnowledgeSearch"
          />
          <button
            class="legacy-search-clear"
            type="button"
            :disabled="!searchKeyword"
            @click="clearKnowledgeSearch"
            aria-label="清空知识树搜索"
          >
            ✕
          </button>
        </div>
        <div class="legacy-tree-toolbar-row">
          <button type="button" class="legacy-secondary-link" @click="toggleKnowledgeFocusMode">
            {{ knowledgeFocusMode ? '退出专注树' : '专注树' }}
          </button>
          <button type="button" class="legacy-secondary-link" @click="expandAllKnowledge">展开全部</button>
          <button type="button" class="legacy-secondary-link" @click="collapseAllKnowledge">收起全部</button>
        </div>
        <div class="legacy-tree-toolbar-meta">
          <span v-if="searchKeyword">搜索结果 {{ searchedKnowledgeNodes.length }} 个节点</span>
          <span v-else-if="knowledgeFocusMode && selectedKnowledgeNode">当前仅展示 {{ selectedKnowledgeNode.title }} 子树</span>
          <span v-else>当前展示全部知识树</span>
        </div>
        <div v-if="searchKeyword && !searchedKnowledgeNodes.length && !searching" class="legacy-tree-toolbar-meta">
          没有命中节点，请尝试更短关键词。
        </div>
        <p v-if="searchError" class="form-error">{{ searchError }}</p>
        <div class="sidebar-card-title">知识树</div>
        <ul class="legacy-tree-list">
          <li v-for="row in visibleKnowledgeRows" :key="row.node.id" class="legacy-tree-row">
            <button
              v-if="(row.node.children?.length ?? 0) > 0"
              type="button"
              class="legacy-tree-expander"
              @click.stop="toggleKnowledgeExpand(row.node.id)"
            >
              {{ isKnowledgeExpanded(row.node.id) ? '▾' : '▸' }}
            </button>
            <span v-else class="legacy-tree-expander legacy-tree-expander--empty">•</span>
            <button
              type="button"
              class="legacy-tree-item"
              :class="{ 'is-active': selectedKnowledgeNode?.id === row.node.id }"
              :style="{ paddingLeft: `${12 + row.depth * 14}px` }"
              @click="selectKnowledgeNode(row.node)"
            >
              <span class="legacy-tree-item-title">{{ row.node.title }}</span>
              <strong>{{ row.node.children?.length ?? 0 }}</strong>
            </button>
          </li>
          <li v-if="!visibleKnowledgeRows.length">暂时还没有知识节点。</li>
        </ul>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel legacy-hero">
        <div v-if="backupMeta?.exists" class="legacy-sync-toast">云端数据已完成后台同步</div>
        <div>
          <div class="eyebrow">首页</div>
          <h1>先决定优先事项，再进入工作区执行</h1>
          <p>在首页先排任务、弱项和笔记，再进入错题与练习流。</p>
          <p v-if="loadError" class="form-error">{{ loadError }}</p>
        </div>
        <div class="legacy-main-actions">
          <a class="legacy-primary-link" :href="legacyActionHref('quickadd')">添加错题</a>
          <a class="legacy-secondary-link" :href="legacyActionHref('daily')">开始练习</a>
          <a class="legacy-secondary-link" href="/next/workspace/errors">错题工作台</a>
          <a class="legacy-secondary-link" href="/next/tools/directory">知识目录</a>
        </div>
        <div class="legacy-hero-actions">
          <a class="legacy-secondary-link" href="/next/tools/note-editor">继续录入</a>
          <a class="legacy-secondary-link" href="/next/tools/search">全局搜索</a>
          <a class="legacy-secondary-link" href="/next/tools/backup">本地备份</a>
        </div>
      </article>

      <section class="workspace-split legacy-summary-grid">
        <article class="panel content-card">
          <h2>今日安排</h2>
          <div class="stats-grid stats-grid--legacy">
            <div class="stat-card">
              <span>先看笔记</span>
              <strong>{{ practiceOverview.noteFirstCount }}</strong>
            </div>
            <div class="stat-card">
              <span>直接开做</span>
              <strong>{{ practiceOverview.directDoCount }}</strong>
            </div>
            <div class="stat-card">
              <span>限时复训</span>
              <strong>{{ practiceOverview.speedDrillCount }}</strong>
            </div>
            <div class="stat-card">
              <span>近7日正确率</span>
              <strong>{{ recentAccuracyText }}</strong>
            </div>
          </div>

          <div class="today-action-row">
            <a class="chip-button" :class="{ 'is-active': activeTodayTab === 'noteFirst' }" :href="legacyActionHref('note')" @mouseenter="focusTodayTab('noteFirst')">
              先看笔记
            </a>
            <a class="chip-button" :class="{ 'is-active': activeTodayTab === 'directDo' }" :href="legacyActionHref('direct')" @mouseenter="focusTodayTab('directDo')">
              直接开做
            </a>
            <a class="chip-button" :class="{ 'is-active': activeTodayTab === 'speedDrill' }" :href="legacyActionHref('speed')" @mouseenter="focusTodayTab('speedDrill')">
              限时复训
            </a>
            <a class="chip-button" :href="legacyActionHref('dashboard')">打开完整统计</a>
          </div>

          <div class="legacy-action-list">
            <div v-for="(item, index) in workflowAdviceItems" :key="`${index}-${buildAdviceText(item)}`" class="legacy-action-item">
              <strong>{{ buildAdviceTitle(item, index) }}</strong>
              <span>{{ buildAdviceText(item) }}</span>
            </div>
            <div v-if="!workflowAdviceItems.length" class="legacy-action-item">
              <strong>继续录入或进入工作区</strong>
              <span>首页只负责排优先级，具体执行请进入工作区。</span>
            </div>
          </div>

          <ul class="result-list legacy-task-list">
            <li v-for="item in activeTodayItems" :key="item.id || item.question">
              <strong>{{ buildItemTitle(item) }}</strong>
              <span>{{ buildItemReason(item) }}</span>
            </li>
            <li v-if="!activeTodayItems.length">当前通道暂无任务。</li>
          </ul>
        </article>

        <article class="panel content-card">
          <h2>先看笔记队列</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="item in practiceWorkbench.noteFirstQueue.slice(0, 6)" :key="item.id || item.question">
              <strong>{{ buildItemTitle(item) }}</strong>
              <span>{{ buildItemReason(item) }}</span>
            </li>
            <li v-if="!practiceWorkbench.noteFirstQueue.length">今日先看笔记任务已完成。</li>
          </ul>

          <div class="legacy-subsection">
            <h3>直接开做</h3>
            <ul class="result-list legacy-task-list">
              <li v-for="item in practiceWorkbench.directDoQueue.slice(0, 4)" :key="item.id || item.question">
                <strong>{{ buildItemTitle(item) }}</strong>
                <span>{{ buildItemReason(item) }}</span>
              </li>
              <li v-if="!practiceWorkbench.directDoQueue.length">当前没有直接开做任务。</li>
            </ul>
          </div>

          <div class="legacy-subsection">
            <h3>限时复训</h3>
            <ul class="result-list legacy-task-list">
              <li v-for="item in practiceWorkbench.speedDrillQueue.slice(0, 4)" :key="item.id || item.question">
                <strong>{{ buildItemTitle(item) }}</strong>
                <span>{{ buildItemReason(item) }}</span>
              </li>
              <li v-if="!practiceWorkbench.speedDrillQueue.length">当前没有限时复训任务。</li>
            </ul>
          </div>
        </article>
      </section>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <div class="legacy-section-header">
            <h2>错题预览</h2>
            <span v-if="errorPreviewFallback" class="legacy-inline-hint">当前筛选无结果，已切换为最近错题。</span>
          </div>
          <div class="search-form">
            <input v-model.trim="errorKeyword" type="text" placeholder="搜索题干、原因、分析、分类" />
            <button type="button" @click="clearErrorFilters">清空</button>
            <button type="button" @click="clearAllFilters">一键清除筛选</button>
            <a class="legacy-secondary-link" href="/next/tools/search" title="Ctrl+K">全局搜索</a>
          </div>
          <div class="topbar-actions legacy-batch-actions">
            <button type="button" class="action-button action-button--quiet" @click="toggleSelectAllDisplayed(true)">全选</button>
            <button type="button" class="action-button action-button--quiet" @click="toggleSelectAllDisplayed(false)">全不选</button>
            <button
              type="button"
              class="action-button action-button--secondary"
              :disabled="!selectedErrorIds.length"
              @click="batchDeleteSelectedErrors"
            >
              批量删除（{{ selectedErrorIds.length }}）
            </button>
            <button
              type="button"
              class="action-button action-button--primary"
              :disabled="!selectedErrorIds.length"
              @click="batchMoveSelectedErrors"
            >
              批量改挂载
            </button>
          </div>
          <div class="chip-row">
            <button
              v-for="typeName in visibleErrorTypes"
              :key="typeName"
              type="button"
              class="chip-button"
              :class="{ 'is-active': selectedErrorType === typeName }"
              @click="toggleErrorType(typeName)"
            >
              {{ typeName }}
            </button>
          </div>
          <div class="error-workspace-grid">
            <ul class="result-list card-list">
              <li
                v-for="error in displayedErrors"
                :key="error.id || error.question"
                class="selectable-card"
                :class="{ 'is-selected': selectedError?.id === error.id }"
              >
                <label class="legacy-select-row">
                  <input
                    type="checkbox"
                    :checked="isErrorSelected(error)"
                    @click.stop
                    @change="toggleErrorSelection(error)"
                  />
                  <span>选中</span>
                </label>
                <button class="selectable-card-button" type="button" @click="selectError(error)">
                  <strong>{{ buildErrorTitle(error) }}</strong>
                  <span>{{ error.question || '未命名题目' }}</span>
                  <span>{{ error.rootReason || error.errorReason || error.analysis || '待补充详情' }}</span>
                </button>
              </li>
              <li v-if="!displayedErrors.length">当前筛选下暂无错题。</li>
            </ul>

            <div class="panel detail-panel">
              <div class="sidebar-card-title">错题详情</div>
              <template v-if="selectedError">
                <div class="detail-title">{{ selectedError.question || '未命名题目' }}</div>
                <div class="fact-list">
                  <div>一级分类：{{ selectedError.type || '未分类' }}</div>
                  <div>二级分类：{{ selectedError.subtype || '未设置' }}</div>
                  <div>掌握度：{{ selectedError.masteryLevel || '未设置' }}</div>
                  <div>信心分：{{ selectedError.confidence ?? 0 }}</div>
                  <div>更新时间：{{ selectedError.updatedAt || '暂无记录' }}</div>
                </div>
                <div class="detail-block">
                  <strong>根因</strong>
                  <p>{{ selectedError.rootReason || selectedError.errorReason || '暂未记录根因' }}</p>
                </div>
                <div class="detail-block">
                  <strong>分析</strong>
                  <p>{{ selectedError.analysis || '暂未记录分析' }}</p>
                </div>
                <div class="detail-block">
                  <strong>下一步</strong>
                  <p>{{ selectedError.tip || selectedError.nextActionType || '暂未记录下一步' }}</p>
                </div>
                <div class="legacy-subsection">
                  <a class="legacy-secondary-link" :href="buildEditErrorHref(selectedError)">打开错题编辑</a>
                  <a class="legacy-secondary-link" :href="`/next/tools/canvas?id=${encodeURIComponent(String(selectedError.id || ''))}`">画布</a>
                  <a class="legacy-secondary-link" :href="`/next/tools/process-image?id=${encodeURIComponent(String(selectedError.id || ''))}`">过程图</a>
                  <a
                    v-if="selectedError.noteNodeId"
                    class="legacy-secondary-link"
                    :href="`/next/tools/note-viewer?nodeId=${encodeURIComponent(String(selectedError.noteNodeId || ''))}`"
                  >
                    查看笔记
                  </a>
                </div>
              </template>
              <p v-else>请先在左侧选择一条错题。</p>
            </div>
          </div>
        </article>
      </section>

      <section class="workspace-split legacy-main-grid">
        <article class="panel content-card panel--muted">
          <h2>当前概览</h2>
          <div class="legacy-action-list">
            <div class="legacy-action-item">
              <strong>今日任务池 {{ visibleTaskPoolCount }}</strong>
              <span>先在这里快速看清任务，再进入工作区执行。</span>
            </div>
            <div class="legacy-action-item">
              <strong>全量练习池 {{ practiceOverview.totalErrors }}</strong>
              <span>完整错题、知识树和练习细节都在工作区内继续处理。</span>
            </div>
            <div class="legacy-action-item">
              <strong>{{ runtimeInfo?.label ?? '正在加载运行时' }}</strong>
              <span>{{ publicEntry?.origin ?? backupMeta?.currentOrigin ?? '正在加载当前入口' }}</span>
            </div>
          </div>
        </article>

        <article class="panel content-card panel--muted">
          <h2>弱项热点</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="group in visibleWeaknessGroups" :key="group.name">
              <strong>{{ group.name }}</strong>
              <span>{{ buildWeaknessReason(group) }}</span>
            </li>
            <li v-if="!visibleWeaknessGroups.length">当前还没有稳定弱项分组。</li>
          </ul>
        </article>

        <article class="panel content-card panel--muted">
          <h2>补充提醒</h2>
          <div class="legacy-action-list">
            <div class="legacy-action-item">
              <strong>任务池 {{ visibleTaskPoolCount }} 条</strong>
              <span>{{ reminderSummaryText }}</span>
            </div>
          </div>
          <div class="legacy-subsection">
            <button class="legacy-secondary-link" type="button" @click="showExtraReminders = !showExtraReminders">
              {{ showExtraReminders ? '收起详细提醒' : '展开详细提醒' }}
            </button>
          </div>
          <div v-if="showExtraReminders" class="legacy-action-list">
            <div class="legacy-action-item">
              <strong>{{ missingNoteCount ? `${missingNoteCount} 条任务缺少可读笔记` : (practiceWorkbench.noteFirstQueue.length ? `${practiceWorkbench.noteFirstQueue.length} 条任务建议先看笔记` : '当前没有笔记缺口') }}</strong>
              <span>{{ missingNoteCount ? '这些任务被分流到先看笔记通道，但当前节点笔记内容还不完整。' : (practiceWorkbench.noteFirstQueue.length ? '这些任务的方法稳定度偏低，建议先笔记复盘再作答。' : '可以直接进入直接开做或限时复训。' ) }}</span>
            </div>
            <div class="legacy-action-item">
              <strong>{{ practiceWorkbench.speedDrillQueue.length ? `${practiceWorkbench.speedDrillQueue.length} 条任务需要限时复训` : '当前没有明显时间风险题' }}</strong>
              <span>{{ practiceWorkbench.speedDrillQueue.length ? '先压缩作答时间，再判断是否需要回到笔记复盘。' : '这一批题目主要不是时间问题。' }}</span>
            </div>
          </div>
        </article>
      </section>

      <section v-if="hasKnowledgePreview || hasCodexPreview" class="workspace-split legacy-secondary-grid">
        <article v-if="hasKnowledgePreview" class="panel content-card panel--muted">
          <h2>知识树预览</h2>
          <div v-if="selectedKnowledgeNode" class="info-block">
            <div class="sidebar-card-title">当前焦点</div>
            <div class="fact-list">
              <div>{{ selectedKnowledgeNode.title }}</div>
              <div>子节点：{{ selectedKnowledgeNode.children?.length ?? 0 }}</div>
            </div>
          </div>
          <ul class="result-list legacy-task-list">
            <li v-for="node in visibleKnowledgeChildren" :key="node.id">
              <button type="button" class="selectable-card-button" @click="selectKnowledgeNode(node)">
                <strong>{{ node.title }}</strong>
                <span>子节点 {{ node.children?.length ?? 0 }}</span>
              </button>
            </li>
              <li v-if="selectedKnowledgeNode && !visibleKnowledgeChildren.length">当前节点下暂无子节点。</li>
              <li v-if="!selectedKnowledgeNode && !knowledgeRoots.length">当前还没有知识节点。</li>
          </ul>
          <div class="legacy-subsection">
              <a class="legacy-secondary-link" href="/next/workspace/notes">打开笔记工作区</a>
            <a
              v-if="selectedKnowledgeNode?.id"
              class="legacy-secondary-link"
              :href="buildRecommendedNoteHref(selectedKnowledgeNode.id)"
            >
                  在当前流程打开笔记
            </a>
          </div>
        </article>

        <article v-if="hasCodexPreview" class="panel content-card panel--muted">
          <h2>Codex 预览</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="thread in codexThreads.slice(0, 6)" :key="thread.id">
                <strong>{{ thread.title || '未命名会话' }}</strong>
                <span>{{ thread.latestMessageText || thread.updatedAt || '暂无预览' }}</span>
            </li>
          </ul>
          <div class="legacy-subsection">
              <a class="legacy-secondary-link" :href="legacyActionHref('codex')">打开 Codex 收件箱</a>
          </div>
        </article>
      </section>

      <a class="legacy-codex-floating-btn" :href="legacyActionHref('codex')">Codex 留言</a>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { PublicEntry, RuntimeInfo } from '@/types/auth'
import type {
  AdviceItem,
  BackupMetaResponse,
  BackupPayloadResponse,
  CodexThreadsResponse,
  ErrorSummary,
  KnowledgeTreeNode,
  LocalBackupItem,
  LocalBackupsResponse,
  NextHomeContextResponse,
  PracticeDailyResponse,
  PracticeQueueItem,
  PracticeWorkbenchResponse,
  WorkspaceSnapshot,
} from '@/types/workspace'

type TodayTabKey = 'noteFirst' | 'directDo' | 'speedDrill' | 'review'

const router = useRouter()
const authStore = useAuthStore()

const runtimeInfo = ref<RuntimeInfo | null>(null)
const publicEntry = ref<PublicEntry | null>(null)
const backupMeta = ref<BackupMetaResponse | null>(null)
const localBackups = ref<LocalBackupItem[]>([])
const workspaceSummary = ref<Record<string, number | string | null>>({})
const knowledgeRoots = ref<KnowledgeTreeNode[]>([])
const selectedKnowledgeNode = ref<KnowledgeTreeNode | null>(null)
const expandedKnowledgeIds = ref<string[]>([])
const allErrors = ref<ErrorSummary[]>([])
const selectedError = ref<ErrorSummary | null>(null)
const errorKeyword = ref('')
const selectedErrorType = ref('')
const activeTodayTab = ref<TodayTabKey>('noteFirst')
const codexThreads = ref<CodexThreadsResponse['threads']>([])
const selectedErrorIds = ref<string[]>([])
const practiceDaily = ref<PracticeDailyResponse>({
  ok: true,
  items: [],
  practicedTodayCount: 0,
  advice: [],
})
const practiceWorkbench = ref<PracticeWorkbenchResponse>({
  ok: true,
  overview: {
    totalErrors: 0,
    noteFirstCount: 0,
    directDoCount: 0,
    speedDrillCount: 0,
    reviewCount: 0,
    retrainCount: 0,
    stabilizingCount: 0,
    stableCount: 0,
    attemptTrackedCount: 0,
  },
  advice: [],
  workflowAdvice: [],
  reviewQueue: [],
  retrainQueue: [],
  noteFirstQueue: [],
  directDoQueue: [],
  speedDrillQueue: [],
  weaknessGroups: [],
})
const knowledgeResults = ref({
  ok: true,
  nodes: [] as Array<{ id: string; title: string; path: string[]; excerpt?: string }>,
  errors: [],
})
const searchKeyword = ref('')
const knowledgeSearchInputRef = ref<HTMLInputElement | null>(null)
const searching = ref(false)
const searchError = ref('')
const loadError = ref('')
const moreMenuOpen = ref(false)
const showExtraReminders = ref(false)
const cloudDetailsOpen = ref(false)
const knowledgeFocusMode = ref(false)


const practiceOverview = computed(() => practiceWorkbench.value.overview)
const workflowAdviceItems = computed(() =>
  practiceWorkbench.value.workflowAdvice.length ? practiceWorkbench.value.workflowAdvice : practiceWorkbench.value.advice,
)
const searchedKnowledgeNodes = computed<KnowledgeTreeNode[]>(() =>
  (knowledgeResults.value.nodes ?? []).map((node) => ({
    id: node.id,
    title: node.title,
    children: [],
  })),
)
const cloudOriginRows = computed(() => {
  const source = String(backupMeta.value?.currentOrigin || publicEntry.value?.origin || 'unknown')
  const updatedAt = String(backupMeta.value?.updatedAt || workspaceSummary.value.latestUpdatedAt || '暂无记录')
  return [
    { key: 'source', label: '当前来源', value: source },
    { key: 'updatedAt', label: '最近同步', value: updatedAt },
    { key: 'errors', label: '错题', value: `${backupMeta.value?.summary?.errors ?? workspaceSummary.value.errors ?? 0} 题` },
    {
      key: 'knowledge',
      label: '知识节点',
      value: `${backupMeta.value?.summary?.knowledgeNodes ?? workspaceSummary.value.knowledgeNodes ?? 0} 个`,
    },
  ]
})
const visibleKnowledgeRows = computed(() => {
  if (searchedKnowledgeNodes.value.length) {
    return searchedKnowledgeNodes.value.map((node) => ({ node, depth: 0 }))
  }
  const roots = knowledgeFocusMode.value && selectedKnowledgeNode.value ? [selectedKnowledgeNode.value] : knowledgeRoots.value
  const rows: Array<{ node: KnowledgeTreeNode; depth: number }> = []
  const expanded = new Set(expandedKnowledgeIds.value)
  const walk = (nodes: KnowledgeTreeNode[], depth = 0) => {
    for (const node of nodes) {
      rows.push({ node, depth })
      if ((node.children?.length ?? 0) > 0 && expanded.has(node.id)) {
        walk(node.children || [], depth + 1)
      }
    }
  }
  walk(roots, 0)
  return rows
})
const visibleKnowledgeChildren = computed(() => {
  if (searchedKnowledgeNodes.value.length) {
    return searchedKnowledgeNodes.value.slice(0, 8)
  }
  if (!selectedKnowledgeNode.value) {
    return knowledgeRoots.value.slice(0, 8)
  }
  return selectedKnowledgeNode.value.children ?? []
})
const activeTodayItems = computed(() => {
  if (activeTodayTab.value === 'noteFirst') {
    return practiceWorkbench.value.noteFirstQueue
  }
  if (activeTodayTab.value === 'directDo') {
    return practiceWorkbench.value.directDoQueue
  }
  if (activeTodayTab.value === 'speedDrill') {
    return practiceWorkbench.value.speedDrillQueue
  }
  return practiceWorkbench.value.reviewQueue
})
const visibleErrorTypes = computed(() => {
  const values = new Set<string>()
  for (const item of allErrors.value) {
    const value = (item.type ?? '').trim()
    if (value) {
      values.add(value)
    }
  }
  return Array.from(values).slice(0, 8)
})
const filteredErrors = computed(() => {
  const keyword = errorKeyword.value.trim().toLowerCase()
  return allErrors.value.filter((item) => {
    if (selectedErrorType.value && item.type !== selectedErrorType.value) {
      return false
    }
    if (selectedKnowledgeNode.value && item.noteNodeId && item.noteNodeId !== selectedKnowledgeNode.value.id) {
      return false
    }
    if (!keyword) {
      return true
    }
    const haystack = [item.type, item.subtype, item.question, item.rootReason, item.errorReason, item.analysis]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(keyword)
  })
})
const errorPreviewFallback = computed(
  () => allErrors.value.length > 0 && filteredErrors.value.length === 0 && Boolean(errorKeyword.value || selectedErrorType.value || selectedKnowledgeNode.value),
)
const displayedErrors = computed(() => {
  if (filteredErrors.value.length) {
    return filteredErrors.value.slice(0, 10)
  }
  if (errorPreviewFallback.value) {
    return allErrors.value.slice(0, 10)
  }
  return []
})
const dailyProgressDenominator = computed(() => Math.max(practiceDaily.value.practicedTodayCount + practiceDaily.value.items.length, 1))
const dailyProgressPercent = computed(() => Math.min(100, Math.round((practiceDaily.value.practicedTodayCount / dailyProgressDenominator.value) * 100)))
const recentAccuracyText = computed(() => {
  const total = practiceOverview.value.attemptTrackedCount
  if (total <= 0) {
    return '0%'
  }
  const stable = practiceOverview.value.stableCount + practiceOverview.value.stabilizingCount
  return `${Math.max(0, Math.min(100, Math.round((stable / total) * 100)))}%`
})
const hasKnowledgePreview = computed(() => knowledgeRoots.value.length > 0 || visibleKnowledgeChildren.value.length > 0)
const hasCodexPreview = computed(() => codexThreads.value.length > 0)
const visibleWeaknessGroups = computed(() => practiceWorkbench.value.weaknessGroups.slice(0, 6))
const visibleTaskPoolCount = computed(
  () =>
    practiceWorkbench.value.noteFirstQueue.length +
    practiceWorkbench.value.directDoQueue.length +
    practiceWorkbench.value.speedDrillQueue.length +
    practiceWorkbench.value.reviewQueue.length,
)
const missingNoteCount = computed(
  () => practiceWorkbench.value.noteFirstQueue.filter((item) => !String(item.noteNodeId || '').trim()).length,
)
const reminderSummaryText = computed(() => {
  if (missingNoteCount.value > 0) {
    return '先补笔记缺口，再进入作答。'
  }
  if (practiceWorkbench.value.speedDrillQueue.length > 0) {
    return '本轮优先处理限时复训任务。'
  }
  return '当前优先级稳定，可直接进入练习。'
})

watch(displayedErrors, (items) => {
  if (!items.length) {
    selectedError.value = null
    return
  }
  if (!selectedError.value || !items.some((item) => item.id === selectedError.value?.id)) {
    selectedError.value = items[0]
  }
  const visibleIds = new Set(items.map((item) => String(item.id || '').trim()).filter(Boolean))
  selectedErrorIds.value = selectedErrorIds.value.filter((id) => visibleIds.has(id))
})

function buildItemTitle(item: PracticeQueueItem): string {
  const typeName = item.type?.trim()
  const question = item.question?.trim()
  if (typeName && question) {
    return `${typeName} ${question}`
  }
  return typeName || question || '待处理任务'
}

function buildItemReason(item: PracticeQueueItem): string {
  return item.taskReason || item.lastMistakeType || item.rootReason || item.errorReason || '根据当前学习状态推荐'
}

function buildErrorTitle(error: ErrorSummary): string {
  if (error.type && error.subtype) {
    return `${error.type} / ${error.subtype}`
  }
  return error.type || '未分类'
}

function buildAdviceText(item: AdviceItem | string): string {
  if (typeof item === 'string') {
    return item
  }
  return String(item.description || item.title || item.key || '').trim()
}

function buildAdviceTitle(item: AdviceItem | string, index: number): string {
  const normalized = buildAdviceText(item).toLowerCase()
  if (normalized.includes('note')) {
    return '先看笔记'
  }
  if (normalized.includes('speed') || normalized.includes('time')) {
    return '限时复训'
  }
  if (normalized.includes('direct')) {
    return '直接开做'
  }
  return `建议 ${index + 1}`
}

function buildWeaknessReason(group: { count: number; topType?: string }): string {
  const typeText = group.topType?.trim() ? `，集中在 ${group.topType}` : ''
  return `累计出现 ${group.count} 次${typeText}`
}

function buildLocalBackupReason(item: LocalBackupItem): string {
  const createdAt = item.createdAt || '未知时间'
  const counts = [`${item.errorCount ?? 0} 题`, `${item.knowledgeNodeCount ?? 0} 节点`]
  return `${createdAt} · ${counts.join(' · ')}`
}

function focusTodayTab(tab: TodayTabKey) {
  activeTodayTab.value = tab
}

function legacyActionHref(action: string): string {
  const normalized = String(action || '').trim()
  if (!normalized) {
    return '/'
  }
  const routeMap: Record<string, string> = {
    quickadd: '/next/actions/quickadd',
    cloud_load: '/next/actions/cloud-load',
    cloud_save: '/next/actions/cloud-save',
    daily: '/next/actions/daily',
    full: '/next/actions/full',
    note: '/next/actions/note',
    recommended_notes: '/next/actions/recommended-notes',
    recommended_notes_return: '/next/actions/recommended-notes/return',
    direct: '/next/actions/direct',
    speed: '/next/actions/speed',
    dashboard: '/next/actions/dashboard',
    codex: '/next/actions/codex',
    taskview_errors: '/next/workspace/tasks/errors',
    taskview_notes: '/next/workspace/tasks/notes',
    local_backup_restore: '/next/tools/backup/restore',
    local_backup_delete: '/next/tools/backup/delete',
    remark_daily_log: '/next/tools/remarks/daily-log',
    quick_import: '/next/tools/quick-import',
    claude_bank_refresh: '/next/tools/claude-bank/refresh',
    canvas: '/next/tools/canvas',
  }
  return routeMap[normalized] ?? '/next/workspace'
}

function buildRecommendedNoteHref(nodeId: string): string {
  const normalized = String(nodeId || '').trim()
  if (!normalized) {
    return '/next/actions/recommended-notes'
  }
  return `/next/actions/recommended-note?nodeId=${encodeURIComponent(normalized)}`
}

function buildEditErrorHref(error: ErrorSummary): string {
  const normalized = String(error.id || '').trim()
  if (!normalized) {
    return '/next/tools/add'
  }
  return `/next/tools/edit?id=${encodeURIComponent(normalized)}`
}

function buildRestoreBackupHref(backupId: string): string {
  const normalized = String(backupId || '').trim()
  if (!normalized) {
    return '/next/tools/backup'
  }
  return `/next/tools/backup/restore?id=${encodeURIComponent(normalized)}`
}

function buildDeleteBackupHref(backupId: string): string {
  const normalized = String(backupId || '').trim()
  if (!normalized) {
    return '/next/tools/backup'
  }
  return `/next/tools/backup/delete?id=${encodeURIComponent(normalized)}`
}

function toggleMoreMenu() {
  moreMenuOpen.value = !moreMenuOpen.value
}

function closeMoreMenu() {
  moreMenuOpen.value = false
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

async function loadCurrentSnapshot(): Promise<WorkspaceSnapshot> {
  const payload = await apiRequest<BackupPayloadResponse>('/api/backup')
  return cloneSnapshot((payload.backup ?? payload.payload ?? {}) as WorkspaceSnapshot)
}

async function saveSnapshot(snapshot: WorkspaceSnapshot, forceOverwrite = false) {
  const baseUpdatedAt = String(backupMeta.value?.updatedAt || snapshot.exportTime || snapshot.baseUpdatedAt || '')
  await apiRequest('/api/backup', {
    method: 'PUT',
    body: JSON.stringify({
      ...snapshot,
      xc_version: 2,
      baseUpdatedAt,
      forceOverwrite,
    }),
  })
}

async function clearCurrentModuleErrors() {
  closeMoreMenu()
  try {
    const snapshot = await loadCurrentSnapshot()
    const source = Array.isArray(snapshot.errors) ? snapshot.errors : []
    if (!source.length) {
      return
    }
    let filtered = source
    if (selectedKnowledgeNode.value?.id) {
      filtered = source.filter((item) => String(item.noteNodeId || '') !== selectedKnowledgeNode.value?.id)
    } else if (selectedErrorType.value) {
      filtered = source.filter((item) => String(item.type || '') !== selectedErrorType.value)
    } else {
      filtered = source.slice(1)
    }
    snapshot.errors = filtered
    await saveSnapshot(snapshot, true)
    await loadWorkspaceContext()
  } catch (error: unknown) {
    loadError.value = error instanceof Error ? error.message : '清空当前模块失败'
  }
}

async function clearAllErrorsData() {
  closeMoreMenu()
  try {
    const snapshot = await loadCurrentSnapshot()
    snapshot.errors = []
    await saveSnapshot(snapshot, true)
    await loadWorkspaceContext()
  } catch (error: unknown) {
    loadError.value = error instanceof Error ? error.message : '清空全部错题失败'
  }
}

async function resetAllStudyData() {
  closeMoreMenu()
  try {
    const snapshot = await loadCurrentSnapshot()
    snapshot.errors = []
    snapshot.knowledgeTree = []
    snapshot.knowledgeNotes = {}
    snapshot.notesByType = {}
    snapshot.noteImages = {}
    snapshot.history = []
    snapshot.revealed = []
    snapshot.expTypes = []
    snapshot.expMain = []
    snapshot.expMainSub = []
    snapshot.expMainSub2 = []
    snapshot.globalNote = ''
    snapshot.todayDone = 0
    await saveSnapshot(snapshot, true)
    await loadWorkspaceContext()
  } catch (error: unknown) {
    loadError.value = error instanceof Error ? error.message : '重置学习数据失败'
  }
}

function printList() {
  closeMoreMenu()
  window.print()
}

function handleWindowClick() {
  if (moreMenuOpen.value) {
    moreMenuOpen.value = false
  }
}

function findKnowledgeNodeById(nodes: KnowledgeTreeNode[], nodeId: string): KnowledgeTreeNode | null {
  if (!nodeId) {
    return null
  }
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node
    }
    const hit = findKnowledgeNodeById(node.children || [], nodeId)
    if (hit) {
      return hit
    }
  }
  return null
}

function findKnowledgePath(nodes: KnowledgeTreeNode[], nodeId: string, path: KnowledgeTreeNode[] = []): KnowledgeTreeNode[] {
  if (!nodeId) {
    return []
  }
  for (const node of nodes) {
    const nextPath = [...path, node]
    if (node.id === nodeId) {
      return nextPath
    }
    const hit = findKnowledgePath(node.children || [], nodeId, nextPath)
    if (hit.length) {
      return hit
    }
  }
  return []
}

function isKnowledgeExpanded(nodeId: string): boolean {
  return expandedKnowledgeIds.value.includes(nodeId)
}

function toggleKnowledgeExpand(nodeId: string) {
  if (!nodeId) {
    return
  }
  if (expandedKnowledgeIds.value.includes(nodeId)) {
    expandedKnowledgeIds.value = expandedKnowledgeIds.value.filter((id) => id !== nodeId)
  } else {
    expandedKnowledgeIds.value = [...expandedKnowledgeIds.value, nodeId]
  }
}

function expandKnowledgePath(nodeId: string) {
  const path = findKnowledgePath(knowledgeRoots.value, nodeId)
  if (!path.length) {
    return
  }
  const ids = new Set(expandedKnowledgeIds.value)
  for (const node of path) {
    if ((node.children?.length ?? 0) > 0) {
      ids.add(node.id)
    }
  }
  expandedKnowledgeIds.value = Array.from(ids)
}

function handleGlobalKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const tag = String(target?.tagName || '').toLowerCase()
  const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable)
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    closeMoreMenu()
    void router.push('/next/tools/search')
    return
  }
  if (event.key === 'Escape' && moreMenuOpen.value) {
    event.preventDefault()
    closeMoreMenu()
    return
  }
  if (event.key === '/' && !inInput) {
    event.preventDefault()
    knowledgeSearchInputRef.value?.focus()
    knowledgeSearchInputRef.value?.select()
  }
}

function selectKnowledgeNode(node: KnowledgeTreeNode) {
  if (selectedKnowledgeNode.value?.id === node.id) {
    selectedKnowledgeNode.value = null
    knowledgeFocusMode.value = false
    return
  }
  selectedKnowledgeNode.value = node
  expandKnowledgePath(node.id)
}

function selectError(error: ErrorSummary) {
  selectedError.value = error
}

function errorIdOf(error: ErrorSummary): string {
  return String(error.id || '').trim()
}

function isErrorSelected(error: ErrorSummary): boolean {
  const id = errorIdOf(error)
  return id ? selectedErrorIds.value.includes(id) : false
}

function toggleErrorSelection(error: ErrorSummary) {
  const id = errorIdOf(error)
  if (!id) {
    return
  }
  if (selectedErrorIds.value.includes(id)) {
    selectedErrorIds.value = selectedErrorIds.value.filter((item) => item !== id)
  } else {
    selectedErrorIds.value = [...selectedErrorIds.value, id]
  }
}

function toggleSelectAllDisplayed(selectAll: boolean) {
  const ids = displayedErrors.value.map((item) => errorIdOf(item)).filter(Boolean)
  if (!selectAll) {
    selectedErrorIds.value = selectedErrorIds.value.filter((id) => !ids.includes(id))
    return
  }
  const merged = new Set([...selectedErrorIds.value, ...ids])
  selectedErrorIds.value = Array.from(merged)
}

async function batchDeleteSelectedErrors() {
  if (!selectedErrorIds.value.length) {
    return
  }
  try {
    const snapshot = await loadCurrentSnapshot()
    const selected = new Set(selectedErrorIds.value)
    snapshot.errors = (snapshot.errors || []).filter((item) => !selected.has(String(item.id || '').trim()))
    await saveSnapshot(snapshot, true)
    selectedErrorIds.value = []
    await loadWorkspaceContext()
  } catch (error: unknown) {
    loadError.value = error instanceof Error ? error.message : '批量删除失败'
  }
}

async function batchMoveSelectedErrors() {
  if (!selectedErrorIds.value.length) {
    return
  }
  const targetNodeId = String(selectedKnowledgeNode.value?.id || '').trim()
  if (!targetNodeId) {
    loadError.value = '请先在知识树里选中目标节点，再执行批量改挂载。'
    return
  }
  try {
    const snapshot = await loadCurrentSnapshot()
    const selected = new Set(selectedErrorIds.value)
    snapshot.errors = (snapshot.errors || []).map((item) => {
      const id = String(item.id || '').trim()
      if (!selected.has(id)) {
        return item
      }
      return {
        ...item,
        noteNodeId: targetNodeId,
      }
    })
    await saveSnapshot(snapshot, true)
    selectedErrorIds.value = []
    await loadWorkspaceContext()
  } catch (error: unknown) {
    loadError.value = error instanceof Error ? error.message : '批量改挂载失败'
  }
}

function clearErrorFilters() {
  errorKeyword.value = ''
  selectedErrorType.value = ''
  selectedKnowledgeNode.value = null
  knowledgeFocusMode.value = false
}

function clearAllFilters() {
  closeMoreMenu()
  clearErrorFilters()
  searchKeyword.value = ''
  knowledgeResults.value = { ok: true, nodes: [], errors: [] }
}

async function refreshWorkspace() {
  closeMoreMenu()
  await loadWorkspaceContext()
}

function toggleErrorType(typeName: string) {
  selectedErrorType.value = selectedErrorType.value === typeName ? '' : typeName
}

function collectKnowledgeMatches(nodes: KnowledgeTreeNode[], keyword: string, path: string[] = []) {
  const normalized = keyword.trim().toLowerCase()
  const results: Array<{ id: string; title: string; path: string[]; excerpt?: string }> = []
  for (const node of nodes) {
    const nextPath = [...path, node.title]
    const haystack = nextPath.join(' / ').toLowerCase()
    if (haystack.includes(normalized)) {
      results.push({
        id: node.id,
        title: node.title,
        path: nextPath,
      })
    }
    if (node.children?.length) {
      results.push(...collectKnowledgeMatches(node.children, keyword, nextPath))
    }
  }
  return results
}

function collectExpandableNodeIds(nodes: KnowledgeTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (items: KnowledgeTreeNode[]) => {
    for (const node of items) {
      if ((node.children?.length ?? 0) > 0) {
        ids.push(node.id)
        walk(node.children || [])
      }
    }
  }
  walk(nodes)
  return ids
}

function clearKnowledgeSearch() {
  searchKeyword.value = ''
  searchError.value = ''
  knowledgeResults.value = { ok: true, nodes: [], errors: [] }
}

function toggleKnowledgeFocusMode() {
  if (!selectedKnowledgeNode.value) {
    searchError.value = '请先在知识树中选择一个节点，再启用专注树。'
    knowledgeFocusMode.value = false
    return
  }
  searchError.value = ''
  knowledgeFocusMode.value = !knowledgeFocusMode.value
}

function expandAllKnowledge() {
  const roots = knowledgeFocusMode.value && selectedKnowledgeNode.value ? [selectedKnowledgeNode.value] : knowledgeRoots.value
  expandedKnowledgeIds.value = collectExpandableNodeIds(roots)
}

function collapseAllKnowledge() {
  if (knowledgeFocusMode.value && selectedKnowledgeNode.value) {
    expandedKnowledgeIds.value = [selectedKnowledgeNode.value.id]
    return
  }
  expandedKnowledgeIds.value = knowledgeRoots.value.length ? [knowledgeRoots.value[0].id] : []
}

function applyKnowledgeTree(tree: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] } | undefined) {
  const previousNodeId = String(selectedKnowledgeNode.value?.id || '')
  if (Array.isArray(tree)) {
    knowledgeRoots.value = tree
  } else if (tree && Array.isArray(tree.roots)) {
    knowledgeRoots.value = tree.roots
  } else {
    knowledgeRoots.value = []
  }
  if (!knowledgeRoots.value.length) {
    selectedKnowledgeNode.value = null
    expandedKnowledgeIds.value = []
    return
  }
  if (!expandedKnowledgeIds.value.length) {
    expandedKnowledgeIds.value = [knowledgeRoots.value[0].id]
  }
  if (previousNodeId) {
    const latest = findKnowledgeNodeById(knowledgeRoots.value, previousNodeId)
    selectedKnowledgeNode.value = latest
    if (latest) {
      expandKnowledgePath(latest.id)
      return
    }
  }
  selectedKnowledgeNode.value = selectedKnowledgeNode.value ? findKnowledgeNodeById(knowledgeRoots.value, selectedKnowledgeNode.value.id) : null
}

async function runKnowledgeSearch() {
  searchError.value = ''
  if (!searchKeyword.value) {
    knowledgeResults.value = { ok: true, nodes: [], errors: [] }
    return
  }
  searching.value = true
  try {
    knowledgeResults.value = {
      ok: true,
      nodes: collectKnowledgeMatches(knowledgeRoots.value, searchKeyword.value).slice(0, 50),
      errors: [],
    }
    const firstNodeId = String(knowledgeResults.value.nodes?.[0]?.id || '').trim()
    if (firstNodeId) {
      const firstNode = findKnowledgeNodeById(knowledgeRoots.value, firstNodeId)
      if (firstNode) {
        selectedKnowledgeNode.value = firstNode
        expandKnowledgePath(firstNode.id)
      }
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      searchError.value = error.message
    } else {
      searchError.value = '搜索失败，请稍后重试。'
    }
  } finally {
    searching.value = false
  }
}

async function loadWorkspaceContext() {
  loadError.value = ''

  void apiRequest<RuntimeInfo>('/api/runtime-info')
    .then((payload) => {
      runtimeInfo.value = payload
    })
    .catch(() => {
      runtimeInfo.value = null
    })

  void apiRequest<PublicEntry>('/api/public-entry')
    .then((payload) => {
      publicEntry.value = payload
    })
    .catch(() => {
      publicEntry.value = null
    })

  try {
    const homeContext = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=6')
    practiceWorkbench.value = homeContext.workbench
    practiceDaily.value = homeContext.daily
    workspaceSummary.value = homeContext.summary ?? {}
    allErrors.value = homeContext.errors ?? []
    applyKnowledgeTree(homeContext.knowledgeTree)
    selectedKnowledgeNode.value = null

    window.setTimeout(() => {
      void apiRequest<BackupMetaResponse>('/api/backup?meta=true')
        .then((payload) => {
          backupMeta.value = payload
        })
        .catch(() => {
          backupMeta.value = null
        })
    }, 200)

    window.setTimeout(() => {
      void apiRequest<LocalBackupsResponse>('/api/local-backups')
        .then((payload) => {
          localBackups.value = payload.items ?? []
        })
        .catch(() => {
          localBackups.value = []
        })
    }, 300)

    window.setTimeout(() => {
      void apiRequest<CodexThreadsResponse>('/api/codex/threads')
        .then((payload) => {
          codexThreads.value = payload.threads
        })
        .catch(() => {
          codexThreads.value = []
        })
    }, 800)
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      await router.push({ name: 'login' })
      return
    }
    loadError.value = error instanceof Error ? error.message : '工作区数据加载失败'
    knowledgeRoots.value = []
    allErrors.value = []
    selectedKnowledgeNode.value = null
    selectedError.value = null
    localBackups.value = []
  }
}

async function handleLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

onMounted(() => {
  window.addEventListener('click', handleWindowClick)
  window.addEventListener('keydown', handleGlobalKeydown)
  void loadWorkspaceContext()
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleWindowClick)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

