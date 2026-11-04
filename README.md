# FrameForge · 素材创作工作台

浏览模板、上传图片并提交制作；Java 在后台依次执行素材检查、模拟生成、结果整理，MySQL 保存任务、阶段和个人记录。结果由 Java2D 将本次上传图片拼为 PNG，不调用真实 AI 服务。

- 仓库：[MarcusDog/FrameForge](https://github.com/MarcusDog/FrameForge)
- 业务代码验收 commit：[49239ac316f47d7ce0e3fb797de837251a1506c3](https://github.com/MarcusDog/FrameForge/commit/49239ac316f47d7ce0e3fb797de837251a1506c3)。后续交付文档更新不改变该业务基线；压缩包的完整快照 commit 见随包 RELEASE.json。
- 最近功能验证：2026-11-04，本地容器内 **44 前端 + 17 Java 单元 + 20 真实 MySQL 集成，共81项通过**，lint/typecheck/build及两套真实 Chromium 检查通过。原始失败和复验见 [ACCOUNTS_QA](docs/ACCOUNTS_QA.md)、[控制台记录](docs/evidence/account-console.txt)。本轮材料整理未重跑这些功能检查。
- GitHub Actions 配置已提供；业务验收对应云端任务因账户计费锁定未开始执行，不能视为云端通过。实际记录见 [SUBMISSION](docs/SUBMISSION.md)。
- 提交材料逐项核对见 [SUBMISSION_READY](docs/SUBMISSION_READY.md)，R-01～R-14证据索引见 [REQUIREMENTS](docs/REQUIREMENTS.md)。

## 容器启动与停止

需要 Docker Engine/Desktop（Linux containers）与 Compose。首次构建需联网取得公开镜像、npm/Maven依赖；正常业务、示例图片和模拟生成不依赖外部服务、AI Key或付费接口。

在工程根目录运行，构建与应用均在容器中执行，评估者无需在宿主机安装 Java、Node 或 Maven：

~~~sh
docker compose up --build -d
docker compose ps
~~~

前端 http://localhost:3000 ，Java健康检查 http://localhost:8080/actuator/health 。默认只绑定本机回环地址；MySQL不向宿主机发布端口。默认三服务为frontend、backend、mysql，按healthcheck等待数据库和后端就绪。

~~~sh
# 停止应用，保留数据库、上传和结果卷
docker compose down
~~~

不要用删除数据卷作为常规停止、升级或回滚方式。

## 技术版本、结构与连接

| 项目 | 实际固定版本/实现 |
|---|---|
| Java构建/运行 | Java21；运行镜像Temurin21.0.10+7 |
| Spring Boot / MyBatis Starter | 3.5.16 / 3.0.5 |
| MySQL | 8.4.8 |
| Maven / Wrapper插件 | 3.9.14 / 3.3.4 |
| Node.js | 24.11.1 |
| Next.js / React / TypeScript | 16.4.3 / 19.3.1 / 5.9.3 |
| Vitest / React Testing Library | 4.0.18 / 16.3.0 |
| Java测试 | Boot BOM管理的JUnit5与Mockito |
| 状态/样式/异步执行 | fetch、Hooks、Context、原生CSS；Spring ThreadPoolTaskExecutor |
| 可选浏览器QA | Playwright Core1.64.1；本次Chromium156.0.8078.79，Linux容器内运行 |

npm直接依赖使用精确版本，完整依赖树及校验值见frontend/package-lock.json。Java使用固定Boot BOM、MyBatis版本及Maven Wrapper；镜像固定补丁标签。QA容器的系统浏览器由Debian仓库安装，每次实际版本记录在报告中。

~~~text
frontend/            Next App Router、上传/任务追踪/账户页面、行为测试
backend/             Spring Boot、Service、MyBatis Mapper、单元/集成测试
database/            001结构、002种子、003资料、004账户会话
scripts/             HTTP smoke、真实浏览器QA、Java2D封面工具
docs/                原题、需求矩阵、AI工作流、决策、真实验证证据
output/playwright/   按阶段保留的截图及浏览器JSON报告
.github/workflows/   push / pull_request检查
compose.yaml         默认三服务；test profile使用独立测试库
~~~

浏览器统一请求同源/api，Next rewrite转发到Java。Compose内前端连接http://backend:8080，Java连接mysql:3306/frameforge；Java负责业务、文件和数据库写入，Next不替代后端执行任务。时间以UTC存储/返回，界面按浏览器本地时区显示。

## 配置、初始化和本地素材

无需真实凭据即可使用默认演示配置；可将.env.example复制为.env后修改。示例密码仅供本机演示。

| 配置 | 默认值 | 用途 |
|---|---|---|
| FRONTEND_PORT / BACKEND_PORT | 3000 / 8080 | 宿主机访问端口 |
| DB_PASSWORD / MYSQL_ROOT_PASSWORD | frameforge-demo / local-root-demo | MySQL首次初始化的示例密码 |
| SIMULATION_ENABLED | true | 开启失败/耗时演示控件；关闭后Java拒绝simulation覆盖参数 |
| DEMO_ENABLED | true | 开启共享Alice/Bob入口；false仅允许注册/密码登录 |
| SECURE_COOKIE | false | 本机HTTP用false；HTTPS部署设true |
| TASK_WORKERS / TASK_QUEUE_CAPACITY | 2 / 20 | 1～4个工作线程，其余进入有界队列 |
| DB_URL / DB_USER | 见application.yml | JDBC连接；Compose固定连接内部mysql服务 |
| STORAGE_PATH | 容器/data | 上传和结果目录，挂载media-data |
| JAVA_API_BASE_URL | 构建时http://backend:8080 | Next rewrite目标，修改需重建前端 |

空数据库卷自动顺序执行001-schema.sql、002-seed.sql、003-user-profiles.sql、004-accounts.sql，创建9表、Alice/Bob和12个模板。mysql-data保存数据库，media-data保存uploads/results；测试库使用单独mysql-test与tmpfs，不复用演示库。已有卷不会重复初始化；修改环境变量不会自动修改已存在的MySQL用户密码。

封面和6张可上传示例均在frontend/public/demo，使用文件选择器选择frontend/public/demo/samples/*.jpg即可，无需远程图片服务。12种版式覆盖1/2/3张输入；封面由生产CollageRenderer生成，结果重新读取本次输入，不复制封面。来源及复用范围见 [ASSET_SOURCES](docs/ASSET_SOURCES.md)。

## 建议演示顺序

1. 选Alice快速体验，或到/register创建独立账户；模板广场切分类、查看封面和图片要求。
2. 进入“旅行明信片”，上传两张示例图；尝试预览、替换、移除及非法文件。素材未就绪或提交中不能重复点击。
3. 点击“开始制作”，获得任务ID后提交状态立即结束；继续浏览或提交下一次。任务由Java继续处理，关闭页面不影响后台。
4. 动态/历史/详情展示当前阶段与服务端真实时间线。完成后预览PNG，Tab/Shift+Tab保持弹窗焦点，Escape关闭并返回触发按钮。
5. 展开“演示控制”，指定“模拟生成”失败：素材检查成功、生成失败、整理跳过。三个阶段均可确定性触发失败。
6. 将耗时调整为2000/10000/2000毫秒，连续提交多次；默认两任务并行，更多任务排队。也可从“我的任务→批量制作”一次选三张，为单图模板创建三个独立结果。
7. 制作期间刷新、离开再返回，历史从Java/MySQL恢复并继续追踪。终态停止查询；无活跃任务不轮询。查询异常保留上次状态，点“恢复查询”继续，不会误标任务FAILED。
8. 切换Bob，确认Alice记录不可读取；注册用户退出后到/login重新登录，恢复本人资料/历史。个人中心可保存头像、昵称、简介，刷新仍在。

失败阶段为MATERIAL_CHECK / GENERATING / ORGANIZING；默认耗时1000/4000/1000毫秒，每阶段允许0～30000整数。查询HTTP500与阶段失败是不同场景：前者只显示同步错误，后者由Java写入FAILED。真实浏览器网络注入/多任务恢复证据见ACCOUNTS_QA。

## 主要API与字段

成功JSON直接返回对象；错误统一为{code,message}，不返回SQL、堆栈或本机路径。私有接口读取Cookie，越权资源返回404；未登录401。图片为JPEG/PNG响应。

| 方法与路径 | 请求 | 响应/说明 |
|---|---|---|
| GET /api/demo/users | 无 | [{id,name}]，只列Alice/Bob |
| POST /api/demo/session | {userId} | {id,name}，仅允许Alice/Bob |
| GET /api/auth/session | Cookie | {id,name}；兼容GET /api/demo/session |
| DELETE /api/auth/session | Cookie | {signedOut:true}，撤销会话；兼容DELETE /api/demo/session |
| POST /api/auth/register | {username,password,nickname} | 201、{id,name}并自动登录；重名409 |
| POST /api/auth/login | {username,password} | {id,name}及HttpOnly Cookie；错误401，暂锁429 |
| GET /api/config | 无 | {simulationEnabled,demoEnabled} |
| GET /api/templates | 无 | 模板数组，前端按category筛选 |
| GET /api/templates/{id} | 模板ID | 模板详情；不存在404 |
| POST /api/assets | multipart的file | {id,previewUrl,mimeType,sizeBytes,width,height} |
| GET /api/assets/{id}/content | Cookie | 校验归属后返回图片 |
| POST /api/tasks | 下方JSON | 202、{taskId,task}，不等待完整执行 |
| GET /api/tasks | before可选、limit默认20/范围1～50 | {items,nextCursor}，个人历史 |
| GET /api/tasks?active=true | Cookie | 全部未结束任务，恢复追踪 |
| GET /api/tasks/{id} | Cookie | 任务、阶段和素材快照 |
| GET /api/tasks/{id}/result | Cookie | 成功PNG；未成功或无权限404 |
| GET /api/me/summary | Cookie | {totalTasks,activeTasks,succeededTasks,failedTasks,assetCount} |
| GET /api/me/profile | Cookie | {userId,nickname,bio,avatarColor,avatarAssetId,avatarUrl,version,createdAt,updatedAt} |
| PUT /api/me/profile | {nickname,bio,avatarColor,avatarAssetId,version} | 完整资料；旧版本409，非本人头像404 |

模板字段：id、title、category、description、requiredImageCount、coverUrl、layout、acceptedMimeTypes、maxFileSizeBytes。只接收JPEG/PNG，单张最大5MiB；同时验证真实格式、解码、单边8192/总像素2500万上限。提交再次验证数量、重复素材、归属和文件存在。

~~~json
{
  "templateId": "pet-portrait",
  "assetIds": ["先上传取得的素材ID"],
  "requestKey": "新制作使用新UUID，同一次网络重试复用",
  "simulation": {
    "failAt": null,
    "checkMs": 1000,
    "generationMs": 4000,
    "organizeMs": 1000
  }
}
~~~

相同用户+requestKey+相同参数返回同一任务；同键不同参数409。正常完成可省略simulation；failAt指定上文阶段。任务字段：id、templateId、templateTitle、coverUrl、status、currentStage、resultUrl、errorCode、errorMessage、version、createdAt、updatedAt、stages、assets。阶段字段：taskId、stage、status、startedAt、endedAt、durationMs、errorMessage。

任务状态为QUEUED→RUNNING→SUCCEEDED/FAILED；阶段按MATERIAL_CHECK→GENERATING→ORGANIZING顺序，阶段状态为PENDING/RUNNING/SUCCEEDED/FAILED/SKIPPED。每步开始/结束独立持久化，失败后后续SKIPPED；PNG原子写入完成才公布结果URL。查询只读，终态不可回退。

资料昵称1～24字符、简介最多160字符；avatarColor为六位十六进制颜色，avatarAssetId为本人上传ID或null。GET取得version后PUT，成功版本递增；冲突显式重载，避免覆盖。注册用户名4～32位字母/数字/下划线、忽略大小写，密码8～128字符；连续5次错误暂锁一分钟。

## 后台执行、身份与边界

- TaskService事务创建任务、素材关联、三阶段记录；AFTER_COMMIT向有界ThreadPoolTaskExecutor投递。拒绝通过独立事务落为FAILED/EXECUTOR_SATURATED，仍可查任务ID；不用CallerRunsPolicy阻塞请求。
- Worker调用TaskStageService短事务更新边界；延迟、Java2D渲染和文件写入在阶段数据库事务之外。条件更新/行锁保护终态，version防旧响应覆盖。
- 前端按taskId分开保存业务快照和请求错误；轮询仅在模板详情、我的任务、历史、任务详情、个人中心启用，回广场/离页/切换用户清理请求。GET/PUT等15秒、POST60秒截止，包含响应体读取。某任务同步失败不影响其他任务。
- Alice/Bob是可主动切换的共享Demo身份；注册账户使用盐化密码派生与MySQL随机会话，HttpOnly/SameSite=Lax Cookie，7天有效、退出撤销。演示接口不能列出或冒充注册用户。全部素材/任务/结果按Java当前用户归属校验。
- 浏览器刷新可以恢复追踪；服务重启不自动续跑。遗留任务启动时清算为FAILED/SERVER_RESTARTED，关闭中断可为SERVER_SHUTDOWN。单实例内存队列不提供崩溃级可靠消息投递；数据库/磁盘持续故障需先恢复环境再清算。

已完成原题核心闭环及材料；注册/资料、真实时间线、Java2D拼贴、批量并行、幂等与队列拒绝是增强。明确未实现：孤立上传文件回收、用户存储配额、EXIF自动旋转、完整生产认证（邮箱验证/找回密码/MFA/分布式限流）、多实例调度、自动续跑/重试/任务取消。历史列表存在有界N+1查询。未验收实体手机/iOS Safari、屏幕阅读器、生产发布与实际回滚、全无缓存安装；没有公网地址要求。更细证据分级见REQUIREMENTS。

## 容器测试与CI

~~~sh
docker compose config --quiet
docker compose --profile test run --build --rm frontend-test
docker compose --profile test run --build --rm backend-test
~~~

frontend-test依次运行lint、TypeScript、Vitest、Next build；backend-test在独立真实MySQL执行Maven verify（含JUnit/Mockito与mysql-it）并构建，不用H2替代。测试命令非零表示失败，不跳过检查。源码中的package.json、pom.xml与Dockerfile为实际执行入口。

HTTP完整闭环在工程根目录执行（PowerShell/bash均可，默认DEMO_ENABLED=true）：

~~~sh
docker run --rm --network frameforge_default --mount "type=bind,source=$PWD,target=/workspace,readonly" -w /workspace -e FRAMEFORGE_URL=http://frontend:3000 node:24.11.1-bookworm-slim node scripts/smoke.mjs
~~~

将脚本名换为scripts/batch-smoke.mjs、scripts/profile-smoke.mjs可分别验证两运行一排队/失败隔离、资料冲突/头像归属/退出；建议依次运行且无其他任务，脚本会增加真实测试记录。真实浏览器可选QA镜像、完整可复制命令与截图见ACCOUNTS_QA；没有要求评估者在宿主机运行npm/Maven/浏览器脚本。

GitHub Actions在push/pull_request触发frontend、backend、compose三任务，保存测试报告、HTTP输出、浏览器报告/截图及容器日志。功能验收run41782261196因GitHub账户计费锁定，三个任务steps为空；云端未执行不代表本地失败，也不算云端通过，详见SUBMISSION原始API记录。

## 升级、部署与基本回滚

新环境使用空卷启动即可。已有旧卷先备份数据库和media-data；停用新提交并等待活动任务结束。资料表缺失先导入003，账户表缺失再导入004，然后重建/启动新应用。下列为已有MySQL服务上的004导入例子：

~~~sh
docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysql --default-character-set=utf8mb4 -uframeforge -Dframeforge' < database/004-accounts.sql
docker compose up --build -d --wait
~~~

PowerShell用以下导入行替换第一行：

~~~powershell
Get-Content -Raw -Encoding utf8 database/004-accounts.sql | docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysql --default-character-set=utf8mb4 -uframeforge -Dframeforge'
~~~

003/004为可重复的增量，003不覆盖已编辑资料；两者不删原任务/素材。目标机器部署需保留配置和备份、启动后检查健康和smoke；升级前给旧镜像保留previous标签。回滚使用匹配旧镜像并执行docker compose up -d --no-build；结构变化需配套恢复数据库/媒体备份。已有注册数据时不能直接回滚到任意ID可切换的旧Demo代码，必须保留当前演示身份限制或恢复配套旧备份。未执行生产发布或回滚，不提供虚构截图。

## AI工作流、本人贡献与实际投入

使用Codex辅助开发。按M0分析/矩阵、M1后端、M2前端、M3测试修复、M4交付推进；向AI提供原题、现有文件/API、约束和失败输出，生成/修改后执行真实容器检查，再按根因做最小修复。完整过程与失败证据见 [AI_WORKFLOW](docs/AI_WORKFLOW.md)、[PLAN](docs/PLAN.md)、[DECISIONS](docs/DECISIONS.md)、[VERIFICATION](docs/VERIFICATION.md)。

具体例子：真实Chromium完成注册后，HTTP容器地址上的界面批量制作报crypto.randomUUID不可用；AI定位安全上下文差异，改用getRandomValues生成提交键，补无randomUUID测试；重新运行完整前端检查及真实三图批量/刷新/登录恢复均通过。首轮错误和复验分别保留，没有删除断言、关闭检查或冒称第一次全通过。

本人于2026-11-04确认：实际投入约12小时，参与需求分析、方案选择、人工试用、代码修改与审查，以及部分代码撰写。AI完成实现/测试/修复/文档等辅助工作；具体手写文件和比例未单独统计，不把AI修改全部归为本人独立编写，也不把AI审查冒称人工审查。

## 来源与复用

未套用第三方业务工程或商业脚手架。框架/工具使用官方npm/Maven发行包，Maven Wrapper由官方插件生成；主要复用范围是框架、测试与构建能力。示例6张摄影来源、许可页面和文件映射见ASSET_SOURCES；Java2D生成封面与结果。原始题目/设计由用户提供用于要求和布局参考，原附件留本地，公开/压缩包保留docs/EXAM_SPEC.md归档，不包含私人对话、账户凭据、依赖缓存或用户上传文件。
