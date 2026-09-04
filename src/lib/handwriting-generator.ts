/**
 * High-quality NCERT Handwritten Notebook Page Generator for Topper AI.
 * Creates clean, photo-realistic student notebook pages with ruled lines, red margins,
 * boxed formulas, crisp dark blue ink handwriting, and scientific diagrams.
 */

function wrapText(text: string, maxChars = 44): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxChars) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgToDataUrl(svg: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
    }
  } catch {
    /* fallback below */
  }
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Returns topic-specific vector diagrams drawn in blue ink style for notebook notes.
 */
function getTopicDiagramSvg(title: string, text: string): string {
  const combined = (title + " " + text).toLowerCase();

  // 1. Cell Division / Mitosis / Meiosis
  if (combined.includes("cell") || combined.includes("mitosis") || combined.includes("meiosis") || combined.includes("division")) {
    return `
      <!-- Cell Division Diagram -->
      <g transform="translate(535, 570)">
        <rect x="0" y="0" width="230" height="250" rx="12" fill="#f0f7ff" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,2" />
        <text x="115" y="24" font-family="'Kalam', cursive, sans-serif" font-size="14" font-weight="bold" fill="#002266" text-anchor="middle">
          Diagram: Mitosis / Cleavage
        </text>

        <!-- Parent Cell -->
        <circle cx="115" cy="75" r="32" fill="#e0f2fe" stroke="#1d4ed8" stroke-width="2.5" />
        <circle cx="107" cy="70" r="8" fill="none" stroke="#002266" stroke-width="1.8" stroke-dasharray="2,2" />
        <circle cx="123" cy="80" r="8" fill="none" stroke="#002266" stroke-width="1.8" stroke-dasharray="2,2" />
        <text x="115" y="122" font-family="'Caveat', cursive, sans-serif" font-size="13" font-weight="bold" fill="#002266" text-anchor="middle">Metaphase Alignment</text>

        <!-- Cleavage Furrow / Telophase -->
        <path d="M 85,170 C 100,180 100,200 85,210 C 145,210 130,200 145,210 C 130,200 130,180 145,170 Z" fill="#e0f2fe" stroke="#1d4ed8" stroke-width="2.5" />
        <circle cx="100" cy="190" r="10" fill="#bae6fd" stroke="#002266" stroke-width="1.8" />
        <circle cx="130" cy="190" r="10" fill="#bae6fd" stroke="#002266" stroke-width="1.8" />
        <text x="115" y="232" font-family="'Caveat', cursive, sans-serif" font-size="13" font-weight="bold" fill="#002266" text-anchor="middle">Cleavage Furrow (2n)</text>
      </g>
    `;
  }

  // 2. Coulomb Law / Electrostatics / Charge
  if (combined.includes("coulomb") || combined.includes("charge") || combined.includes("electrostat") || combined.includes("electric force")) {
    return `
      <!-- Coulomb Law Diagram -->
      <g transform="translate(530, 580)">
        <rect x="0" y="0" width="230" height="190" rx="12" fill="#f0f7ff" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,2" />
        <text x="115" y="24" font-family="'Kalam', cursive, sans-serif" font-size="14" font-weight="bold" fill="#002266" text-anchor="middle">
          Electrostatic Force F
        </text>

        <!-- Point Charges -->
        <circle cx="45" cy="90" r="18" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2.5" />
        <text x="45" y="95" font-family="'Caveat', cursive, sans-serif" font-size="16" font-weight="bold" fill="#002266" text-anchor="middle">+q₁</text>

        <circle cx="185" cy="90" r="18" fill="#fee2e2" stroke="#dc2626" stroke-width="2.5" />
        <text x="185" y="95" font-family="'Caveat', cursive, sans-serif" font-size="16" font-weight="bold" fill="#991b1b" text-anchor="middle">-q₂</text>

        <!-- Distance Line -->
        <line x1="63" y1="90" x2="167" y2="90" stroke="#002266" stroke-width="1.8" stroke-dasharray="3,3" />
        <text x="115" y="82" font-family="'Caveat', cursive, sans-serif" font-size="15" font-weight="bold" fill="#002266" text-anchor="middle">r</text>

        <!-- Force Vectors -->
        <path d="M 65,90 L 85,90 M 80,85 L 85,90 L 80,95" stroke="#1d4ed8" stroke-width="2.2" fill="none" />
        <text x="80" y="112" font-family="'Caveat', cursive, sans-serif" font-size="13" font-weight="bold" fill="#1d4ed8" text-anchor="middle">F₁₂</text>

        <path d="M 165,90 L 145,90 M 150,85 L 145,90 L 150,95" stroke="#dc2626" stroke-width="2.2" fill="none" />
        <text x="150" y="112" font-family="'Caveat', cursive, sans-serif" font-size="13" font-weight="bold" fill="#dc2626" text-anchor="middle">F₂₁</text>

        <text x="115" y="165" font-family="'Kalam', cursive, sans-serif" font-size="14" font-weight="bold" fill="#002266" text-anchor="middle">
          F = k · (q₁q₂) / r²
        </text>
      </g>
    `;
  }

  // 3. Optics / Lens / Light / Refraction
  if (combined.includes("lens") || combined.includes("optics") || combined.includes("refract") || combined.includes("ray") || combined.includes("mirror")) {
    return `
      <!-- Optics Diagram -->
      <g transform="translate(530, 580)">
        <rect x="0" y="0" width="230" height="190" rx="12" fill="#f0f7ff" stroke="#2563eb" stroke-width="2" />
        <text x="115" y="24" font-family="'Kalam', cursive, sans-serif" font-size="14" font-weight="bold" fill="#002266" text-anchor="middle">
          Convex Lens Refraction
        </text>

        <!-- Optical Axis -->
        <line x1="15" y1="95" x2="215" y2="95" stroke="#475569" stroke-width="1.5" stroke-dasharray="4,2" />

        <!-- Convex Lens -->
        <path d="M 115,40 Q 130,95 115,150 Q 100,95 115,40 Z" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2.5" />

        <!-- Incident Rays -->
        <line x1="25" y1="65" x2="115" y2="65" stroke="#dc2626" stroke-width="2" />
        <line x1="115" y1="65" x2="185" y2="95" stroke="#dc2626" stroke-width="2" />

        <line x1="25" y1="125" x2="115" y2="125" stroke="#dc2626" stroke-width="2" />
        <line x1="115" y1="125" x2="185" y2="95" stroke="#dc2626" stroke-width="2" />

        <!-- Focus Point -->
        <circle cx="185" cy="95" r="4" fill="#dc2626" />
        <text x="185" y="115" font-family="'Caveat', cursive, sans-serif" font-size="15" font-weight="bold" fill="#dc2626" text-anchor="middle">F</text>
        <text x="115" y="170" font-family="'Caveat', cursive, sans-serif" font-size="14" font-weight="bold" fill="#002266" text-anchor="middle">1/f = 1/v - 1/u</text>
      </g>
    `;
  }

  // 4. Circuit / Ohm / Resistance
  if (combined.includes("circuit") || combined.includes("ohm") || combined.includes("resist") || combined.includes("current") || combined.includes("voltage")) {
    return `
      <!-- Circuit Diagram -->
      <g transform="translate(530, 580)">
        <rect x="0" y="0" width="230" height="190" rx="12" fill="#f0f7ff" stroke="#2563eb" stroke-width="2" />
        <text x="115" y="24" font-family="'Kalam', cursive, sans-serif" font-size="14" font-weight="bold" fill="#002266" text-anchor="middle">
          Resistor Circuit (Ohm's Law)
        </text>

        <!-- Circuit Wires -->
        <path d="M 35,140 L 35,70 L 75,70" stroke="#002266" stroke-width="2.2" fill="none" />
        <!-- Resistor Zigzag -->
        <path d="M 75,70 L 82,60 L 92,80 L 102,60 L 112,80 L 122,60 L 132,80 L 139,70" stroke="#1d4ed8" stroke-width="2.5" fill="none" />
        <path d="M 139,70 L 195,70 L 195,140 L 130,140" stroke="#002266" stroke-width="2.2" fill="none" />

        <!-- Battery -->
        <line x1="100" y1="140" x2="130" y2="140" stroke="#002266" stroke-width="2.2" />
        <line x1="110" y1="130" x2="110" y2="150" stroke="#1d4ed8" stroke-width="3" />
        <line x1="120" y1="135" x2="120" y2="145" stroke="#dc2626" stroke-width="3" />
        <path d="M 35,140 L 100,140" stroke="#002266" stroke-width="2.2" fill="none" />

        <text x="107" y="52" font-family="'Caveat', cursive, sans-serif" font-size="16" font-weight="bold" fill="#1d4ed8" text-anchor="middle">R (Ω)</text>
        <text x="115" y="172" font-family="'Caveat', cursive, sans-serif" font-size="15" font-weight="bold" fill="#002266" text-anchor="middle">V = I · R</text>
      </g>
    `;
  }

  return ""; // No diagram for general topics
}

