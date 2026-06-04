import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/Pricing') {
    const url = request.nextUrl.clone();
    url.pathname = '/pricing';
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  if (pathname === '/api/Stripe/Checkout') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/stripe/checkout';
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}
