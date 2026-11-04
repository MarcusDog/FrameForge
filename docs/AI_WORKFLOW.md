# 真实 AI Coding 工作流

本工程由 Codex 执行开发。用户提供完整题目、目标、技术限制，并明确选择浅色蓝紫视觉。以下区分事实、计划和人工待确认事项；不包含私人聊天或凭据。

## M0：输入与拆解

- 上下文：题目要求.txt 全文、四张题目截图、十张设计参考、本次实施方案、目录及工具检查。
- 实际修改：初始化本地 Git；建立 PLAN 与 R-01～R-14 矩阵；归档原题。
- 选择：Java 业务单体 + MySQL + 单线程有界队列；用真实阶段记录解释异步，不引入 Redis/MQ。
- 环境事实：初次检查无工程和 Git；默认 Java 17，另有 Java 24；Node 24.11.1；Docker CLI 可用但引擎尚未运行。实施阶段已尝试隐藏启动现有 Docker Desktop。
- 验证：题目可完整读取；Git 初始化命令成功。版本解析与引擎情况将在后续实际检查后记录。

## 人工贡献

用户：提出需求、提供题目与参考、确认视觉方向。人工代码修改、人工运行审查、个人实际投入：待人工确认。未将 AI 的设计或修改归为用户手写。

## M1：后端与第一次修复

上下文：R-01～R-06/R-10、六表模型、事务事件官方文档、本地图片约束。AI 实现 Java API、素材内容校验、任务幂等、提交后调度、有界队列、阶段短事务、终态保护、重启清算和 Java2D 拼贴。验证发现测试的 checked exception 声明缺失；最小修正后容器 verify 的 14 项测试全部通过。真实 SQL 行为另由 M3 验证。

## M2：前端状态与验证

上下文：浅色设计参考、Java DTO/API、R-03/R-07～R-11。AI 实现响应式页面、上传替换移除、模拟面板、按用户生命周期隔离的 TaskFeed、版本合并、错误暂停与恢复、历史与预览。网络返回在单一 unknown 边界收窄；用可控 Promise 和假时钟验证乱序响应。经历 lint 与 mock 泛型类型错误，保留全部检查并最小修复后，lint/typecheck/10 tests/build 全通过。

## M3：真实数据库行为

上下文：真实 MySQL 8.4.8、独立测试数据库、事务和执行器行为。AI 增加 9 项 HTTP/MySQL 集成测试；使用 latch 阻塞工作线程，证明 POST 已返回而工作尚未完成；固定容量一线程一队列触发拒绝；并发提交相同键验证仅一条任务和三个阶段。MySQL 集成 verify 成功，未用 H2 或跳过失败测试。

## M4：可视证据发现遗漏并修复

上下文：真实三容器运行、D 盘存储约束、浏览器截图与 HTTP 请求。AI 通过无界面浏览器发现动态中文乱码，核对 SQL 文件和数据库 HEX 证明是导入字符集，显式设置 UTF-8 并为 smoke 增加中文值断言，再复验真实接口与页面。此例表明单元绿灯不能替代实际交付检查。

同时加固身份请求生命周期，新增初始化/快速切换测试；增加重启清算与仅最终阶段可公布结果的测试。Computer Use 根据用户要求停用；后续均为命令行、容器与独立无界面 Edge，临时数据在 D 盘。浏览器七组检查最终通过；云端 Actions 与本人手工审查不虚构为已执行。

## M4 深查补充：先让回归变红

继续使用原题、现有提交、请求生命周期和真实 HTTP 输出作为上下文。AI 发现根布局追踪没有在离开任务页时停止、fetch 无截止时间、通用异常处理改写 4xx 三个问题。先新增回归并运行旧代码：页面清理两个用例和超时三个用例失败，协议误返回 500 通过真实请求复现；随后只修改对应模块，复验 19 前端测试、15 Java 单元、12 MySQL 集成与构建。另给独立 Maven 测试容器持久缓存，继续复用 D 盘已有资源。

最终本轮 46 项自动化测试及 8 组无界面浏览器检查通过；新增浏览器场景采用客户端导航保留根布局，避免整页刷新掩盖生命周期缺口。云端 CI、真人实机和个人贡献仍明确待确认，不以本地测试代替。


