/**
 * 分享功能工具函数
 * 统一管理分享相关的逻辑，避免代码重复
 */

import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { track } from '@vercel/analytics';
import { CityLandmark, TravelProfile } from '@/types';
import { getColorForRange } from '@/data/isochrone-config';
import { wgs84ToGcj02 } from '@/lib/coord-transform';
import { POIByLayer, formatLayerTime } from '@/lib/poi-utils';

// ============ 类型定义 ============

export interface ShareParams {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: number[];
}

export interface ShareImageOptions extends ShareParams {
  poiByLayer?: POIByLayer[];
  trackingLocation: string;
}

// ============ URL 生成 ============

/**
 * 生成分享 URL
 */
export function generateShareUrl(params: ShareParams): string {
  const { landmark, profile, rangeMinutes } = params;
  
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || '';
  
  const urlParams = new URLSearchParams({
    lat: landmark.coordinates[1].toString(),
    lng: landmark.coordinates[0].toString(),
    name: landmark.name,
    city: landmark.city,
    profile,
    range: rangeMinutes.join(','),
  });
  
  return `${baseUrl}?${urlParams.toString()}`;
}

// ============ 社交分享文案 ============

/**
 * 生成社交分享文案
 */
export function generateShareTitle(params: ShareParams): string {
  const { landmark, profile, rangeMinutes } = params;
  const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
  const hours = Math.round((maxMinutes / 60) * 10) / 10;
  
  if (profile === 'driving-car') {
    return `一脚油门，从${landmark.name}出发${hours}小时能逃离到哪里？我的周末逃离计划已生成！`;
  } else if (profile === 'cycling-regular') {
    return maxMinutes <= 60 
      ? `在${landmark.name}骑行${maxMinutes}分钟能去哪？我的城市漫游地图已生成！`
      : `挑战自我！从${landmark.name}出发骑行${hours}小时，探索城市边界。`;
  } else {
    return maxMinutes <= 60
      ? `丈量${landmark.name}，发现身边未知的惊喜。你的1小时生活圈有多大？`
      : `从${landmark.name}出发步行${hours}小时，这是我的城市探索足迹。`;
  }
}

/**
 * 打开社交平台分享
 */
