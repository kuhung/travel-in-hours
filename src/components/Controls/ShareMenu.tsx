'use client';

import { useState } from 'react';
import { CityLandmark, TravelProfile } from '@/types';
import { POIByLayer } from '@/lib/poi-utils';
import { 
  generateShareUrl, 
  generateShareImage, 
  openSocialShare, 
  copyShareLink 
} from '@/lib/share-utils';
import { WeChatShareModal } from '@/components/UI';

interface ShareMenuProps {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: number[];
  poiByLayer?: POIByLayer[];
  /** 用于埋点追踪的位置标识 */
  trackingLocation: string;
  /** 菜单展开方向：向上或向下 */
  direction?: 'up' | 'down';
  /** 是否显示复制链接选项 */
  showCopyLink?: boolean;
  /** 关闭菜单的回调 */
  onClose?: () => void;
}

/**
 * 分享菜单组件
 * 统一的分享菜单 UI，可被 ShareButton 和 ResultToolbar 复用
 */
export default function ShareMenu({
  landmark,
  profile,
  rangeMinutes,
  poiByLayer = [],
  trackingLocation,
  direction = 'up',
  showCopyLink = true,
  onClose,
}: ShareMenuProps) {
  const [generating, setGenerating] = useState(false);
  const [showWeChatModal, setShowWeChatModal] = useState(false);

  const shareParams = { landmark, profile, rangeMinutes };

  const handleShareImage = async () => {
    if (generating) return;
    
    setGenerating(true);
    try {
      await generateShareImage({
        ...shareParams,
        poiByLayer,
        trackingLocation,
      });
    } finally {
      setGenerating(false);
      onClose?.();
    }
  };

  const handleCopyLink = async () => {
    const success = await copyShareLink(shareParams, trackingLocation);
    if (success) {
      alert('链接已复制到剪贴板');
    } else {
      alert('复制失败，请手动复制链接');
    }
    onClose?.();
  };

  const handleSocialShare = (platform: 'weibo' | 'twitter' | 'wechat') => {
    if (platform === 'wechat') {
      setShowWeChatModal(true);
    } else {
      openSocialShare(platform, shareParams, trackingLocation);
      onClose?.();
    }
  };

  const positionClasses = direction === 'up' 
    ? 'bottom-full mb-2' 
    : 'top-full mt-2';

  return (
    <>
      {/* 点击外部关闭 */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      <div className={`absolute ${positionClasses} right-0 w-56
                      bg-white/98 backdrop-blur-xl border border-gray-200 rounded-xl 
                      shadow-2xl overflow-hidden animate-fade-in z-50`}>
        
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

        {/* 复制链接按钮 */}
        {showCopyLink && (
          <button
            onClick={handleCopyLink}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 
                     transition-colors flex items-center gap-3 text-gray-700 text-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <span>复制链接</span>
          </button>
        )}

        <button
          onClick={() => handleSocialShare('weibo')}
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
          onClick={() => handleSocialShare('twitter')}
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
          onClick={() => handleSocialShare('wechat')}
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

      {/* 微信分享弹窗 */}
      <WeChatShareModal
        isOpen={showWeChatModal}
        onClose={() => {
          setShowWeChatModal(false);
          onClose?.();
        }}
        shareUrl={generateShareUrl(shareParams)}
        landmarkName={landmark.name}
        city={landmark.city}
        travelMode={profile}
        maxMinutes={rangeMinutes[rangeMinutes.length - 1]}
        onSaveImage={handleShareImage}
      />
    </>
  );
}

