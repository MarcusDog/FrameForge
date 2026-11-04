# 实际验证记录

记录日期按 Asia/Shanghai。只有执行过的命令才写入结果；CI 配置存在不代表远端已运行。

## 最新个人中心资料增强 / 2026-11-04

本轮命令明细、原始失败与复验见 [PROFILE_UPDATE.md](PROFILE_UPDATE.md) 和 [profile-console.txt](evidence/profile-console.txt)。39 前端 +17 Java 单元 +16 真实 MySQL 集成共 72 项通过；全部 lint/typecheck/build 通过。首次失败为 effect 内同步更新状态触发 lint，后续测试没有执行；最小修复后才通过，未关闭检查。新增行为测试第一次实际运行均通过。单元日志中的模拟 IOException/ERROR 属于主动失败注入，JUnit 失败/错误/跳过均为 0。

Docker 三服务更新并健康；UTF-8 增量导入 003 不删数据；旧库 27 任务/17素材变为运行脚本后的32/21。profile-smoke 最后恢复原 Bob 资料，版本正常递增。重复执行 003，资料与任务/素材数量前后相同。最终 Node 容器顺序执行 smoke、batch-smoke、profile-smoke 返回 PASS；两条并行运行、一条排队，失败仅影响指定任务。Compose config 退出 0。

当前真实浏览器小屏、焦点、头像交互与双标签页操作未验证；不使用 Computer Use。GitHub 本地发布映射和实际云端结果见 SUBMISSION，不能用本地 72 项通过替代远端。人工贡献/工时待本人确认。

最终 diff 检查发现 Docker 原始输出带行尾空格；仅对提交版日志规范换行并去除行尾空白，命令/错误/结果不变，.runtime 保留原件。源码审阅同时补齐“移除头像后清除旧成功提示”，保留原断言并追加交互断言，再执行完整前端四项检查：退出0、39/39；重新构建前端并启动三服务 healthy。六份主要交付文档本地链接无缺失，规范日志后 git diff --cached --check 退出0。

## M0 / 2026-11-02

| 命令或检查 | 实际结果 |
|---|---|
| 读取题目要求.txt，列举目录 | 完整 R-01～R-14；仅原题和设计，无工程 |
| git status --short（初始化前） | 失败：不是 Git 仓库，符合初始环境 |
| git init | 成功：初始化本地仓库 |
| java -version（初始环境） | Java 17.0.18，不用于本项目最终运行 |
| node --version / npm --version | v24.11.1 / 11.6.0 |
| docker version（计划阶段） | 客户端可用，引擎管道不存在；容器运行当时未验证 |

项目测试、构建、Compose 和浏览器验证待实际执行。

## M1 / 2026-11-02

- Docker Desktop 启动成功，Docker server 29.9.2 可用。
- Maven Wrapper 初次命令失败：PowerShell 将未加引号的 -Dmaven=3.9.14 拆分成参数与 .9.14 生命周期。修正为带引号参数，生成 Maven 3.9.14 Wrapper。
- 首次 verify 失败：参数化测试验证会抛 IOException 的 publish 方法，测试方法未声明异常。只为该测试补充 throws Exception，未删除断言。
- 在 maven:3.9.14-eclipse-temurin-21 容器执行 ./mvnw -B -ntp verify：BUILD SUCCESS；14 tests，0 failures，0 errors，0 skipped；生成可运行 JAR。
- 真实 MySQL 集成和 HTTP 演示尚待 M3，不将单元测试视为集成通过。

## M2 / 2026-11-02

- npm install 在 Node 24.11.1 容器成功，生成 package-lock.json。
- 初次 lint 因 3 项 Hook 警告失败：未使用的身份依赖和 cleanup 读取可变 ref。让 feed 明确持有 ownerKey，cleanup 捕获容器数组，保持警告零容忍。
- 初次 typecheck 因 Vitest Mock 擦除泛型 Transport 返回类型而失败。将网络解析边界明确为 Promise<unknown>，在 request<T> 单点收窄，未关闭严格类型。
- 修复后容器内 npm run lint、npm run typecheck、npm run test -- --run、npm run build 全通过；10 tests / 2 files；Next.js 16.4.3 构建六条页面路由。
- Java2D 封面生成命令在 Java 21 容器成功；六张封面和六张样例图片已随工程保存。

