# GitHub 工程交付与 AI 工作流核对

日期：2026-11-03（Asia/Shanghai）。公开仓库：https://github.com/MarcusDog/FrameForge 。本文件是 R-12～R-14 的交付入口，逐条业务审查仍见 REVIEW.md / REQUIREMENTS.md。

## 审核结论与仍存在的不足

核心闭环已有源码和容器运行证据：Java 后台按三个阶段执行，MySQL 保存状态，失败中断后续阶段，成功终态受保护；前端独立追踪任务，查询异常与制作失败分开。上一轮发现的五项前端竞态/重复查询已修复；本轮复核没有新增已复现的核心业务缺陷，未改业务代码。

仍需如实说明：

- 真实浏览器小屏、刷新、键盘焦点与真实网络 500 注入本轮未复测；已有组件/状态测试及历史浏览器产物，不能混称本轮端到端验收。
- 上传替换和移除不会删除服务端旧文件；未做孤立文件回收和存储配额。
- 演示身份可主动切换，属于 Demo；单实例内存队列不提供崩溃级可靠调度，服务重启会清算遗留任务为失败，不自动续跑。以上边界在 README 已说明，不把题外能力写成已实现。
- 历史列表存在有界 N+1 查询，暂未测得实际性能问题；不为此引入通用缓存或额外框架。
- 本人实际投入、手写修改、人工审查待本人确认。公网部署与实际回滚未执行，不属于本题必做运行项。

## R-12：CI 与关键测试

工作流在 push 和 pull_request 时触发三个任务：

1. frontend：固定 Node 容器，npm ci、lint、严格类型检查、Vitest、Next build；保存 JUnit XML。
2. backend：Java 21/Maven 容器与真实 MySQL 服务，一次 -Pmysql-it verify 包含单元、集成、打包；保存 Surefire/Failsafe 报告。移除原有重复执行单元测试的单独 verify，未跳过任何测试。
3. compose：构建并启动三服务、等待健康、在容器内运行 HTTP smoke；始终保存 Compose 日志和 smoke 输出，再停止服务。

2026-11-03 本地容器预检：27 前端、15 Java 单元、12 MySQL 集成全部通过，0 failures/errors/skipped；lint/typecheck/build 成功，Compose config 成功。原始输出见 [github-preflight-console.txt](evidence/github-preflight-console.txt)。没有在宿主机执行工程构建、测试或业务脚本。

远端 CI：待首个发布提交实际运行后填写对应 SHA、run URL 和结论；本地通过不等于 GitHub 已通过。

## R-13：材料逐项对应

| 提交要求 | 材料 |
|---|---|
| 前后端完整源码、版本/锁文件 | frontend、backend、frontend/package-lock.json、backend/pom.xml、Maven Wrapper |
| 数据库结构与模拟数据 | database/001-schema.sql、002-seed.sql；两 Demo 用户、六模板 |
| 构建/测试/启动与连接 | README 的快速启动、技术版本、连接初始化、测试与 CI |
| 无真实凭据的配置示例 | .env.example、application.yml、Compose 中仅本地演示密码 |
| API 字段、状态、阶段、后台执行 | README 的 API 与字段、异步正确性与边界 |
| 成功/失败/耗时/多任务/刷新演示 | README 的演示步骤 |
| 身份及个人记录 | README 的用户身份与已知限制；服务端归属测试 |
| 完成/未完成、限制与投入 | REVIEW / REQUIREMENTS / 本文件；代码与测试规模已有记录，个人工时待本人确认 |
| 基本部署与回滚 | README 的部署与基本回滚；未声称做过生产操作 |
| AI 使用、上下文、生成/修正/验证 | AI_WORKFLOW.md、VERIFICATION.md、原始 evidence 日志 |
| 素材与复用来源 | ASSET_SOURCES.md；摄影/原创 Java2D 封面、依赖与 Wrapper 范围 |
| 验收 commit | 见本文件“发布与验收提交”，不将文档中的历史本地 SHA 当作已公开的 GitHub 提交 |

## AI 工作流是否完成

已完成题目要求的 AI 工作流说明，且有可复核的具体案例，不依赖私人聊天记录：

- 拆解任务：PLAN 的 M0～M4 和 R-01～R-14 矩阵。
- 提供上下文：原题、现有源码、DTO/API、测试、设计约束与实际错误。
- 生成与修改：AI_WORKFLOW 逐项列出 AI 修改文件、选择和理由，不冒称用户手写。
- 验证：真实容器命令、失败输出和复验结果；区分 fetch 桩、真实 HTTP、真实 MySQL。
- 修正：R-07/08 案例先测得仅文案不匹配；独立审查又测得五个边界失败，最小修改两个实现文件后 16/16、全前端 27/27。原始失败断言与输出完整保留。

早期部分阶段没有保存完整原始日志，不补造历史；这不等于没有 AI 工作流，也不能据此声称每段早期叙事都已独立证实。个人投入和人工审查尚待本人确认。

## R-14：容器与评估入口

在仓库根目录运行 docker compose up --build；默认前端 http://localhost:3000、Java 8080、MySQL 内部网络。初始化 SQL、媒体和数据库卷、healthcheck、依赖等待及两个 Dockerfile 均已提供。完整评估命令见 README，不要求评估者在宿主机安装 Java/Node/Maven。

## 发布与验收提交

- 业务代码本地验收基线：e70c44a9d06fc380fa55ea4c4d06730abcc672e6；本轮只更新 CI、忽略规则和交付文档。
- GitHub 是从本地完整工程导出的发布快照，初始发布不携带本地开发历史；上述本地 SHA 不承诺可在 GitHub 打开。完整本地历史与原始附件均保留。
- 公开内容包括工程、必要题目归档、示例素材、测试与证据；原始“前端设计/”“题目要求/”、缓存、构建产物、用户媒体、凭据不上传。
- GitHub 验收提交及远端运行结果：发布并检查后填入真实值；不会把待执行操作提前写为通过。
