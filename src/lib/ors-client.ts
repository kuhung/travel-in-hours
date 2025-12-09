import { TravelProfile, IsochroneResponse } from '@/types';
import { minutesToSeconds } from '@/data/isochrone-config';

const ORS_BASE_URL = 'https://api.openrouteservice.org/v2';

interface IsochroneRequestParams {
  coordinates: [number, number]; // [lng, lat]
  profile: TravelProfile;
  rangeMinutes: number[];
}

/**
 * 调用 OpenRouteService Isochrones API
 */
export async function fetchIsochrones(
  params: IsochroneRequestParams,
  apiKey: string
): Promise<IsochroneResponse> {
  const { coordinates, profile, rangeMinutes } = params;
  
  // 将分钟转换为秒
  const rangeSeconds = rangeMinutes.map(minutesToSeconds);
  
  const requestBody = {
    locations: [coordinates],
    range: rangeSeconds,
    range_type: 'time',
    attributes: ['area', 'total_pop'],
  };

  const response = await fetch(`${ORS_BASE_URL}/isochrones/${profile}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API 请求失败: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 验证 API Key 是否有效
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    // 使用一个简单的测试请求
    const response = await fetch(`${ORS_BASE_URL}/isochrones/driving-car`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({
        locations: [[8.681495, 50.114787]], // 德国法兰克福 (ORS 总部)
        range: [300], // 5 分钟
      }),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

