"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type GalleryImage = { id: string; url: string; alt: string };

export function ProductGallery({ images, previousLabel, nextLabel, slideLabel }: { images: GalleryImage[]; previousLabel: string; nextLabel: string; slideLabel: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hasSlides = images.length > 1;
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!hasSlides || paused || reducedMotion) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % images.length), 5000);
    return () => window.clearInterval(timer);
  }, [hasSlides, images.length, paused, reducedMotion]);
  if (!images.length) return null;
  const image = images[index];
  function move(delta: number) { setIndex((current) => (current + delta + images.length) % images.length); }
  return <div className={`product-gallery${hasSlides ? " product-gallery-slideshow" : ""}`} aria-label={hasSlides ? `${slideLabel} ${index + 1} / ${images.length}` : undefined} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
    <Image src={image.url} alt={image.alt} fill unoptimized sizes="(max-width: 960px) 100vw, 44vw" />
    {hasSlides && <><button type="button" className="gallery-control gallery-previous" onClick={() => move(-1)} aria-label={previousLabel}>‹</button><button type="button" className="gallery-control gallery-next" onClick={() => move(1)} aria-label={nextLabel}>›</button><div className="gallery-indicators" aria-label={slideLabel}>{images.map((item, itemIndex) => <button type="button" key={item.id} className={`gallery-indicator${itemIndex === index ? " active" : ""}`} onClick={() => setIndex(itemIndex)} aria-label={`${slideLabel} ${itemIndex + 1}`} aria-current={itemIndex === index ? "true" : undefined} />)}</div></>}
  </div>;
}
