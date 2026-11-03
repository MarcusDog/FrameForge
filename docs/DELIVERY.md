# FrameForge 实际交付

交付日期：2026-11-02（Asia/Shanghai）。本地工程即完整交付物，不需要真实 AI Key 或外部素材服务。

## 当前完成情况

R-01～R-14 均有实现与材料；逐项证据见 REQUIREMENTS.md。模板浏览、上传、Java 受理与异步三阶段、持久化、独立多任务追踪、Alice/Bob 隔离、历史恢复及真实 PNG 闭环均已通过实际验证。

Docker 默认三个服务均健康，访问 http://localhost:3000 。本机 Docker 主数据盘经核对位于 D:/Docker/dockerdata/DockerDesktopWSL，工程、截图、浏览器 QA 临时文件在 D 盘。后续没有继续把镜像或依赖下载到 C 盘数据盘。

## 最终实际通过的命令

| 命令 | 实际结果 |
|---|---|
| docker compose config --quiet | 通过 |
| Node 24.11.1 容器内 npm run test -- --run --reporter=verbose | 独立审查本轮 27 项前端测试通过 |
| 相同容器配置下依次执行 npm run lint、npm run typecheck、npm run build | 本轮全部通过 |
| docker compose --profile test run --build --rm backend-test | 本轮 Maven build、15 项单元、12 项真实 MySQL 集成通过，0 失败/错误/跳过 |
| docker compose up --build -d --wait --wait-timeout 180 | 通过；三服务 healthy |
| 容器内 node scripts/smoke.mjs | PASS：UTF-8、封面、Cookie、上传、多任务、阶段、失败、PNG、历史、隔离 |
| node scripts/browser-check.cjs（已有 Playwright Core + Edge，无界面） | PASS：8 组检查、0 page errors |
| git diff --check / 原题与归档比较 | 通过；原题内容原样保留 |

独立审查本轮修改两个前端实现文件和相应测试；重新执行 27 前端、15 Java 单元、12 MySQL 集成、lint/typecheck/build、Compose 和 HTTP smoke，并检查无任务 GET 的 Java 后台执行及新 MySQL 自动初始化。八组浏览器结果沿用上轮，未重新执行。

容器 smoke 的完整可复制命令与单项开发检查命令见 README。浏览器脚本为可选补充 QA，不是项目运行依赖；运行时使用已安装的 Playwright Core，并通过 FF_PLAYWRIGHT_MODULE 指定位置，TEMP/TMP 设置到 D 盘。未下载额外浏览器。

## 真实失败与修复

交付后深查又修复了请求无超时、根布局离开任务页后仍追踪、框架 4xx 被改写为 500 三项缺口。新增回归在旧实现上先失败，再最小修改后复验。测试容器增加 D 盘 Maven 缓存卷；详细复现见 VERIFICATION.md。

- PowerShell 将 Maven 的未引用版本参数拆分：引用参数后重新生成 Wrapper。
- Java 测试声明遗漏 IOException：补充测试方法声明后复验。
- Hook cleanup 与依赖警告：明确捕获引用、传入身份键，保持 lint 零警告。
- Mock 泛型类型不兼容：收敛到 unknown 网络解析边界，保持严格类型检查。
- 实际页面的 MySQL 中文乱码：核对原文件和数据库字节后固定 SQL 字符集，重新应用六条模板；加入准确中文断言，验证页面和接口。
- 新增重启清算测试调用启动接口时缺少参数：传入空 ApplicationArguments 后，全部 Java 测试复验通过。
- 浏览器测试错误页匹配到 Next announcer：定位业务 alert，保留“模板不存在”的断言，完整流程通过。
- 测试种子字符集的辅助 SQL 检查曾在测试库建表前运行失败，等待集成初始化完成后再验证；未将失败写成通过。

## 快速演示

1. 打开工作台，选择 Alice，按分类进入“旅行明信片”。
2. 上传 frontend/public/demo/samples 中两张照片，点击“开始制作”；立即可以提交下一任务。
3. 观察后台时间线，完成后在历史中预览 PNG。
4. 展开演示控制，选择模拟生成失败，再提交；后续阶段会跳过。
5. 增大耗时，连续提交，刷新或离开后重开；从 Java 恢复未结束任务。
6. 切换 Bob 查看独立记录，再切回 Alice。查询临时失败保留已有状态，可恢复查询。

## 真实工作量与人工待确认

实际代码规模：15 个 Java 主源码文件、5 个 Java 测试文件、25 个前端源码/测试文件；另有 SQL、容器、CI、验收脚本与文档。本轮已验证自动化测试 54 项（27 + 15 + 12），另有本轮完整 HTTP smoke；8 组浏览器检查为上一轮历史证据。

本次执行包含环境故障、停机与多次用户中断，没有可靠的纯编码计时数据，因此不虚构有效工时。用户个人实际投入、个人代码修改和人工审查：待本人确认。AI 的具体上下文、修改与修复记录见 AI_WORKFLOW.md。

## 未完成与未验证

- 核心业务没有已知未完成项。
- 远端 GitHub Actions、真实公网部署与回滚操作尚未执行；已交付相应配置与步骤。
- 真机手机、其他浏览器和长时间压力测试未验证；已验证 Edge 桌面及 390px/320px 无界面布局。
- Demo 身份、孤立素材清理、单实例、进程重启不续跑等限制见 README。
- 验收 commit 以最终答复及本地 git log -1 为准；不推送远端。

## R-07/R-08/R-12 专项补充

按用户规定顺序先补测试：首次定向 10 通过/2 失败，状态逻辑和切换用户首次通过，失败仅是两处指定文案。最小修改后定向 12/12、完整前端 23/23、lint/typecheck/build 全通过。原始输出和 AI 工作流、人工待审要点见 AI_WORKFLOW.md 与 evidence/r07-r08-console.txt；真实 HTTP 500 故障注入和远端 CI 未验证。

最新独立验收及实际发现/修复见 REVIEW.md；不以旧的浏览器检查代替本轮视觉验收。
