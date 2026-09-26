import type { Metadata } from 'next';
import ImmigrationHallsApp from '@/components/App/ImmigrationHallsApp';

export const metadata: Metadata = {
  title: '珠海市出入境智能服务厅地图',
  description:
    '在地图上查看珠海市 15 个出入境智能服务厅位置、地址与服务时间，覆盖香洲、金湾、斗门、高栏港与高新区。',
  alternates: {
    canonical: '/zhuhai-immigration',
  },
  openGraph: {
    title: '珠海市出入境智能服务厅地图',
    description: '一图掌握珠海 15 个出入境智能服务厅位置与开放时间',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function ZhuhaiImmigrationPage() {
  return <ImmigrationHallsApp />;
}
