import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://keda.kuhung.me/',
      lastModified: new Date('2026-09-07'),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
