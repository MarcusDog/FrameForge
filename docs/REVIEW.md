# 独立验收记录

审查日期：2026-11-02；源码基线：df5c3ed7c77dff05f6f081cdb065b485c8f1442e。审查由 AI 执行，不代表招聘方或用户本人已人工验收。以 EXAM_SPEC.md 原文为准，README 仅作为待核查的交付说明。

## 修复前报告

在修改生产代码前，重新执行容器内前端检查（23 项测试、lint/typecheck/build）、Java 单元（15 项）和真实 MySQL 集成（12 项），全部通过。随后新增 4 项回归并给既有详情用例增加请求数量断言：定向 16 项，11 通过、5 失败，退出码 1。

按影响排序的五项发现：

| 编号/级别 | 可复现问题 | 原因及最小修复方向 |
|---|---|---|
| F1 / P2 | Bob 等待自己的详情响应时仍显示 Alice 的旧详情错误；未发现任务记录跨用户泄露 | TaskDetail 局部错误未绑定用户与任务；为错误保存所属用户和任务 |
| F2 / P2 | 较新 SUCCEEDED 快照到达后，旧查询失败又写入错误 | poll 的 catch 只检查会话代次，未检查任务是否已有更新；检查快照版本及活跃状态 |
| F3 / P2 | 已成功取得较新 RUNNING 快照，旧查询错误仍保留，自动追踪仍暂停 | merge 更新 items 而不更新 errors；仅被接受的成功快照清除对应错误 |
| F4 / P2 | 首次详情加载失败后，历史刷新已恢复成功任务，页面仍显示同步失败 | 局部加载错误与任务追踪错误混用；仅在没有快照时展示局部加载错误 |
| F5 / P3 | 详情首屏和恢复查询重复 GET；场景为 4 次而非 2 次 | 详情直接请求与 feed 查询并行；已有快照复用 feed，缺失任务才单独加载，恢复时只触发一个通道 |

首次失败输出保存在 .runtime/logs/audit-regressions-before.log，现已归档到 [失败与复验原始输出](evidence/audit-regressions-console.txt)。没有删除断言或改写原题。此节先记录发现，后续修复及验收结果另记。

## 修复后的逐条验收

“已验证”指本轮实际命令或行为测试通过；模拟传输、真实 HTTP、真实数据库分别标注。源码存在或历史报告写过，不自动等于本轮运行通过。未验证不直接等同于未实现。

