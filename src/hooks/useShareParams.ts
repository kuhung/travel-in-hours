'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cityLandmarks } from '@/data/landmarks';
import { parseShareParams } from '@/lib/share-params';

/** Capture the arrival URL once. Editing or moving to a personal exploration cannot replay it. */
export function useShareParams() {
  const searchParams = useSearchParams();
  const [result] = useState(() => parseShareParams(searchParams.toString(), cityLandmarks));
  return result;
}
