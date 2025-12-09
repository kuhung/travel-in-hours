'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CityLandmark, TravelProfile } from '@/types';
import { cityLandmarks } from '@/data/landmarks';

interface ShareParamsResult {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  hasParams: boolean;
}

export function useShareParams(): ShareParamsResult {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ShareParamsResult>({
    landmark: null,
    profile: 'driving-car',
    rangeMinutes: [30, 60],
    hasParams: false,
  });

  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const name = searchParams.get('name');
    const city = searchParams.get('city');
    const profile = searchParams.get('profile') as TravelProfile | null;
    const rangeStr = searchParams.get('range');

    if (lat && lng && name) {
      // 尝试从预设地标中找到匹配的
      let landmark = cityLandmarks.find(
        l => l.name === name && l.city === city
      );

      // 如果没找到，创建一个自定义地标
      if (!landmark) {
        landmark = {
          id: `custom-${Date.now()}`,
          name: name,
          city: city || '自定义位置',
          province: '',
          coordinates: [parseFloat(lng), parseFloat(lat)],
        };
      }

      const parsedRanges = rangeStr
        ? rangeStr.split(',').map(Number).filter(n => !isNaN(n))
        : [30, 60];

      setResult({
        landmark,
        profile: profile && ['driving-car', 'cycling-regular', 'foot-walking'].includes(profile)
          ? profile
          : 'driving-car',
        rangeMinutes: parsedRanges.length > 0 ? parsedRanges : [30, 60],
        hasParams: true,
      });
    }
  }, [searchParams]);

  return result;
}