| 要求 | 代码/测试证据 | 本轮实际结果与边界 |
|---|---|---|
| R-01 技术栈与职责 | [pom.xml](../backend/pom.xml)、[package.json](../frontend/package.json)、[ApiController](../backend/src/main/java/studio/frameforge/ApiController.java)、[Mapper](../backend/src/main/java/studio/frameforge/TaskMapper.java) | 已验证：Java 21、Node 24 容器、Next 构建、MySQL 8.4.8；任务/素材/模板由 Java 提供，SQL 可直接读取任务。没有 Next 代替 Java 执行业务 |
| R-02 模板与分类 | [Gallery](../frontend/src/components/gallery.tsx)、[种子](../database/002-seed.sql)、[HTTP smoke](../scripts/smoke.mjs) | 已验证：Java 返回六模板、三分类、不同数量、真实本地封面可访问；源码支持但未验证：本轮真实浏览器点击分类。旧浏览器产物单列为历史证据 |
| R-03 详情/上传/校验 | [Studio](../frontend/src/components/studio.tsx)、[上传测试](../frontend/src/components/studio.test.tsx)、[FileStore](../backend/src/main/java/studio/frameforge/FileStore.java)、FileStoreTest、TaskServiceTest、TaskFlowIT | 已验证：真实 HTTP 上传、假图片拒绝、数量/归属/缺失文件校验、真实 PNG 内容检查；组件测试验证禁用、替换竞态、移除/取消与预览释放。完整真实浏览器上传交互未复测 |
| R-04 受理与后台 | [TaskService:31](../backend/src/main/java/studio/frameforge/TaskService.java#L31)、[Dispatcher:39](../backend/src/main/java/studio/frameforge/TaskDispatcher.java#L39)、TaskFlowIT.acceptanceReturnsBeforeWorkerFinishesAndQueueRejectionIsWritten / rollbackDoesNotDispatchAndAfterCommitRecordsAreVisibleToWorker | 已验证：latch 阻塞 worker 时 HTTP 已返回；回滚不留任务；提交后 worker 可读；拒绝有持久失败。独立运行中 POST 65ms 返回 QUEUED，该审查客户端零任务 GET 时 MySQL 已成功 |
| R-05 三阶段/查询/终态 | [Worker:21](../backend/src/main/java/studio/frameforge/TaskWorker.java#L21)、[StageService:10](../backend/src/main/java/studio/frameforge/TaskStageService.java#L10)、TaskMapper、TaskWorkerTest、TaskFlowIT.actualDatabaseWorkflowProducesReadablePngAndImmutableTerminalState | 已验证：三个独立开始/结束、数据库时间线顺序、生成 PNG、成功后 begin/complete/fail 均不能回退。独立 SQL 读到三个阶段成功；任务 GET 前后 version 均为 7 |
| R-06 指定失败/耗时 | TaskWorkerTest.eachFailureStopsAllFollowingStages、TaskFlowIT.eachInjectedFailureIsPersistentAndSkipsFollowingStages、Studio 模拟面板 | 已验证：三个阶段逐个注入失败；后续阶段无 startedAt 且 SKIPPED，失败原因落库、结果不可读；固定延迟可调，不用随机失败 |
| R-07 状态与请求异常 | [TaskFeed](../frontend/src/lib/task-feed.ts)、[TaskDetail](../frontend/src/components/task-pages.tsx)、[专项组件测试](../frontend/src/components/task-sync.test.tsx) | 已验证：真实 api 封装+fetch Response 500 桩，A 保持 RUNNING、B SUCCEEDED、恢复查询；本轮 F2/F3/F4 修复并复验。真实浏览器网络故障注入未验证 |
| R-08 多任务/生命周期 | TaskFeed 11 项、Providers 4 项、task-sync 5 项、api 4 项测试 | 已验证：独立终态/请求数量、无活跃任务不轮询、离页中止、旧代次/旧版本保护；F1/F5 修复，Bob 不显示 Alice 旧详情错误，详情恢复仅单通道。测试为 jsdom/可控 Promise，并非浏览器端到端 |
| R-09 刷新恢复/历史 | TaskFeed.restoresUnfinishedTasksBeyondTheFirstHistoryPage、TaskFlowIT.seedTextRemainsUtf8AndHistoryPaginationDoesNotLoseRecords、TaskPages、ResultPreview、HTTP smoke | 已验证：Java 历史与分页、前端从空 feed 恢复未完成任务、真实 PNG/失败记录；源码支持但未验证：本轮真实浏览器刷新与预览对话框键盘操作 |
| R-10 身份与个人记录 | ApiController.user/session、StoreMapper.asset、TaskMapper.owned/list、TaskFlowIT.userIsolationCoversAssetSubmissionHistoryTaskAndResult | 已验证：Cookie 同源转发，跨用户素材/任务/结果 404、历史过滤、无身份 401；Demo 可主动切换，README 没有将其说成生产认证 |
| R-11 界面与可用性 | Shell、Gallery、Studio、TaskCard/Timeline/ResultPreview、globals.css、组件测试 | 已验证：组件语义标签、上传禁用与错误反馈；源码支持但未验证：当前构建桌面/小屏视觉、焦点与 dialog 原生行为。output/playwright 为前一轮产物，未把它算成本轮视觉验收 |
| R-12 CI/关键测试 | [.github/workflows/ci.yml](../.github/workflows/ci.yml)、Docker test targets、5 个 Java 测试文件/5 个前端测试文件 | 已验证：27 前端、15 Java 单元、12 真实 MySQL 集成，共 54 项，本轮均执行，0 失败/跳过；lint/typecheck/build/Compose smoke 通过。源码支持但未验证：远端 Actions 的 push/PR 触发与运行结果；本仓库无 remote |
| R-13 交付/说明/AI | README、锁文件、SQL、Wrapper、ASSET_SOURCES、AI_WORKFLOW、本文、[本轮日志](evidence/audit-regressions-console.txt) | 已验证：材料存在且与本轮命令逐项核对，原题归档 SHA256 与来源完全相同；原始失败与复验可查。未完成：本人实际投入/个人代码贡献/人工验收确认；未验证：历史每阶段原始失败记录、外部图片授权现状、实际部署回滚 |
| R-14 容器交付 | compose.yaml、前后端 Dockerfile、.env.example、database SQL | 已验证：config、up --build --wait、三服务 healthy、真实同源业务 smoke；另用全新 tmpfs MySQL 验证 Docker entrypoint 自动建六表、两用户、六个中文模板。使用现有镜像/依赖缓存，未验证全无缓存联网安装或第二台机器 |

没有发现仍未实现的核心业务条目；R-13 的个人投入等信息仍待本人补充。R-14 是原题推荐交付，已提供并实际验证。远端部署、自动续跑、生产认证、Redis/MQ 不作为缺失业务扣分。

## 五项问题的修复与复验

- F1：详情加载错误保存 userId/taskId，只显示当前身份/任务的错误；等待 Bob 响应时不再展示 Alice 错误。
- F2：旧查询的 catch 同时校验代次、活跃状态和发起查询时的任务版本；不能给较新终态附加过期错误。
- F3：被版本规则接受的成功快照清除该任务查询错误；旧版本快照不会清错。新 RUNNING 快照可恢复自动追踪。
- F4：没有任务快照时展示详情加载错误；已有快照只展示 feed 的同步错误，历史恢复后不残留旧加载失败。
- F5：先复用历史/活跃任务快照，加载完成后确实缺少任务才查询详情；已有任务恢复只调用 feed.retry，不再额外发起详情请求。

生产修改只有 frontend/src/lib/task-feed.ts 与 frontend/src/components/task-pages.tsx；新增 4 项测试并加强 1 项既有测试，未删除任何断言、修改题意、禁用检查或引入依赖。定向复验 16/16，全前端 27/27；lint/typecheck/build 通过。Java/SQL 未改动，本轮基线的 15+12 项结果适用于最终代码。

优先级：P2 正确性/隔离问题先修（本轮已完成），P3 重复查询随后修（本轮一并消除）。下一步应优先由本人确认投入和关键策略，再在有 remote 的交付仓库触发 CI，并在目标浏览器复验小屏、刷新和键盘交互。没有 P0/P1 级问题的已证实证据，不为凑数拔高严重性。

## 后台与 MySQL 的独立运行证据

任务 2749e7c6-a06e-439c-8a7e-c8c789d641e9：POST 返回 QUEUED，65ms；计划延迟为 500/4500/500ms。客户端在检查闸门前没有调用任何任务详情 GET。

在闸门放行前，直接用 MySQL 客户端读到 SUCCEEDED、ORGANIZING、version=7，三行阶段全部成功，耗时分别为 801/4777/599ms。运行日志对应 Java worker 的六条 start/end 边界。放行后首次任务 GET 返回成功，再查数据库 version 仍为 7。这里的实际耗时包含真实解码/渲染/落盘，不把模拟配置值冒充实际耗时。

[审查脚本](evidence/audit-background.mjs) 与 [运行/SQL/初始化输出](evidence/audit-runtime-console.txt) 可复核此过程。SQL 与六条 worker 日志相互对应，不仅依赖 README 或测试 Mock。

## 执行命令与结果

全部项目构建、测试、业务脚本在容器中执行；PowerShell 只编排容器、读写证据文件和检查 Git。捕获命令均保留容器非零退出码。

| 顺序 | 实际命令 | 退出码/结果 |
|---|---|---|
| 1 | docker compose --profile test run --build --rm frontend-test | 0；基线 lint/typecheck/23 tests/build |
| 2 | docker compose --profile test run --build --rm backend-test | 0；15 unit + 12 MySQL IT，BUILD SUCCESS |
| 3 | 下方公共前缀 + npm run test -- --run src/lib/task-feed.test.ts src/components/task-sync.test.tsx --reporter=verbose | 1；修复前 11 passed / 5 failed |
| 4 | 同一命令，两个生产文件修复后 | 0；16 passed |
| 5 | 公共前缀 + sh -c 'npm run test -- --run --reporter=verbose && npm run lint && npm run typecheck && npm run build' | 0；27 passed，lint 零警告、类型与构建通过 |
| 6 | docker compose config --quiet | 0 |
| 7 | docker compose up --build -d --wait --wait-timeout 180 | 0；三服务 healthy |
| 8 | 容器内 node docs/evidence/audit-background.mjs，SQL 检查后放行 | 0；65ms 受理、该审查客户端零任务 GET 时已持久成功 |
| 9 | 容器内 node scripts/smoke.mjs | 0；真实上传、多任务、PNG、失败中断、历史、越权、HTTP 错误等 PASS |
| 10 | 独立 MySQL 8.4.8 + 全新 tmpfs + 挂载 database 初始化目录，随后 SQL 查询 | 0；六表/两用户/六中文模板/零任务 |
| 11 | git diff --check、最终 diff 审查 | 通过；最终提交前再次检查 |

定向测试和最终前端检查的公共前缀（在工程根目录执行）：

~~~powershell
docker run --rm --mount 'type=bind,source=D:\求职\小影科技\ai全栈工程师\frontend,target=/app' --mount type=volume,source=frameforge-node-modules,target=/app/node_modules -w /app node:24.11.1-bookworm-slim
~~~

后台独立检查可复现方式：AUDIT_GATE_DIR 每次选择一个新的工程内空目录，运行脚本容器；读取 accepted.json 的 taskId；先用只读 SQL 验证 task 与 task_stage 成功，再创建 release 文件，脚本才会执行首次任务 GET。90 秒内需完成放行，超时会如实失败。

~~~powershell
docker run --rm --network frameforge_default --mount 'type=bind,source=D:\求职\小影科技\ai全栈工程师,target=/workspace' -w /workspace -e AUDIT_GATE_DIR=/workspace/.runtime/review-background-a node:24.11.1-bookworm-slim node docs/evidence/audit-background.mjs
~~~

本次实际使用上述目录；重跑必须换新目录。SQL 使用 docker compose exec -T mysql 内的 mysql 客户端，MYSQL_PWD 从容器环境读取，不输出真实凭据。后台客户端放行前后的 SQL、worker 边界与返回值均在 runtime 证据中；新库检查使用临时容器 frameforge-review-init，结束后已停止并自动移除，测试库也已停止，演示三服务与已有数据保留。

新库初始化的实际入口命令（需要已存在的 mysql:8.4.8 镜像；只使用全新临时内存数据目录）：

~~~powershell
docker run -d --rm --name frameforge-review-init --tmpfs /var/lib/mysql -e MYSQL_DATABASE=frameforge -e MYSQL_USER=frameforge -e MYSQL_PASSWORD=review-demo -e MYSQL_ROOT_PASSWORD=review-root-demo --mount 'type=bind,source=D:\求职\小影科技\ai全栈工程师\database,target=/docker-entrypoint-initdb.d,readonly' --health-cmd 'MYSQL_PWD=$MYSQL_PASSWORD mysql -h 127.0.0.1 -u $MYSQL_USER -D frameforge -e "SELECT 1"' --health-interval 3s --health-timeout 5s --health-retries 30 mysql:8.4.8
~~~

容器 healthy 后以 mysql 客户端查询 VERSION、information_schema.tables、demo_user、template、task，结果见 runtime 控制台文件；实际清理为 docker stop frameforge-review-init（--rm 自动移除），没有删除演示数据卷。

## 可以删除或简化的内容

1. 已简化详情页的重复请求通道和两套混用错误提示，保留缺失快照的单独加载。没有为这次修复引入工厂、策略或基类。
2. TaskFeed.ownerKey 仅是构造时的身份标签，并未参与授权或响应校验。可在后续整理时取消该只读字段，配套调整按用户创建 feed 的方式与 lint 依赖；不能把它描述成安全机制。真正保护来自服务端归属、不同 feed 实例、代次及 AbortSignal。本轮未为小收益扩大修改范围。
3. TaskService.view 对每个历史任务单独查模板/阶段/素材，是有界 N+1（默认 20，最大 50）；没有本轮延迟测量证明性能缺陷。可先在一次 history 调用内复用模板映射；不建议为此引入通用缓存或复杂仓储层。
4. 测试中的 task/page/deferred 小型夹具跨两个文件重复，可在继续增长时集中；当前直接保留更容易独立读懂测试，没必要新增抽象框架。
5. 各文档重复维护最终测试总数容易过期（PLAN 曾仍为 19，而上一提交已是 23）。保留历史阶段数，最新总数统一引用本轮 REVIEW/VERIFICATION。本轮同步了入口摘要。

未发现无用途的大型运行时依赖：前端只有 Next/React，测试/类型/lint 为开发依赖；后端 Web、Validation、MyBatis/MySQL、Actuator 均有实际用途。StageDelay 是确定性后台阻塞测试的替换边界，TaskStageService 是独立事务边界，均不应为减少文件数而合并掉。

## AI 工作流的证据缺口

- 先前 M0～M4 的很多失败与修复仅有文字摘要及聚合提交，未逐阶段保存原始控制台或独立提交。本轮成功重跑能证明当前行为，不能追认每一段历史失败叙事；不补造旧日志。
- R-07/08 专项已有原始失败/复验输出；本轮另外保留基线、五项失败、定向复验、最终检查和真实 SQL/HTTP 输出。它们是 AI 执行记录，不等于本人或招聘方人工审查。
- 旧浏览器截图/JSON 有时间和场景，但不绑定当前修复的源码 hash；本轮未进行浏览器自动化或 Computer Use，不能用旧图声称当前真实刷新/小屏/焦点已重新验收。
- 没有远端仓库、CI run URL 或远端报告，不能将本地通过写成 GitHub Actions 通过。
- 用户个人有效工时、手写贡献、人工批准待本人确认；现有文件/测试规模不能代替个人投入时长。
- 已记录示例摄影来源与复用范围，但本轮没有联网核验授权现状，不作额外法律保证。

原题归档与来源文件 SHA256 均为 53250C39F9DBC64ADA1746E0DBBDDC69F3DEA0237FE731076F4822DFD01BF836。没有修改 EXAM_SPEC、删除测试、改变 Java/SQL、依赖、CI 或模拟执行规则。
