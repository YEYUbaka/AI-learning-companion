# 项目文档分区说明

这个目录用于放置项目级文档，避免根目录堆积大量说明文件。

## 目录说明

- `FULLSTACK_DEV_RUNBOOK.md`: 前后端本地联调启动手册
- `reports/`: 历史阶段报告、测试报告、实施总结
- `快速启动指南.md`: 项目快速上手
- `测试账号.md`: 测试账号信息
- `项目结构说明.md`: 项目结构说明
- `整理计划.md` + `整理完成报告.md`: 本次整理记录

## 根目录整理规则

- 根目录只保留对外入口与核心配置：
  - `README.md`
  - `docker-compose.yml`
  - 核心代码目录（`backend/`、`frontend/`、`docs/` 等）
- 操作性说明与过程文档都放到 `docs/` 内。

## 新文档落位规则

- 开发规范和方案：`docs/development/`
- 部署相关：`docs/deployment/`
- 排障记录：`docs/troubleshooting/`
- 阶段汇报：`docs/project/reports/`
