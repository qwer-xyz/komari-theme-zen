# Komari Zen

基于极简主义设计理念的 [Komari Monitor](https://github.com/komari-monitor/komari) 主题。

主题功能实现尽量遵循 Komari 官方[默认主题](https://github.com/komari-monitor/komari-web)规范；若 UI 相似，纯属审美撞车。

## 预览

演示站：https://komari.qwerxyz.com/

## 1.1.0 更新

* 重做首页概览与统计区，带宽趋势展示最近 3 分钟的数据。
* 统一首页和节点详情的移动端顶栏，完整保留站标、站名、时间、时区、语言、亮暗切换与后台入口；缩小移动端搜索栏。
* 提供 **中性白、柔暖色、科技蓝、薄荷绿** 四套配色，均支持亮暗模式，统一菜单、状态标签、图表提示和加载、错误状态的样式。
* 将配置面板从 **36 项精简为 18 项**，合并为通用、延迟检测、外观、页脚四个标签。

## 安装与配置

### 快捷安装

* 进入 Komari 市场 → 搜索 zen → 选择 komari-theme-zen → 点击安装 → 设为当前主题

### 手动安装

1. 在 [Releases](https://github.com/qwer-xyz/komari-theme-zen/releases) 下载对应版本的 `zen-theme-v*.zip`（1.1.0 对应 `zen-theme-v1.1.0.zip`）
2. 进入 Komari 后台 → 主题管理 → 上传该 zip 并启用

### 个性化配置

可在 Komari 后台 → 主题 → Zen 主题设置中进行个性化配置，主要包括：

常规设置共 **18 项、4 个标签**：

* **通用（10）：** Logo、离线节点位置与分组、到期与价格、剩余价值与货币、默认视图与排序、节点地图
* **延迟检测（3）：** 延迟显示、Ping 任务范围、颜色分级模式
* **外观（4）：** 配色方案、亮暗模式强调色、字体方案
* **页脚（1）：** 自定义页脚 HTML 或文本

配色方案为 **中性白（Kumo）、柔暖色（Anthropic）、科技蓝（IBM Carbon）、薄荷绿（Supabase）**，默认使用中性白。两种模式的交互强调色仍可单独设置，字体由“字体方案”独立控制。设计依据见[配色说明](./docs/color-palettes.md)。

### 从旧版升级

1.1.0 移除了 18 个低频配置的面板入口，包括概览布局与统计口径、Logo 形状、自动续费显示、排序方向、延迟阈值、自定义背景和自定义字体。这些已保存的值仍兼容读取；新安装使用完整概览、平均 CPU、总带宽和内置延迟阈值等默认值。

旧配色 `Kumo`、`A\` 分别对应中性白、柔暖色；更早的暖色、红、黄、绿、蓝、紫、黑白方案已移除，其旧值回退到中性白。科技蓝和薄荷绿为新的配色方案。详见[完整配置与升级说明](./docs/theme-settings.md)。

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