## M3 / 2026-11-02

- docker compose config --quiet 成功；独立 mysql-test 服务启动成功。
- Java 21 容器联网真实 MySQL 8.4.8，执行 ./mvnw -B -ntp -Pmysql-it verify：BUILD SUCCESS，14 unit + 9 integration tests，0 failed / 0 errors / 0 skipped。
- 集成测试实际覆盖：三步时间线与 PNG、三个阶段失败、受理提前返回、队列拒绝落库、事务回滚不调度、并发幂等与冲突、素材/任务/结果/历史隔离、非法素材。

## M4：容器与边界复查 / 2026-11-02

- Docker 数据实际已位于 D:/Docker/dockerdata/DockerDesktopWSL（设置 CustomWslDistroDir 与实际 VHDX 均核对）；项目和 QA 临时目录在 D 盘。迁移由环境后续操作完成，本记录不将它虚构为 AI 已操作完成。确认时 C 盘可用 16.95 GB，D 盘 27.74 GB。
- docker compose up --build -d --wait --wait-timeout 180 成功；frontend/backend/mysql 三服务均 healthy。
- 无界面截图发现 MySQL 模板中文乱码。原始 SQL 为 UTF-8，数据库 title 的 HEX 已是二次编码；修复 SQL 为显式 SET NAMES utf8mb4 与 utf8mb4 表字符集，重新应用六条固定演示模板（保留任务和素材），并给 smoke 增加准确中文标题/分类断言。修复后 HTTP smoke PASS。
- 身份初始化改为等待所有请求，增加 epoch、取消请求和同步切换锁。docker compose --profile test run --build --rm frontend-test：lint、typecheck、12 tests、Next production build 全成功。
- 后端增强只允许结果整理阶段公布结果；新增重启清算与 UTF-8/分页集成场景。第一次新增测试编译失败：ApplicationRunner.run 需要 ApplicationArguments；改为传入空 DefaultApplicationArguments，保留断言复验。
- 可选脚本 scripts/browser-check.cjs 复用已有 Playwright Core 与 Edge 156，无界面执行，不操作桌面。TEMP/TMP 指向 D 盘 .runtime/temp。首次 CLI 截图完成后 Edge 后台工具进程未退出，只终止本工程 QA profile 的进程，改用可明确终止的 browser server。
- 首次浏览器流程的最终错误页检查命中两个 alert（Next route announcer 及业务提示），修正为业务空状态的 alert 定位；不降低错误页断言。最终脚本 PASS，七组检查、0 page errors；实际 JSON 与五张截图在 output/playwright。
- 最终 HTTP smoke PASS：UTF-8 seed、6 模板与本地封面、同源 Cookie、上传、多任务、三阶段、失败中断、PNG、历史恢复、用户隔离。

- 最终 docker compose --profile test run --build --rm backend-test：BUILD SUCCESS；15 unit + 11 integration，0 failures / errors / skipped（总耗时约 6 分 45 秒，包含测试容器首次下载依赖）。
- 浏览器最终结果时间 2026-11-02T12:34:57Z（北京时间 20:34:57），Edge 156.0.4314.58，七组检查 PASS，0 page errors；具体任务 ID 见输出 JSON。

- 辅助 SQL 首次 SHOW VARIABLES LIKE 十六进制模式写法被 MySQL 拒绝，后续直接读取 HEX(title) 定位编码；未视作检查通过。辅助导入检查首次在临时测试库建表前执行，提示表不存在；集成初始化后重跑成功。显式以 latin1 客户端导入带 SET NAMES 的种子，旅行明信片的 HEX 为 E69785E8A18CE6988EE4BFA1E78987，验证 UTF-8 不依赖客户端默认字符集。
- 测试结束已停止仅用于验收的 mysql-test 服务；三个演示服务保持健康。
- 最终源代码审查为 AI 执行，人工审查仍待本人确认。无远端推送或发布。

