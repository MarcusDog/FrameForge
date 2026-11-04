# 个人中心增强与实际证据 / 2026-11-04

## 实现范围

- 昵称（1～24 字符）、简介（最多 160 字符）、五色默认头像或自选 JPEG/PNG（最大 5 MiB）。头像复用现有 Java 上传/真实格式/像素检查；归属验证后持久化头像素材 ID。图片加载失败回退为昵称首字。
- 顶栏和个人中心同步显示保存后的资料。保存不替换 Demo 身份对象，不重启 TaskFeed。保留现有全量统计、最近记录、历史入口和账户切换。
- DELETE session 清 Cookie、清空本地私人视图与追踪，不删服务端资料/历史。身份仍为 Alice/Bob Demo，未实现生产认证。
- 新增一张 user_profile 表，和原六张业务表一对一关联；003 SQL 可重复执行，不覆盖已有资料。PUT 以 version 做乐观锁，旧版本 409；用户归属由 Cookie 决定，不接收目标 userId。
- 资料读取、上传、保存均有请求取消及用户代次检查。旧用户读/写响应被忽略；冲突保留草稿，显式重新加载。

## 实际验证

完整原始输出见 [profile-console.txt](evidence/profile-console.txt)。全部构建、测试、HTTP 脚本在已有 D 盘 Docker 中执行，宿主机只读写文件和编排，未新增运行时/浏览器/项目依赖。

| 实际命令（省略本机 docker.exe 的绝对路径） | 结果 |
|---|---|
| docker compose --profile test run --rm --build frontend-test（首次） | 退出 1；lint 的 react-hooks/set-state-in-effect 拦截同步状态更新，后续类型/测试/构建未执行 |
| 同命令（最小修复后） | 退出 0；lint、typecheck、39 项前端测试、Next build 通过 |
| 同命令（最后顶栏/成功反馈调整后） | 退出 0；完整四项检查再次通过，39 项断言保留 |
| docker compose --profile test run --rm --build backend-test | 退出 0；Maven verify 成功，17 单元 + 16 真实 MySQL 集成，0 failure/error/skipped |
| docker compose build backend frontend | 退出 0；使用已缓存依赖生成运行镜像 |
| MySQL 查询更新前活跃/任务/素材数量 | 分别 0 / 27 / 17；没有活动任务时更新服务 |
| UTF-8 客户端导入 database/003-user-profiles.sql | 退出 0；增量加表，未删除数据卷、任务或素材 |
| docker compose up -d --wait --wait-timeout 120 | 退出 0；三服务 healthy |
| 容器内 node scripts/profile-smoke.mjs | PASS；资料/头像读回、409、跨用户 404、退出 401、历史保留。恢复 Bob 原资料；保留新增测试头像素材 |

最近自动化测试共 **72 项**：39 前端 + 17 Java 单元 + 16 MySQL 集成。不把 Docker 构建中重复执行的单元测试重复计数。新增 6 项前端行为用例（含 GET/PUT 两个参数化场景）及 3 项 MySQL 集成；首次实际运行这些测试均通过，无需制造失败。

最后顶栏/反馈变更后另行构建并启动前端，现有后端镜像未变。最终在同一 Node 容器依次执行 smoke、batch-smoke、profile-smoke，退出 0：完整 HTTP 闭环、两 RUNNING/一 QUEUED、成功/失败/成功、资料保存/恢复均 PASS。脚本增加真实测试记录；之后共 32 任务、21 素材。再次应用 003 前后，Alice/Bob 资料与版本（0/4）、任务/素材数量完全一致，迁移可重复性已验证。最终 GitHub 提交与对应 run 的实际结果见 SUBMISSION.md。

## 具体失败与修复

首次新增资料加载 effect 直接 setProfile 设 loading，触发 lint 禁止级联渲染。最小修改：首次加载从缺少当前用户快照推导，重新加载的 loading 由点击事件设置，effect 仅接收异步结果。没有禁用 lint、吞掉错误或删除断言。随后完整前端检查通过。

## 待人工确认及已知边界

当前版本真实浏览器外观、小屏/焦点、上传图片失败回退的视觉效果、双标签页资料冲突、人工贡献和个人工时待本人确认。自动化使用 React/fetch 桩与真实 MySQL/HTTP，不能代替所有浏览器验收。新头像不会裁剪成新文件，页面以 object-fit 显示；未保存的上传和移除头像不删除旧文件。没有头像裁剪器、生产认证或账号注册。

最终源码 diff 审阅补齐移除头像时清除旧“已保存”提示，并追加断言；前端完整四项检查再次退出0、39/39，重新构建前端和启动三服务均成功。六份主要交付文档的 Markdown 本地链接检查无缺失。日志提交版只规范换行和行尾空白；原命令/错误/结果保留，.runtime 有原件。
