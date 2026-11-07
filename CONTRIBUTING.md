# Contributing / 贡献指南

欢迎提交修复、文档、中文体验改进、行情适配器与回归测试。请先在 Issue 中描述较大改动。

1. 安装 Node.js 22.13+（建议 24），运行 `npm ci` 和 `npm ci --prefix iphone`。
2. 在功能分支中改动。核心账户与报价逻辑分别在 `lib/account.cjs`、`lib/market.cjs`；基础界面在 `public/`。
3. 共享代码改动后运行 `npm run sync:mobile`，一并提交生成的手机版文件。
4. 运行 `npm run check`、`npm test`、`npm run test:mobile`。改动手机构建时再运行 `npm run build --prefix iphone`。
5. 在 Pull Request 中说明问题、结果和验证方法。

不要提交真实账户、备份、环境变量、访问令牌、个人部署标识、构建目录或供应商整日行情抓取文件。测试使用明确标记的合成数据，不要将模拟价格加入生产失败回退。

价格和时间处理必须保留来源信息。不要通过平滑、添加收盘价或删除大幅波动来掩盖来源差异；未知时间编码应显示错误。账本计算需保持精确与可重放，不能信任浏览器传入的成交价格。

提交贡献即表示你有权提供该内容，并同意以本项目 MIT 许可证授权项目原创部分；保留第三方许可证与版权说明。

English: use a focused branch, explain the bug and resulting behavior, add meaningful regression coverage, run the checks above, sync generated mobile files, and retain all third-party notices. Never submit private data or credentials.
