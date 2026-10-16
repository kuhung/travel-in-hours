'use client';

import { Analytics } from '@vercel/analytics/next';
import { sanitizeAnalyticsUrl } from '@/lib/analytics';

export default function PrivacyAnalytics() {
  return <Analytics beforeSend={event => ({ ...event, url: sanitizeAnalyticsUrl(event.url) })} />;
}
