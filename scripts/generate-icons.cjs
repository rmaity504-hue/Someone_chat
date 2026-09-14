const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Generate the SVG markup for Someone app icon
// Incorporating the user's sumi-e ink-wash silhouette, energetic splatter burst,
// cinnabar crimson calligraphy brushstroke, and warm ochre watercolor underwash.
function getIconSvg(isMaskable = false, isBrandArtwork = false) {
  const size = 512;
  const transform = isMaskable ? 'transform="scale(0.82) translate(56, 56)"' : '';
  const background = isMaskable || isBrandArtwork
    ? `<rect width="512" height="512" fill="#F6F3EE"/>`
    : `<rect width="512" height="512" rx="104" fill="#F6F3EE"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Paper texture filter -->
    <filter id="ink-bleed" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <!-- Crimson gradient -->
    <linearGradient id="crimson-stroke" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#9C271C"/>
      <stop offset="35%" stop-color="#BC3426"/>
      <stop offset="70%" stop-color="#D04130"/>
      <stop offset="100%" stop-color="#DE4E3C"/>
    </linearGradient>
    <!-- Ochre wash gradient -->
    <linearGradient id="ochre-wash" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#C28938" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#D69B46" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#E8B45E" stop-opacity="0.4"/>
    </linearGradient>
    <!-- Ink wash tone gradient -->
    <linearGradient id="ink-tone" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#12100E"/>
      <stop offset="40%" stop-color="#1C1917"/>
      <stop offset="80%" stop-color="#2D2824"/>
      <stop offset="100%" stop-color="#3F3934"/>
    </linearGradient>
  </defs>

  <!-- Canvas Background -->
  ${background}

  <!-- Artwork Container with optional safe-padding for maskable -->
  <g ${transform}>
    <!-- Subtle watercolor paper grain / undertone wash -->
    <path d="M 180 180 Q 240 140 330 150 Q 400 180 390 280 Q 360 360 260 390 Q 180 370 170 300 Z" fill="#F0ECE0" opacity="0.4" filter="url(#soft-glow)"/>

    <!-- Ochre / Amber Watercolor Underwash -->
    <path d="M 148 422 C 175 395 210 365 265 342 C 320 320 375 292 418 268 C 412 282 390 305 345 324 C 295 345 220 388 182 432 Z" fill="url(#ochre-wash)"/>
    <path d="M 215 355 C 265 330 325 305 390 278 C 375 295 340 322 280 348 C 245 365 210 382 195 390 Z" fill="#E2AC5A" opacity="0.45"/>

    <!-- Outer Splatters & Calligraphic Bursts (Rear and Top) -->
    <!-- Large upper-rear ink wash blooms -->
    <path d="M 285 92 C 315 75 345 68 375 72 C 362 88 358 105 385 110 C 405 115 428 102 438 122 C 420 135 408 140 422 158 C 402 165 390 182 395 205 C 375 195 362 185 350 200 C 342 180 325 170 310 175 C 312 150 295 130 275 125 Z" fill="#241F1C" opacity="0.88"/>
    <path d="M 330 105 C 365 92 395 85 425 98 C 410 115 415 135 435 145 C 415 152 405 172 380 162 C 365 178 345 160 335 140 Z" fill="#151311"/>

    <!-- Energetic bristle sweeps radiating backwards -->
    <path d="M 360 110 Q 425 85 452 78 Q 438 98 420 112 Q 450 118 465 135 Q 435 140 422 152 Q 448 165 440 182 Q 420 178 405 188 Z" fill="#2E2824" opacity="0.9"/>
    <path d="M 380 145 Q 440 148 462 168 Q 435 175 418 190 Q 438 205 435 228 Q 415 218 395 222 Z" fill="#231F1C"/>
    <path d="M 365 195 Q 420 220 442 245 Q 412 250 395 262 Q 420 282 410 305 Q 388 288 370 285 Z" fill="#2E2824" opacity="0.85"/>

    <!-- Lower calligraphic swirls and ink flourishes -->
    <path d="M 310 320 Q 365 360 385 415 Q 360 405 342 385 Q 352 425 330 455 Q 320 420 305 395 Q 295 440 272 468 Q 275 425 285 390 Q 255 420 238 438 Q 252 395 268 365 Z" fill="#1C1816" opacity="0.95"/>
    <path d="M 320 340 C 360 365 392 410 375 445 C 360 415 340 390 325 372 Z" fill="#12100E"/>
    <path d="M 280 400 Q 305 445 320 475 Q 302 455 292 430 Q 282 465 265 488 Q 268 450 275 420 Z" fill="#2D2723"/>

    <!-- Main Silhouette (Left-Facing Head, Elegant Profile, Deep Carbon Ink) -->
    <!-- Profile contours: Forehead -> Brow -> Nose -> Philtrum -> Lips -> Chin -> Throat -->
    <path d="M 270 115 
             C 245 118 220 128 200 145 
             C 185 160 178 175 175 190
             C 172 196 168 200 162 208
             C 152 220 142 232 146 238
             C 149 241 158 240 168 245
             C 165 252 162 260 165 268
             C 168 274 175 277 172 284
             C 168 292 165 302 172 310
             C 178 316 188 318 195 328
             C 205 342 212 365 220 395
             C 225 415 228 440 225 460
             C 240 445 255 420 268 390
             C 285 350 295 315 292 285
             C 290 260 298 240 310 220
             C 325 195 330 170 320 145
             C 310 125 290 112 270 115 Z" 
          fill="url(#ink-tone)" filter="url(#ink-bleed)"/>

    <!-- Solid saturated black core overlay for face & forehead opacity -->
    <path d="M 255 125 
             C 230 132 210 145 192 162 
             C 180 175 174 188 172 200
             C 168 206 160 216 150 228
             C 145 235 152 238 162 242
             C 162 248 158 256 162 264
             C 165 270 170 274 168 280
             C 165 288 165 298 170 305
             C 176 312 185 316 190 325
             C 200 340 206 362 215 390
             C 235 345 258 300 262 250
             C 265 205 278 165 255 125 Z" 
          fill="#100E0D"/>

    <!-- Soft charcoal shading on cheekbone / temple -->
    <path d="M 215 190 C 235 180 250 195 245 225 C 240 255 220 270 205 265 C 195 240 198 210 215 190 Z" fill="#28231F" opacity="0.6"/>
    <path d="M 228 220 C 242 212 252 222 248 242 C 245 262 232 272 222 268 C 215 250 218 230 228 220 Z" fill="#181513" opacity="0.8"/>

    <!-- Sweeping Cinnabar Crimson Calligraphy Brushstroke -->
    <!-- Traverses dramatically from lower left across neck toward upper right -->
    <path d="M 125 428 
             C 152 405 185 372 232 345 
             C 285 315 352 288 442 270
             C 415 278 375 295 330 315
             C 275 340 205 385 155 435 
             C 142 448 130 445 125 428 Z" 
          fill="url(#crimson-stroke)" filter="url(#soft-glow)"/>

    <!-- Second bristle feathering on crimson stroke -->
    <path d="M 145 422 C 180 392 230 358 290 330 C 355 300 415 280 448 272 C 418 280 365 302 305 332 C 245 362 195 398 165 426 Z" fill="#E04634" opacity="0.75"/>
    <path d="M 132 438 C 145 422 165 405 195 385 C 182 402 165 422 148 442 Z" fill="#942016"/>

    <!-- Dry brush frayed tail of the crimson stroke -->
    <path d="M 425 273 Q 448 268 465 262 Q 445 275 430 278 Z" fill="#D03D2B"/>
    <path d="M 405 282 Q 435 275 455 268 Q 432 282 415 288 Z" fill="#B53222"/>

    <!-- Expressive Ink Splatters & Droplets (Fine to Heavy) -->
    <!-- Top right spray -->
    <circle cx="372" cy="54" r="2.5" fill="#1A1715"/>
    <circle cx="392" cy="62" r="3.2" fill="#151311"/>
    <circle cx="418" cy="48" r="2" fill="#2A2420"/>
    <circle cx="435" cy="68" r="4.2" fill="#1A1715"/>
    <circle cx="452" cy="58" r="2.2" fill="#1C1816"/>
    <circle cx="468" cy="82" r="3" fill="#181513"/>
    <circle cx="445" cy="95" r="2.5" fill="#241E1A"/>
    <circle cx="478" cy="115" r="4" fill="#151311"/>
    <circle cx="488" cy="132" r="2" fill="#1F1B18"/>
    <circle cx="462" cy="142" r="3.2" fill="#181513"/>
    <circle cx="475" cy="165" r="2.5" fill="#221C18"/>
    <circle cx="485" cy="188" r="3.8" fill="#141210"/>
    <circle cx="458" cy="202" r="2" fill="#2A221E"/>
    <circle cx="472" cy="225" r="3" fill="#1C1816"/>

    <!-- Mid right & near stroke droplets -->
    <circle cx="448" cy="252" r="2.8" fill="#1E1916"/>
    <circle cx="462" cy="285" r="2.2" fill="#241D19"/>
    <circle cx="428" cy="320" r="3.5" fill="#181412"/>
    <circle cx="442" cy="342" r="2" fill="#2A221E"/>
    <circle cx="415" cy="365" r="4.5" fill="#151210"/>
    <circle cx="430" cy="392" r="2.5" fill="#1E1916"/>
    <circle cx="395" cy="425" r="3" fill="#181412"/>
    <circle cx="410" cy="450" r="2" fill="#251E1A"/>

    <!-- Fine splatter mist on forehead / temple negative space -->
    <circle cx="168" cy="142" r="1.8" fill="#2A231F" opacity="0.7"/>
    <circle cx="152" cy="165" r="2.2" fill="#1C1815" opacity="0.65"/>
    <circle cx="138" cy="192" r="1.5" fill="#251E1A" opacity="0.6"/>
    <circle cx="130" cy="218" r="2" fill="#1A1614" opacity="0.7"/>
    <circle cx="135" cy="255" r="1.8" fill="#2A201B" opacity="0.7"/>
    <circle cx="142" cy="285" r="2.2" fill="#221B17" opacity="0.75"/>
    <circle cx="155" cy="335" r="2.8" fill="#1E1714" opacity="0.8"/>

    <!-- Crimson micro-specks near stroke -->
    <circle cx="452" cy="265" r="1.8" fill="#C23828" opacity="0.8"/>
    <circle cx="470" cy="258" r="1.4" fill="#D64230" opacity="0.75"/>
    <circle cx="118" cy="432" r="2.2" fill="#A8281C" opacity="0.8"/>
  </g>
</svg>`;
}

