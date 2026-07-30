import sharp from 'sharp';

// og:image 1200x630，匹配站点编辑设计风格（teal-700 / stone 配色）
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8f7f3"/>
  <rect x="0" y="0" width="14" height="630" fill="#0f766e"/>
  <rect x="100" y="90" width="64" height="64" rx="14" fill="#0f766e"/>
  <text x="132" y="132" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">D/F</text>
  <text x="184" y="132" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" font-weight="bold" fill="#1c1917">DevFormat.tools</text>
  <text x="100" y="290" font-family="DejaVu Sans, Arial, sans-serif" font-size="84" font-weight="bold" fill="#1c1917">Convert data.</text>
  <text x="100" y="385" font-family="DejaVu Sans, Arial, sans-serif" font-size="84" font-weight="bold" fill="#0f766e">Keep it yours.</text>
  <text x="100" y="455" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#57534e">Private developer converters — runs entirely in your browser.</text>
  <g font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="bold" fill="#44403c">
    <rect x="100" y="510" width="150" height="56" rx="28" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
    <text x="175" y="546" text-anchor="middle">JSON</text>
    <rect x="270" y="510" width="150" height="56" rx="28" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
    <text x="345" y="546" text-anchor="middle">CSV</text>
    <rect x="440" y="510" width="150" height="56" rx="28" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
    <text x="515" y="546" text-anchor="middle">YAML</text>
    <rect x="610" y="510" width="170" height="56" rx="28" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
    <text x="695" y="546" text-anchor="middle">Base64</text>
    <rect x="800" y="510" width="160" height="56" rx="28" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
    <text x="880" y="546" text-anchor="middle">Go · Rust</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og-image.png');
const meta = await sharp('public/og-image.png').metadata();
console.log(`generated: ${meta.width}x${meta.height} ${meta.format}`);