## 专项案例：R-07 / R-08 / R-12，HTTP 500 与任务执行失败的区分

日期：2026-11-02。审查基线：6daffa7e688444b074824c6771414881092d5a64。本案例按用户要求先编写测试、保存首次输出，再决定是否修改实现。

### 原始需求

A、B 初始均为 RUNNING。下一轮 A 查询返回 HTTP 500，B 查询返回 SUCCEEDED：

1. A 保留原有 RUNNING 和阶段、时间、版本等快照，不能因为请求错误成为 FAILED。
2. A 显示“状态同步失败，可重试”。
3. B 更新为 SUCCEEDED，并停止自动轮询。
4. A 后续成功查询可以恢复；当前产品策略是暂停该任务的自动查询，点击“恢复查询”后重新读取并继续跟踪。
5. 切换用户后，旧用户的迟到成功响应和迟到错误都不能污染新用户。
6. 以真实执行记录交付 R-12 测试证据，不删除失败断言，也不为叙事人为制造 bug。

### 提供给 AI 的上下文与提示词摘要

上下文包括本次六项行为要求、题目 R-07/R-08/R-12、干净 Git 基线、TaskFeed、真实 api 请求封装、Providers、TaskCard、TaskDetail、已有行为测试、Vitest 配置和 CI 前端检查步骤。

提示词摘要：“先审查；为两个 RUNNING 任务编写 HTTP 500/成功、恢复查询、终态停轮询与切换用户的测试；执行并记录首次结果；仅针对实际不符合预期之处最小修改；重跑测试、lint/typecheck/build；检查最终 diff；首次通过的行为如实记录；人工审查未进行就写待确认。”

审查发现：TaskFeed 已将 items 业务快照与 errors 查询错误分开，使用版本与代次保护响应，失败查询只暂停该任务。现有测试以 QUEUED 或普通 Error 为主，缺少本次完整场景；两个页面原有提示与本次明确要求的文案不同。

### 编写测试与首次实际结果

新增四个行为用例，不 mock TaskFeed、api 或 Providers 的业务实现；在 fetch 边界提供 Response，使用真实 API 错误解析、React 状态订阅和假时钟。Next 路径钩子固定为 /history，以启用真实 Provider 的追踪效果；这些是 jsdom 组件联动测试，不是浏览器端到端测试：

| 用例 | 关键断言 | 首次结果 |
|---|---|---|
| TaskFeed 精确 HTTP 500 场景 | A 完整快照不变；B 成功；B 查询仅一次；A 手动恢复为 RUNNING 后继续成功 | 通过 |
| 卡片提示与恢复 | A 仍为“处理中”，无业务失败区域；出现指定提示；恢复后错误消失，B 不再请求 | 失败：指定文案不匹配 |
| 详情页提示与恢复 | RUNNING 保留、指定提示、点击恢复后成功 | 失败：指定文案不匹配 |
| 真实 Provider 用户切换 | 先发起 Alice 的 A/B 查询，再切到 Bob；旧请求信号取消，故意忽略取消的迟到成功/500 仍不能进入 Bob 界面 | 通过 |

首次定向运行包含原有测试，共 12 个用例：10 通过、2 失败，退出码 1。状态逻辑与切换用户测试第一次就通过，没有为了制造失败而修改实现。

两项实际失败输出：

~~~text
Expected element to have text content:
  状态同步失败，可重试
Received:
  暂时无法获取最新状态，已保留上次记录。同步接口暂时不可用恢复查询

Expected element to have text content:
  状态同步失败，可重试
Received:
  查询连接异常，保留上次状态。恢复查询
~~~

这是提示文案不符合本次明确验收要求，不是 RUNNING 被错误改为 FAILED。没有删除或弱化断言。

### 最小修改及 AI 修改的文件

生产实现仅修改两行：

- frontend/src/components/task-card.tsx：提示改为“状态同步失败，可重试。已保留上次记录。”，继续展示原始查询错误和“恢复查询”按钮。
- frontend/src/components/task-pages.tsx：详情页使用相同的同步失败语义，保留上次状态提示。

测试修改：