export function openSocialShare(
  platform: 'weibo' | 'twitter',
  params: ShareParams,
  trackingLocation: string
) {
  const url = generateShareUrl(params);
  const title = generateShareTitle(params);
  
  track('social_share_clicked', {
    location: trackingLocation,
    platform,
    landmark: params.landmark.name,
    city: params.landmark.city,
    travel_mode: params.profile,
    max_range: params.rangeMinutes[params.rangeMinutes.length - 1]
  });
  
  switch (platform) {
    case 'weibo':
      window.open(
        `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
        '_blank'
      );
      break;
    case 'twitter':
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
        '_blank'
      );
      break;
  }
}

// ============ 复制链接 ============

/**
 * 复制链接到剪贴板
 */
export async function copyShareLink(
  params: ShareParams,
  trackingLocation: string
): Promise<boolean> {
  const url = generateShareUrl(params);
  let copySuccess = false;
  
  // 方法1: 尝试使用现代 Clipboard API
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(url);
      copySuccess = true;
    }
  } catch (err) {
    console.warn('Clipboard API failed:', err);
  }
  
  // 方法2: 如果方法1失败，使用 execCommand 降级方案
  if (!copySuccess) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      
      // iOS 需要特殊处理
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.select();
      }
      
      copySuccess = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr);
    }
  }
  
  if (copySuccess) {
    track('share_copy_link', {
      location: trackingLocation,
      landmark: params.landmark.name,
      city: params.landmark.city,
      travel_mode: params.profile,
    });
  }
  
  return copySuccess;
}

// ============ 图片生成 ============

/**
 * 生成分享图片
 * @returns Promise<boolean> 是否成功
 */
export async function generateShareImage(options: ShareImageOptions): Promise<boolean> {
  const { landmark, profile, rangeMinutes, poiByLayer = [], trackingLocation } = options;
  
  track('share_image_started', {
    location: trackingLocation,
    landmark: landmark.name,
    city: landmark.city,
    travel_mode: profile,
    max_range: rangeMinutes[rangeMinutes.length - 1]
  });

  try {
    const mapElement = document.getElementById('app-map-container');
    if (!mapElement) {
      throw new Error('Map container not found');
    }

    // 0. 自动居中逻辑
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (window as any).__leaflet_map;
    if (map && landmark) {
      const [lng, lat] = wgs84ToGcj02(landmark.coordinates[0], landmark.coordinates[1]);
      map.setView([lat, lng], map.getZoom(), { animate: false });
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // 1. 截图地图
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      ignoreElements: (element) => {
        return element.classList.contains('leaflet-control-container');
      }
    });

    // 2. 生成高清二维码
    const shareUrl = generateShareUrl({ landmark, profile, rangeMinutes });
    const dpr = window.devicePixelRatio || 1;
    const isLandscape = canvas.width > canvas.height;
    const hasPOI = poiByLayer.length > 0;
    const totalPOIs = poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);
    
    const qrDisplaySize = isLandscape ? 72 : 80;
    const qrGenerateSize = qrDisplaySize * dpr * 2;
    
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: qrGenerateSize,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    const qrImage = new Image();
    qrImage.src = qrDataUrl;
    await new Promise((resolve) => { qrImage.onload = resolve; });

    // 3. 计算尺寸
    const footerHeight = isLandscape ? 100 : 120;
    let mapWidth = canvas.width;
    let mapHeight = canvas.height;
    let sourceY = 0;

    if (!isLandscape) {
      const targetTotalHeight = mapWidth / 0.75;
      const targetMapHeight = targetTotalHeight - footerHeight;
      if (canvas.height > targetMapHeight) {
        mapHeight = targetMapHeight;
        sourceY = (canvas.height - mapHeight) / 2;
      }
    }

    // 4. 创建高DPI Canvas
    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const scale = Math.max(dpr, 2);
    finalCanvas.width = mapWidth * scale;
    finalCanvas.height = (mapHeight + footerHeight) * scale;
    ctx.scale(scale, scale);

    // 绘制背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // 绘制地图
    ctx.drawImage(
      canvas,
      0, sourceY, mapWidth, mapHeight,
      0, 0, mapWidth, mapHeight
    );

    // ========== 绘制左侧 POI 清单面板 ==========
    if (hasPOI && totalPOIs > 0) {
      drawPOIPanel(ctx, poiByLayer, mapWidth, mapHeight, isLandscape);
    }

    // ========== 绘制图例 ==========
    drawLegend(ctx, rangeMinutes, mapWidth, mapHeight, isLandscape);

    // ========== 绘制 Footer ==========
    drawFooter(ctx, landmark, profile, rangeMinutes, qrImage, mapWidth, mapHeight, footerHeight, isLandscape, qrDisplaySize);

    // 5. 导出图片
    return new Promise((resolve) => {
      finalCanvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }

        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          
          track('share_image_success', {
            location: trackingLocation,
            method: 'clipboard',
            landmark: landmark.name,
            city: landmark.city,
            travel_mode: profile
          });
          
          alert('图片已生成并复制到剪贴板！');
          resolve(true);
        } catch (err) {
          console.warn('Clipboard API failed, falling back to download', err);
          
          track('share_image_success', {
            location: trackingLocation,
            method: 'download',
            landmark: landmark.name,
            city: landmark.city,
            travel_mode: profile
          });
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `keda-map-${landmark.name}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(true);
        }
      }, 'image/png');
    });

  } catch (err) {
    console.error('Screenshot failed:', err);
    
    track('share_image_error', {
      location: trackingLocation,
      landmark: landmark.name,
      city: landmark.city,
      error: err instanceof Error ? err.message : 'unknown'
    });
    
    alert('生成图片失败，请重试');
    return false;
  }
}

// ============ 绘制辅助函数 ============

