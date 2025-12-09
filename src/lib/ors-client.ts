import { TravelProfile, IsochroneResponse } from '@/types';
import { minutesToSeconds } from '@/data/isochrone-config';
import { unstable_cache } from 'next/cache';

const ORS_BASE_URL = 'https://api.openrouteservice.org/v2';

interface IsochroneRequestParams {
  coordinates: [number, number]; // [lng, lat]
  profile: TravelProfile;
  rangeMinutes: number[];
}

/**
 * 基础 ORS API 调用
 */
async function fetchIsochronesFromAPI(
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
      'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
      'User-Agent': 'TravelIn3HoursApp/1.0',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorData;
    let errorText = '';
    
    try {
      errorText = await response.text();
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // 非 JSON 响应
      }
    } catch {
      // 无法读取响应体
    }

    console.error('[ORS Error]', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: errorText
    });

    const errorMessage = errorData?.error?.message || 
                        (typeof errorData?.error === 'string' ? errorData.error : '') || 
                        `API 请求失败: ${response.status} ${response.statusText}`; // 包含 statusText

    // 抛出带状态码的错误对象
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}

/**
 * 生成缓存 Key
 */
function generateCacheKey(params: IsochroneRequestParams): string {
  const { coordinates, profile, rangeMinutes } = params;
  // 确保数字精度一致，避免微小差异导致缓存失效
  const coordKey = `${coordinates[0].toFixed(4)}_${coordinates[1].toFixed(4)}`;
  const rangeKey = [...rangeMinutes].sort((a, b) => a - b).join('_');
  return `ors-iso-${coordKey}-${profile}-${rangeKey}`;
}

/**
 * 带服务端缓存的等时圈数据获取
 * 使用 Next.js unstable_cache 进行持久化缓存
 */
export async function fetchIsochrones(
  params: IsochroneRequestParams,
  apiKey: string
): Promise<IsochroneResponse> {
  const cacheKey = generateCacheKey(params);
  
  // 使用 unstable_cache 包装 API 调用
  const getCachedData = unstable_cache(
    async () => fetchIsochronesFromAPI(params, apiKey),
    [cacheKey], // 缓存 Key 部分
    {
      revalidate: 60 * 60 * 24 * 30, // 30天缓存 (地理数据变化不频繁)
      tags: ['isochrones', `iso-${params.profile}`],
    }
  );

  return getCachedData();
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

