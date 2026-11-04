# 账户与真实浏览器验收 / 2026-11-04

用户本轮要求增加创建账户、注册、登录，并优先完成手机尺寸/键盘焦点、真实浏览器网络异常/多任务/刷新恢复验收；随后提供截图要求“创作动态”减少大片空白。原题不强制密码认证，本轮是用户明确要求的增强，未修改 EXAM_SPEC 或提高原题验收门槛。

## 新账户实现

- `/register`：用户名 4～32 位 ASCII 字母/数字/下划线，大小写归一；昵称最多24字符；密码8～128字符，确认密码在前端校验。注册事务创建用户、个人资料和凭据，成功自动登录。Alice/Bob 为保留演示身份，不能注册同名账号。
- `/login`：验证密码，错误保留表单；同账户连续5次错误后锁定一分钟，失败计数写入 MySQL。`noRollbackFor=ApiException` 仅用于登录，让认证失败计数不因业务异常回滚；注册仍正常事务回滚，重复用户名不遗留用户/资料。
- `AuthService` 使用 Java 原生 PBKDF2-HMAC-SHA256、随机16字节盐、600000次、256位派生；参数依据 [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。不保存明文密码，也不输出到日志。没有新增应用密码库依赖。
- 登录创建32字节随机会话，HttpOnly/SameSite=Lax Cookie 保存随机值，MySQL 仅保存其 SHA-256；有效期7天，退出立即撤销服务端会话。登录轮换当前会话，过期会话不能读任务/资料。
- Demo API 只返回且只允许 Alice/Bob；注册用户不能用可猜测用户ID或旧 Demo Cookie 冒充。`DEMO_ENABLED=false` 可关闭演示入口，`SECURE_COOKIE=true` 供 HTTPS 环境使用。本机 HTTP 保持 false。
- 新增 `004-accounts.sql` 两张表（凭据、会话），全工程共9表。旧卷先导入004再运行新版；新空卷自动001→002→003→004。所有原有任务与文件保留，003/004不删除数据。

## 浏览器与真实边界

实际使用 Docker 内 Chromium **156.0.8078.79**、Playwright Core **1.64.1**，Node24.11.1；新建可选 QA 镜像复用已有 Node 镜像，浏览器/中文字体仅安装在 D 盘 Docker 数据中，未在宿主机安装新运行时，也未使用 Computer Use。

脚本为 `scripts/browser-regression.cjs` 和 `scripts/browser-account.cjs`。Java、MySQL、文件、任务、会话均真实运行；只对指定 A 的浏览器 GET 临时返回500，其他请求继续真实调用。这是浏览器网络层故障注入，不冒充 Java 服务器真的宕机，也不是 fetch 单元桩。

## 首轮发现与最小修复

1. **预览 Tab 焦点离开弹窗**：真实浏览器断言失败。ResultPreview 添加可读名称和 Tab/Shift+Tab 边界循环，保留 Escape 关闭及焦点返回触发按钮。
2. **简介焦点只有默认1px**：断言预期3px、实际1px。补齐 textarea:focus-visible，与其余输入保持一致；没有删焦点断言。
3. **真实批量页面无法提交**：注册已完成，但批量制作出现 `crypto.randomUUID is not a function`。原因是 HTTP 容器主机名不属于安全上下文；旧组件测试未覆盖该差异。改用 `getRandomValues` 生成 UUIDv4，继续复用每组提交键。新增不含 randomUUID 的运行环境回归；没有改用 Math.random，也没有通过浏览器标记把 HTTP 伪装成 HTTPS。
4. 前端首次检查另发现新测试误用 Testing Library 不支持的 exact 参数，类型检查退出1；删掉无效参数而保留原定位和断言后复验通过。该次测试没有运行，不写成“业务测试失败”。

原始失败分别保存在 `output/playwright/2026-11-04-before-auth/`、`output/playwright/2026-11-04-accounts/` 与本轮控制台归档。最终结果单独存放 `output/playwright/2026-11-04-final/`，不覆盖失败证据。

## 创作动态与留白

动态优先显示进行中任务，同类任务优先，提供最近/进行中筛选；最多展示8条，完整历史另有入口。紧凑卡片保留真实阶段、失败原因、查询错误、详情和结果。列表可键盘聚焦/独立滚动，桌面侧栏随滚动保留；模板摘要缩为缩略图与说明，单图上传位限制高度。

1440px宽度实际测量：原制作面板1214.8px、动态1753.2px；最终制作774px、动态723px，差51px。截图与几何断言共同验证，不靠添加装饰块填空。手机单列，动态列表高度有界。

## 实际命令与结果

- `docker build -t frameforge-browser:1.64.1 -f scripts/browser/Dockerfile scripts/browser`：成功。系统浏览器由 Debian 仓库提供，版本记录于每次 JSON；QA镜像不参与默认三服务启动。
- `docker compose --profile test run --rm --build frontend-test`：首次类型错误退出1；最小修复后通过；随机键与最终布局更新后完整复验，lint/typecheck/**44项测试**/build全部通过。
- `docker compose --profile test run --rm --build backend-test`：新增账户测试首次通过；最后空值边界调整后复验成功，**17单元+20真实MySQL集成**，0失败/错误/跳过。
- UTF-8客户端导入004、构建前后端、`docker compose up -d --no-build --wait --wait-timeout 120`：成功，三服务健康。更新前活跃任务0，35条真实任务；未删除用户数据。
- 最终 `browser-regression.cjs`：PASS。A初始RUNNING/GET500保留，B成功且停止查询，A恢复后成功，空闲无轮询；刷新恢复、离页/切换取消迟到响应；Tab/Shift+Tab/Escape/返回焦点、上传及简介焦点；320/375/390px基本页面无横向溢出；新布局几何断言通过。`pageErrors=[]`。
- 更新后依次执行HTTP smoke/batch/profile：全部PASS，旧演示Cookie转发与归属仍工作，指定生成失败停止后续，两个成功版式PNG不同，资料测试恢复原Bob资料。
- 另用独立、无端口、tmpfs MySQL空库自动执行全部四个SQL：成功创建9表、2用户/2资料/12模板；验证后停止自动移除该临时容器，不影响主数据卷。

最终 `browser-account.cjs`：PASS。375px真实键盘注册/自动登录/刷新保留；界面选择3张图片、3个独立202任务、2运行/1排队、刷新后恢复3个成功结果；演示入口不能冒充注册用户，Alice读其任务404；真实退出后401，错误密码保留在登录页，正确登录恢复本人3条历史。两份最终报告均 `pageErrors=[]`，见 [最终浏览器报告](../output/playwright/2026-11-04-final/browser-regression.json) / [账户报告](../output/playwright/2026-11-04-final/browser-account.json)。

81项测试是44前端+17单元+20MySQL，不重复计算镜像构建中的测试。真实浏览器检查另列，不混入这个数字。最终截图包括桌面制作页、375px表单/历史和网络异常，AI已读取最终制作页与注册页截图，未冒称人工审查。发布回执见SUBMISSION。

## 可复现命令

工程根目录运行（PowerShell/bash的 `$PWD` 均可用于挂载）：

~~~sh
docker build -t frameforge-browser:1.64.1 -f scripts/browser/Dockerfile scripts/browser
docker run --rm --network frameforge_default --shm-size=256m -v "$PWD:/workspace" -e FRAMEFORGE_URL=http://frontend:3000 -e FF_QA_RUN=current -e FF_ASSERT_COMPACT=true frameforge-browser:1.64.1 scripts/browser-regression.cjs
docker run --rm --network frameforge_default --shm-size=256m -v "$PWD:/workspace" -e FRAMEFORGE_URL=http://frontend:3000 -e FF_QA_RUN=current frameforge-browser:1.64.1 scripts/browser-account.cjs
~~~

测试创建真实演示记录及临时测试账户，不删除已有资料。测试凭据只在进程内生成，不打印、不保存登录状态文件。建议无其他任务运行时执行，用于验证默认两 worker/一排队的确定性场景。

## 明确未验证或未实现

手机宽度由真实 Chromium 调整视口验收，非实体手机/iOS Safari；没有声称人工已审查。跨浏览器/屏幕阅读器、触屏软键盘、生产部署/回滚未验收。基础账户已实现，但没有邮箱验证、忘记密码、MFA、分布式限流；Demo身份仍可共享，不能当作私密个人账户。头像未保存文件回收/存储配额仍未实现。GitHub云端是否运行以实际run为准，历史计费锁定不自动变成通过。
