/** Shared Fornace visual language for printable / Puppeteer PDFs. */

export const PDF_BRAND = 'Pizza D.O.C.'

export const PDF_COLORS = {
  bg: '#f7f3ee',
  surface: '#ffffff',
  surfaceMuted: '#f0ebe4',
  border: 'rgba(28, 25, 23, 0.12)',
  borderStrong: 'rgba(28, 25, 23, 0.2)',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#ea580c',
  accentSoft: 'rgba(234, 88, 12, 0.12)',
  success: '#15803d',
  successSoft: 'rgba(21, 128, 61, 0.12)',
  warning: '#b45309',
  warningSoft: 'rgba(180, 83, 9, 0.14)',
  danger: '#b91c1c',
  dangerSoft: 'rgba(185, 28, 28, 0.12)',
} as const

/** Base CSS reset + Fornace tokens for PDF HTML documents. */
export function pdfBaseStyles(extra = ''): string {
  const c = PDF_COLORS
  return `
    @page { margin: 12mm; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: ${c.text};
      background: ${c.surface};
    }
    .pd-display {
      font-family: Georgia, 'Times New Roman', Times, serif;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .pd-muted { color: ${c.muted}; }
    .pd-accent { color: ${c.accent}; }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid ${c.accent};
    }
    .doc-brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .doc-brand .name {
      font-size: 20px;
      color: ${c.text};
    }
    .doc-brand .tag {
      font-size: 10px;
      color: ${c.muted};
      font-weight: 500;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-meta .title {
      font-size: 14px;
      color: ${c.text};
      margin-bottom: 4px;
    }
    .doc-meta .line {
      font-size: 10px;
      color: ${c.muted};
    }
    .stat-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: ${c.border};
      border: 1px solid ${c.border};
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .stat-strip .cell {
      background: ${c.surface};
      text-align: center;
      padding: 14px 10px;
    }
    .stat-strip .value {
      font-size: 22px;
      color: ${c.text};
      margin-bottom: 2px;
    }
    .stat-strip .label {
      font-size: 10px;
      color: ${c.muted};
      font-weight: 500;
    }
    .section-card {
      border: 1px solid ${c.border};
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
      background: ${c.surface};
    }
    .section-card-head {
      background: ${c.surfaceMuted};
      border-bottom: 1px solid ${c.border};
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    .section-card-head h3 {
      font-size: 13px;
      font-weight: 600;
      color: ${c.text};
    }
    .section-card-head .meta {
      font-size: 12px;
      font-weight: 600;
      color: ${c.accent};
    }
    .section-card-body { padding: 12px 14px; }
    .pill {
      display: inline-block;
      font-size: 9px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 999px;
      background: ${c.accentSoft};
      color: ${c.accent};
    }
    .doc-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid ${c.border};
      text-align: center;
      font-size: 9px;
      color: ${c.muted};
    }
    ${extra}
  `
}

export function pdfDocHeader(opts: {
  title: string
  subtitle?: string
  lines?: string[]
}): string {
  const lines = (opts.lines || [])
    .map((l) => `<div class="line">${escapePdfHtml(l)}</div>`)
    .join('')
  return `
    <header class="doc-header">
      <div class="doc-brand">
        <div class="pd-display name">${PDF_BRAND}</div>
        <div class="tag">Gestione team</div>
      </div>
      <div class="doc-meta">
        <div class="pd-display title">${escapePdfHtml(opts.title)}</div>
        ${opts.subtitle ? `<div class="line">${escapePdfHtml(opts.subtitle)}</div>` : ''}
        ${lines}
      </div>
    </header>
  `
}

export function pdfDocFooter(generatedAtLabel: string): string {
  return `
    <footer class="doc-footer">
      <p>${escapePdfHtml(generatedAtLabel)} · ${PDF_BRAND}</p>
      <p>© ${new Date().getFullYear()} ${PDF_BRAND}</p>
    </footer>
  `
}

export function escapePdfHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
