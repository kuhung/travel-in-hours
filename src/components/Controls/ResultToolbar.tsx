'use client';

import { useState } from 'react';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { CityLandmark, TravelProfile } from '@/types';
import { getColorForRange } from '@/data/isochrone-config';
import { POIByLayer, formatLayerTime } from '@/lib/poi-utils';
import { wgs84ToGcj02 } from '@/lib/coord-transform';

interface ResultToolbarProps {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  poiByLayer?: POIByLayer[];
  onEdit: () => void;
}

export default function ResultToolbar({
  landmark,
  profile,
  rangeMinutes,
  poiByLayer = [],
  onEdit,
}: ResultToolbarProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateShareUrl = () => {
    if (!landmark) return '';
    
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || '';
    
    const params = new URLSearchParams({
      lat: landmark.coordinates[1].toString(),
      lng: landmark.coordinates[0].toString(),
      name: landmark.name,
      city: landmark.city,
      profile,
      range: rangeMinutes.join(','),
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  const handleShareImage = async () => {
    if (generating || !landmark) return;
    setGenerating(true);

    try {
      const mapElement = document.getElementById('app-map-container');
      if (!mapElement) {
        throw new Error('Map container not found');
      }

      // 0. 自动居中逻辑 (PC端和移动端)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (window as any).__leaflet_map;
      if (map && landmark) {
        // 转换坐标为 GCJ-02 (因为地图使用的是高德底图，坐标系是 GCJ-02)
        // landmark.coordinates 是 [lng, lat] (WGS-84)
        const [lng, lat] = wgs84ToGcj02(landmark.coordinates[0], landmark.coordinates[1]);
        
        // 移动地图中心
        map.setView([lat, lng], map.getZoom(), { 
          animate: false // 瞬间移动，减少动画带来的截图不确定性
        });

        // 等待瓦片加载
        // 鉴于瓦片加载需要网络，给一点缓冲时间
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

      // 2. 生成高清二维码 - 系统优化
      const shareUrl = generateShareUrl();
      
      // 获取设备像素比
      const dpr = window.devicePixelRatio || 1;
      
      // 判断屏幕方向
      const isLandscape = canvas.width > canvas.height;
      const hasPOI = poiByLayer.length > 0;
      const totalPOIs = poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);
      
      // 二维码显示尺寸优化：增大确保扫描
      const qrDisplaySize = isLandscape ? 72 : 80; // 横屏92px，竖屏108px（避免超出边界）
      const qrGenerateSize = qrDisplaySize * dpr * 2; // 生成超高清二维码
      
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        margin: 1,
        width: qrGenerateSize,
        errorCorrectionLevel: 'M', // M级纠错更平衡
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      const qrImage = new Image();
      qrImage.src = qrDataUrl;
      await new Promise((resolve) => { qrImage.onload = resolve; });

      // 3. Footer高度
      const footerHeight = isLandscape ? 100 : 120;
      
      // 计算裁剪区域（仅针对竖屏）
      let mapWidth = canvas.width;
      let mapHeight = canvas.height;
      let sourceY = 0;

      if (!isLandscape) {
        // 竖屏模式：确保最终图片比例为 3:4 (0.75)
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

      // 使用高DPI确保清晰
      const scale = Math.max(dpr, 2);
      finalCanvas.width = mapWidth * scale;
      finalCanvas.height = (mapHeight + footerHeight) * scale;
      
      // 缩放上下文
      ctx.scale(scale, scale);

      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // 绘制地图 (支持裁剪)
      ctx.drawImage(
        canvas,
        0, sourceY, mapWidth, mapHeight, // source x, y, w, h
        0, 0, mapWidth, mapHeight        // dest x, y, w, h
      );

      // ========== 绘制左侧 POI 清单面板 (优化设计) ==========
      if (hasPOI && totalPOIs > 0) {
        // 根据屏幕方向调整清单宽度
        const listPanelWidth = isLandscape 
          ? Math.min(180, mapWidth * 0.18)  // 横屏时更窄
          : Math.min(200, mapWidth * 0.22); // 竖屏时适中
        
        const listPadding = isLandscape ? 12 : 16;
        const headerHeight = 56;
        
        // 计算清单实际需要的高度
        let neededHeight = headerHeight + 16;
        poiByLayer.forEach(layer => {
          neededHeight += 24 + layer.points.length * 22 + 12;
        });
        
        // 清单最大高度限制
        const maxListHeight = mapHeight - 40;
        const actualListHeight = Math.min(neededHeight, maxListHeight);

        // ===== 清单容器 - 现代磨砂玻璃效果 =====
        const listX = 16;
        const listY = 16;
        
        // 背景渐变 - 从左上到右下的微妙渐变
        const bgGradient = ctx.createLinearGradient(listX, listY, listX + listPanelWidth, listY + actualListHeight);
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        bgGradient.addColorStop(1, 'rgba(248, 250, 252, 0.92)');
        
        // 绘制圆角矩形背景
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.roundRect(listX, listY, listPanelWidth, actualListHeight, 16);
        ctx.fill();
        
        // 边框 - 细微的白色光泽边
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // ===== 标题区域 =====
        let currentY = listY + listPadding;

        // 标题装饰线条
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(listX + listPadding, currentY, 3, 18, 1.5);
        ctx.fill();
        
        // 标题文字
        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${isLandscape ? 13 : 14}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('可达热点', listX + listPadding + 10, currentY + 1);

        // 副标题
        ctx.fillStyle = '#9ca3af';
        ctx.font = `400 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(`共 ${totalPOIs} 个地点`, listX + listPadding + 10, currentY + (isLandscape ? 16 : 18));

        currentY += headerHeight - 10;

        // ===== 绘制各圈层 =====
        poiByLayer.forEach((layer) => {
          if (currentY > listY + actualListHeight - 30) return;
          
          // 圈层标签 - 药丸形状
          const pillWidth = ctx.measureText(formatLayerTime(layer.layerMinutes)).width + 24;
          const pillHeight = 20;
          
          // 药丸背景
          ctx.fillStyle = layer.fillColor;
          ctx.beginPath();
          ctx.roundRect(listX + listPadding, currentY, pillWidth, pillHeight, pillHeight / 2);
          ctx.fill();
          
          // 药丸边框
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 圈层文字
          ctx.fillStyle = layer.color;
          ctx.font = `600 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(formatLayerTime(layer.layerMinutes), listX + listPadding + 12, currentY + pillHeight / 2);
          
          currentY += pillHeight + 8;

          // POI 列表
          layer.points.forEach((poi) => {
            if (currentY > listY + actualListHeight - 24) return;

            // 编号圆圈
            const circleX = listX + listPadding + 9;
            const circleY = currentY + 9;
            const circleRadius = isLandscape ? 7 : 8;

            // 圆圈阴影
            ctx.shadowColor = layer.color + '40';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 1;

            ctx.beginPath();
            ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = layer.color;
            ctx.fill();
            
            ctx.shadowColor = 'transparent';

            // 编号文字
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${isLandscape ? 8 : 9}px system-ui, -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(poi.index.toString(), circleX, circleY);

            // POI 名称
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

      // ===== 绘制图例 (优化设计) =====
      const legendPadding = 10;
      const legendItemHeight = isLandscape ? 20 : 22;
      const legendWidth = isLandscape ? 110 : 120;
      const legendHeight = legendPadding * 2 + 18 + rangeMinutes.length * legendItemHeight;
      
      // 图例位置 - 统一放右下角，与页面布局逻辑一致
      const legendX = mapWidth - legendWidth - 16;
      // Legend Y 定位基于裁剪后的地图高度
      const legendY = mapHeight - legendHeight - 16;

      // 图例背景 - 磨砂玻璃
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

      // 图例标题
      ctx.fillStyle = '#6b7280';
      ctx.font = `600 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('等时圈范围', legendX + legendPadding, legendY + legendPadding);

      // 图例项
      rangeMinutes.forEach((minutes, index) => {
        const { color, fillColor } = getColorForRange(minutes);
        const itemY = legendY + legendPadding + 18 + index * legendItemHeight;
        
        // 色块 - 圆角
        const boxSize = isLandscape ? 14 : 16;
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.roundRect(legendX + legendPadding, itemY, boxSize, boxSize, 3);
        ctx.fill();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#374151';
        ctx.font = `500 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(`${minutes} 分钟`, legendX + legendPadding + boxSize + 8, itemY + 2);
      });

      // ========== Footer 区域 - 响应式两栏/三栏布局 ==========
      const footerY = mapHeight;
      const canvasWidth = mapWidth; // 使用逻辑宽度
      
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
      // 使用优化后的二维码尺寸
      const qrSize = qrDisplaySize;

      // 判断是否需要简化布局（窄屏幕）
      const isNarrowScreen = canvasWidth < 500;
      
      if (isNarrowScreen) {
        // ===== 窄屏两栏布局：左侧信息 + 右侧二维码 =====
        
        // 左栏：地点信息
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
        ctx.fillText(landmark.name, padding, footerY + 28);

        const modeText = profile === 'driving-car' ? '驾车' : 
                         profile === 'cycling-regular' ? '骑行' : '步行';
        const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
        const rangeText = maxMinutes >= 60 
          ? `${Math.round(maxMinutes / 60 * 10) / 10}h`
          : `${maxMinutes}min`;
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '500 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${modeText} | ${rangeText} 可达`, padding, footerY + 52);

        // 品牌和日期
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
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
        
        // 高质量二维码绘制
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
        ctx.imageSmoothingEnabled = true;
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '400 9px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('扫码查看', qrX + qrSize / 2, qrY + qrSize + 10);
        
      } else {
        // ===== 宽屏三栏布局 =====
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

      const modeText = profile === 'driving-car' ? '驾车' : 
                       profile === 'cycling-regular' ? '骑行' : '步行';
      const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
      const rangeText = maxMinutes >= 60 
        ? `${Math.round(maxMinutes / 60 * 10) / 10}h 可达范围`
        : `${maxMinutes}min 可达范围`;
      
      ctx.fillStyle = '#6b7280';
        ctx.font = `500 ${isLandscape ? 14 : 16}px system-ui, -apple-system, sans-serif`;
        const leftLineY2 = footerY + (isLandscape ? 58 : 70);
      ctx.fillText(`${modeText}  |  ${rangeText}`, leftColumnX, leftLineY2);

      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      ctx.fillStyle = '#9ca3af';
        ctx.font = `400 ${isLandscape ? 11 : 13}px system-ui, -apple-system, sans-serif`;
        const leftLineY3 = footerY + (isLandscape ? 80 : 96);
      ctx.fillText(dateStr, leftColumnX, leftLineY3);

        // 中栏：品牌 Logo
      ctx.textAlign = 'center';
      
        const logoSize = isLandscape ? 26 : 30;
        const logoY = footerY + (isLandscape ? 28 : 34);

        // Logo 背景
      ctx.fillStyle = '#10b981';
        ctx.shadowColor = 'rgba(16, 185, 129, 0.25)';
        ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
        ctx.roundRect(centerX - logoSize / 2, logoY - logoSize / 2, logoSize, logoSize, 7);
      ctx.fill();
      ctx.shadowColor = 'transparent';

        // Logo 图标
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

      // 品牌名称
        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${isLandscape ? 16 : 18}px system-ui, -apple-system, sans-serif`;
        ctx.fillText('可达出行', centerX, footerY + (isLandscape ? 56 : 66));

      // Slogan
      ctx.fillStyle = '#9ca3af';
        ctx.font = `400 ${isLandscape ? 10 : 12}px system-ui, -apple-system, sans-serif`;
        ctx.fillText('探索你的小时边界', centerX, footerY + (isLandscape ? 74 : 86));

      // 网址
      ctx.fillStyle = '#10b981';
        ctx.font = `400 ${isLandscape ? 9 : 11}px system-ui, -apple-system, sans-serif`;
        ctx.fillText('https://keda.kuhung.me', centerX, footerY + (isLandscape ? 88 : 102));

        // 右栏：二维码
        const qrX = rightColumnX;
        const qrY = footerY + (footerHeight - qrSize - (isLandscape ? 12 : 16)) / 2;

        // 二维码容器
      ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        
        // 高质量二维码绘制
        ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
        ctx.imageSmoothingEnabled = true;

      ctx.fillStyle = '#9ca3af';
        ctx.font = `400 ${isLandscape ? 9 : 10}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
        ctx.fillText('扫码查看本地图', qrX + qrSize / 2, qrY + qrSize + (isLandscape ? 12 : 14));
      }

      finalCanvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('图片已生成并复制到剪贴板！');
        } catch (err) {
          console.warn('Clipboard API failed, falling back to download', err);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `keda-map-${landmark.name}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');

    } catch (err) {
      console.error('Screenshot failed:', err);
      alert('生成图片失败，请重试');
    } finally {
      setGenerating(false);
      setShowShareOptions(false);
    }
  };

  const handleShare = async (platform: 'weibo' | 'twitter' | 'wechat') => {
    const url = generateShareUrl();
    if (!url) return;
    
    const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
    const hours = Math.round((maxMinutes / 60) * 10) / 10;
    
    let title = '';
    if (profile === 'driving-car') {
      title = `一脚油门，从${landmark?.name}出发${hours}小时能逃离到哪里？我的周末逃离计划已生成！`;
    } else if (profile === 'cycling-regular') {
      title = maxMinutes <= 60 
        ? `在${landmark?.name}骑行${maxMinutes}分钟能去哪？我的城市漫游地图已生成！`
        : `挑战自我！从${landmark?.name}出发骑行${hours}小时，探索城市边界。`;
    } else {
      title = maxMinutes <= 60
        ? `丈量${landmark?.name}，发现身边未知的惊喜。你的1小时生活圈有多大？`
        : `从${landmark?.name}出发步行${hours}小时，这是我的城市探索足迹。`;
    }
    
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
      case 'wechat':
        // 微信分享主要依赖页面 meta 标签，提示用户使用自带分享功能
        alert('请使用微信扫描页面二维码，点击右上角"..."分享给朋友');
        break;
    }
    
    setShowShareOptions(false);
  };

  const profileName = profile === 'driving-car' 
    ? '驾车' 
    : profile === 'cycling-regular' 
      ? '骑行' 
      : '步行';

  return (
    <div className="absolute top-4 right-4 z-30 flex items-stretch gap-2">
      {/* 编辑按钮 */}
      <button
        onClick={onEdit}
        className="
          bg-white/90 backdrop-blur shadow-lg border border-white/20
          text-gray-700 hover:bg-white hover:text-emerald-600
          transition-all duration-200
          flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl
        "
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <div className="hidden sm:flex flex-col items-start whitespace-nowrap">
          <span className="text-sm font-bold leading-tight">编辑</span>
          <span className="text-[10px] text-gray-500 leading-tight">
            {landmark?.name.slice(0, 4) || '地点'} · {profileName}
          </span>
        </div>
      </button>

      {/* 分享按钮 */}
      <div className="relative">
        <button
          onClick={() => setShowShareOptions(!showShareOptions)}
          className="
            h-full bg-gradient-to-r from-emerald-500 to-teal-600 
            text-white hover:from-emerald-400 hover:to-teal-500
            shadow-lg shadow-emerald-500/20 border border-emerald-400/20
            transition-all duration-200
            flex items-center gap-2 py-2.5 px-3.5 rounded-xl
          "
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline text-sm font-bold">分享</span>
        </button>

        {/* 分享选项下拉菜单 */}
        {showShareOptions && (
          <>
            {/* 点击外部关闭 */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowShareOptions(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-56
                            bg-white/98 backdrop-blur-xl border border-gray-200 rounded-xl 
                            shadow-2xl overflow-hidden animate-fade-in z-50">
              
              {/* 生成图片按钮 */}
              <button
                onClick={handleShareImage}
                disabled={generating}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 
                         transition-colors flex items-center gap-3 text-gray-700 text-sm disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  {generating ? (
                    <svg className="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <span>{generating ? '生成中...' : '保存分享图片'}</span>
              </button>

              <button
                onClick={() => handleShare('weibo')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 
                         transition-colors flex items-center gap-3 text-gray-700 text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.098 20c-4.612 0-8.348-2.717-8.348-6.057 0-1.74.96-3.75 2.609-5.653 2.197-2.536 4.754-3.898 5.73-3.064.53.455.49 1.263.15 2.137-.16.416.38.25.38.25 1.84-.757 3.46-.78 3.92.15.24.485.13 1.175-.27 1.94-.13.244 0 .37.2.33 1.14-.23 2.01-.16 2.37.32.19.26.22.59.09.97-.25.73-.82 1.51-1.62 2.32.16.12.32.25.46.39.61.57.94 1.17.94 1.8 0 2.89-3.04 4.12-6.66 4.12zm-3.73-7.14c-1.84.89-2.89 2.28-2.54 3.38.37 1.15 2.02 1.62 3.81.97 1.79-.65 3.02-2.07 2.74-3.24-.27-1.12-2.17-1.99-4.01-1.11z"/>
                  </svg>
                </div>
                <span>分享到微博</span>
              </button>
              
              <button
                onClick={() => handleShare('twitter')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 
                         transition-colors flex items-center gap-3 text-gray-700 text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <span>分享到推特</span>
              </button>
              
              <button
                onClick={() => handleShare('wechat')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 
                         transition-colors flex items-center gap-3 text-gray-700 text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.328.328 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.406-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
                  </svg>
                </div>
                <span>分享到微信</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