## 交付后深查：请求与协议边界 / 2026-11-02

本轮从已提交 fdd37a6 的干净工作区开始，仍保持原题范围。

### 先复现，再修复

- 实际访问 DELETE /api/templates、text/plain POST /api/tasks、GET /api/not-an-api：旧版本均返回 500 / INTERNAL_ERROR。根因是通用异常处理捕获 Spring 的客户端错误后统一改写为 500。
- 新增页面生命周期回归：旧实现首页仍发起两次任务读取，离开任务页后旧请求没有被中止，两个用例失败。根因是 Provider 位于根布局，追踪效果没有绑定相关页面。
- 新增 API 超时回归：旧版本请求及 JSON 响应体长时间不返回时，超时用例失败。初版测试未给旧 fetch 的缺省 signal 建立替代信号，先修正测试夹具，再确认三个用例因 signal 未超时取消而失败；不将夹具异常当作产品证据。

### 最小修复与验证

- GET 查询/身份/配置 15 秒请求期限；POST 上传/提交 60 秒。期限覆盖读取 JSON，保留调用方取消，结束清理定时器和监听。超时只产生请求错误，绝不改写任务业务状态。
- 只有模板详情、任务和历史页面自动追踪；离开到模板广场取消请求与定时器，返回后从 Java 恢复。
- Spring 4xx 异常保留原 HTTP 状态、Allow 等头和统一安全消息；未知异常仍记录日志并返回 500。
- 新增挂起 A 查询超时、B 仍完成的联动测试；新增 404/405/415 的真实 HTTP/MySQL 集成断言。
- docker compose --profile test run --build --rm frontend-test：lint、typecheck、19 tests / 4 files、生产 build 全通过。
- docker compose --profile test run --build --rm backend-test：15 unit + 12 integration，0 failures / errors / skipped，BUILD SUCCESS。
- 测试容器新增 D 盘 Docker maven-cache 卷，并以已有本工程 Maven 缓存预热；本次容器内 verify 约 16 秒，避免每次销毁测试容器后丢失依赖缓存。
- 创建预热容器的辅助命令首次使用 create --no-deps，被当前 Compose 拒绝；改为受支持的 create backend-test，未影响应用容器。

- 最终 docker compose up --build -d --wait --wait-timeout 180 成功，三个应用服务 healthy；容器 HTTP smoke PASS，新增客户端 HTTP 状态断言。
- 无界面 Edge 检查于 2026-11-02T12:57:19Z（北京时间 20:57:19）PASS，共 8 组、0 page errors；本次用客户端导航保留根布局，验证后台任务运行时回到广场不再查询、返回历史恢复。证据已更新至 output/playwright。
- 本轮总测试数 46（19 前端 + 15 Java 单元 + 12 MySQL 集成），未跳过测试。原题、用户素材与历史保留；远端 Actions、公网部署及真人实机仍未验证。

## R-07 / R-08 / R-12 专项案例 / 2026-11-02

- 审查基线：6daffa7，工作区初始干净。新用例使用两个 RUNNING 任务，fetch 返回实际 Response status=500，经过真实 api 封装和 TaskFeed；组件用例复用真实 Provider。
- 首次定向测试：exit 1，12 用例中 10 通过、2 失败。状态逻辑与切换用户首次通过，仅两个指定提示文案断言失败。
- 生产修改：仅 task-card.tsx、task-pages.tsx 各一行文案，不改变业务状态算法。
- 定向复验：exit 0，12/12；完整前端回归：exit 0，23/23（5 files）。
- 依次执行 npm run lint、npm run typecheck、npm run build，均通过；全部在已有 Node 24.11.1 容器内执行。
- 原始首次失败、复验、完整回归、检查输出见 docs/evidence/r07-r08-console.txt；完整提示词摘要、人工待审关键点和验证边界见 AI_WORKFLOW.md 专项案例。
- 本轮未修改 Java、数据库、依赖或 CI 配置；后端测试不重复运行。当前累计 50 个已验证用例，其中本轮重跑前端 23，后端 27 沿用上轮记录。远端 CI 与真实链路 HTTP 500 故障注入未验证。