- frontend/src/lib/task-feed.test.ts：新增精确 RUNNING / HTTP 500 / B 成功 / A 恢复用例。
- frontend/src/components/task-sync.test.tsx：新增真实 Provider、API 封装与组件联动的三项行为测试。

未修改 TaskFeed 状态机、api 封装、Provider 实现、Java 后端、依赖或 CI 配置。现有 Vitest include 会自动发现新测试，现有 CI 的 npm run test -- --run 会包含本案例。

文档与证据修改：本文件、VERIFICATION.md、REQUIREMENTS.md、DELIVERY.md、README.md 及 docs/evidence/r07-r08-console.txt。

### 实际执行命令和结果

在工程根目录 D:/求职/小影科技/ai全栈工程师 执行。测试、lint、类型与构建均使用现有 Node 24.11.1 Docker 镜像；命令的公共前缀为：

~~~powershell
docker run --rm --mount 'type=bind,source=D:\求职\小影科技\ai全栈工程师\frontend,target=/app' --mount type=volume,source=frameforge-node-modules,target=/app/node_modules -w /app node:24.11.1-bookworm-slim
~~~

下表是每次追加到此前缀的实际容器命令，按执行顺序排列。PowerShell 使用 Tee-Object 捕获输出，并以 exit $LASTEXITCODE 传播退出码：

| 顺序 | 容器内实际命令 | 实际结果 |
|---|---|---|
| 1，未修改生产代码 | npm run test -- --run src/lib/task-feed.test.ts src/components/task-sync.test.tsx --reporter=verbose | exit 1；10 passed / 2 failed；两项文案断言失败 |
| 2，仅修改两行提示后 | npm run test -- --run src/lib/task-feed.test.ts src/components/task-sync.test.tsx --reporter=verbose | exit 0；12 passed / 2 files |
| 3，完整前端回归 | npm run test -- --run --reporter=verbose | exit 0；23 passed / 5 files |
| 4，质量检查与生产构建 | sh -c 'npm run lint && npm run typecheck && npm run build' | exit 0；lint 零警告、tsc 通过、Next.js 16.4.3 build 成功 |

控制台输出直接从捕获文件整理到 [控制台证据](evidence/r07-r08-console.txt)，仅清理行尾空格与末尾空行，保留首次失败信息及四次运行结果；日志时间为容器 UTC，首次定向开始时间 13:14:49 UTC，即北京时间 21:14:49。

构建后检查生产代码 diff：只有上述两行提示调整，任务业务状态处理未变化。再检查整个最终 diff 和空白错误；未删除既有断言，没有跳过用例、关闭类型检查或放宽 lint。

额外同步本地运行环境：实际执行 docker compose up --build -d --no-deps --wait --wait-timeout 120 frontend，退出码 0，前端容器重建并 healthy；后端和数据库未重建。此操作应用了提示文案，不代表真实链路 HTTP 500 故障注入已验证。

### 人工需要审查的关键点（待人工审查，未声称已完成）

- 是否认可“HTTP 查询错误暂停 A，手动恢复；B 达终态后永久停止该任务自动查询”的产品策略。
- 业务状态来自 Java；请求错误保存在 errors，不以客户端异常替换 items 中的 RUNNING。
- 卡片和详情页指定提示是否清楚表达“同步失败”而不是“制作失败”。
- 假时钟跨越多个轮询周期、按 taskId 统计请求的断言，是否充分证明 B 已停止查询。
- 切换用户测试故意让 fetch 忽略 AbortSignal 后仍返回旧成功与旧 500，是否覆盖取消之外的代次防护。
- HTTP 500 是 fetch 边界的测试响应，未用“模拟生成失败”替代查询异常。

### 最终结论与未验证事项

六项目标行为在本地前端自动化测试中通过。状态隔离、A 恢复、B 停轮询及用户切换防污染首次即通过；本轮实际生产修改仅统一两处提示。完整前端测试从 19 项增至 23 项，lint、typecheck 和 build 全部通过。

本案例的 HTTP 500 是可复现的 fetch 桩，经过真实 api 封装处理；未在真实浏览器和运行中的 Java 服务之间注入 HTTP 500，也未执行远端 GitHub Actions。Java 与数据库实现没有修改，本轮未重跑后端测试；既有 15 单元与 12 MySQL 集成结果属于上轮验证。人工审查、本人贡献与有效工时仍待本人确认。

