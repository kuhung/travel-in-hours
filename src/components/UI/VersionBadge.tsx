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
                       bg-slate-900/75 text-white/90 text-[11px] font-mono backdrop-blur-sm
                       border border-white/10">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {version}
      </span>
    </div>
  );
}
