'use client';

import dynamic from 'next/dynamic';
import { ImmigrationHall } from '@/data/zhuhai-immigration-halls';

const ImmigrationHallsMap = dynamic(() => import('./ImmigrationHallsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-400 border-t-transparent" />
        <p className="text-emerald-400 text-lg font-medium">地图加载中...</p>
      </div>
    </div>
  ),
});

interface Props {
  halls: ImmigrationHall[];
  selectedId: string | null;
  onSelect: (hall: ImmigrationHall) => void;
}

export default function ImmigrationHallsMapWrapper(props: Props) {
  return <ImmigrationHallsMap {...props} />;
}
