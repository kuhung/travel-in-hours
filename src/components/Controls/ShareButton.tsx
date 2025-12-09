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
                   cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        选择地点后分享
      </button>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setShowOptions(!showOptions)}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 
                   text-white font-medium hover:from-emerald-600 hover:to-teal-600 
                   transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        分享可达地图
      </button>

      {showOptions && (
        <div className="absolute bottom-full left-0 right-0 mb-2 
                        bg-slate-800 border border-white/10 rounded-xl 
                        shadow-xl overflow-hidden">
          <button
            onClick={handleCopyLink}
            className="w-full px-4 py-3 text-left hover:bg-white/10 
                     transition-colors flex items-center gap-3 text-white"
          >
            <span className="text-lg">🔗</span>
            <span>{copied ? '已复制!' : '复制链接'}</span>
          </button>
          <button
            onClick={() => handleShare('weibo')}
            className="w-full px-4 py-3 text-left hover:bg-white/10 
                     transition-colors flex items-center gap-3 text-white"
          >
            <span className="text-lg">📱</span>
            <span>分享到微博</span>
          </button>
          <button
            onClick={() => handleShare('twitter')}
            className="w-full px-4 py-3 text-left hover:bg-white/10 
                     transition-colors flex items-center gap-3 text-white"
          >
            <span className="text-lg">🐦</span>
            <span>分享到 Twitter</span>
          </button>
          <button
            onClick={() => handleShare('wechat')}
            className="w-full px-4 py-3 text-left hover:bg-white/10 
                     transition-colors flex items-center gap-3 text-white"
          >
            <span className="text-lg">💬</span>
            <span>分享到微信</span>
          </button>
        </div>
      )}
    </div>
  );
}

