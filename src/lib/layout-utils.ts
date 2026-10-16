import type { TravelProfile, CoverageStatus } from '../types/index.ts';

/**
 * 共享布局常量：统一 CSS 样式与计算所用视口参数
 */
export const MOBILE_SHEET_VH = 0.48; // 移动端清单占据视口高度 48vh
export const DESKTOP_LIST_WIDTH = 320; // 桌面端清单固定宽度 320px
export const DESKTOP_PANEL_WIDTH = 320; // 桌面端控制面板固定宽度 320px

/**
 * 地图视口布局 Padding 配置项
 */
export interface MapPaddingOptions {
  containerWidth: number;
  containerHeight: number;
  isMobile: boolean;
  isListOpen: boolean;
  isEditPanelOpen?: boolean;
}

/**
 * 地图 fitBounds 所需的 padding 结构
 * Leaflet 契约：
 * paddingTopLeft: [left, top]
 * paddingBottomRight: [right, bottom]
 */
export interface MapPaddingResult {
  paddingTopLeft: [number, number]; // [left, top]
  paddingBottomRight: [number, number]; // [right, bottom]
}

/**
 * 根据当前地图容器真实尺寸、移动端/桌面端及面板展开状态，纯函数计算地图适配视口 Padding
 * 避免固定 50px 导致标记被遮挡，同时保障核心可视区域至少占 30%
 */
export function calculateMapPadding(options: MapPaddingOptions): MapPaddingResult {
  const { containerWidth, containerHeight, isMobile, isListOpen, isEditPanelOpen = false } = options;

  let left = 24;
  let right = 24;
  let top = 72; // 顶部标题与工具栏避让
  let bottom = 40; // 底部图例/边距

  if (isMobile) {
    left = 16;
    right = 16;
    top = 80;
    if (isListOpen) {
      // 移动端清单占据底部 48vh，按真实容器高度计算避让
      const sheetHeight = Math.round(containerHeight * MOBILE_SHEET_VH);
      bottom = sheetHeight + 16;
    } else {
      bottom = 56; // 底部折叠悬浮按钮避让
    }
  } else {
    // 桌面端
    if (isListOpen) {
      // 桌面端左侧清单固定宽 320px + 边距
      left = DESKTOP_LIST_WIDTH + 24;
    } else {
      left = 40;
    }

    if (isEditPanelOpen) {
      // 桌面端右侧编辑面板固定宽 320px + 边距
      right = DESKTOP_PANEL_WIDTH + 24;
    } else {
      right = 40;
    }
    top = 80;
    bottom = 48;
  }

  // 安全保护：若 padding 之和超过视口 70%，按比例等比压缩，杜绝超出或逆序
  if (containerWidth > 0) {
    const maxHorizontal = containerWidth * 0.7;
    if (left + right > maxHorizontal) {
      const factor = maxHorizontal / (left + right);
      left = Math.round(left * factor);
      right = Math.round(right * factor);
    }
  }

  if (containerHeight > 0) {
    const maxVertical = containerHeight * 0.7;
    if (top + bottom > maxVertical) {
      const factor = maxVertical / (top + bottom);
      top = Math.round(top * factor);
      bottom = Math.round(bottom * factor);
    }
  }

  return {
    paddingTopLeft: [Math.max(8, left), Math.max(8, top)],
    paddingBottomRight: [Math.max(8, right), Math.max(8, bottom)],
  };
}

/**
 * 结构化覆盖状态解释与可操作出口描述
 */
export interface CoverageStatusDescription {
  title: string;
  badgeText: string;
  badgeVariant: 'success' | 'warning' | 'info' | 'error';
  explanation: string;
  helpfulNote: string;
  canViewExample: boolean;
  canEditOrigin: boolean;
  canChangeMode: boolean;
  canRetry: boolean;
}

/**
 * 获取覆盖状态的诚实解释与后续建议操作
 * 杜绝用空白暗示“附近没有地方”
 */
export function getCoverageStatusDescription(params: {
  status: CoverageStatus;
  isPartial: boolean;
  matchedCount: number;
  landmarkName?: string;
  profile?: TravelProfile;
  dataError?: string | null;
}): CoverageStatusDescription {
  const { status, isPartial, matchedCount, landmarkName, profile, dataError } = params;
  const profileName = profile === 'driving-car' ? '驾车' : profile === 'cycling-regular' ? '骑行' : '步行';

  if (dataError) {
    return {
      title: '地点数据处理异常',
      badgeText: '数据异常',
      badgeVariant: 'error',
      explanation: '地点数据匹配解析遇到异常，未能完成清单检索。等时圈范围已在地图中展示。',
      helpfulNote: '您可以尝试重新查询当前结果的地点数据，无需重新请求等时圈服务。',
      canViewExample: false,
      canEditOrigin: true,
      canChangeMode: false,
      canRetry: true,
    };
  }

  if (status === 'uncovered') {
    return {
      title: '超出当前收录范围',
      badgeText: '未收录区域',
      badgeVariant: 'info',
      explanation: `当前出发点${landmarkName ? `“${landmarkName}”` : ''}超出已收录区域。可达范围计算已完成，地点清单目前收录上海精选热门地标与珠海出入境服务厅。`,
      helpfulNote: '建议重新在已收录核心城区选择出发点，或点击下方查看上海精选示例。',
      canViewExample: true,
      canEditOrigin: true,
      canChangeMode: false,
      canRetry: false,
    };
  }

  if (status === 'covered-empty') {
    return {
      title: '范围内暂无收录地点',
      badgeText: '0 处收录地点',
      badgeVariant: 'warning',
      explanation: `出发点位于已收录区域内，在${profileName} 60 分钟预估范围内暂未收录精选地点。`,
      helpfulNote: '您可以尝试切换更快速的出行方式（如驾车）或更换出发点探索。',
      canViewExample: true,
      canEditOrigin: true,
      canChangeMode: true,
      canRetry: false,
    };
  }

  if (status === 'partial' && matchedCount === 0) {
    return {
      title: '部分范围跨越收录边界',
      badgeText: '跨边界未匹配',
      badgeVariant: 'warning',
      explanation: '当前等时圈范围部分超出了本地收录边界，且在已收录的区域内部暂未匹配到精选地点。',
      helpfulNote: '建议查看收录核心区示例或将出发点移至收录中心区域。',
      canViewExample: true,
      canEditOrigin: true,
      canChangeMode: true,
      canRetry: false,
    };
  }

  // 正常匹配成功
  return {
    title: '可达热点清单',
    badgeText: isPartial ? `已收录 ${matchedCount} 处 (部分跨界)` : `已收录 ${matchedCount} 处`,
    badgeVariant: 'success',
    explanation: isPartial
      ? `在可达范围内发现 ${matchedCount} 个精选地点。注意：部分可达区域已超出收录边界。`
      : `在可达范围内共发现 ${matchedCount} 个精选地点，按可达时间圈层分布。`,
    helpfulNote: '地点基于精选推荐数据；圈层范围基于城市道路网络模型估算。',
    canViewExample: false,
    canEditOrigin: true,
    canChangeMode: true,
    canRetry: false,
  };
}

/**
 * 统一的可达范围实估参考提示
 */
export const ESTIMATION_DISCLAIMER_TEXT =
  '可达范围基于城市路网模型实估，供日常出行规划参考。';
