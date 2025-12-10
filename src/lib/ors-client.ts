import { TravelProfile, IsochroneResponse } from '@/types';
import { minutesToSeconds } from '@/data/isochrone-config';
import { unstable_cache } from 'next/cache';
import { snapToGrid } from './grid';

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

  // 根据出行方式应用折扣系数，避免可达范围过大
  // 驾车 x0.8, 骑行 x0.7, 步行 x0.6
  let discountFactor = 1.0;
  if (profile === 'driving-car') {
    discountFactor = 0.8;
  } else if (profile === 'cycling-regular') {
    discountFactor = 0.7;
  } else if (profile === 'foot-walking') {
    discountFactor = 0.6;
  }
  
  // 将分钟转换为秒，并应用折扣
  const rangeSeconds = rangeMinutes.map(m => minutesToSeconds(m * discountFactor));
  
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

  const data: IsochroneResponse = await response.json();

  // 修正返回数据的 properties.value
  // 因为请求时用了折扣，返回的 value 是打折后的秒数。
  // 我们需要把它改回用户请求的原始秒数，以便前端正确显示颜色和标签。
  if (data.features && discountFactor !== 1.0) {
    data.features.forEach(feature => {
      if (feature.properties && typeof feature.properties.value === 'number') {
        // 还原： value / discountFactor
        // 注意取整，避免浮点数误差
        feature.properties.value = Math.round(feature.properties.value / discountFactor);
      }
    });
  }

  return data;
}

/**
 * 生成缓存 Key
 */
function generateCacheKey(params: IsochroneRequestParams): string {
  const { coordinates: rawCoordinates, profile, rangeMinutes } = params;
  
  // 确保使用网格坐标生成 Key
  const coordinates = snapToGrid(rawCoordinates[0], rawCoordinates[1]);

  // 使用与客户端一致的精度
  const coordKey = `${coordinates[0].toFixed(6)}_${coordinates[1].toFixed(6)}`;
  const rangeKey = [...rangeMinutes].sort((a, b) => a - b).join('_');
  // v3: 增加了 value 还原逻辑，确保缓存的数据包含原始时间值
  return `ors-iso-v3-${coordKey}-${profile}-${rangeKey}`;
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

