"use client";

import { useEffect, useState } from "react";

type GalleryImage = { id: string; url: string; alt: string };

export function ProductGallery({ images, previousLabel, nextLabel, slideLabel }: { images: GalleryImage[]; previousLabel: string; nextLabel: string; slideLabel: string }) {
  const [index, setIndex] = useState(0);
  const hasSlides = images.length > 1;
  useEffect(() => {
    if (!hasSlides) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % images.length), 5000);
    return () => window.clearInterval(timer);
  }, [hasSlides, images.length]);
  if (!images.length) return null;
  const image = images[index];
  function move(delta: number) { setIndex((current) => (current + delta + images.length) % images.length); }
  return <div className={`product-gallery${hasSlides ? " product-gallery-slideshow" : ""}`} aria-label={hasSlides ? `${slideLabel} ${index + 1} / ${images.length}` : undefined}>
    <img src={image.url} alt={image.alt} />
    {hasSlides && <><button type="button" className="gallery-control gallery-previous" onClick={() => move(-1)} aria-label={previousLabel}>‹</button><button type="button" className="gallery-control gallery-next" onClick={() => move(1)} aria-label={nextLabel}>›</button><div className="gallery-indicators" aria-label={slideLabel}>{images.map((item, itemIndex) => <button type="button" key={item.id} className={`gallery-indicator${itemIndex === index ? " active" : ""}`} onClick={() => setIndex(itemIndex)} aria-label={`${slideLabel} ${itemIndex + 1}`} aria-current={itemIndex === index ? "true" : undefined} />)}</div></>}
  </div>;
}