## 独立审查角色：新增回归推翻部分既有绿灯 / 2026-11-02

原始需求：读取 EXAM_SPEC 的 R-01～R-14，不信任未经验证的 README，区分源码与实际运行；先报告问题，再最小修复并复验。AI 获得的上下文为 df5c3ed 基线、原题、全部业务/前端源码、测试、容器/CI、既有日志。提示词摘要为“重新建立验收证据，重点检查 Java 后台、MySQL 真实来源、阶段失败和终态、前端隔离；保留失败断言、原题和真实输出”。

首先执行实际容器基线：frontend-test 的 23 项/lint/typecheck/build、backend-test 的 15 单元+12 MySQL 集成通过。审查发现详情直接请求与 feed 重叠、局部错误没有用户范围、成功快照与查询错误合并不完整。新增 4 项测试、加强 1 项请求数量断言，定向首次 11 通过/5 失败（exit 1）。向用户报告五项问题，并先写入 REVIEW.md 的修复前报告；没有为了制造 bug 改动旧实现。

AI 只修改两个生产文件：frontend/src/lib/task-feed.ts（成功快照清理查询错误、拒绝较新快照之后的旧查询错误）、frontend/src/components/task-pages.tsx（加载错误绑定身份/任务、已有快照复用 feed、恢复不重复请求）。测试修改 frontend/src/lib/task-feed.test.ts、frontend/src/components/task-sync.test.tsx；文档/原始证据及独立后台检查脚本见 REVIEW.md 和 evidence/audit-*。未修改 Java、SQL、依赖、CI 或原题，未删断言。

定向复验 16/16（exit 0）；最终容器执行 npm run test -- --run --reporter=verbose 后接 lint/typecheck/build，27/27 且全部检查成功。docker compose config、up --build --wait 和容器内 scripts/smoke.mjs 均成功。独立 Node 客户端 POST 65ms 返回 QUEUED，然后等待检查闸门、不查询任务；直接 SQL 已见三阶段 SUCCEEDED、version=7，随后放行首次 GET，再查 version 仍为 7。另用 tmpfs 新 MySQL 容器验证 entrypoint 自动初始化六表、两用户、六模板。实际命令、根因、复现步骤和输出见 REVIEW.md 与四份 audit 控制台文件；只规范日志尾空白，保留首次五项失败。

人工需要审查：是否认可详情页只在缺少快照时独立加载、成功新快照清除查询错误、旧错误按发起版本拒绝的规则；是否确认用户/任务范围足够隔离；是否接受没有真实浏览器新截图和远端 CI 结果的边界。这里没有声称人工审查已进行。

结论：既有 50 项绿灯没有覆盖五个边界，审查增加到本轮 54 项并修复对应问题。当前行为的可验证证据增强，但不能据此追认 M0～M4 中每条历史失败叙事。真实浏览器刷新/小屏/焦点、真实网络 500 注入、远端 Actions、部署回滚未在本轮验证；个人有效工时、手写贡献、人工审查仍待本人确认。没有 Computer Use、远端推送或公网发布。

## R-12～R-14 GitHub 交付复核 / 2026-11-03

用户要求再次审核不足、确认 AI 工作流，并发布到 GitHub；在目标缺失时补充确认了公开仓库 MarcusDog/FrameForge。上下文为本地 e70c44a、交付条款、现有源码/证据/CI、已登录账户。提示词摘要为“如实复核材料，新增工程交付部分，明确验收 commit；发布并检查真实 CI，不能用本地通过代替远端结果”。

AI 新增 README 验收入口和 SUBMISSION.md，更新素材发布范围；CI 保存前端 XML、Java 测试报告、Compose 日志与 smoke 输出，加入超时，并用一次 Maven profile verify 运行全部后端测试，避免重复单元检查。业务代码、原题和测试断言未改动。

实际在现有 Docker 环境执行前端完整检查（含新 JUnit 输出参数）及后端真实 MySQL 集成，54 项测试、lint/typecheck/build 全部通过。GitHub 连接器用于账户/仓库只读核查；其当前工具不提供新建仓库及本地 Git 推送，改用已登录 GitHub CLI 创建公开仓库并准备发布快照。没有安装新运行时或使用 Computer Use；数据和构建仍使用 D 盘已有 Docker 存储。

