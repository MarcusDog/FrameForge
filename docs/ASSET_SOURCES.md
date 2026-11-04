# 素材及复用范围

- 题目要求及两套设计参考：用户提供，原文件保留本地；公开工程包含 docs/EXAM_SPEC.md 题目归档，原始设计附件不随 GitHub 快照发布。设计图仅作为布局与视觉参考，未充当页面截图或生成结果。
- 示例摄影来自 Unsplash 公共图片 CDN，下载后保存在 frontend/public/demo/samples，运行时无远程依赖。
- 许可：https://unsplash.com/license 。允许免费下载、复制、修改及用于此类应用演示；素材不能作为未经实质修改的照片产品单独售卖，也不能用于建立竞品图库。
- 来源 URL：
  - mountains.jpg：https://images.unsplash.com/photo-1464822759023-fed622ff2c3b
  - lake.jpg：https://images.unsplash.com/photo-1470770841072-f978cf4d019e
  - dog.jpg：https://images.unsplash.com/photo-1517849845537-4d257902454a
  - city.jpg：https://images.unsplash.com/photo-1519501025264-65ba15a82390
  - birthday.jpg：https://images.unsplash.com/photo-1464349095431-e9a21285b5f3
  - weekend.jpg：https://images.unsplash.com/photo-1500534623283-312aade485b7
- 十二张模板封面由 scripts/PrepareDemo.java 调用生产 CollageRenderer 生成，与实际输出共享版式。重新生成需先构建 backend-test，然后在该 Java 容器中以 /workspace/backend/target/classes 为 classpath 编译和运行工具；完整已验证命令见 UI_UPDATE.md。原来的单文件 java scripts/PrepareDemo.java 命令已不适用。
- 结果生成器不复制封面；读取用户本次上传的文件重新拼贴成 PNG。
- 框架与依赖来自各自官方 npm/Maven 发行包；Maven Wrapper 由官方 wrapper 插件生成。未复用第三方业务脚手架或模板业务代码。
