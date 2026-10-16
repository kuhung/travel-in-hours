import { ImageResponse } from 'next/og';
import { VISUAL_THEME } from '@/data/isochrone-config';

export const runtime = 'edge';

export const alt = '出行可达地图 - 探索你的1小时生活圈';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: VISUAL_THEME.surface,
          color: VISUAL_THEME.ink,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 背景装饰 */}
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            width: '120%',
            height: '120%',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)',
            zIndex: 0,
          }}
        />
        
        {/* 主要内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '20px' }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: VISUAL_THEME.ink,
            }}
          >
            出行可达地图
          </div>
          <div style={{ fontSize: 40, color: '#475569', marginTop: 20 }}>
            Travel Reach Map
          </div>
          <div
            style={{
              fontSize: 32,
              color: VISUAL_THEME.primaryDark,
              marginTop: 40,
              padding: '10px 30px',
              border: '2px solid #bfdbfe',
              borderRadius: '50px',
              background: '#eff6ff',
            }}
          >
            探索你的 1 小时生活圈 🚗 🚴 🚶
          </div>
        </div>

        {/* 底部装饰 */}
        <div style={{ position: 'absolute', bottom: 40, fontSize: 24, color: '#64748b' }}>
          https://keda.kuhung.me
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