export async function createHandwrittenNotebookPage(
  text: string,
  mode: "notes" | "solution" = "notes"
): Promise<string> {
  const clean = text.replace(/[*#`$]/g, "").trim().slice(0, 1500);
  const rawLines = clean.split("\n").filter((l) => l.trim().length > 0);
  const title = rawLines.length > 0 ? rawLines[0].slice(0, 60) : "NCERT Worked Notes";

  return createSvgNotebookPage(clean, title, mode);
}

export function createSvgNotebookPage(
  text: string,
  title: string,
  _mode: "notes" | "solution" = "notes"
): string {
  const rawLines = text.split("\n").filter((l) => l.trim().length > 0);
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const diagramSvg = getTopicDiagramSvg(title, text);
  const hasDiagram = diagramSvg.length > 0;
  const maxLineLength = hasDiagram ? 32 : 44;

  const svgLines: string[] = [];
  let y = 135;

  // Header Title - Deep Royal Blue
  svgLines.push(`
    <text x="140" y="${y}" font-family="'Caveat', 'Kalam', cursive, sans-serif" font-size="29" font-weight="bold" fill="#00185e" stroke="#00185e" stroke-width="0.3">
      📌 ${escapeXml(title)}
    </text>
    <line x1="140" y1="${y + 8}" x2="${hasDiagram ? 510 : 700}" y2="${y + 8}" stroke="#002b80" stroke-width="2.8" stroke-linecap="round" />
  `);
  y += 48;

  // Process text lines with crisp dark blue ink styling
  for (let i = 0; i < rawLines.length && y < 910; i += 1) {
    const rawLine = rawLines[i].trim();
    if (i === 0 && rawLine === title) continue; // skip title duplication

    const isHeading =
      rawLine.startsWith("#") ||
      rawLine.toUpperCase() === rawLine ||
      rawLine.endsWith(":") ||
      rawLine.startsWith("Step") ||
      rawLine.startsWith("Phase");

    const isFormula =
      rawLine.includes("=") ||
      rawLine.includes("+") ||
      rawLine.includes("F =") ||
      rawLine.includes("E =") ||
      rawLine.includes("KE") ||
      rawLine.includes("Rule:");

    if (isHeading) {
      const subLines = wrapText(rawLine.replace(/^#+\s*/, ""), maxLineLength - 4);
      for (const sl of subLines) {
        if (y >= 910) break;
        svgLines.push(`
          <text x="140" y="${y}" font-family="'Caveat', 'Kalam', cursive, sans-serif" font-size="23" font-weight="bold" fill="#020617" stroke="#020617" stroke-width="0.3">
            ${escapeXml(sl)}
          </text>
          <line x1="140" y1="${y + 4}" x2="${140 + Math.min(sl.length * 11, hasDiagram ? 360 : 500)}" y2="${y + 4}" stroke="#dc2626" stroke-width="1.8" stroke-dasharray="4,2" />
        `);
        y += 36;
      }
    } else if (isFormula) {
      const subLines = wrapText(rawLine, maxLineLength - 6);
      const boxWidth = hasDiagram ? 370 : 560;
      const boxHeight = subLines.length * 30 + 16;

      svgLines.push(`
        <rect x="135" y="${y - 22}" width="${boxWidth}" height="${boxHeight}" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-dasharray="6,3" />
      `);

      for (const sl of subLines) {
        if (y >= 910) break;
        svgLines.push(`
          <text x="150" y="${y + 4}" font-family="'Caveat', 'Kalam', cursive, sans-serif" font-size="21" font-weight="bold" fill="#00185e" stroke="#00185e" stroke-width="0.4">
            ⚡ ${escapeXml(sl)}
          </text>
        `);
        y += 30;
      }
      y += 12;
    } else {
      const subLines = wrapText(rawLine, maxLineLength);
      for (const sl of subLines) {
        if (y >= 910) break;
        // Deep Royal Blue Ink (#002166) with bold weight & high contrast stroke
        svgLines.push(`
          <text x="140" y="${y}" font-family="'Caveat', 'Kalam', cursive, sans-serif" font-size="21" font-weight="bold" fill="#002166" stroke="#001a52" stroke-width="0.3">
            ${escapeXml(sl)}
          </text>
        `);
        y += 36;
      }
    }
  }

  // Draw Ruled Lines
  const ruledLines: string[] = [];
  for (let ly = 100; ly <= 960; ly += 36) {
    ruledLines.push(`<line x1="40" y1="${ly}" x2="760" y2="${ly}" stroke="#94a3b8" stroke-width="1.2" opacity="0.65" />`);
  }

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&amp;family=Kalam:wght@400;700&amp;display=swap');
          text {
            text-rendering: optimizeLegibility;
            font-smooth: always;
            -webkit-font-smoothing: antialiased;
          }
        </style>
      </defs>

      <!-- Paper Base -->
      <rect width="800" height="1000" fill="#fffdf0" />
      <rect width="800" height="1000" fill="#ffffff" opacity="0.4" />

      <!-- Horizontal Ruled Lines -->
      <g>
        ${ruledLines.join("")}
      </g>

      <!-- Red Left Margin Line -->
      <line x1="115" y1="0" x2="115" y2="1000" stroke="#ef4444" stroke-width="2.8" />
      <line x1="120" y1="0" x2="120" y2="1000" stroke="#fca5a5" stroke-width="1.2" />

      <!-- Top Margin Header -->
      <line x1="0" y1="85" x2="800" y2="85" stroke="#ef4444" stroke-width="2.2" />
      <rect x="490" y="20" width="260" height="52" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="1.8" />
      <text x="505" y="42" font-family="'Kalam', cursive, sans-serif" font-size="13" font-weight="bold" fill="#92400e">
        DATE: ${dateStr}
      </text>
      <text x="505" y="60" font-family="'Kalam', cursive, sans-serif" font-size="13" font-weight="bold" fill="#92400e">
        LAST TOPPER · NCERT NOTES ✍️
      </text>

      <!-- Handwritten Content -->
      <g>
        ${svgLines.join("")}
      </g>

      <!-- Topic Diagram (if available) -->
      ${diagramSvg}

      <!-- Watermark Badge -->
      <g transform="translate(480, 935)">
        <rect x="0" y="0" width="260" height="36" rx="18" fill="#00185e" />
        <text x="20" y="23" font-family="'Kalam', cursive, sans-serif" font-size="14" font-weight="bold" fill="#ffffff">
          ✍️ VERIFIED TOPPER NOTES
        </text>
      </g>
    </svg>
  `.trim();

  return svgToDataUrl(svgContent);
}
