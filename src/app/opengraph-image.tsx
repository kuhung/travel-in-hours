import { ImageResponse } from 'next/og';

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
          background: '#0f172a',
          color: 'white',
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
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
            zIndex: 0,
          }}
        />
        
        {/* 主要内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '20px' }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #34d399, #10b981)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            出行可达地图
          </div>
          <div style={{ fontSize: 40, color: '#94a3b8', marginTop: 20 }}>
            Travel Reach Map
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#f1f5f9',
              marginTop: 40,
              padding: '10px 30px',
              border: '2px solid #334155',
              borderRadius: '50px',
              background: 'rgba(30, 41, 59, 0.5)',
            }}
          >
            探索你的 1-3 小时生活圈 🚗 🚴‍♀️ 🚶
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

