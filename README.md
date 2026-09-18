# 事故证据链编排器（Evidence Chain Orchestrator）

用「必须早于」约束编排事故证据：每次连线都会校验有向图，合法连线按拓扑层级自动重排为**可解释时间线**；若连线构成环，则**拒绝保存**并高亮完整冲突闭环。侧栏「约束瘦身」可对当前无环图做**传递约简**：逐条标出可被替代路径推导的冗余连线，确认后在单个事务中批量移除，且**不改变任何证据间的可达关系**。

技术栈：**React 18 + TypeScript + Vite**（前端） · **Express + better-sqlite3**（后端） · 单容器交付。

## 功能

- 证据卡片：创建 / 编辑 / 删除（标题、来源、发生时间、描述）
- 「必须早于」连线：拖拽卡片上的「⇢ 连线」到目标卡片，或点击连线按钮后再点击目标卡片
- 有向图校验：每次连线在服务端做环检测；成环时返回完整闭环（HTTP 409），前端将闭环中的卡片与已有连线标红、被否决的新边以红色虚线动画展示
- 拓扑分层时间线：合法连线后按 Kahn 最长路径分层自动重排为「层级 1 → 层级 N」的时间线列
- 可解释侧栏：每个层级列出卡片及其「需等待」的直接前置证据，并附完整约束清单
- **约束瘦身（传递约简）**：检测忽略自身后仍有起点→终点路径的直接连线，将其标为冗余并给出一条**最短替代路径**；瘦身面板逐条展示，点击后在画布上同时高亮原连线（琥珀色虚线）与替代路径（绿色），其余元素自动弱化；确认后在**单个事务**中删除当前仍冗余的连线并返回最新分层，所有证据间的可达关系（及拓扑层级）保持不变
- 导入 / 导出 JSON 快照（导入时同样做环校验，含环快照整体拒绝，HTTP 422；瘦身不落库、不写入快照，快照格式不变）
- 内置示例事故（2026-03 支付网关宕机），首次启动自动载入，也可随时一键重置

## 快速开始（Docker，单条命令）

```bash
docker compose up --build
```

然后访问 **http://localhost:8080**（数据持久化在命名卷 `evidence-data` 中）。

不使用 Compose 时：

```bash
docker build -t evidence-chain . && docker run -p 8080:8080 -v evidence-data:/data evidence-chain
```

## 本地开发

要求 Node.js ≥ 20。

```bash
npm install        # 安装全部 workspace 依赖
npm run dev        # 同时启动后端(8080)与前端 Vite(5173，代理 /api)
```

访问 http://localhost:5173 。

其他命令：

```bash
npm test           # 图算法单元测试（环检测 / 拓扑分层 / 传递约简）
npm run build      # 构建前端静态文件 + 编译后端到 server/dist
npm start          # 生产模式启动（服务前端构建产物，端口 8080）
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8080` | HTTP 服务端口 |
| `DB_PATH` | `./data/evidence.db`（容器内 `/data/evidence.db`） | SQLite 数据库文件路径 |
| `CLIENT_DIST` | `client/dist` | 前端构建产物目录 |

## API 摘要

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/state` | 全量状态：证据、连线、拓扑层级 |
| POST | `/api/evidence` | 新建证据卡片 |
| PUT | `/api/evidence/:id` | 编辑证据卡片 |
| DELETE | `/api/evidence/:id` | 删除卡片（级联删除相关连线） |
| POST | `/api/edges` | 新建「必须早于」连线；成环返回 `409 { message, cycle }` |
| DELETE | `/api/edges/:id` | 删除连线 |
| GET | `/api/slim` | 约束瘦身检测：返回全部冗余连线及每条的最短替代路径 |
| POST | `/api/slim/apply` | 单事务批量删除当前仍冗余的连线；返回最新全量状态与 `removed` 计数 |
| GET | `/api/export` | 导出 JSON 快照（附件下载） |
| POST | `/api/import` | 导入快照（整体替换）；含环返回 `422 { message, cycle }` |
| POST | `/api/seed` | 重置为内置示例数据 |

所有变更类接口均返回最新全量状态，前端直接替换本地状态。`POST /api/slim/apply` 的返回体额外包含 `removed`（本次实际删除条数）。

`GET /api/slim` 响应示例：

```json
{
  "count": 1,
  "redundant": [
    { "edgeId": 12, "fromId": "a", "toId": "d", "alternativePath": ["a", "b", "d"] }
  ]
}
```

## 快照格式

```json
{
  "app": "evidence-chain-orchestrator",
  "version": 1,
  "exportedAt": "2026-09-18T00:00:00.000Z",
  "evidence": [
    {
      "id": "uuid",
      "title": "发布支付服务 v2.3.1",
      "description": "…",
      "source": "CI/CD 流水线",
      "occurredAt": "2026-03-12T02:15",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "edges": [{ "from": "前置证据id", "to": "后续证据id" }]
}
```

快照只包含证据与连线，瘦身为按需计算、不落库，因此快照格式与旧版本、环检测完全兼容（version 仍为 1，旧快照可直接导入）。

## 环检测、分层与约束瘦身算法

- **连线校验**（`server/src/graph.ts`）：新增边 `A → B` 前，沿已有边从 `B` 出发 BFS 寻找回到 `A` 的路径；找到即构成环，返回闭环节点序列 `[A, B, …, A]` 供前端高亮。
- **拓扑分层**：Kahn 算法 + 最长路径分层，`level(n) = max(level(前置)) + 1`，保证每条边都严格从左指向右，层级即「最早可发生轮次」。
- **约束瘦身（传递约简）**：对每条直接边 `u → v`，在「去掉自身」的边上从 `u` 做 BFS；若仍能到达 `v`，则该边冗余，BFS 给出的就是一条**边数最少的替代路径**（长度 ≥ 2）。DAG 的传递约简唯一：在单个事务中重新判定并删除当前全部冗余边后，任意两节点的可达关系不变（单元测试以全点对可达集合 + 拓扑层级断言），因此分层结果也保持一致。
