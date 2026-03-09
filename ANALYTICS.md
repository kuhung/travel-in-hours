# 数据监控文档

本项目使用 Vercel Web Analytics 进行用户行为分析和系统健康监控。

---

## 📊 监控概览

| 类别 | 事件数量 | 用途 |
|------|---------|------|
| 用户行为 | 15+ | 地标选择、出行方式、分享等 |
| 自定义生成 | 5 | 配额使用、次数统计 |
| API 健康 | 15+ | 限流、错误、成功率监控 |

---

## 🔍 核心监控场景

### 1. 自定义生成次数追踪

**问题**: 用户用了几次自定义选点？

**查看方法**:
```
Vercel Dashboard → Analytics → Events
→ 选择 "custom_analysis_started"
→ 筛选 is_cached = false (实际消耗配额)
```

**关键事件**:
- `custom_analysis_started` - 自定义分析开始
- `custom_quota_used` - 配额消耗 (记录剩余数量)
- `analysis_limit_reached` - 达到每日限制

**数据字段**:
- `remaining_quota` - 剩余配额
- `is_cached` - 是否命中缓存
- `travel_mode` - 出行方式

---

### 2. API 限流和配额监控

**问题**: OpenRouteService API 是否限流或配额耗尽？

**查看方法**:
```
Vercel Dashboard → Analytics → Events
→ 查看 "ors_daily_quota_exceeded" (配额耗尽警报)
→ 查看 "api_rate_limit_reached" (限流警报)
```

**关键事件**:

#### 🚨 告警事件
- `ors_daily_quota_exceeded` - 每日配额耗尽 (最高优先级)
- `api_rate_limit_reached` - API 限流
- `api_error` - API 调用失败

#### ✅ 健康指标
- `ors_api_success` - API 调用成功
- `api_call_success` - 客户端成功率

**计算成功率**:
```
API 成功率 = ors_api_success / (ors_api_success + 各类错误)
目标: > 95%
```

---

## 📋 完整事件列表

### 用户行为事件

| 事件名称 | 触发时机 | 关键字段 |
|---------|---------|---------|
| `landmark_selected` | 选择地标 | city, landmark_name |
| `geolocation_requested` | 请求定位 | location |
| `geolocation_success` | 定位成功 | latitude, longitude |
| `geolocation_error` | 定位失败 | error_type |
| `travel_mode_changed` | 切换出行方式 | mode, previous_mode |
| `poi_clicked` | 点击兴趣点 | poi_name, layer_minutes |
| `edit_button_clicked` | 点击编辑 | landmark, travel_mode |

### 分析功能事件

| 事件名称 | 触发时机 | 关键字段 |
|---------|---------|---------|
| `custom_analysis_started` | 自定义分析开始 | remaining_quota, is_cached |
| `custom_analysis_completed` | 自定义分析完成 | quota_used, remaining_quota |
| `preset_analysis_started` | 预设地标分析开始 | landmark, city |
| `preset_analysis_completed` | 预设地标分析完成 | landmark, city |
| `custom_quota_used` | 消耗自定义配额 | new_remaining |
| `analysis_limit_reached` | 达到每日限制 | remaining_quota |
| `map_custom_point_created` | 地图自定义选点 | latitude, longitude |

### 分享功能事件

| 事件名称 | 触发时机 | 关键字段 |
|---------|---------|---------|
| `share_image_started` | 开始生成图片 | landmark, travel_mode |
| `share_image_success` | 图片生成成功 | method (clipboard/download) |
| `share_image_error` | 图片生成失败 | error |
| `social_share_clicked` | 社交分享点击 | platform (weibo/twitter/wechat) |
| `toolbar_share_image_*` | 工具栏分享操作 | 同上 |
| `toolbar_social_share_clicked` | 工具栏社交分享 | platform |

### API 监控事件

