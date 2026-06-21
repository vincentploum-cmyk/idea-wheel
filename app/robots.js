export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/profile/',
          '/*?next=*',
          '/*?canceled=*',
          '/*?success=*',
          '/*?package=*',
          '/*?pack=*',
          '/*?credits=*',
        ],
      },
    ],
    sitemap: 'https://ideareels.io/sitemap.xml',
  };
}