- 已用 docker compose up --build -d --no-deps --wait --wait-timeout 120 frontend 同步运行中文案，exit 0，前端 healthy；未重建后端和数据库。最终 git diff 的生产部分仅两行文案，git diff --check 通过。

## 独立验收 / 2026-11-02 / 基线 df5c3ed

- 基线实际执行 docker compose --profile test run --build --rm frontend-test：exit 0，23 tests/lint/typecheck/build；backend-test 同等命令：exit 0，15 单元+12 真实 MySQL 集成，0 failures/errors/skipped。输出见 evidence/audit-baseline-console.txt。
- 新增 4 项回归并加强 1 项请求计数断言，首次定向 exit 1：16 项中 11 通过、5 失败。先报告并写入 REVIEW.md，再只修改 TaskFeed 与 TaskDetail 两个实现文件。
- 定向同命令复验 exit 0：16/16。前后完整输出见 evidence/audit-regressions-console.txt，未删除断言。
- 最终 Node 容器执行 npm run test -- --run --reporter=verbose && npm run lint && npm run typecheck && npm run build：exit 0，27 tests/5 files，所有检查成功。输出见 evidence/audit-final-console.txt。
- docker compose config --quiet、docker compose up --build -d --wait --wait-timeout 180：exit 0，三服务 healthy；容器 HTTP smoke：exit 0/PASS，真实成功与失败 taskId 均留在日志。
- 独立审查客户端 65ms 受理后未查询任务，先用 MySQL 直接读到三个阶段成功/version=7，再放行首次任务 GET；GET 后 SQL version 仍为 7。六条 Java worker 开始/结束日志与阶段记录对应。不是用前端定时切换文案作为后台证据。
- 新建临时 MySQL 8.4.8、tmpfs 数据目录、挂载同一 database 初始化脚本，实际建成六表/Alice/Bob/六中文模板/零任务；测试结束已停止并自动移除，仅演示三服务继续运行。
- 运行容器与最新 backend 构建镜像的 app.jar SHA256 均为 128b42251d20b421ffd38576894c98be21c21852863da46b3ec264840f7e9a3d。题目来源与 EXAM_SPEC SHA256 完全相同。运行/SQL/初始化/环境输出见 evidence/audit-runtime-console.txt。
- 本轮共 54 项测试（27+15+12），均为本轮运行结果；Java 源码未改，修复后不重复执行同一后端检查。远端 CI、当前真实浏览器小屏/刷新/焦点、部署回滚未验证；旧截图不当成本轮运行证据。人工投入/审查待本人确认。完整逐项分级见 REVIEW.md。
- 整理文档时一条补丁因旧行文本与当前 REQUIREMENTS 不匹配而被拒绝，未改动文件；重新读取现有行后应用成功。这是文档编辑失败，不是测试失败，未据此改写验收结果。

## GitHub 交付复核 / 2026-11-03

