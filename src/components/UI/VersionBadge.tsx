'use client';

const version =
  process.env.NEXT_PUBLIC_GIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  'dev';

export default function VersionBadge() {
  return (
    <div
      className="absolute bottom-3 left-3 z-20 pointer-events-none"
      title={`Git ${version}`}
    >
      <span className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                       bg-white/95 text-slate-600 text-[11px] font-mono backdrop-blur-sm
                       border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        {version}
      </span>
    </div>
  );
}
