# 贡献指南

## 提交规范

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范：

```text
<type>(<scope>): <description>
```

- `type` 使用英文，常用类型包括 `feat`、`fix`、`docs`、`refactor`、`test`、`build`、`ci`、`chore`。
- `scope` 可选，使用简短的英文模块名，例如 `converter`、`seo`、`ui`。
- `description` 使用中文，采用祈使语气，简洁描述改动目的，结尾不加句号。
- 每个提交只包含一个逻辑变更，提交前运行与改动相关的质量检查。
- 不兼容变更在 `type` 或 `scope` 后添加 `!`，并在正文中使用 `BREAKING CHANGE:` 说明迁移方式。

示例：

```text
feat(converter): 支持 TOML 转 JSON
fix(ui): 修复复制按钮状态未重置
docs: 补充本地部署说明
refactor(converter): 统一解析错误处理
```

## 提交前检查

```bash
npm test
npm run check
npm run build
```