async function run() {
  console.log('Generating official Someone app icons...');

  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');

  const standardSvg = getIconSvg(false);
  const maskableSvg = getIconSvg(true);

  // 1. Save public/icon.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), standardSvg, 'utf8');
  console.log('Created public/icon.svg');

  // 2. Render public/icon-512.png (512x512)
  const buf512 = await sharp(Buffer.from(standardSvg))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), buf512);
  console.log('Created public/icon-512.png (512x512)');

  // 3. Render public/icon-192.png (192x192)
  const buf192 = await sharp(Buffer.from(standardSvg))
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), buf192);
  console.log('Created public/icon-192.png (192x192)');

  // 4. Render public/icon-maskable.png (512x512 with safe-zone margin)
  const bufMaskable = await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.png'), bufMaskable);
  console.log('Created public/icon-maskable.png (512x512 maskable)');

  // 5. Render public/apple-touch-icon.png (180x180)
  const bufApple = await sharp(Buffer.from(standardSvg))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), bufApple);
  console.log('Created public/apple-touch-icon.png (180x180)');

  // 6. Render public/brand-artwork.png (1024x1024 high resolution square artwork)
  const brandArtworkSvg = getIconSvg(false, true);
  const bufBrandArtwork = await sharp(Buffer.from(brandArtworkSvg))
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'brand-artwork.png'), bufBrandArtwork);
  console.log('Created public/brand-artwork.png (1024x1024)');

  // Also sync to dist/ if dist exists
  if (fs.existsSync(distDir)) {
    fs.copyFileSync(path.join(publicDir, 'icon.svg'), path.join(distDir, 'icon.svg'));
    fs.copyFileSync(path.join(publicDir, 'icon-512.png'), path.join(distDir, 'icon-512.png'));
    fs.copyFileSync(path.join(publicDir, 'icon-192.png'), path.join(distDir, 'icon-192.png'));
    fs.copyFileSync(path.join(publicDir, 'icon-maskable.png'), path.join(distDir, 'icon-maskable.png'));
    fs.copyFileSync(path.join(publicDir, 'apple-touch-icon.png'), path.join(distDir, 'apple-touch-icon.png'));
    fs.copyFileSync(path.join(publicDir, 'brand-artwork.png'), path.join(distDir, 'brand-artwork.png'));
    console.log('Synced icon assets to dist/');
  }

  console.log('All icons generated successfully.');
}

run().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
