# FrameForge · 素材创作工作台

选择模板、上传照片、提交后台制作，然后继续浏览。Java 按 **素材检查 → 模拟生成 → 结果整理** 执行，MySQL 保存任务和真实时间线，Java2D 将本次上传的照片拼成可预览 PNG。无真实 AI 调用。

当前版本：可保存头像/昵称/简介的个人中心、批量独立任务、两条并行制作和 12 种版式。最近本地验证为 **72 项测试通过**；代码验收提交 [01e5347](https://github.com/MarcusDog/FrameForge/commit/01e5347b6b0c19b481440202ad7fdf99951fb336)，远端 CI 真实状态见 [交付清单](docs/SUBMISSION.md)。个人中心证据见 [PROFILE_UPDATE.md](docs/PROFILE_UPDATE.md)，后续完善优先级见 [SCORECARD.md](docs/SCORECARD.md)。

## 快速启动

需要 Docker Desktop（Linux containers）和 Docker Compose。首次构建需联网下载官方镜像、npm/Maven 依赖；启动后素材与业务无需外部服务。

在工程根目录运行：

~~~sh
docker compose up --build -d
docker compose ps
~~~

打开 http://localhost:3000 。后端健康检查：http://localhost:8080/actuator/health 。默认仅绑定本机回环地址，数据库不向宿主机发布端口。

## 工程与交付验收入口（R-12～R-14）

公开仓库：[MarcusDog/FrameForge](https://github.com/MarcusDog/FrameForge)。交付检查与不足清单见 [SUBMISSION.md](docs/SUBMISSION.md)，AI 使用说明与真实案例见 [AI_WORKFLOW.md](docs/AI_WORKFLOW.md)。

| 要求 | 交付位置与核验方法 |
|---|---|
| R-12 CI 与关键测试 | [.github/workflows/ci.yml](.github/workflows/ci.yml) 在 push/PR 运行前端 lint、类型检查、39 项测试和 build；Java 一次 Maven verify 运行 17 单元+16 MySQL 集成并构建。Compose 再验证完整 HTTP 闭环、批量并行/失败隔离与个人资料。报告和 Compose 日志作为 Actions artifacts 保存，远端状态以对应 run 为准 |
| R-13 完整材料与 AI 工作流 | 前后端源码、npm 锁文件、Maven Wrapper/BOM、七表 SQL/种子与增量迁移、示例配置、素材、README 均包含。下文给出连接/API/演示/限制/回滚；AI_WORKFLOW 记录上下文、生成修改、真实失败与复验；个人实际投入与人工审查待本人确认 |
| R-14 容器交付 | 根目录 docker compose up --build 启动前端、Java、MySQL，初始化表与种子；数据卷保留数据库和媒体。评估者无需在宿主机直接运行工程脚本 |

历史本地代码验收基线（2026-11-02）：e70c44a9d06fc380fa55ea4c4d06730abcc672e6。GitHub 发布快照与最终验收提交见 SUBMISSION.md；原始题目/设计附件保留本地，公开仓库包含必要的题目归档与工程，不上传依赖、构建缓存和用户上传文件。

可直接使用默认演示配置；需要修改端口或参数时，将 .env.example 复制为 .env 后编辑。配置中均为本地示例密码，不含真实凭据。

停止但保留数据库、素材和结果：

~~~sh
docker compose down
~~~

## 技术版本与结构

| 项目 | 固定版本 |
|---|---|
| Java 构建/运行 | 21（运行镜像 Temurin 21.0.10+7） |
| Spring Boot | 3.5.16 |
| MyBatis Spring Boot Starter | 3.0.5 |
| MySQL | 8.4.8 |
| Maven / Wrapper 插件 | 3.9.14 / 3.3.4 |
| Node.js | 24.11.1 |
| Next.js / React | 16.4.3 / 19.3.1 |
| TypeScript | 5.9.3 |
| Vitest / React Testing Library | 4.0.18 / 16.3.0 |
| Java 测试 | Boot BOM 管理的 JUnit 5、Mockito |
| 样式与状态 | 原生 CSS、fetch、Hooks、Context |

npm 直接依赖使用精确版本，完整依赖树及完整性值见 frontend/package-lock.json。Java 由固定 Boot BOM、MyBatis 版本与 Maven Wrapper 管理，实际测试报告含解析版本。Dockerfile 与 Compose 固定镜像补丁标签。

~~~text
frontend/              Next App Router、页面、上传与 TaskFeed、行为测试
backend/               Spring Boot、Service、MyBatis Mapper、JUnit/MySQL 集成测试
database/              六张业务表、个人资料增量表与 Alice/Bob、十二模板种子
docs/                  原题、验收矩阵、技术选择、实际 AI 工作流与验证
scripts/               HTTP 验收、Java2D 本地封面生成器
.github/workflows/     push / pull_request CI
compose.yaml           默认三服务；test profile 为独立测试服务
~~~

## 连接、初始化与配置

浏览器只请求同源 /api。Next rewrite 转发到 Java；业务、文件处理和 MySQL 写入均在 Java。Compose 内前端使用 http://backend:8080，后端使用 mysql:3306/frameforge。

MySQL 首次创建空数据卷时，依次执行 database/001-schema.sql、002-seed.sql、003-user-profiles.sql。包含用户、模板、素材、任务、任务素材关联、阶段六表和独立的 user_profile 表。已有卷不会重复执行初始化；升级旧版本需在启动新版应用前执行 003 增量迁移，不能依赖重启自动重建。

- mysql-data：MySQL 持久卷。
- media-data：Java /data，保存 uploads 和 results。
- maven-cache：测试容器复用 Maven 依赖，避免每次 --rm 后重新下载。
- 演示摄影和生成封面已在 frontend/public/demo 随源码提供，样例图片可直接选取上传。
- 时间以 UTC 保存及返回，页面按浏览器时区显示。
- 任务和阶段字段在短事务中一致更新，查询事务读取同一快照。

| 配置 | 默认值 | 作用 |
|---|---|---|
| FRONTEND_PORT / BACKEND_PORT | 3000 / 8080 | 宿主机访问端口 |
| DB_PASSWORD | frameforge-demo | 演示数据库应用用户密码 |
| MYSQL_ROOT_PASSWORD | local-root-demo | 首次初始化 root 密码 |
| SIMULATION_ENABLED | true | 启用开发演示控制 |
| TASK_QUEUE_CAPACITY | 20 | 工作线程之外的排队容量 |
| TASK_WORKERS | 2 | 后台同时处理的任务数，支持 1～4；其余任务排队 |
| DB_URL / DB_USER | 见 application.yml | Java 独立开发时的 JDBC 配置 |
| STORAGE_PATH | ./.runtime/storage | 独立开发的文件目录；容器内为 /data |
| JAVA_API_BASE_URL | 本地 localhost:8080；容器 backend:8080 | Next 构建时的 rewrite 目标，修改后需重建前端 |

数据库密码在卷初始化后更改环境变量不会自动修改现有 MySQL 用户密码，需同步更改数据库用户配置。

不使用容器开发时，需要 Java 21、Node 24.11.1 和已初始化的 MySQL：在 backend 执行 sh ./mvnw spring-boot:run（Windows 为 .\mvnw.cmd spring-boot:run）；在 frontend 执行 npm ci、npm run dev。最终验收优先采用下面的容器命令。

## 演示步骤

1. 打开模板广场，选择 **Alice**；切换“创意拼贴 / 生活影集 / 节日海报”，或搜索模板。
2. 进入“旅行明信片”，按两个上传位选择 demo/samples 中不同图片；观察上传状态，尝试替换、移除。缺图、上传中和提交中不能提交。
3. 点击“开始制作”。受理后立即恢复按钮，并出现任务；可以继续提交第二个任务或返回广场。
4. 在右侧动态、“我的任务”或任务详情查看 Java 返回的阶段及真实耗时。完成后点击“预览作品”，可以用 Escape 关闭。
5. 展开“演示控制”，选择“模拟生成”失败，提交新任务：素材检查完成、模拟生成失败、结果整理跳过，失败原因写入 MySQL。
6. 将各阶段延迟调整为例如 2000 / 10000 / 2000 毫秒，连续创建多个任务：第一个处理中，后面的排队。三个阶段都可独立触发失败，行为不依赖随机数。
7. 制作期间刷新、切换页面或关闭页面后重新打开：历史从 Java 恢复，未结束任务继续追踪，已结束任务不再自动查询。
8. 切换 **Bob**：Alice 的素材、任务、结果均不可通过 Bob 身份读取。Bob 可以独立创作；切回 Alice 恢复其历史。
9. 浏览器 Network 中观察：没有活跃任务时没有任务自动查询；查询网络异常保留旧快照并提供“恢复查询”，不会将任务改成业务失败。

上传失败可用不符合类型的文件验证前端反馈；伪装扩展名的损坏图片会被 Java 内容校验拒绝。查询失败可在开发者工具暂时阻断单个任务查询，然后恢复并点“恢复查询”。

模拟参数仅在开关开启时接受；关闭 SIMULATION_ENABLED 后页面隐藏控件，后端拒绝客户端提交的 simulation 覆盖项。

## API 与字段

JSON 成功响应直接返回对象；失败格式：

~~~json
{"code":"INVALID_INPUT","message":"可理解的原因"}
~~~

| 方法与路径 | 请求 | 响应 |
|---|---|---|
| GET /api/demo/users | 无 | [{id,name}] |
| GET /api/demo/session | Cookie | {id,name}；未选用户 401 |
| POST /api/demo/session | {userId:"alice"或"bob"} | 用户；设置 HttpOnly、SameSite=Lax Cookie |
| DELETE /api/demo/session | 无 | {signedOut:true}；过期 Cookie，保留资料和任务 |
| GET /api/me/profile | Cookie | 当前用户 {userId,nickname,bio,avatarColor,avatarAssetId,avatarUrl,version,createdAt,updatedAt} |
| PUT /api/me/profile | {nickname,bio,avatarColor,avatarAssetId,version} | 返回保存后的完整资料；过期版本 409，非本人头像 404 |
| GET /api/config | 无 | {simulationEnabled} |
| GET /api/me/summary | Cookie | 当前用户 {totalTasks,activeTasks,succeededTasks,failedTasks,assetCount}；从 MySQL 全量统计 |
| GET /api/templates | 无 | 模板数组 |
| GET /api/templates/{id} | 模板 ID | 模板详情，不存在 404 |
| POST /api/assets | multipart 的 file | {id,previewUrl,mimeType,sizeBytes,width,height} |
| GET /api/assets/{id}/content | Cookie | JPEG/PNG，校验归属 |
| POST /api/tasks | 下方 JSON | HTTP 202，{taskId,task} |
| GET /api/tasks | before 可选游标；limit 1～50，默认 20 | {items,nextCursor}，按创建顺序倒序 |
| GET /api/tasks?active=true | Cookie | 当前用户全部未结束任务，不截断为第一页历史 |
| GET /api/tasks/{id} | Cookie | 任务及阶段、素材元数据 |
| GET /api/tasks/{id}/result | Cookie | 成功后的 PNG；未成功或无权限 404 |

模板字段：id、title、category、description、coverUrl、layout、requiredImageCount、acceptedMimeTypes、maxFileSizeBytes。

资料昵称去除首尾空白后 1～24 字符，简介最多 160 字符；avatarColor 为六位十六进制颜色，avatarAssetId 为本人上传素材 ID 或 null（移除头像）。先 GET 获取 version，每次成功 PUT 增加版本。409 时显式重新读取，避免旧页面覆盖新资料。createdAt 表示资料记录创建时间，不冒充原账户注册时间。

任务提交示例：

~~~json
{
  "templateId":"pet-portrait",
  "assetIds":["先通过上传接口获得的素材 ID"],
  "requestKey":"每次新制作的 UUID；同一次网络重试复用",
  "simulation":{
    "failAt":"GENERATING",
    "checkMs":1000,
    "generationMs":4000,
    "organizeMs":1000
  }
}
~~~

正常完成时 failAt 为 null，或省略 simulation。默认阶段耗时为 1000 / 4000 / 1000 毫秒，每阶段可设 0～30000。非法阶段、耗时和素材被拒绝。相同用户+requestKey+相同归一化参数返回同一任务；参数冲突返回 409。前端同步提交锁防连点；请求失败后保留提交键。

任务字段：id、templateId、templateTitle、coverUrl、status、currentStage、resultUrl、errorCode、errorMessage、version、createdAt、updatedAt、stages、assets。阶段字段：stage、status、startedAt、endedAt、durationMs、errorMessage。

任务状态为 QUEUED / RUNNING / SUCCEEDED / FAILED。阶段依次为 MATERIAL_CHECK / GENERATING / ORGANIZING，阶段状态为 PENDING / RUNNING / SUCCEEDED / FAILED / SKIPPED。

## 异步正确性与边界

- 提交事务写入任务、素材关联及三个阶段记录，AFTER_COMMIT 监听器向 Spring ThreadPoolTaskExecutor 投递；不会等待制作完成。
- 默认两个工作线程、20 队列。拒绝时通过 REQUIRES_NEW 将已受理任务写为 FAILED / EXECUTOR_SATURATED；客户端仍收到任务 ID。没有 CallerRunsPolicy。
- Worker 每个阶段开始和结束调用独立 Service 的短事务；等待、Java2D 和磁盘操作位于事务外。
- 条件更新、行锁和 version 保证终态不回退、重复调度不重复执行；查询不推进任务。
- 后续阶段在失败后标为 SKIPPED。GENERATING 读取用户图片，ORGANIZING 原子落盘后才公布结果 URL。
- 上传同时限制 MIME、真实图片格式、解码、字节和像素；服务端随机文件名，原文件名不参与路径。单张不超过 5 MiB、单边 8192、总像素不超过 2500 万。
- 前端任务快照与查询错误分开，响应按用户代次和 version 合并；终态停止轮询，失败查询暂停该任务直到手动恢复，其他任务继续。只有模板详情、任务和历史页面自动追踪，回到广场取消查询，返回后恢复。
- GET 请求 15 秒、POST 上传和提交 60 秒超时，期限覆盖 JSON 响应体读取。超时保留业务快照，显示请求异常；不会将任务标记为失败。
- 错误请求保留 HTTP 404/405/415 等客户端状态，必要响应头（如 Allow）保留；未预期异常仍返回 500 并记录服务端日志。
- 浏览器刷新恢复与服务进程恢复不同：服务重启不续跑，启动清算遗留任务为 FAILED / SERVER_RESTARTED；正常关闭时被中断任务可为 SERVER_SHUTDOWN。

## 用户身份与已知限制

Alice/Bob 是数据库中的演示用户。Java 设置 ff_demo_user Cookie，素材、任务、历史和结果读取按当前用户校验；没有公开静态素材目录。跨用户读取返回 404。

这是可主动切换、可模拟的 Demo 身份，不是生产认证。没有账号密码、身份验证、集群协调、自动重试、断点续跑或任务取消。应用按单实例设计；扩容需换成持久调度及真实身份系统。

上传替换/移除仅改变本次表单引用，不删除服务端旧素材，避免影响历史任务；当前没有自动清理孤立文件和存储配额。单个结果采用中心裁剪，不自动旋转 EXIF，不提供视频或真实 AI。模拟延迟之外，实际耗时还包含解码、渲染和存储。

任务受理与内存入队之间不提供崩溃级可靠消息保证；进程异常中止后由重启清算明确失败。数据库/磁盘持续故障时可能无法立即记录错误，需修复基础环境后重启清算。

## 测试和 CI

全部运行与评估可在容器中完成，测试数据库与演示数据库隔离：

~~~sh
docker compose --profile test run --build --rm frontend-test
docker compose --profile test run --build --rm backend-test
~~~

前者顺序执行 lint、tsc、Vitest、Next build；后者运行 Maven verify 和 mysql-it 集成测试。退出码非零即为失败，不跳过检查。

等价的单项开发命令：

~~~sh
# frontend
npm run lint
npm run typecheck
npm run test -- --run
npm run build
# backend
sh ./mvnw -B -ntp verify
sh ./mvnw -B -ntp -Pmysql-it verify
~~~

mysql-it 必须配置指向专用测试库的 DB_URL / DB_USER / DB_PASSWORD；profile 会初始化表和种子。不配置真实 MySQL 时不要声称集成测试通过。

完整 HTTP 闭环验收（工程根目录，PowerShell / bash 均可）：

~~~sh
docker run --rm --network frameforge_default --mount "type=bind,source=$PWD,target=/workspace,readonly" -w /workspace -e FRAMEFORGE_URL=http://frontend:3000 node:24.11.1-bookworm-slim node scripts/smoke.mjs
~~~

脚本创建两个属于 Alice 的真实演示任务，验证同源 Cookie、封面、上传、多任务、成功 PNG、指定阶段失败、历史恢复和 Bob 越权拒绝。会增加演示记录，不删除已有数据。

GitHub Actions 在 push / pull_request 时触发 frontend、backend、compose 三个任务。前端四项检查；Java 单元/构建及真实 MySQL 集成；Compose 启动和 HTTP smoke。远端 Actions 是否实际运行以仓库记录为准，本地配置存在不等于云端已通过。

2026-11-03 实际推送已触发 [GitHub Actions](https://github.com/MarcusDog/FrameForge/actions/runs/41603794341)，但账户因计费问题被锁定，三个任务均未启动，不能标记为远端通过。处理账户锁定后可重新运行；本地容器 54 项测试及构建已通过。验收代码提交与原始 API 证据见 [SUBMISSION.md](docs/SUBMISSION.md)。

## 部署与基本回滚

本题不要求公网部署。目标机器准备 Docker 后复制源码和非敏感配置，配置持久卷备份，再执行 Compose 启动并运行 smoke。生产化前需替换 Demo 身份、配置 HTTPS 和正式凭据。

更新前对 MySQL 做一致性备份，同时备份 media-data；将当前前后端镜像各自标记为 previous 后构建新镜像。健康检查和 smoke 通过后保留新版本。

回滚应用时，将 previous 镜像重新标记为 Compose 当前镜像名，再执行 docker compose up -d --no-build。数据库结构无变化时保留数据卷；涉及结构或结果格式变化时，必须按对应版本恢复配套数据库与文件备份。不要以删除数据卷充当回滚。

## 交付状态、AI 工作流与投入

详细实现与证据见：

- docs/REQUIREMENTS.md：R-01～R-14 实际验收矩阵。
- docs/VERIFICATION.md：真实命令、成功、失败及复验结果。
- docs/AI_WORKFLOW.md：M0～M4 的上下文、AI 修改与具体修复案例。
- docs/DECISIONS.md：关键技术判断与取舍。
- docs/ASSET_SOURCES.md：合法摄影来源与复用范围。

本工程使用 Codex 开发。用户提供题目、约束、方案并确认视觉；AI 负责拆解、编写、测试、定位和修复。例如前端测试最初暴露 Mock 泛型返回类型不兼容，改为明确的 unknown 网络解析边界后重新执行严格类型、全部测试和构建，未关闭检查。个人手写代码、个人投入和人工审查均待本人确认。

最终测试统计和验收提交在验证记录及最终交付报告中记录；没有可靠的纯编码工时记录，实际个人投入待本人确认。原始题目和设计参考保留本地。GitHub 源码发布与真实线上部署分别记录；本项目未进行公网服务部署。

## 最终验收摘要

R-01～R-14 的实现与证据见 docs/REQUIREMENTS.md，当前交付说明见 docs/DELIVERY.md。2026-11-04 最近本地验证通过 39 项前端、17 项 Java 单元、16 项 MySQL 集成，共 72 项；lint/typecheck/build、HTTP 闭环、两任务并行、失败隔离及资料保存验证均通过，原始输出见 docs/evidence/profile-console.txt。旧浏览器截图属于历史产物；当前浏览器视觉/手机/焦点和人工贡献仍待确认。GitHub 发布与 CI 的实际结果单独记录在 SUBMISSION.md。

无界面验证截图及结果：output/playwright/gallery-desktop.png、gallery-mobile.png、studio-mobile.png、history-desktop.png、result-preview.png、browser-check.json。可选脚本 scripts/browser-check.cjs 复用已安装的 Playwright Core/Edge；用 FF_PLAYWRIGHT_MODULE 指定模块，TEMP/TMP 可设为工程 D 盘 .runtime/temp；不参与项目启动，不要求评估者在宿主机安装或执行它。

已修复 MySQL 中文导入问题：种子显式 SET NAMES utf8mb4，表固定 utf8mb4。首次启动自动应用；已有旧演示库需要使用 UTF-8 客户端重新执行 002-seed.sql 更新十二条模板，保留任务/素材。Docker 主数据盘与构建缓存位置由 Docker Desktop 管理，安装目录在 D 盘并不代表数据也在 D 盘；本机已核对数据盘位于 D 盘。

R-07/R-08/R-12 的专项案例见 docs/AI_WORKFLOW.md：两个 RUNNING 任务中 A 查询 HTTP 500、B 成功，A 保留状态并显示“状态同步失败，可重试”，点击“恢复查询”后继续；B 停止轮询，切换用户拒绝旧响应。首次状态逻辑与切换用户测试即通过，实际只统一两处文案；原始执行输出见 docs/evidence/r07-r08-console.txt。

独立验收、五项新发现及最小修复见 docs/REVIEW.md；本轮详情页改为复用已知任务快照，加载错误绑定用户和任务，旧查询错误不能污染较新快照。个人投入和人工审查仍待本人确认。

## 个人中心、批量制作与 12 种版式（2026-11-04）

点击头像或侧栏“个人中心”：查看当前账户、全部/进行中/完成/失败任务、上传素材数与最近记录，可切换 Alice/Bob。统计来自 Java/MySQL 的当前用户数据，不以当前加载的历史页数代替总数；会话使用原有 HttpOnly Demo Cookie，仍不是生产认证。

“我的任务”→“批量制作”可一次选多张：单图模板每张生成一个独立任务，双图/三图模板按要求张数组成一组。每批最多 5 个任务，上传最多同时 3 张；素材准备齐、分组完整才可提交。提交受理后开始追踪，不等待生成结束。部分受理失败时只重试未受理任务并复用原提交键，已受理任务不会重复创建。新一批通过重新选图开始。

默认两个 Java worker 同时处理，其余排队；每个任务独立展示上传图片缩略图、编号、阶段、失败与结果。终态不再自动查询，离开任务/历史/模板详情/个人中心时清理请求；切换用户清空旧视图，迟到响应不能污染新用户。空闲个人中心不持续请求统计。

12 个模板分别使用明信片、拍立得、圆形肖像、杂志、庆祝卡、满版海报、胶片、留白双图、信笺、拼图、三联画、拱形双图。封面与结果使用同一个 Java2D 生成器；旧结果保留，新任务使用新排版。已有数据库升级需以 UTF-8 客户端重新执行 002-seed.sql；该种子只 upsert 用户/模板，不删除任务或素材。

本轮本地验证：33 前端 + 17 Java 单元 + 13 MySQL 集成，共 63 项；lint/typecheck/build、HTTP 业务闭环、两条同时 RUNNING / 一条 QUEUED 以及单任务失败隔离均通过。详细记录和原始失败/复验见 [UI_UPDATE.md](docs/UI_UPDATE.md)。本轮功能已同步 GitHub；新旧验收快照与本地/云端结果分开记录。最新 CI 仍因账户计费锁定未启动任务，原始证据见 SUBMISSION.md。

## 个人资料更新与演示（后续增强）

个人中心现在支持编辑昵称、简介，上传/移除头像，或选择五种默认头像颜色。保存成功后顶栏同步更新，刷新从 Java/MySQL 恢复。Alice/Bob 仍是稳定身份，昵称不改变任务归属。统计和最近记录继续使用服务端数据；退出账户清除当前 Cookie 和私人视图，重新选择后恢复历史。

演示：选择 Alice → 个人中心 → 上传一张 JPEG/PNG 头像并填写昵称/简介 → 保存 → 刷新 → 切换 Bob，确认资料/作品独立 → 退出 → 重新选择 Alice。两个页面同时修改时，后保存的旧版本收到冲突提示，草稿保留，点击“重新加载资料”后再编辑。

**已有数据卷升级**：先备份数据库与媒体，完成正在执行的任务，再执行增量迁移，然后构建/启动新版应用。以下是 bash 命令；不删除数据卷，不重复执行破坏性初始化：

~~~sh
docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysql --default-character-set=utf8mb4 -uframeforge -Dframeforge' < database/003-user-profiles.sql
docker compose up --build -d --wait
~~~

PowerShell 导入使用：

~~~powershell
Get-Content -Raw -Encoding utf8 database/003-user-profiles.sql | docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysql --default-character-set=utf8mb4 -uframeforge -Dframeforge'
docker compose up --build -d --wait
~~~

003 使用 CREATE IF NOT EXISTS / INSERT IGNORE，可重复执行而不覆盖已编辑资料。首次空卷自动执行，无需手工导入。回滚到前一版应用时可保留新增表；该增量没有修改旧六表，旧版应用会忽略它。头像上传复用现有资产，移除头像不删旧文件；没有新增自动清理或存储配额。

同源 HTTP 资料验收（与前述 smoke 命令相同容器参数，将脚本改为 scripts/profile-smoke.mjs）：验证真实资料读写、版本冲突、头像归属、退出与记录保留，最后恢复原 Bob 资料。会保留一张新增测试头像素材；若检测到同时有人编辑，恢复会因版本冲突失败，避免覆盖人工修改。CI 的 Compose 任务已加入此脚本。完整记录与本轮 72 项测试见 [PROFILE_UPDATE.md](docs/PROFILE_UPDATE.md)。
