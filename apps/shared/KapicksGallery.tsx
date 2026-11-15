import {useState} from 'react';
import './kapicks-gallery.css';

const photos = [
  {src:'/kapicks/tiger.webp', alt:'Bengal tiger in water, photographed for Kapicks'},
  {src:'/kapicks/bee-eater.webp', alt:'Green bee-eater perched on a branch, photographed for Kapicks'},
];

export function KapicksGallery() {
  const [index, setIndex] = useState(0);
  return <div className="kapicks-gallery" aria-label="Kapicks wildlife photography preview">
    {photos.map((photo, i) => <img key={photo.src} src={photo.src} alt={photo.alt} loading="lazy" className={index === i ? 'active' : ''} aria-hidden={index !== i}/>) }
    <div className="kapicks-gallery-controls" aria-label="Photography preview controls">
      <button type="button" aria-label="Previous photo" onClick={() => setIndex((index + photos.length - 1) % photos.length)}>‹</button>
      <span aria-live="polite">{index + 1} / {photos.length}</span>
      <button type="button" aria-label="Next photo" onClick={() => setIndex((index + 1) % photos.length)}>›</button>
    </div>
  </div>;
}
