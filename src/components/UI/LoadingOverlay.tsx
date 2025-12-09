'use client';

interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({ message = '计算可达范围中...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 
                    flex items-center justify-center">
      <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl 
                      flex flex-col items-center gap-4 max-w-xs mx-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-400/20"></div>
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 
                          border-transparent border-t-emerald-400 animate-spin"></div>
        </div>
        <p className="text-white text-center font-medium">{message}</p>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" 
               style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" 
               style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" 
               style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