环境/工具错误如实区分：首次 Docker 查询因引擎未运行失败，隐藏启动现有 Docker Desktop 后恢复；Git 默认转义中文文件名导致一次只读文件尺寸枚举报错，改用 core.quotePath=false 正确读取。它们不是工程测试失败。远端发布和 CI 的实际结果将在完成后记录于 SUBMISSION.md，人工贡献与工时仍待本人确认。

实际发布：公开工程快照 6d3e27f 推送成功，原始设计/题目目录未进入发布树，完整本地历史保留。Git diff 验证公开业务代码与本地 e70c44a 基线一致；没有借发布过程改动业务行为。重新执行 Compose 构建启动与容器 HTTP smoke 均成功，输出见 github-runtime-console.txt。

首次远端 run 41603794341 返回 failure，三个任务没有任何执行步骤，annotations 明确为账户计费锁定。gh run view --log-failed 返回 log not found，与任务未启动相符；改读 check-run annotations 获取真实原因，并保存 JSON，没有凭空补出构建错误。当前不存在可供下载的远端测试 artifact。没有为了绿灯修改触发器或删检查；剩余动作是账户所有者解除锁定后重跑。R-12 配置和本地等价检查已交付，远端执行仍受外部条件阻挡。

## 用户试用反馈：更大字号、个人中心、批量制作 / 2026-11-04

上下文：用户试用中的文字过小/解释过多反馈，R-03/R-08/R-10、原始个人界面参考图、现有 Cookie/TaskFeed/上传实现，以及“多个图片同时进行”的补充。AI 通过简短选择题确认用户要“多张图片批量制作，分别生成结果”。提示词摘要为“精简说明、放大字体，补全真实个人记录和账户切换；一次选多张分别创建任务；模板与结果不能只是同一版式换标题；保留异步隔离与双端校验”。

AI 实现个人中心与 MySQL 统计接口，扩展现有 UploadForm 的批量分组/上传并发/每组提交键/失败重试，新增两 worker 配置，给任务卡片使用各自上传缩略图。模板增至 12 种真实 Java2D 排版，封面也调用生产渲染器。原有 TaskFeed 业务规则继续使用，仅把个人中心加入相关页面追踪；没有新增大型依赖、假登录/邮箱或装饰性账户按钮。

本轮没有冒称全程测试先行：实现后补行为测试并实际执行。首次检查发现 cleanup ref 警告、snapshot 空值类型问题、封面工具 FileStore 同名导入错误；修复并复验。随后前端 32/33，失败为“207”在全部/完成字段同时出现的定位歧义；限定统计字段后保留断言、33/33。最后增加 A/B 素材缩略图隔离断言，再次完整 lint/typecheck/test/build 成功。所有实际失败与复验输出保存在 evidence/ui-update-console.txt，详见 UI_UPDATE.md。

真实验证：后端 17 单元+13 MySQL 集成通过；前端 33；封面生成 12；主数据库只 upsert 模板而不删记录，更新前未完成任务数为 0。部署新版后 HTTP smoke 成功，batch-smoke 记录两 RUNNING/一 QUEUED，最终成功/失败/成功，两个成功任务同图异模板 PNG 内容不同、个人统计增量正确。人工浏览器外观/焦点/手机、真实故障注入及有效工时仍待本人确认；不使用 Computer Use，不把旧云端状态写成本轮通过。

## 新版 GitHub 与文档同步 / 2026-11-04

用户明确要求把本轮功能更新至 GitHub 和 README。AI 使用已验证的 da3b2c6、当前工作流及旧发布记录作为上下文，统一 README/DELIVERY/PLAN/REQUIREMENTS 的当前模板数、并发数、63 项统计和旧证据日期；历史日志不改写为本轮结果。CI 增加现有 batch-smoke 的容器执行与结果 artifact，检查新批量功能。