- Docker 初次不可连接，隐藏启动 D:/Docker/docker 下的现有 Docker Desktop 后恢复；没有安装新运行时。
- docker compose --profile test run --build --rm frontend-test sh -c 'npm run lint && npm run typecheck && npm run test -- --run --reporter=default --reporter=junit --outputFile=reports/vitest.xml && npm run build'：exit 0，27 tests，JUnit XML 参数可用，lint/typecheck/build 通过。
- docker compose --profile test run --build --rm backend-test：exit 0，15 unit+12 MySQL IT，0 failures/errors/skipped，BUILD SUCCESS。原始输出见 evidence/github-preflight-console.txt。
- docker compose config --quiet、docker compose up --build -d --wait --wait-timeout 180：exit 0；容器内 node scripts/smoke.mjs：exit 0/PASS。输出见 evidence/github-runtime-console.txt。
- gh repo create MarcusDog/FrameForge --public 成功；git push origin refs/heads/github/main:refs/heads/main 成功，公开快照为 6d3e27f9d923dbcc3b50574cef23e1d9bccc6efd。本地开发历史/原始附件未公开，源代码一致性记录见 github-source-provenance.json。
- gh run view 首次 push run 41603794341：failure，三个 job 无 steps；读取失败日志返回 log not found；check-run annotations 均明确“account is locked due to a billing issue”。原始 API JSON 已保存，artifact total_count=0。远端未运行测试，不能以本地 54 通过替代。
- 本轮变动为交付文档、CI 报告/超时/去重配置和报告忽略规则；未改业务代码和测试断言，未使用 Computer Use 或在宿主机运行工程构建/测试/业务脚本。个人实际投入与人工审查待本人确认。

## 个人中心、批量制作与版式 / 2026-11-04

- 运行环境复核：项目源码与此前验收一致后，复用 D 盘现有镜像启动，未安装新运行时。随后按用户新增试用反馈开发本轮功能。
- 后端 docker compose --profile test run --build --rm backend-test：exit 0，17 单元+13 MySQL 集成，0 failures/errors/skipped；12 版式输入图可见性/结果差异、两 worker 和用户统计隔离新增验证。
- Node 容器依次 npm run lint / typecheck / test -- --run / build：第一次 lint exit 1；修复后类型检查 exit 2；再修复后首次完整测试 exit 1（32 passed/1 locator failure）。最后完整复验 exit 0，33/33，所有检查通过。增加素材缩略图断言后再执行一轮同等检查和 build，仍 exit 0。
- 封面工具第一次 javac exit 1（FileStore 同名），改为精确导入后 exit 0，Generated 12 covers；读取生成的胶片与拱形双图作本地图片核对。
- docker compose build backend frontend 与 up --no-build --wait：exit 0；UTF-8 执行新版种子，模板 12/版式 12，原有任务、素材、历史保留；更新前未完成数为 0。最后更新任务缩略图再重建前端并 healthy。
- 容器 HTTP smoke exit 0/PASS。batch-smoke exit 0/PASS：三条 taskId 独立，初始两 RUNNING 一 QUEUED，最终 SUCCEEDED/FAILED/SUCCEEDED；失败阶段后跳过，同图异模板结果 hash 不同，个人统计增量正确。
- 当前共 63 项测试（33+17+13），不把 Docker build 内重复运行的单元测试另计。实际命令、失败原因、演示路径与边界见 UI_UPDATE.md；原始输出见 evidence/ui-update-console.txt。
- 未进行当前真实浏览器/手机自动化、未重跑云端 CI；未使用 Computer Use。用户个人审查、贡献和工时待确认。

## 新版 GitHub 与交付文档同步 / 2026-11-04

- 业务源码相对 da3b2c6 未变；本轮只统一文档与 CI 的批量 smoke 执行/结果保存。原有 63 项结果保留实际执行日期，没有重复计算或虚构新运行。
- git diff --check、文档本地链接、docker compose config --quiet 均通过。
- git push origin refs/heads/github/main:refs/heads/main 成功，公开代码快照 c89371247b44d3236b1d3c2510da87979878cab3；原始附件/缓存未入公开树。
- git diff --exit-code da3b2c6 github/main -- backend frontend database compose.yaml scripts .env.example 为 0；新映射见 evidence/github-ui-provenance-2026-11-04.json。
- 本次 run 41765366854 已触发，三个任务 steps 为空，GitHub 仍返回账户计费锁定。实际 API 结果见 evidence/github-ui-run-2026-11-04.json；不得把本地通过写成远端通过。
