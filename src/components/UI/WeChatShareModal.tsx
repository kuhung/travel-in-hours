'use client';

import { useState, useEffect, useCallback } from 'react';
import { track } from '@vercel/analytics';
import QRCode from 'qrcode';

interface WeChatShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  landmarkName: string;
  city: string;
  travelMode: string;
  maxMinutes: number;
  onSaveImage?: () => void;
}

export function WeChatShareModal({
  isOpen,
  onClose,
  shareUrl,
  landmarkName,
  city,
  travelMode,
  maxMinutes,
  onSaveImage,
}: WeChatShareModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qrcode' | 'link'>('qrcode');

  // 生成二维码
  useEffect(() => {
    if (isOpen && shareUrl) {
      QRCode.toDataURL(shareUrl, {
        margin: 2,
        width: 200,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#1f2937',
          light: '#ffffff',
        },
      }).then(setQrCodeUrl);
    }
  }, [isOpen, shareUrl]);

  // 复制链接
  const handleCopyLink = useCallback(async () => {
    let copySuccess = false;
    
    // 方法1: 尝试使用现代 Clipboard API
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareUrl);
        copySuccess = true;
      }
    } catch (err) {
      console.warn('Clipboard API failed:', err);
    }
    
    // 方法2: 如果方法1失败，使用 execCommand 降级方案
    if (!copySuccess) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
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
    
    // 根据结果显示反馈
    if (copySuccess) {
      setCopied(true);
      
      track('wechat_share_copy_link', {
        landmark: landmarkName,
        city,
        travel_mode: travelMode,
      });
      
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert('复制失败，请手动复制链接');
    }
  }, [shareUrl, landmarkName, city, travelMode]);

  // 关闭弹窗时追踪
  const handleClose = useCallback(() => {
    track('wechat_share_modal_closed', {
      landmark: landmarkName,
      city,
    });
    onClose();
  }, [onClose, landmarkName, city]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const modeText = travelMode === 'driving-car' ? '驾车' : 
                   travelMode === 'cycling-regular' ? '骑行' : '步行';
  const rangeText = maxMinutes >= 60 
    ? `${Math.round(maxMinutes / 60 * 10) / 10}小时`
    : `${maxMinutes}分钟`;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4">
          <button
            onClick={handleClose}
            className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 
                       flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.328.328 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.406-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">分享到微信</h3>
              <p className="text-white/80 text-xs">让好友看看你的出行可达范围</p>
            </div>
          </div>
        </div>

        {/* 分享信息卡片 */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{landmarkName}</p>
              <p className="text-xs text-gray-500">{city} | {modeText} {rangeText}可达</p>
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'qrcode' 
                ? 'text-emerald-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            扫码分享
            {activeTab === 'qrcode' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'link' 
                ? 'text-emerald-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            复制链接
            {activeTab === 'link' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-5">
          {activeTab === 'qrcode' ? (
            <div className="flex flex-col items-center">
              {/* 二维码 */}
              <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm mb-4">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="分享二维码" 
                    className="w-[180px] h-[180px]"
                  />
                ) : (
                  <div className="w-[180px] h-[180px] flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* 提示文字 */}
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600 font-medium">
                  微信扫一扫，查看可达地图
                </p>
                <p className="text-xs text-gray-400">
                  或截图发送给好友
                </p>
              </div>

              {/* 分享步骤 */}
              <div className="mt-5 w-full bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-medium mb-3">分享步骤</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-medium">1</span>
                    <span>保存或截图二维码</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-medium">2</span>
                    <span>打开微信，发送给好友或朋友圈</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-medium">3</span>
                    <span>好友扫码即可查看同款地图</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 链接输入框 */}
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-4 py-3 pr-20 bg-gray-50 border border-gray-200 rounded-xl 
                           text-sm text-gray-600 truncate focus:outline-none focus:ring-2 
                           focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <button
                  onClick={handleCopyLink}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg 
                             text-xs font-medium transition-all ${
                    copied 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>

              {/* 分享步骤 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-medium mb-3">分享步骤</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-medium">1</span>
                    <span>点击上方「复制」按钮</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-medium">2</span>
                    <span>打开微信，粘贴链接发送给好友</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-medium">3</span>
                    <span>好友点击链接即可查看</span>
                  </div>
                </div>
              </div>

              {/* 提示 */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-700">
                  微信会自动识别链接，好友点击即可打开查看地图
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-5 pb-5">
          {activeTab === 'qrcode' ? (
            // 扫码分享页面：保存图片按钮
            <button
              onClick={() => {
                onClose();
                onSaveImage?.();
              }}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 
                         text-white rounded-xl font-medium hover:from-emerald-400 hover:to-teal-500 
                         transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]
                         flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>保存分享图片</span>
            </button>
          ) : (
            // 复制链接页面：复制链接按钮
            <button
              onClick={handleCopyLink}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 
                         text-white rounded-xl font-medium hover:from-emerald-400 hover:to-teal-500 
                         transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]
                         flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>链接已复制</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>一键复制链接</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

