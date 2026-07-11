// Serves the pre-optimized static variants from public/blog-img/ (see
// scripts/generate-blog-images.mjs). Plain <picture> instead of next/image:
// static files are edge-cached by Cloudflare, while /_next/image responses
// are never cached at the edge and cost Render CPU per request.
const WIDTHS = [400, 800, 1600];

export default function BlogImage({ imageId, alt, sizes, priority = false, thumb = false, style = {} }) {
  const srcSet = (ext) => WIDTHS.map((w) => `/blog-img/${imageId}-${w}.${ext} ${w}w`).join(', ');

  if (thumb) {
    return (
      <picture>
        <source type="image/avif" srcSet={`/blog-img/${imageId}-144.avif`} />
        <img
          src={`/blog-img/${imageId}-144.webp`}
          alt={alt}
          width={72}
          height={52}
          loading="lazy"
          decoding="async"
          style={style}
        />
      </picture>
    );
  }

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      <img
        src={`/blog-img/${imageId}-800.webp`}
        srcSet={srcSet('webp')}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }}
      />
    </picture>
  );
}