本次没有改业务实现或测试断言，也没有重复执行已有的 63 项检查来制造新记录。实际执行文档链接检查、git diff --check、Compose config 和源码差异核对后，再导出不含原始附件/缓存的 GitHub 快照。发布 SHA、源码一致性与实际 CI 结果以 SUBMISSION.md 和新的原始 API 记录为准；没有把待推送或待运行提前写为成功。

实际完成：代码快照 c893712 发布成功，Git 核对 backend/frontend/database/compose/scripts/.env.example 与本地 da3b2c6 完全一致；包括新界面、12 张封面和批量脚本。Actions run 41765366854 三任务均未启动，annotations 仍明确为账户计费锁定。保存新版 CI JSON 与源码映射，README/SUBMISSION 标明准确验收 SHA；未假称远端测试通过。

## 真实案例：持久化个人资料与并发保存 / 2026-11-04

**原始需求**：用户要求个人账户增加头像、昵称等个人中心内容，并围绕高分完善功能。AI 回读完整 EXAM_SPEC，确认头像是 R-10 增强，原题核心仍为 Java 异步和前端多任务。没有擅自把生产认证、会员、积分写成必做。

**提供的上下文与提示词摘要**：原题 R-10/R-08/R-12、现有 Demo Cookie/StoreMapper/AssetService/FileStore、Providers/TaskFeed/Account、现有数据库/Compose/测试、用户要求不使用 Computer Use 且缓存位于 D 盘。摘要为“提供可保存的头像、昵称与简介；沿用已有素材校验与用户归属；保存资料不能重启任务追踪；取消旧请求并拒绝跨用户旧响应；避免多页面静默覆盖；真实验证、记录失败并同步 README/GitHub”。

**AI 修改文件**：新增 database/003-user-profiles.sql、backend/.../ProfileService.java、frontend/src/components/avatar.tsx、profile-editor.tsx、scripts/profile-smoke.mjs、PROFILE_UPDATE/SCORECARD 文档。修改 Models、StoreMapper、ApiController、TaskFlowIT、frontend 的 types/providers/account/shell/globals.css/account.test、CI 及相关交付文档。profile 与稳定 DemoUser 分开，避免昵称保存替换 user 对象导致 TaskFeed 清理/重启；SQL 条件版本更新提供冲突 409，头像只能引用当前用户已有素材。表迁移为增量，INSERT IGNORE 不覆盖昵称。

**实际顺序与结果**：本案例先实现再补行为测试，不冒称 TDD。首次容器前端检查退出 1：react-hooks/set-state-in-effect 指出 effect 同步 setProfile 不合适，后续测试并未执行。AI 将首次 loading 从缺少当前用户快照推导，重载 loading 移到点击事件，保留规则；复验 lint、typecheck、39 测试、build 全部通过。后续微调顶栏昵称与成功提示后再次完整通过。首次实际运行新增测试即通过，没有人为制造业务缺陷、删除断言或把 lint 失败写成测试失败。

后端 docker compose --profile test run --rm --build backend-test 成功：17 单元 +16 真实 MySQL 集成，包含昵称/头像持久化、旧版本冲突、非法字段、跨用户头像及退出 Cookie。真实 MySQL GET 与直接 SQL 共同验证保存结果。前端新增行为测试覆盖保存/刷新、保存不重启追踪、非法头像/上传禁用、冲突保留草稿、旧用户 GET/PUT 响应被取消忽略、退出清空视图。共 72 项，不重复计算镜像构建中重跑的单元测试。

**运行验证**：现有库更新前 0 个活跃任务、27 个任务和17个素材。UTF-8 导入 003，无删除；构建并启动三服务 healthy。容器执行 profile-smoke，中文资料/真实头像读回、409、越权404、退出401和历史保留均通过，恢复原 Bob 资料。日志见 evidence/profile-console.txt，完整命令/结果见 PROFILE_UPDATE.md / VERIFICATION.md。演示会增加测试记录和素材，不伪称数据库毫无变化。

**人工需要审查**：当前小屏/键盘焦点、头像显示裁剪与失败回退、双标签页冲突交互、资料是否符合个人展示偏好；本人实际投入和贡献。均为待人工确认，未虚构人工操作或“人工审核通过”。

