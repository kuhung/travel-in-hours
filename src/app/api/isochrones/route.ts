import { NextRequest, NextResponse } from 'next/server';
import { fetchIsochrones } from '@/lib/ors-client';
import { TravelProfile } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinates, profile, rangeMinutes } = body;

    // 参数验证
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return NextResponse.json(
        { error: '无效的坐标格式' },
        { status: 400 }
      );
    }

    if (!profile || !['driving-car', 'cycling-regular', 'foot-walking'].includes(profile)) {
      return NextResponse.json(
        { error: '无效的出行方式' },
        { status: 400 }
      );
    }

    if (!rangeMinutes || !Array.isArray(rangeMinutes) || rangeMinutes.length === 0) {
      return NextResponse.json(
        { error: '无效的时间范围' },
        { status: 400 }
      );
    }

    // 获取 API Key
    const apiKey = process.env.ORS_API_KEY;
    
    // Debug logging for API Key (masked)
    if (apiKey) {
      console.log('API Key loaded:', `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
    } else {
      console.error('API Key missing in environment variables');
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '服务器配置错误：缺少 API Key' },
        { status: 500 }
      );
    }

    // 调用 ORS API
    const data = await fetchIsochrones(
      {
        coordinates: coordinates as [number, number],
        profile: profile as TravelProfile,
        rangeMinutes: rangeMinutes as number[],
      },
      apiKey
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Isochrones API error:', error);
    
    const status = error.status || 500;
    const message = error.message || '未知错误';
    
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

