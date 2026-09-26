import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://keda.kuhung.me/',
      lastModified: new Date('2026-09-07'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://keda.kuhung.me/zhuhai-immigration',
      lastModified: new Date('2026-09-26'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]
}
