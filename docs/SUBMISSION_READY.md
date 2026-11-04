# 提交材料核对与评审入口

整理日期：2026-11-04（Asia/Shanghai）。项目：FrameForge，小影科技全栈开发笔试。

## 提交标识

- 公开源码：[MarcusDog/FrameForge](https://github.com/MarcusDog/FrameForge)。
- 已实际验证的业务代码 commit：[49239ac316f47d7ce0e3fb797de837251a1506c3](https://github.com/MarcusDog/FrameForge/commit/49239ac316f47d7ce0e3fb797de837251a1506c3)。
- 本次整理只更新交付文档，业务源码、依赖、SQL、容器及CI保持与该基线一致。源码压缩包取公开交付快照；完整材料 commit、文件名和校验值记录在随包 RELEASE.json / SHA256SUMS.txt。
- 项目不需要公网地址、真实AI服务或生产部署截图。压缩包解压后进入FrameForge目录，在根目录执行docker compose up --build即可评估。

## R-13逐项核对

| 原要求 | 实际材料/入口 | 核对结论 |
|---|---|---|
| 前后端完整源码 | frontend/src、backend/src；package.json、pom.xml | 已包含；业务职责由Java实现 |
| 版本/锁文件 | README版本表、frontend/package-lock.json、backend/.mvn/wrapper/maven-wrapper.properties、mvnw/mvnw.cmd | npm精确版本；固定Boot BOM/MyBatis/Maven Wrapper |
| 数据库结构/初始化 | database/001～004 | 九表、两Demo用户、十二模板；空库初始化有实际输出 |
| CI | .github/workflows/ci.yml | push/PR触发前端四项、Java/MySQL和Compose/浏览器；云端受阻单列 |
| 构建/测试/启动及连接 | README启动、连接、容器测试章节 | 构建/运行/测试均可在容器内完成，无宿主机npm/Maven前置要求 |
| 配置/示例无真实凭据 | .env.example、compose.yaml、application.yml | 示例仅为本机Demo值，不包含真实账户令牌 |
| 模拟数据/本地素材 | 002-seed、frontend/public/demo、ASSET_SOURCES | 十二模板/六张样例随源码保存，正常运行不依赖远程图片服务 |
| API字段/任务状态/阶段 | README API表和JSON例子；Models.java | 提交/查询/归属/资料/登录字段完整说明；查询不驱动阶段推进 |
| 成功/失败/耗时/多任务/刷新 | README九步演示；smoke/batch/profile和browser脚本 | 实际HTTP/浏览器证据可查，失败阶段可确定性指定 |
| 身份与个人记录 | README身份章节；AuthService、ProfileService、TaskService | Demo与注册账户分开，Java按当前用户过滤素材/任务/结果，MySQL持久化 |
| 完成/未完成/边界 | REQUIREMENTS、README边界章节 | 核心闭环完成；不隐瞒单实例队列、重启清算、不续跑等限制 |
| 实际投入/本人贡献 | README、AI_WORKFLOW的本人确认 | 本人自述约12小时：需求/方案、人工试用、代码修改/审查及部分代码撰写；无逐行比例统计 |
| 部署/回滚 | README升级与回滚章节 | 镜像/数据库/媒体备份配套，旧Demo代码的注册用户归属风险已注明；未声称生产执行过 |
| 是否使用AI及工作流 | AI_WORKFLOW、PLAN、DECISIONS、VERIFICATION | 明确使用Codex；拆解/上下文/代码生成修改/真实失败/最小修复/复验均有具体案例 |
| 脚手架/开源/素材来源 | ASSET_SOURCES、README来源章节 | 官方框架/Wrapper，摄影来源URL及许可，原创Java2D版式；未套第三方业务工程 |

## R-14与评估环境

默认Compose三服务为MySQL、Java、Next.js，含健康检查、数据库初始化、数据库/媒体持久卷及两端多阶段Dockerfile。只对本机发布3000/8080，MySQL在内部网络。可直接使用无真实凭据的默认示例配置。

test profile使用独立MySQL；frontend-test在Node容器执行lint/typecheck/test/build，backend-test在Java21/Maven容器执行verify及真实MySQL集成。可选Chromium QA镜像不影响默认三服务启动。容器命令见README/ACCOUNTS_QA，不要求评估者在宿主机直接运行工程脚本。

源码压缩包不含node_modules、.next、target、.git、.runtime、真实.env、数据库卷、上传文件或账户凭据；保留CI隐藏目录、.env.example、锁文件、Wrapper、测试和示例素材。原始附件目录留本地，题目原文保留为EXAM_SPEC。

## 实际验证与未验证

| 证据层级 | 实际情况 |
|---|---|
| 最近功能检查 | 2026-11-04：44前端+17单元+20真实MySQL=81项；lint/typecheck/build成功。原始输出account-console.txt包含首轮失败和复验 |
| 浏览器 | Linux Chromium156，两套脚本PASS；320/375/390px、焦点/多任务/网络500/刷新及375px注册登录/真实三图批量。JSON/截图在output/playwright/2026-11-04-final |
| 运行与初始化 | 三服务healthy、三个HTTP脚本PASS；新tmpfs空库四SQL创建9表、2用户/资料、12模板 |
| 云端CI | 业务验收对应run41782261196三个任务均未开始，GitHub账户计费锁定；原始API见SUBMISSION。不能标成云端通过 |
| 本轮材料整理 | 读取源码/入口/配置/既有证据，修正文档；校验源码一致性、文档链接、压缩包结构/文件校验与Compose配置。未重复执行81项功能检查 |
| 未验证 | 实体手机/iOS、屏幕阅读器、生产发布与回滚、全无缓存安装；不把视口模拟或AI审阅称为人工完整验收 |

未实现的额外能力：断点续跑/自动重试、多实例可靠调度、存储配额/孤立文件回收、完整生产认证等。服务重启会把遗留任务明确清算为失败，而非恢复执行。细节见README。

## 推荐评审顺序

README快速启动 → REQUIREMENTS矩阵 → TaskService/TaskDispatcher/TaskWorker/TaskStageService与MyBatis条件更新 → TaskFeed/Providers及关键测试 → AI_WORKFLOW具体案例 → 原始日志/浏览器JSON。无需阅读私人聊天或提供私人账号。

GitHub仓库和源码压缩包是等价提交入口，随包提交说明注明完整快照commit及业务验收基线。原始失败证据继续保留；历史阶段的测试数量和“待确认”字样不覆盖本次本人补充确认。
