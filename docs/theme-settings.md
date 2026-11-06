# 主题配置

Komari Zen 1.1.0 将常规设置从 **36 项精简为 18 项**，分为 **4 个标签**。配色与字体统一放在“外观”中。

| 标签 | 设置 |
|---|---|
| 通用（10） | 显示 Logo、Logo 图片地址、离线节点位置、离线分组、显示到期与价格、显示剩余价值、主货币、默认视图、默认排序指标、显示节点地图 |
| 延迟检测（3） | 显示延迟信息、显示的 Ping 任务、延迟色块分级模式 |
| 外观（4） | 配色方案、亮色强调色、暗色强调色、字体方案 |
| 页脚（1） | 自定义页脚内容 |

“显示到期与价格”和“显示延迟信息”同时控制首页及节点详情。详情历史还需要 Komari 开启记录功能。离线节点位置适用于默认顺序及指标排序；“保持”按当前排序排列。默认视图会让位于访客的手动选择，窄屏首次访问使用卡片。

所有配色方案都覆盖首页、详情页及图表。强调色覆盖包括菜单、时间范围选中态等交互，不改变成功、警告和错误的状态含义。

配色为 **中性白、柔暖色、科技蓝、薄荷绿**。中性白、柔暖色分别是原 Kumo、A\ 的新名称，已保存的选择仍能识别；科技蓝参考 IBM Carbon，薄荷绿参考 Supabase。已删除的更早配色值仍回退中性白。色彩来源与亮暗模式设计见[配色说明](./color-palettes.md)。

## 从旧配置升级

1.1.0 从管理页移除了以下 18 个配置入口，保留解析以兼容已有安装：

| 类别 | 旧配置键 |
|---|---|
| Logo、账单与排序（3） | `logoShape`、`showAutoRenewal`、`defaultSortOrder` |
| 首页概览（5） | `dashboardOverviewLayout`、`dashboardOverviewSections`、`dashboardCpuMetric`、`dashboardBandwidthMetric`、`dashboardNodeIds` |
| 延迟分级阈值（4） | `latencyFixedGreenMax`、`latencyFixedYellowMax`、`latencyMeanGreenDelta`、`latencyMeanYellowDelta` |
| 自定义背景（4） | `customBgLight`、`customBgDark`、`customSurfaceLight`、`customSurfaceDark` |
| 自定义字体（2） | `fontFamilyCustom`、`fontCssUrlCustom` |

这些配置的已保存值仍会读取。配色方案的删除与回退规则见上文，不能按此表视作保留旧配色。

新安装使用新版完整概览、平均 CPU、总带宽、全部节点、圆角 Logo、自动续费随账单显示和默认升序。延迟分级使用内置阈值：固定模式 100/150 ms，均值偏移 +10/+30 ms。

自定义字体不再提供新增入口；已有的 Custom 配置继续生效，切换字体方案后使用所选预设。

[Komari 管理页的合并保存逻辑](https://github.com/komari-monitor/komari-web/blob/bed58b589da63232a17681b1dbaed9eab2423078/src/utils/saveThemeSettings.ts)会先读取完整旧配置，再合并表单值，保留未在面板声明的字段。旧值能否在再次保存后保留，也取决于管理端版本；若旧版或自行修改过的管理端采用整表覆盖，应先备份设置并更新管理端。

本地 `VITE_COLOR_PRESET` 仅用于开发预览；安装主题后，以后台的配色方案为准。