function drawPOIPanel(
  ctx: CanvasRenderingContext2D,
  poiByLayer: POIByLayer[],
  mapWidth: number,
  mapHeight: number,
  isLandscape: boolean
) {
  const totalPOIs = poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);
  const listPanelWidth = isLandscape 
    ? Math.min(180, mapWidth * 0.18)
    : Math.min(200, mapWidth * 0.22);
  
  const listPadding = isLandscape ? 12 : 16;
  const headerHeight = 56;
  
  let neededHeight = headerHeight + 16;
  poiByLayer.forEach(layer => {
    neededHeight += 24 + layer.points.length * 22 + 12;
  });
  
  const maxListHeight = mapHeight - 40;
  const actualListHeight = Math.min(neededHeight, maxListHeight);

  const listX = 16;
  const listY = 16;
  
  // 背景渐变
  const bgGradient = ctx.createLinearGradient(listX, listY, listX + listPanelWidth, listY + actualListHeight);
  bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  bgGradient.addColorStop(1, 'rgba(248, 250, 252, 0.92)');
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.roundRect(listX, listY, listPanelWidth, actualListHeight, 16);
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  // 标题区域
  let currentY = listY + listPadding;

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.roundRect(listX + listPadding, currentY, 3, 18, 1.5);
  ctx.fill();
  
  ctx.fillStyle = '#1f2937';
  ctx.font = `bold ${isLandscape ? 13 : 14}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('可达热点', listX + listPadding + 10, currentY + 1);

  ctx.fillStyle = '#9ca3af';
  ctx.font = `400 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(`共 ${totalPOIs} 个地点`, listX + listPadding + 10, currentY + (isLandscape ? 16 : 18));

  currentY += headerHeight - 10;

  // 绘制各圈层
  poiByLayer.forEach((layer) => {
    if (currentY > listY + actualListHeight - 30) return;
    
    const pillWidth = ctx.measureText(formatLayerTime(layer.layerMinutes)).width + 24;
    const pillHeight = 20;
    
    ctx.fillStyle = layer.fillColor;
    ctx.beginPath();
    ctx.roundRect(listX + listPadding, currentY, pillWidth, pillHeight, pillHeight / 2);
    ctx.fill();
    
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = layer.color;
    ctx.font = `600 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(formatLayerTime(layer.layerMinutes), listX + listPadding + 12, currentY + pillHeight / 2);
    
    currentY += pillHeight + 8;

    layer.points.forEach((poi) => {
      if (currentY > listY + actualListHeight - 24) return;

      const circleX = listX + listPadding + 9;
      const circleY = currentY + 9;
      const circleRadius = isLandscape ? 7 : 8;

      ctx.shadowColor = layer.color + '40';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = layer.color;
      ctx.fill();
      
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${isLandscape ? 8 : 9}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(poi.index.toString(), circleX, circleY);

      ctx.fillStyle = '#374151';
      ctx.font = `500 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      let poiName = poi.name;
      const maxWidth = listPanelWidth - listPadding * 2 - 28;
      while (ctx.measureText(poiName).width > maxWidth && poiName.length > 0) {
        poiName = poiName.slice(0, -1);
      }
      if (poiName !== poi.name) poiName += '...';
      
      ctx.fillText(poiName, listX + listPadding + 22, currentY + 4);
      currentY += isLandscape ? 20 : 22;
    });

    currentY += 8;
  });
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  rangeMinutes: number[],
  mapWidth: number,
  mapHeight: number,
  isLandscape: boolean
) {
  const legendPadding = 10;
  const legendItemHeight = isLandscape ? 20 : 22;
  const legendWidth = isLandscape ? 110 : 120;
  const legendHeight = legendPadding * 2 + 18 + rangeMinutes.length * legendItemHeight;
  
  const legendX = mapWidth - legendWidth - 16;
  const legendY = mapHeight - legendHeight - 16;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#6b7280';
  ctx.font = `600 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('等时圈范围', legendX + legendPadding, legendY + legendPadding);

  rangeMinutes.forEach((minutes, index) => {
    const { color, fillColor } = getColorForRange(minutes);
    const itemY = legendY + legendPadding + 18 + index * legendItemHeight;
    
    const boxSize = isLandscape ? 14 : 16;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(legendX + legendPadding, itemY, boxSize, boxSize, 3);
    ctx.fill();
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = `500 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(`${minutes} 分钟`, legendX + legendPadding + boxSize + 8, itemY + 2);
  });
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  landmark: CityLandmark,
  profile: TravelProfile,
  rangeMinutes: number[],
  qrImage: HTMLImageElement,
  mapWidth: number,
  mapHeight: number,
  footerHeight: number,
  isLandscape: boolean,
  qrDisplaySize: number
) {
  const footerY = mapHeight;
  const canvasWidth = mapWidth;
  
  // Footer 背景渐变
  const footerGradient = ctx.createLinearGradient(0, footerY, 0, footerY + footerHeight);
  footerGradient.addColorStop(0, '#fafafa');
  footerGradient.addColorStop(1, '#f5f5f5');
  ctx.fillStyle = footerGradient;
  ctx.fillRect(0, footerY, canvasWidth, footerHeight);

  // 顶部分割线
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(canvasWidth, footerY);
  ctx.stroke();

  const padding = isLandscape ? 24 : 28;
  const qrSize = qrDisplaySize;
  const isNarrowScreen = canvasWidth < 500;
  
  const modeText = profile === 'driving-car' ? '驾车' : 
                   profile === 'cycling-regular' ? '骑行' : '步行';
  const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
  const rangeText = maxMinutes >= 60 
    ? `${Math.round(maxMinutes / 60 * 10) / 10}h`
    : `${maxMinutes}min`;
  
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const fullDateStr = `${dateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (isNarrowScreen) {
    // 窄屏两栏布局
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(landmark.name, padding, footerY + 28);

    ctx.fillStyle = '#6b7280';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${modeText} | ${rangeText} 可达`, padding, footerY + 52);

    ctx.fillStyle = '#10b981';
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('可达出行', padding, footerY + 76);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '400 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(dateStr, padding + 50, footerY + 76);

    // 右栏：二维码
    const qrX = canvasWidth - padding - qrSize;
    const qrY = footerY + (footerHeight - qrSize - 12) / 2;
    
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.imageSmoothingEnabled = true;
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '400 9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('扫码查看', qrX + qrSize / 2, qrY + qrSize + 10);
    
  } else {
    // 宽屏三栏布局
    const leftColumnX = padding;
    const centerX = canvasWidth / 2;
    const rightColumnX = canvasWidth - padding - qrSize;

    // 左栏：地点信息
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${isLandscape ? 22 : 26}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const leftLineY1 = footerY + (isLandscape ? 32 : 38);
    ctx.fillText(landmark.name, leftColumnX, leftLineY1);

    ctx.fillStyle = '#6b7280';
    ctx.font = `500 ${isLandscape ? 14 : 16}px system-ui, -apple-system, sans-serif`;
    const leftLineY2 = footerY + (isLandscape ? 58 : 70);
    ctx.fillText(`${modeText}  |  ${rangeText} 可达范围`, leftColumnX, leftLineY2);

    ctx.fillStyle = '#9ca3af';
    ctx.font = `400 ${isLandscape ? 11 : 13}px system-ui, -apple-system, sans-serif`;
    const leftLineY3 = footerY + (isLandscape ? 80 : 96);
    ctx.fillText(fullDateStr, leftColumnX, leftLineY3);

    // 中栏：品牌 Logo
    ctx.textAlign = 'center';
    
    const logoSize = isLandscape ? 26 : 30;
    const logoY = footerY + (isLandscape ? 28 : 34);

    ctx.fillStyle = '#10b981';
    ctx.shadowColor = 'rgba(16, 185, 129, 0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(centerX - logoSize / 2, logoY - logoSize / 2, logoSize, logoSize, 7);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const iconSize = isLandscape ? 10 : 12;
    ctx.beginPath();
    ctx.moveTo(centerX - iconSize, logoY + iconSize / 2);
    ctx.lineTo(centerX - iconSize / 3, logoY - iconSize / 2);
    ctx.lineTo(centerX + iconSize / 3, logoY + iconSize / 2);
    ctx.lineTo(centerX + iconSize, logoY - iconSize / 2);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${isLandscape ? 16 : 18}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('可达出行', centerX, footerY + (isLandscape ? 56 : 66));

    ctx.fillStyle = '#9ca3af';
    ctx.font = `400 ${isLandscape ? 10 : 12}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('探索你的小时边界', centerX, footerY + (isLandscape ? 74 : 86));

    ctx.fillStyle = '#10b981';
    ctx.font = `400 ${isLandscape ? 9 : 11}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('https://keda.kuhung.me', centerX, footerY + (isLandscape ? 88 : 102));

    // 右栏：二维码
    const qrX = rightColumnX;
    const qrY = footerY + (footerHeight - qrSize - (isLandscape ? 12 : 16)) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#9ca3af';
    ctx.font = `400 ${isLandscape ? 9 : 10}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('扫码查看本地图', qrX + qrSize / 2, qrY + qrSize + (isLandscape ? 12 : 14));
  }
}

