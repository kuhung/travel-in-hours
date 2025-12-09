'use client';

import { useState } from 'react';
import { CityLandmark, TravelProfile } from '@/types';

interface ShareButtonProps {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
}

export default function ShareButton({ landmark, profile, rangeMinutes }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

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

  const handleCopyLink = async () => {
    const url = generateShareUrl();
    if (!url) return;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleShare = async (platform: 'weibo' | 'wechat' | 'twitter') => {
    const url = generateShareUrl();
    if (!url) return;
    
    const title = `${landmark?.name} ${rangeMinutes[rangeMinutes.length - 1] >= 60 
      ? `${rangeMinutes[rangeMinutes.length - 1] / 60}小时` 
      : `${rangeMinutes[rangeMinutes.length - 1]}分钟`}可达地图`;
    
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
        // 微信需要特殊处理，这里显示二维码
        alert('请使用微信扫描页面二维码分享');
        break;
    }
    
    setShowOptions(false);
  };

  if (!landmark) {
    return (
      <button 
        disabled
        className="w-full py-3 px-4 rounded-xl bg-white/5 text-gray-500 
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

  return (
    <div className="relative">
      <button 
        onClick={() => setShowOptions(!showOptions)}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 
                   text-white text-sm font-medium hover:from-emerald-400 hover:to-teal-400 
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
                        bg-slate-800/98 backdrop-blur-xl border border-white/10 rounded-xl 
                        shadow-2xl overflow-hidden animate-fade-in">
          <button
            onClick={handleCopyLink}
            className="w-full px-4 py-3 text-left hover:bg-white/5 
                     transition-colors flex items-center gap-3 text-white text-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              {copied ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
            </div>
            <span>{copied ? '已复制!' : '复制链接'}</span>
          </button>
          <button
            onClick={() => handleShare('weibo')}
            className="w-full px-4 py-3 text-left hover:bg-white/5 
                     transition-colors flex items-center gap-3 text-white text-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.098 20c-4.612 0-8.348-2.717-8.348-6.057 0-1.74.96-3.75 2.609-5.653 2.197-2.536 4.754-3.898 5.73-3.064.53.455.49 1.263.15 2.137-.16.416.38.25.38.25 1.84-.757 3.46-.78 3.92.15.24.485.13 1.175-.27 1.94-.13.244 0 .37.2.33 1.14-.23 2.01-.16 2.37.32.19.26.22.59.09.97-.25.73-.82 1.51-1.62 2.32.16.12.32.25.46.39.61.57.94 1.17.94 1.8 0 2.89-3.04 4.12-6.66 4.12zm-3.73-7.14c-1.84.89-2.89 2.28-2.54 3.38.37 1.15 2.02 1.62 3.81.97 1.79-.65 3.02-2.07 2.74-3.24-.27-1.12-2.17-1.99-4.01-1.11z"/>
              </svg>
            </div>
            <span>分享到微博</span>
          </button>
          <button
            onClick={() => handleShare('twitter')}
            className="w-full px-4 py-3 text-left hover:bg-white/5 
                     transition-colors flex items-center gap-3 text-white text-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <span>分享到 X (Twitter)</span>
          </button>
          <button
            onClick={() => handleShare('wechat')}
            className="w-full px-4 py-3 text-left hover:bg-white/5 
                     transition-colors flex items-center gap-3 text-white text-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
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