| 事件名称 | 触发时机 | 关键字段 |
|---------|---------|---------|
| `api_call_success` | API 调用成功 | profile, range_count |
| `api_error` | API 错误 | error_type, status_code |
| `api_rate_limit_reached` | 🚨 客户端限流 | profile, coordinates |
| `api_network_error` | 网络错误 | error_message |
| `ors_api_success` | ORS API 成功 | profile, range_count |
| `ors_daily_quota_exceeded` | 🔴 配额耗尽 | timestamp |
| `ors_rate_limit` | ORS API 限流 | status_code |
| `ors_*_error` | 各类 ORS 错误 | status_code, error_message |

---

## 🎯 数据分析指南

### 场景 1: 评估自定义功能使用情况

```
1. 查看 custom_analysis_started 总数
2. 对比 preset_analysis_started 数量
3. 计算占比 = custom / (custom + preset)

决策:
- 占比 > 30%: 功能受欢迎，考虑扩展
- 占比 < 10%: 需要优化引导
```

### 场景 2: 监控 API 健康状态

```
每日检查:
1. ors_daily_quota_exceeded 事件数 (目标 = 0)
2. API 成功率 (目标 > 95%)
3. api_rate_limit_reached 次数 (目标 = 0)

告警设置:
- 配额耗尽 → 立即通知
- 成功率 < 90% → 高优先级
- 限流 > 10次/小时 → 警告
```

### 场景 3: 优化缓存策略

```
1. 统计 is_cached = true 的比例
2. 缓存命中率 = 缓存次数 / 总次数
3. 目标: > 30%

优化:
- 命中率低: 延长缓存时间
- 按出行方式分析: 针对性优化
```

### 场景 4: 配额管理

```
监控指标:
1. custom_quota_used 每日总量
2. analysis_limit_reached 用户占比
3. 剩余配额分布 (remaining_quota)

调整策略:
- 达限用户 > 15%: 增加配额
- 使用率 < 50%: 配额充足
```

---

## 🔔 告警建议

### 高优先级 (立即响应)
```
1. ors_daily_quota_exceeded 
   → API 配额耗尽，服务受影响

2. api_rate_limit_reached 频率 > 10次/小时
   → 接近限制，需要调整

3. API 成功率 < 80%
   → 服务严重不稳定
```

### 中优先级 (24h 内响应)
```
4. analysis_limit_reached 用户占比 > 15%
   → 自定义配额不足

5. api_error 频繁 (server_error 类型)
   → ORS 服务不稳定

6. 每日调用量 > 套餐 70%
   → 提前规划升级
```

### 低优先级 (定期检查)
```
7. 缓存命中率 < 25%
   → 优化缓存策略

8. custom_analysis 占比大幅变化
   → 用户行为模式改变
```

---

## 📈 关键指标速查

### 自定义生成
```
事件: custom_analysis_started
指标: 总次数、配额消耗 (is_cached=false)、达限占比
```

### API 健康
```
成功率: ors_api_success / 总调用
限流: api_rate_limit_reached + ors_daily_quota_exceeded
调用量: ors_api_success 按日统计
```

### 用户转化
```
漏斗: 地标选择 → 分析开始 → 分析完成 → 分享
转化率: 各环节事件数比例
```

---

## 🛠️ 技术实现

### 依赖
- `@vercel/analytics` v1.6.1
- 客户端: `track()` from '@vercel/analytics'
- 服务端: `track()` from '@vercel/analytics/server'

### 代码位置
```
客户端监控:
- src/components/Controls/*.tsx
- src/components/App/IsochroneApp.tsx
- src/hooks/useIsochrones.ts

服务端监控:
- src/app/api/isochrones/route.ts
```

### 数据规范
- 事件名称: 小写字母 + 下划线
- 字段名称: 小写字母 + 下划线
- 字符串长度: 最多 255 字符
- 不包含敏感信息
- 坐标精度: 保留 4 位小数

---

## 📊 查看数据

1. 登录 [Vercel Dashboard](https://vercel.com)
2. 选择项目 `travel-in-3hours`
3. 点击 **Analytics** 标签
4. 滚动到 **Events** 面板
5. 选择事件名称查看详细数据

---

## 更新日期

2026-03-09

