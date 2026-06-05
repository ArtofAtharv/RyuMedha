# Web Deployment

The `web/` directory contains the production Next.js application for the Ryu Medha dashboard.

## Deployment Steps

1. Install dependencies:
```bash
cd web
npm install
```

2. Build the production app:
```bash
npm run build
```

3. Deploy to Vercel (recommended):
```bash
npm i -g vercel
vercel
```

Alternatively, deploy to any Next.js-compatible hosting (Netlify, AWS Amplify, self-hosted).

## Environment Variables

Set these in your hosting platform:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public_anon_key>
NEXT_PUBLIC_WEBSITE_URL=https://ryumedha.in
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://ryumedha.in
```

## Runtime

The web app communicates with Supabase for:
- Data access and display (with RLS enforcement)
- OTP authentication for login
- Displaying analytics and study dashboards

## Performance Optimization

- **Image Optimization**: Next.js automatically optimizes images
- **Code Splitting**: Automatic code splitting per route
- **Caching**: Set `Cache-Control` headers in `next.config.ts` for static assets
- **CDN**: Vercel automatically serves via global CDN

## Monitoring

- Monitor Vercel Analytics for performance metrics
- Check server logs for auth errors
- Use Supabase console to inspect user sessions
