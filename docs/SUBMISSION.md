# GitHub 工程交付与 AI 工作流核对

更新：2026-11-04（Asia/Shanghai）。公开仓库：https://github.com/MarcusDog/FrameForge 。当前版本有注册/登录/独立会话、完整个人资料、批量任务与12版式；**81项本地测试与两套真实浏览器检查通过**，见ACCOUNTS_QA.md。下方旧SHA/72等测试数量是历史证据；最新公开验收与云端状态以文末为准。矩阵见REQUIREMENTS，历史审查见REVIEW。

## 审核结论与仍存在的不足

核心闭环已有源码和容器运行证据：Java 后台按三个阶段执行，MySQL 保存状态，失败中断后续阶段，成功终态受保护；前端独立追踪任务，查询异常与制作失败分开。上一轮发现的五项前端竞态/重复查询已修复。后续新增个人资料保存、头像归属/版本冲突和退出，原有异步任务行为测试继续通过；修改与失败修复见 PROFILE_UPDATE。

仍需如实说明：

- 当前Chromium手机尺寸/键盘/刷新/网络500/多任务与注册登录已实测通过；实体手机/iOS/屏幕阅读器仍未验收，不能把视口模拟称为实体设备验收。截图/JSON分阶段保留于output/playwright。
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

远端 CI 已触发：[首个 push run 41603794341](https://github.com/MarcusDog/FrameForge/actions/runs/41603794341)，对应提交 6d3e27f9d923dbcc3b50574cef23e1d9bccc6efd。GitHub 返回 failure，三个任务 steps 都为空，原因为“The job was not started because your account is locked due to a billing issue.”。任务未启动，没有测试/构建日志和 artifacts，不能写成远端测试已通过，也不能将它误报为业务测试失败。

原始 API 信息见 [github-actions-first-run.json](evidence/github-actions-first-run.json)。账户所有者需处理 GitHub 计费锁定后重新运行此 workflow；本轮没有修改账户账单、跳过检查、改用自托管 runner 或伪造绿色状态。后续文档提交同样保留 push 触发。

## R-13：材料逐项对应

| 提交要求 | 材料 |
|---|---|
| 前后端完整源码、版本/锁文件 | frontend、backend、frontend/package-lock.json、backend/pom.xml、Maven Wrapper |
| 数据库结构与模拟数据 | database/001～004；两Demo用户、十二模板、九表；新空库自动初始化已验收 |
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

## 历史发布与验收提交（2026-11-03）

- 2026-11-03 业务代码本地验收基线：e70c44a9d06fc380fa55ea4c4d06730abcc672e6；该次发布只更新 CI、忽略规则和交付文档。
- GitHub 是从本地完整工程导出的发布快照，初始发布不携带本地开发历史；上述本地 SHA 不承诺可在 GitHub 打开。完整本地历史与原始附件均保留。
- 本地发布分支为 github/main，推送到 origin 的 main；本地 main 保留原始附件历史，不直接发布。远端默认推送映射已指向该发布分支。GitHub 克隆者使用正常的 main 即可，不需要本地历史。
- 公开内容包括工程、必要题目归档、示例素材、测试与证据；原始“前端设计/”“题目要求/”、缓存、构建产物、用户媒体、凭据不上传。
- 可供招聘方复核的代码验收提交：[6d3e27f9d923dbcc3b50574cef23e1d9bccc6efd](https://github.com/MarcusDog/FrameForge/commit/6d3e27f9d923dbcc3b50574cef23e1d9bccc6efd)，本地容器验证通过，远端因账户计费锁定未执行。不是“云端通过的验收提交”。
- [github-source-provenance.json](evidence/github-source-provenance.json) 记录 git diff exit 0，证明该公开快照的业务源码/依赖/Compose 与本地验收基线一致。后续提交只补交付证据与文档，最新入口取 main。

## 2026-11-04 本地试用增强（同步前记录）

本地后来新增了个人中心、批量制作、两 worker 和 12 种版式，并完成 63 项测试及运行更新，见 UI_UPDATE.md。上述 GitHub SHA 与 source-provenance 文件是 2026-11-03 发布的历史证据，不指代本地新版；该阶段尚未更新远端快照或重跑云端 CI，不能把历史一致性证明套用到新版。

## 最新版本同步 / 2026-11-04

本次已按用户明确要求，把本地 da3b2c631a03c0d3a3ef12df6f0a0a65c7f753bc 已验证的界面、个人中心、批量任务和模板更新发布至远端。新版本地证据为 33+17+13 共 63 项，见 UI_UPDATE.md；本次只修正文档与补充 CI 的 batch-smoke 步骤，没有改变业务代码或重算测试通过记录。

新版代码验收提交：[c89371247b44d3236b1d3c2510da87979878cab3](https://github.com/MarcusDog/FrameForge/commit/c89371247b44d3236b1d3c2510da87979878cab3)。代码、依赖、模板封面和配置与本地 da3b2c6 已验证版本的 git diff 为 0，完整路径与统计见 [新版源码一致性记录](evidence/github-ui-provenance-2026-11-04.json)。后续提交仅整理文档/证据，GitHub main 提供最新交付入口。

本次 [Actions run 41765366854](https://github.com/MarcusDog/FrameForge/actions/runs/41765366854) 返回 failure；backend/frontend/compose 三个任务的 steps 均为空，原因仍为账户计费锁定，未实际执行测试。原始返回见 [本次 CI 记录](evidence/github-ui-run-2026-11-04.json)。本地 63 项通过不代表云端已通过。账户所有者解除锁定后，可对该 run 重新运行全部任务。没有为获得绿色状态修改触发器、删除测试或换自托管 runner。

## 个人资料增强：最新本地验收 / 2026-11-04

39 前端、17 Java 单元、16 真实 MySQL 集成共72项通过；lint/typecheck/build 通过。增量003迁移、重复执行不覆盖、三服务 healthy、smoke/batch/profile 三个容器 HTTP 脚本 PASS。新增6项前端行为和3项MySQL测试，首次运行均通过；首次 lint 的 effect 同步更新失败与修复完整保留在 [profile-console.txt](evidence/profile-console.txt)。当前真实浏览器小屏/焦点/头像交互及双标签页冲突待人工确认。

交付已补个人资料 API、升级/回滚说明、AI真实工作流案例与 [高分完善优先级](SCORECARD.md)。没有添加生产登录、会员或支付，也没有将建议当作完成项。该版业务验收 SHA、公开源码一致性和对应新 CI run 在发布后记录，旧的 c893712 不指代新个人资料代码。

## 最新公开验收提交与实际云端结果

- 个人资料业务验收提交：[01e5347b6b0c19b481440202ad7fdf99951fb336](https://github.com/MarcusDog/FrameForge/commit/01e5347b6b0c19b481440202ad7fdf99951fb336)。本地验证基线 2180ec35b276bd8f6071df680f349069fc6fb4ca；Git 比对 backend/frontend/database/scripts/Compose/配置/CI 无差异，退出0。
- [源码一致性原始记录](evidence/github-profile-provenance-2026-11-04.json) 同时核对远端 README、AI_WORKFLOW、新增SQL、ProfileService、ProfileEditor 和 CI 的 Git blob；原始题目/设计目录未进入公开树。
- 本次 [Actions run 41778534619](https://github.com/MarcusDog/FrameForge/actions/runs/41778534619) 状态 failure，三个任务 steps 都为空。annotations 原因仍为 GitHub 账户计费锁定，未执行任何构建/测试，见 [完整API记录](evidence/github-profile-run-2026-11-04.json)。另有 runner 镜像迁移提示，不是本次业务测试失败。
- 本地72项通过与远端未启动明确分开。账户所有者需处理锁定后重跑；没有改账单、删除断言、关闭CI或替换runner规避检查。后续文档回执提交不改变业务源码，验收仍指向上述01e5347。

## 注册登录与真实浏览器：当前本地验收

当前81项=44前端+17单元+20真实MySQL；lint/typecheck/build通过。两套真实Chromium脚本PASS：手机尺寸、键盘焦点、网络500恢复/终态停询/切换旧响应、375px注册/实际三图2运行1排队/刷新/退出/错误与正确登录历史恢复。首轮焦点失败、类型错误、HTTP randomUUID失败及修复保留，详见ACCOUNTS_QA与account-console。创作面板/动态774/723px，解决截图指出的大片留白。三HTTP脚本与空tmpfs库四SQL初始化9表/2用户/12模板亦通过。

最新公开代码SHA与对应云端run在本次发布后补录；01e5347只指代前一版，不是当前账户与焦点修复代码。CI已加入相同浏览器脚本与截图artifact，但配置存在不等于云端已执行。

原始附件、缓存、个人上传文件继续留在本地；公开工程快照不携带本地原始附件历史。
