# 个人中心、批量任务和版式改进

日期：2026-11-04。本轮针对用户实际试用反馈实施，不修改题目要求。

## 实际变化

- 正文基准 16px，主要按钮/输入约 16px，状态/辅助内容约 14px，手机模板卡片改为单列。删除侧栏宣传说明、任务/历史页重复解释及上传流程中的技术性文字。
- 新增 /account 与头像/侧栏入口，显示真实账户、作品统计、素材数、最近记录及 Alice/Bob 切换；没有虚构邮箱、密码重置或付费设置。GET /api/me/summary 通过 Cookie 校验用户，从 MySQL 全量统计。
- 用户明确选择“多张图片批量制作，分别生成结果”。模板页提供单次/批量模式，“我的任务”提供批量入口。单图每张一任务，多图按模板要求分组；最多 5 任务/批、3 张同时上传。等待、上传失败、缺图/分组不足时不能提交。
- 各组使用不同提交键；请求受理失败的组保留键重试，已受理组跳过，不会重复创建。受理后不用等生成结束，可以继续单次制作或新选一批。
- 后台默认两线程实际同时执行，最多四线程可配置，仍是单实例有界队列。集成测试为稳定验证容量拒绝而显式使用一线程；新增执行器测试和真实运行检查另行证明两任务并行。
- 任务卡片展示各自上传图片和简短编号；业务状态/阶段/错误/结果按 taskId 独立。个人中心纳入相关页面的追踪与清理；统计响应也检查用户与取消信号，旧用户迟到统计不可覆盖新用户。

## 模板与实际结果

| 模板 | 图片数 | Java2D 版式 |
|---|---:|---|
| 旅行明信片 | 2 | postcard，双图明信片 |
| 拍立得故事 | 3 | polaroid，错落相纸 |
| 宠物写真 | 1 | portrait，圆形肖像 |
| 城市手记 | 2 | magazine，不对称杂志 |
| 生日贺卡 | 1 | celebration，纸屑与相纸 |
| 周末来信 | 1 | editorial，满版照片与标题 |
| 胶片日记 | 3 | filmstrip，胶片齿孔三格 |
| 留白画廊 | 2 | minimal，错位双图 |
| 落日来信 | 1 | letter，照片与信笺 |
| 自然拼图 | 3 | mosaic，一大两小 |
| 记忆三联 | 3 | triptych，深色三联 |
| 同行时光 | 2 | duo，拱形双图 |

封面与结果都调用生产 CollageRenderer。Java 测试对 12 个版式校验结果差异和每张输入图片的可见像素，保留原有 PNG 可解码/红蓝图片内容断言。封面也在运行环境通过 HTTP 验证可访问且 12 个内容 hash 不同。

重新生成封面的实际成功命令（先构建 backend-test 镜像）：

~~~powershell
docker run --rm --entrypoint sh --mount 'type=bind,source=D:\求职\小影科技\ai全栈工程师,target=/source' -w /source frameforge-backend-test -c 'javac -cp /workspace/backend/target/classes -d /tmp/frameforge-tools scripts/PrepareDemo.java && java -Djava.awt.headless=true -cp /tmp/frameforge-tools:/workspace/backend/target/classes PrepareDemo'
~~~

新库自动使用新版种子；本机已用 UTF-8 MySQL 客户端重新执行 002-seed.sql，只更新用户/模板，保留所有旧任务、上传和结果。升级前查询未完成任务为 0，随后才重启前后端，三服务已恢复 healthy。

## 真实验证与修复

| 命令/检查 | 实际结果 |
|---|---|
| backend-test 容器 build + -Pmysql-it verify | exit 0；17 单元 + 13 MySQL 集成，0 失败/错误/跳过 |
| Node 容器 lint → typecheck → test → build | 最终 exit 0；33 tests/6 files，检查和 build 通过 |
| PrepareDemo 容器编译运行 | 最终 exit 0；Generated 12 covers |
| docker compose build backend frontend；up --no-build --wait | exit 0；三服务 healthy |
| 容器内 scripts/smoke.mjs | exit 0/PASS；12 模板、真实上传/结果、失败中断、历史/隔离 |
| 容器内 scripts/batch-smoke.mjs | exit 0/PASS；两 RUNNING / 一 QUEUED；最终成功/失败/成功；同图异模板 PNG 不同；个人统计增量正确 |

前端完整验证在工程根目录实际使用以下前缀，后接 sh -c 'npm run lint && npm run typecheck && npm run test -- --run && npm run build'：

~~~powershell
docker run --rm --mount 'type=bind,source=D:\求职\小影科技\ai全栈工程师\frontend,target=/app' --mount type=volume,source=frameforge-node-modules,target=/app/node_modules -w /app node:24.11.1-bookworm-slim
~~~

本轮实际失败没有隐藏：

1. lint 因 cleanup 中读取可变 ref 的警告失败；把批次代次递增放到 effect 建立时，卸载仍取消请求并标记 mounted=false，没有关闭检查。
2. typecheck 指出统计 snapshot 可能为空；改为明确检查当前用户和非空快照。
3. 封面工具 javac 因 java.nio.file.FileStore 与工程 FileStore 同名失败；改为精确导入 Path/Files 后重新生成成功。
4. 首次完整前端用例 32 通过/1 失败：总数与完成数同为 207，未限定字段的文本定位匹配两个节点。修正为按“全部任务”定位其 dd，保留数值断言，最终 33/33。
5. 两次代码补丁因重复路径或旧上下文被工具拒绝；未应用的修改没有写成完成或通过，随后按实际源码修改。

新增缩略图后再次完成前端全部检查与生产重建；测试同时验证 A/B 卡片使用各自素材 URL。没有删除断言、跳过类型检查或降低 lint 标准。

## 手动演示与验证范围

1. 刷新 http://localhost:3000，选择 Alice；头像进入个人中心，核对账户、统计与个人记录，切到 Bob 确认独立视图。
2. “我的任务”→“批量制作”，一次选 3 张不同图片，上传完成后创建 3 个任务。默认同时处理两条，剩余一条排队，各自卡片可识别输入图片。
3. 制作期间刷新、返回广场再进入任务；后端继续执行，恢复后追踪未结束任务，终态停止自动查询。
4. 在不同模板中使用相同图片，比较真实结果版式；两图/三图模板也可切批量模式，按要求张数组成每个任务。

浏览器原生文件选择、焦点、手机视觉和真实网络故障注入本轮未自动化验证，交由当前手动试用继续确认；组件/状态测试、真实 API 与 MySQL 已验证。不使用 Computer Use，不下载新浏览器或运行时。个人人工审查与有效工时仍待本人确认。

本轮为本地交互增强，旧 GitHub 发布快照与旧 CI 记录继续作为历史材料；没有把旧 SHA 误称为当前新版源码或云端通过结果。