**结论与未验证事项**：资料闭环、归属、并发版本和异步隔离已由组件/真实 MySQL/HTTP 分层验证；没有真实浏览器外观验收、生产身份认证、头像裁剪器、孤立文件回收或公网部署。GitHub 发布与对应云端任务的实际状态另记 SUBMISSION，不能用本地通过代替远端。高分建议按原题重点写入 SCORECARD，不保证招聘结果。

实际发布回执：01e5347 推送成功，与本地2180ec3业务/测试/配置一致，核对远端关键文件blob。Actions run41778534619三任务均在步骤开始前因账户计费锁定失败，完整API记录已保存；未声称云端通过。最终diff另修复移除头像后旧成功提示，新增断言、完整前端39项/检查复验通过；没有虚构独立人工审查。

## 真实案例：从浏览器失败到注册与批量闭环 / 2026-11-04

原始需求：用户明确要求创建账户/注册/登录，先解决当前手机尺寸与键盘焦点、真实浏览器网络异常/多任务/刷新演示；随后用截图指出创作动态拉长页面、左侧大片空白。上下文包括EXAM_SPEC、原6表与资料表、Cookie归属、Providers/TaskFeed/Studio/ResultPreview、已有组件/集成测试、D盘资源约束和不用Computer Use。提示词摘要：“先真实浏览器验收，保留失败证据并最小修复；新增真实用户名密码账户与MySQL会话，保留但限制Demo入口；缩短创作动态，验证新用户界面批量制作和登录恢复；同步文档与GitHub”。

AI先编写容器Chromium脚本，在旧运行版本得到两个真实失败：Tab离开预览弹窗、简介焦点1px而非3px。A/B HTTP500隔离与刷新/用户切换、手机宽度本身通过。AI给弹窗添加可读名称和键盘边界循环，补textarea焦点；保留原断言。首轮失败JSON/截图保存在before-auth目录，未覆盖。

注册增强由AI新增004、AuthMapper/AuthService、AuthForm及路由、账户集成/前端测试，修改ApiController/Providers/Shell与配置。注册事务创建资料及凭据；PBKDF2与随机会话复用Java原生能力；失败次数需落库，所以登录ApiException不回滚，注册重复则正常回滚。演示接口限制Alice/Bob，不能猜ID切进注册用户。所有人工贡献/工时仍待本人确认。

首次前端检查因新测试误用exact选项导致类型错误，后续测试未执行。移除无效参数而不删断言，43前端+17单元+20MySQL通过。真实浏览器注册已通过，接着界面批量提交暴露crypto.randomUUID在HTTP服务主机名不可用。AI定位为安全上下文差异，新增getRandomValues提交键函数及无randomUUID环境测试；没有伪装HTTPS或吞错。完整前端44项、lint/typecheck/build与后端17+20复验通过，共81项；首次新增账户MySQL测试即通过，无人为制造bug。

最终Chromium156/Playwright1.64.1在D盘Docker运行两套脚本：核心异步/焦点/手机检查PASS；375px键盘注册、自动登录/刷新、真实三图批量2运行1排队/3独立成功结果、退出401/错误密码/重新登录历史PASS，pageErrors均为空。动态/制作面板从1753/1215px调整为723/774px，AI读取截图验证，未冒称人工审查。实际命令、失败、复验见ACCOUNTS_QA及account-console原始归档，截图/JSON分阶段保留。

最后审阅确认旧Demo版本的回滚存在新账户归属风险，在README明确须保留演示ID限制或恢复配套备份；没有执行破坏性迁移或生产回滚。尚未验收实体手机/iOS、屏幕阅读器、软键盘、生产认证完整性；没有邮箱验证/找回密码/MFA、孤立素材回收。GitHub提交和新run实际状态另记SUBMISSION，不把本地通过冒称云端通过。

发布实际完成：公开49239ac与本地1993dcc完整业务/配置一致，远端关键源码和最终浏览器报告blob核对通过。run41782261196三个任务steps为空，annotations仍为账户计费锁定；保存完整API回执，不虚构云端日志/artifacts。新tmpfs空MySQL自动初始化九表、两用户/资料、十二模板通过，之后移除一次性容器；主数据卷和现有记录保留。最终Git diff已审阅，文档链接与空白检查通过；不把AI审阅称为人工审阅。
