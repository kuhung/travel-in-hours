'use client';

import { useState } from 'react';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { CityLandmark, TravelProfile } from '@/types';
import { getColorForRange } from '@/data/isochrone-config';

interface ShareButtonProps {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  hasData?: boolean;
}

export default function ShareButton({ landmark, profile, rangeMinutes, hasData = false }: ShareButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
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
    if (generating || !landmark || !hasData) return;
    setGenerating(true);

    try {
      const mapElement = document.getElementById('app-map-container');
      if (!mapElement) {
        throw new Error('Map container not found');
      }

      // 1. 截图地图
      // 使用 ignoreElements 来隐藏不需要的控件 (Leaflet controls)
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        ignoreElements: (element) => {
          // 隐藏 leaflet 的控件 (zoom, attribution 等)
          // 也可以通过 class name 匹配
          return element.classList.contains('leaflet-control-container');
        }
      });

      // 2. 生成二维码
      const shareUrl = generateShareUrl();
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        margin: 0,
        width: 80,
        color: {
          dark: '#9ca3af', // gray-400
          light: '#00000000' // 透明背景
        }
      });
      const qrImage = new Image();
      qrImage.src = qrDataUrl;
      await new Promise((resolve) => { qrImage.onload = resolve; });

      // 3. 创建合成画布 (增加底部 Footer)
      const footerHeight = 160;
      const finalCanvas = document.createElement('canvas');
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // 设置高倍率以保证清晰度 (简单的做法是直接用 html2canvas 的结果尺寸，通常已经是屏幕分辨率)
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height + footerHeight;

      // 绘制背景 (白色)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // 绘制地图
      ctx.drawImage(canvas, 0, 0);

      // --- 绘制图例 (Legend) ---
      // 样式参考 MapLegend.tsx
      // 位置：地图区域左下角，距离底部稍微留一点空隙 (Footer 之上)
      const legendWidth = 140;
      const legendPadding = 12;
      const legendItemHeight = 24;
      const legendHeight = legendPadding * 2 + 20 + rangeMinutes.length * legendItemHeight; // 标题高度约20
      
      const legendX = 20; // 左边距
      const legendY = canvas.height - legendHeight - 20; // 距离地图底边 20px

      // 图例背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // white/90
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      
      // 绘制圆角矩形背景
      const radius = 8;
      ctx.beginPath();
      ctx.roundRect(legendX, legendY, legendWidth, legendHeight, radius);
      ctx.fill();
      ctx.shadowColor = 'transparent'; // 重置阴影

      // 边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 图例标题
      ctx.fillStyle = '#6b7280'; // gray-500
      ctx.font = '600 12px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('等时圈范围', legendX + legendPadding, legendY + legendPadding);

      // 图例项
      rangeMinutes.forEach((minutes, index) => {
        const { color, fillColor } = getColorForRange(minutes);
        const itemY = legendY + legendPadding + 20 + index * legendItemHeight;
        
        // 色块
        const boxSize = 16;
        ctx.fillStyle = fillColor; // 填充色
        ctx.fillRect(legendX + legendPadding, itemY, boxSize, boxSize);
        
        // 色块边框
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX + legendPadding, itemY, boxSize, boxSize);

        // 文字
        ctx.fillStyle = '#374151'; // gray-700
        ctx.font = '500 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${minutes} 分钟`, legendX + legendPadding + boxSize + 8, itemY + 2);
      });

      // 绘制 Footer 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, canvas.height, finalCanvas.width, footerHeight);

      // 绘制分割线
      ctx.strokeStyle = '#f3f4f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(finalCanvas.width, canvas.height);
      ctx.stroke();

      // --- 绘制文字 ---
      const padding = 40;
      let textY = canvas.height + 36;

      // 标题: 地点名称
      ctx.fillStyle = '#111827'; // gray-900
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(landmark.name, padding, textY);
      
      textY += 50;

      // 副标题: 出行方式与坐标
      ctx.fillStyle = '#4b5563'; // gray-600
      ctx.font = '500 24px system-ui, -apple-system, sans-serif';
      
      const modeText = profile === 'driving-car' ? '驾车' : 
                       profile === 'cycling-regular' ? '骑行' : '步行';
      
      const coordText = `${landmark.coordinates[1].toFixed(4)}, ${landmark.coordinates[0].toFixed(4)}`;
      
      ctx.fillText(`${modeText} · ${coordText}`, padding, textY);

      textY += 36;

      // 网址
      ctx.fillStyle = '#059669'; // emerald-600
      ctx.font = '20px system-ui, -apple-system, sans-serif';
      ctx.fillText('https://keda.kuhung.me', padding, textY);

      // --- 绘制二维码 ---
      const qrSize = 96;
      const qrX = finalCanvas.width - padding - qrSize;
      const qrY = canvas.height + (footerHeight - qrSize) / 2;

      // QR 背景 (可选，现在是透明的)
      // ctx.fillStyle = '#f3f4f6';
      // ctx.fillRect(qrX, qrY, qrSize, qrSize);
      
      // 绘制二维码图片
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // 4. 导出图片
      finalCanvas.toBlob(async (blob) => {
        if (!blob) return;

        // 尝试构建 ClipboardItem
        try {
          // 只有 png 支持较好
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('图片已生成并复制到剪贴板！');
        } catch (err) {
          console.warn('Clipboard API failed, falling back to download', err);
          // 降级：下载
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
    }
  };

  const handleShare = async (platform: 'weibo' | 'twitter' | 'wechat') => {
    const url = generateShareUrl();
    if (!url) return;
    
    const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
    const hours = Math.round((maxMinutes / 60) * 10) / 10;
    
    let title = '';
    if (profile === 'driving-car') {
      title = `🚗 一脚油门，从${landmark?.name}出发${hours}小时能逃离到哪里？我的周末逃离计划已生成！`;
    } else if (profile === 'cycling-regular') {
      title = maxMinutes <= 60 
        ? `🚴‍♀️ 在${landmark?.name}骑行${maxMinutes}分钟能去哪？我的城市漫游地图已生成！`
        : `🚴‍♀️ 挑战自我！从${landmark?.name}出发骑行${hours}小时，探索城市边界。`;
    } else {
      title = maxMinutes <= 60
        ? `🚶 丈量${landmark?.name}，发现身边未知的惊喜。你的1小时生活圈有多大？`
        : `🚶 从${landmark?.name}出发步行${hours}小时，这是我的城市探索足迹。`;
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
    
    setShowOptions(false);
  };

  // 如果没有地点，或者（有地点但没有数据），都显示禁用状态
  // 但为了引导用户，当有地点但没数据时，文案可以区分
  if (!landmark) {
    return (
      <button 
        disabled
        className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-400 
                   cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        选择地点后可分享
      </button>
    );
  }

  // 有地点但没数据
  if (!hasData) {
    return (
      <button 
        disabled
        className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-400 
                   cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        分析范围后可分享
      </button>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setShowOptions(!showOptions)}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 
                   text-white text-sm font-medium hover:from-emerald-400 hover:to-teal-500 
                   transition-all flex items-center justify-center gap-2 
                   shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        分享可达地图
      </button>

      {showOptions && (
        <div className="absolute bottom-full left-0 right-0 mb-2 
                        bg-white/98 backdrop-blur-xl border border-gray-200 rounded-xl 
                        shadow-2xl overflow-hidden animate-fade-in z-50">
          
          {/* 生成图片按钮 - 替换了原来的复制链接 */}
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
            <span>分享到 X (Twitter)</span>
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
      )}
    </div>
  );
}
