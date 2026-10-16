'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SharePayload, POIWithLayer } from '@/types';
import { 
  copyShareLink, 
  exportShareImage, 
  downloadBlob,
  createSharePayload,
} from '@/lib/share-utils.ts';
import { formatExclusiveTierTime } from '@/lib/poi-utils.ts';
import { getPOICategoryLabel } from '@/lib/navigation-utils.ts';
import { track } from '@/lib/analytics';

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
  /** 当有选中地点时，初始分享目标，默认为 poi（若有）或 whole */
  initialTarget?: 'whole' | 'poi';
}

export default function ShareDialog({
  isOpen,
  onClose,
  payload,
  initialTarget = 'whole',
}: ShareDialogProps) {
  // 分享对象选择：整次探索 vs 所选地点
  const [targetMode, setTargetMode] = useState<'whole' | 'poi'>(initialTarget);

  // 复制链接状态
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);

  // 图片生成与导出状态
  const [imageState, setImageState] = useState<'idle' | 'generating' | 'preview' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('keda-share.png');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'initiated' | 'failed'>('idle');

  // 引用与资源守卫
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activePreviewUrlRef = useRef<string | null>(null);
  const copyRunIdRef = useRef<number>(0);
  const imageRunIdRef = useRef<number>(0);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 幂等清理会话资源与在途操作
  const cleanupSession = useCallback(() => {
    // 递增身份版本以废弃在途异步回调
    imageRunIdRef.current++;
    copyRunIdRef.current++;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }

    if (activePreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(activePreviewUrlRef.current);
      } catch (e) {
        console.warn('URL.revokeObjectURL error:', e);
      }
      activePreviewUrlRef.current = null;
    }
  }, []);

  // 完整重置 UI 状态
  const resetUI = useCallback(() => {
    cleanupSession();
    setImageState('idle');
    setErrorMessage(null);
    setPreviewUrl(null);
    setCurrentBlob(null);
    setCopyStatus('idle');
    setManualCopyUrl(null);
    setSaveStatus('idle');
  }, [cleanupSession]);

  // 打开或 payload 关键字段变化时初始化
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = (document.activeElement as HTMLElement) || null;
      resetUI();
      if (payload?.selectedPOI && initialTarget === 'poi') {
        setTargetMode('poi');
      } else {
        setTargetMode('whole');
      }
    } else {
      resetUI();
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
        triggerElementRef.current = null;
      }
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen, payload?.createdAt, payload?.selectedPOI, initialTarget, resetUI, cleanupSession]);

  // 初始焦点设置
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [isOpen]);

  // 键盘无障碍：Escape 关闭与 Tab 焦点圈守卫 (Focus Trap)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 根据 targetMode 构造实际消费的不可变 payload 快照
  const activePayload = useMemo<SharePayload | null>(() => {
    if (!payload) return null;
    if (targetMode === 'poi' && payload.selectedPOI) {
      return payload;
    }
    // 切换为整次探索时，派生不可变副本（去除特定地点选中，保持原生成时间戳）
    return createSharePayload({
      landmark: payload.conditions.landmark,
      profile: payload.conditions.profile,
      rangeMinutes: payload.conditions.rangeMinutes,
      isochrones: payload.isochrones,
      selectedPOIId: null,
      selectedPOI: null,
      totalPOIs: payload.poiInfo.totalPOIs,
      poiByLayer: payload.poiInfo.poiByLayer,
      coverageStatus: payload.poiInfo.coverageStatus,
      isPartial: payload.poiInfo.isPartial,
      isExample: payload.conditions.isExample,
      createdAt: payload.createdAt,
    });
  }, [payload, targetMode]);

  // 切换分享对象（地点 vs 探索）
  const handleSwitchTarget = (mode: 'whole' | 'poi') => {
    if (mode === targetMode) return;
    resetUI();
    setTargetMode(mode);
  };

  // 动作 1：复制链接（带请求身份保护，防止旧 URL 晚返回污染新目标）
  const handleCopyLink = async () => {
    if (!activePayload) return;
    const runId = ++copyRunIdRef.current;
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopyStatus('idle');
    setManualCopyUrl(null);

    const { success, url } = await copyShareLink(activePayload, 'share_dialog_link_button');
    if (copyRunIdRef.current !== runId) return;

    if (success) {
      setCopyStatus('copied');
      copyTimerRef.current = setTimeout(() => {
        if (copyRunIdRef.current === runId) {
          setCopyStatus('idle');
        }
      }, 3000);
    } else {
      setCopyStatus('failed');
      setManualCopyUrl(url);
    }
  };

  // 动作 2：生成图片（带会话与 runId 守卫，立即登记 ObjectURL 防泄漏）
  const handleGenerateImage = async () => {
    if (!activePayload) return;
    cleanupSession();
    const runId = imageRunIdRef.current;

    setImageState('generating');
    setErrorMessage(null);
    setSaveStatus('idle');
    setPreviewUrl(null);
    setCurrentBlob(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await exportShareImage(activePayload, {
        trackingLocation: 'share_dialog_image_button',
        signal: controller.signal,
        timeoutMs: 25000,
      });

      if (imageRunIdRef.current !== runId || controller.signal.aborted) {
        try {
          URL.revokeObjectURL(result.url);
        } catch {
          // ignore
        }
        return;
      }

      // 立即登记引用，避免状态更新与下次 cleanup 之间的泄漏窗口
      activePreviewUrlRef.current = result.url;
      setCurrentBlob(result.blob);
      setPreviewUrl(result.url);
      setCurrentFilename(result.filename);
      setImageState('preview');
    } catch (err) {
      if (imageRunIdRef.current !== runId || controller.signal.aborted) return;
      console.error('Image export failed:', err);
      setImageState('error');
      setErrorMessage(
        err instanceof Error ? err.message : '生成图片遇到错误，请检查网络后重试。'
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // 取消正在进行的生成
  const handleCancelGeneration = () => {
    cleanupSession();
    setImageState('idle');
    setErrorMessage(null);
  };

  // 保存图片（独立触发下载，可重复保存同一产物不重算）
  const handleSaveImage = () => {
    if (!currentBlob) return;
    const ok = downloadBlob(currentBlob, currentFilename);
    if (ok) {
      track('share_save_requested', { method: 'download', share_target: targetMode });
      setSaveStatus('initiated');
    } else {
      setSaveStatus('failed');
    }
  };

  if (!isOpen || !payload) return null;

  const landmark = payload.conditions.landmark;
  const profile = payload.conditions.profile;
  const modeText = profile === 'driving-car' ? '驾车' : profile === 'cycling-regular' ? '骑行' : '步行';
  const selectedPOI: POIWithLayer | null = payload.selectedPOI || null;
  const hasSelectedPOI = Boolean(selectedPOI);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <div 
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 对话框头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/70">
          <div>
            <h2 id="share-dialog-title" className="text-base font-bold text-gray-900">
              分享可达探索
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              基于已生成的等时圈快照，提供交互链接与静态卡片
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="关闭分享窗口"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 滚动内容区域 */}
        <div className="p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
          {/* 分享对象卡片与切换器（若有选中地点） */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                分享对象
              </span>
              {hasSelectedPOI && (
                <div className="inline-flex rounded-lg bg-gray-200/80 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchTarget('poi')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      targetMode === 'poi'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    所选地点
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchTarget('whole')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      targetMode === 'whole'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    整张地图
                  </button>
                </div>
              )}
            </div>

            {targetMode === 'poi' && selectedPOI ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{selectedPOI.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    {getPOICategoryLabel(selectedPOI.category)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                    {formatExclusiveTierTime(selectedPOI.layerMinutes, payload.conditions.rangeMinutes)} 预估可达
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  从「{landmark.name}」出发 · 方式: {modeText}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{landmark.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                    {modeText} · 15/30/60m
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  包含 {payload.poiInfo.totalPOIs} 处已收录热点 · 圈层互斥预估
                </p>
              </div>
            )}
          </div>

          {/* 第一层双核心通道：通道 1 - 复制链接 */}
          <div className="p-3.5 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>复制交互链接</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  接收者打开后可在可交互地图中查看与继续探索
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
              >
                {copyStatus === 'copied' ? '已复制链接' : '复制链接'}
              </button>
            </div>

            {copyStatus === 'copied' && (
              <p className="text-[11px] text-emerald-600 font-medium">
                ✓ 链接已复制到剪贴板，可直接粘贴发送
              </p>
            )}

            {copyStatus === 'failed' && manualCopyUrl && (
              <div className="space-y-1 pt-1.5 border-t border-gray-100">
                <p className="text-[10px] text-amber-700">无法自动写入剪贴板，请长按或 Ctrl+C 手动复制链接：</p>
                <textarea
                  readOnly
                  value={manualCopyUrl}
                  rows={2}
                  className="w-full text-[10px] p-2 bg-gray-50 border border-gray-200 rounded-lg select-all font-mono leading-tight"
                  onFocus={(e) => e.target.select()}
                />
              </div>
            )}
          </div>

          {/* 第一层双核心通道：通道 2 - 生成图片与预览保存 */}
          <div className="p-3.5 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>静态分享卡片</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  基于统一 960x600 离屏独立地图渲染，底部嵌入交互二维码
                </p>
              </div>

              {imageState === 'idle' && (
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  className="py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
                >
                  生成图片
                </button>
              )}
            </div>

            {/* 生成中状态 */}
            {imageState === 'generating' && (
              <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-teal-800">
                  <svg className="w-4 h-4 animate-spin text-teal-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>正在渲染离屏地图快照与卡片...</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="text-xs text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  取消
                </button>
              </div>
            )}

            {/* 错误与原地重试 */}
            {imageState === 'error' && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 space-y-2">
                <p>{errorMessage || '生成图片遇到问题，请重试。'}</p>
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  className="py-1 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  重试生成
                </button>
              </div>
            )}

            {/* 成功预览与显式保存 */}
            {imageState === 'preview' && previewUrl && (
              <div className="space-y-3 pt-1">
                <div className="relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden max-h-56 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="分享卡片预览"
                    className="max-h-56 w-auto object-contain select-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveImage}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>保存图片</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateImage}
                    className="py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-xs transition-colors cursor-pointer shrink-0"
                    title="按当前条件重新渲染"
                  >
                    重新生成
                  </button>
                </div>

                {saveStatus === 'initiated' && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    ✓ 已发起下载，请在浏览器下载记录中查看。手机端亦可长按上方图片存储。
                  </p>
                )}
                {saveStatus === 'failed' && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 space-y-1">
                    <p>自动发起下载受限，请长按或右键上方图片存储；亦可点击在新标签页查看：</p>
                    <a
                      href={previewUrl}
                      onClick={() => track('share_save_requested', { method: 'open_preview', share_target: targetMode })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-emerald-700 font-medium underline"
                    >
                      在新标签页中打开原始图片
                    </a>
                  </div>
                )}
                {saveStatus === 'idle' && (
                  <p className="text-[10px] text-gray-400">
                    点击保存图片将发起 PNG 文件下载。手机浏览器中亦可长按上方卡片直接存储。
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部信息与完成关闭 */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-400 flex items-center justify-between">
          <span>等时圈数据基于 OpenRouteService · 地图 © 高德地图</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
