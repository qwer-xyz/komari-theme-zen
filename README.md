# Komari Zen

基于极简主义设计理念的 [Komari Monitor](https://github.com/komari-monitor/komari) 主题。

主题功能实现尽量遵循 Komari 官方[默认主题](https://github.com/komari-monitor/komari-web)规范；若 UI 相似，纯属审美撞车。

## 预览

演示站：https://tz.kkkk.li

## 安装与配置

### 快捷安装

* 进入 Komari 市场 → 搜索 zen → 选择 komari-theme-zen → 点击安装 → 设为当前主题

### 手动安装

1. 在 [Releases](https://github.com/qwer-xyz/komari-theme-zen/releases) 下载对应版本的 `zen-theme-v*.zip`（例如 `zen-theme-v1.0.2.zip`）
2. 进入 Komari 后台 → 主题管理 → 上传该 zip 并启用

### 个性化配置

可在 Komari 后台 → 主题 → Zen 主题设置中进行个性化配置，主要包括：

* **通用：** Logo 与形状、离线节点位置和离线筛选、到期与续费信息、剩余价值、默认视图与排序
* **首页：** 节点地图、概览布局与显示区块、CPU 和带宽统计方式、参与统计的节点范围
* **延迟检测：** 节点延迟、首页网络质量、Ping 任务范围及延迟颜色分级
* **配色：** 多套预设配色，以及亮色和暗色模式的背景、卡片与强调色自定义
* **字体：** 内置字体方案，以及自定义字体名称和 CSS 地址
* **页脚：** 自定义页脚 HTML 或文本内容

## 技术栈

React 19 · TypeScript · Vite 6 · Tailwind CSS v4

## 鸣谢

* [Komari](https://github.com/komari-monitor/komari)
* [Komari Web](https://github.com/komari-monitor/komari-web)
* [React](https://react.dev/)
* [Vite](https://vite.dev/) 
* [Tailwind CSS](https://tailwindcss.com/) 

## 许可证

[MIT](./LICENSE)
