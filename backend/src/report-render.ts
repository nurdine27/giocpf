import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export type ColumnKind = 'text' | 'date' | 'datetime' | 'number' | 'percent';

export type ReportColumn = {
  key: string;
  header: string;
  /** Relative width; PDF widths are scaled to the page, Excel uses it as character width. */
  width: number;
  kind?: ColumnKind;
  align?: 'left' | 'right' | 'center';
};

export type ReportData = {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  /** Key figures shown above the table (and in the "Resumo" sheet). */
  summary?: [string, string | number][];
  landscape?: boolean;
  /** Adds signature lines at the end (useful for class lists and official listings). */
  signatures?: string[];
};

export type ReportMeta = {
  number: string;
  hash: string;
  generatedAt: Date;
  generatedBy: string;
  /** Human readable date range, or null for snapshot reports. */
  range: string | null;
  filters: [string, string][];
  institution: { name: string; email: string; phone: string; address: string; website: string };
};

const GREEN = '#12352e';
const GREEN2 = '#234d40';
const LIME = '#d8ef75';
const MUTED = '#66736d';
const LINE = '#dfe4dc';
const ZEBRA = '#f6f8f3';

function logoBuffer() {
  for (const path of [
    join(process.cwd(), 'assets', 'gio-logo.png'),
    join(__dirname, '..', '..', 'assets', 'gio-logo.png'),
  ])
    if (existsSync(path)) return readFileSync(path);
  return null;
}

export function formatDate(value: unknown, withTime = false) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return withTime
    ? `${date} ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
    : date;
}

function cellText(value: unknown, kind: ColumnKind = 'text') {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'date') return formatDate(value);
  if (kind === 'datetime') return formatDate(value, true);
  if (kind === 'percent') return `${Math.round(Number(value) * 100)}%`;
  if (kind === 'number') return Number(value).toLocaleString('pt-PT');
  return String(value);
}

function contactLine(meta: ReportMeta) {
  const i = meta.institution;
  return [i.address, i.phone, i.email, i.website].filter(Boolean).join('  ·  ');
}

/* ====================================================================== */
/* PDF                                                                    */
/* ====================================================================== */

export function renderPdf(report: ReportData, meta: ReportMeta): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: report.landscape ? 'landscape' : 'portrait',
    margins: { top: 36, bottom: 54, left: 36, right: 36 },
    bufferPages: true,
    info: {
      Title: `${report.title} — ${meta.number}`,
      Author: meta.institution.name,
      Subject: report.subtitle ?? report.title,
      Creator: 'GIO CPF — Sistema de gestão',
      Keywords: `${meta.number} ${meta.hash}`,
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const logo = logoBuffer();

  // ---- Full institutional header (first page)
  if (logo) doc.image(logo, left, 34, { height: 40 });
  const textX = logo ? left + 82 : left;
  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(meta.institution.name, textX, 38, { width: width - 260 });
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(contactLine(meta), textX, doc.y + 2, { width: width - 260 });
  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('RELATÓRIO OFICIAL', left + width - 200, 38, { width: 200, align: 'right' })
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(`Documento N.º ${meta.number}`, { width: 200, align: 'right' })
    .text(`Emitido em ${formatDate(meta.generatedAt, true)}`, { width: 200, align: 'right' });
  doc.rect(left, 84, width, 3).fill(LIME);
  doc.rect(left, 87, width, 1).fill(GREEN);

  doc.y = 100;
  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(17)
    .text(report.title, left, doc.y, { width });
  if (report.subtitle)
    doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(report.subtitle, { width });
  doc.moveDown(0.5);

  // ---- Parameters box
  const params: [string, string][] = [
    ...(meta.range ? ([['Período', meta.range]] as [string, string][]) : []),
    ...meta.filters,
    ['Gerado por', meta.generatedBy],
    ['Total de registos', String(report.rows.length)],
  ];
  // Two columns; each row is as tall as its longest (wrapped) value so nothing overlaps.
  const boxTop = doc.y;
  const colW = width / 2;
  const textW = colW - 20;
  doc.font('Helvetica').fontSize(8.5);
  const measure = ([label, value]: [string, string]) =>
    doc.font('Helvetica-Bold').heightOfString(`${label}: ${value}`, { width: textW });
  const rowHeights: number[] = [];
  for (let i = 0; i < params.length; i += 2)
    rowHeights.push(Math.max(measure(params[i]), params[i + 1] ? measure(params[i + 1]) : 0) + 3);
  const boxH = rowHeights.reduce((sum, h) => sum + h, 0) + 12;
  doc.roundedRect(left, boxTop, width, boxH, 4).fill(ZEBRA);
  let rowY = boxTop + 7;
  rowHeights.forEach((h, r) => {
    [params[r * 2], params[r * 2 + 1]].forEach((param, c) => {
      if (!param) return;
      const [label, value] = param;
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text(`${label}: `, left + 10 + c * colW, rowY, { width: textW, continued: true })
        .fillColor(GREEN)
        .font('Helvetica-Bold')
        .text(value);
    });
    rowY += h;
  });
  doc.y = boxTop + boxH + 10;

  // ---- Key figures
  if (report.summary?.length) {
    const per = Math.min(report.summary.length, report.landscape ? 6 : 4);
    const cardW = (width - (per - 1) * 8) / per;
    report.summary.forEach(([label, value], i) => {
      if (i > 0 && i % per === 0) doc.y += 46;
      const x = left + (i % per) * (cardW + 8);
      const y = doc.y;
      doc.roundedRect(x, y, cardW, 40, 4).lineWidth(0.8).strokeColor(LINE).stroke();
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(label.toUpperCase(), x + 8, y + 7, { width: cardW - 16, lineBreak: false });
      doc
        .fillColor(GREEN)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(String(value), x + 8, y + 19, { width: cardW - 16, lineBreak: false });
      doc.y = y;
    });
    doc.y += 52;
  }

  // ---- Table
  const totalRel = report.columns.reduce((s, c) => s + c.width, 0);
  const widths = report.columns.map((c) => (c.width / totalRel) * width);
  const pad = 4;
  const fontSize = report.columns.length > 8 ? 7.5 : 8.5;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 8;

  const drawHeader = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(fontSize);
    const h =
      Math.max(
        ...report.columns.map((c, i) =>
          doc.heightOfString(c.header, { width: widths[i] - pad * 2 }),
        ),
      ) +
      pad * 2;
    doc.rect(left, y, width, h).fill(GREEN2);
    let x = left;
    report.columns.forEach((c, i) => {
      doc
        .fillColor('#ffffff')
        .text(c.header, x + pad, y + pad, { width: widths[i] - pad * 2, align: c.align ?? 'left' });
      x += widths[i];
    });
    doc.y = y + h;
  };

  const newPage = () => {
    doc.addPage();
    // Compact header on continuation pages so every page stays identifiable.
    doc
      .fillColor(GREEN)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(meta.institution.name, left, 30, { width: width / 2, lineBreak: false });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(`${report.title} · N.º ${meta.number}`, left + width / 2, 30, {
        width: width / 2,
        align: 'right',
        lineBreak: false,
      });
    doc.rect(left, 44, width, 1).fill(GREEN);
    doc.y = 52;
    drawHeader();
  };

  if (!report.rows.length) {
    doc
      .fillColor(MUTED)
      .font('Helvetica-Oblique')
      .fontSize(10)
      .text('Sem registos para os critérios seleccionados.', left, doc.y + 10);
  } else {
    if (doc.y + 60 > bottomLimit()) newPage();
    else drawHeader();
    doc.font('Helvetica').fontSize(fontSize);
    report.rows.forEach((row, index) => {
      const texts = report.columns.map((c) => cellText(row[c.key], c.kind));
      const h =
        Math.max(...texts.map((t, i) => doc.heightOfString(t, { width: widths[i] - pad * 2 }))) +
        pad * 2;
      if (doc.y + h > bottomLimit()) newPage();
      const y = doc.y;
      if (index % 2) doc.rect(left, y, width, h).fill(ZEBRA);
      doc
        .moveTo(left, y + h)
        .lineTo(left + width, y + h)
        .lineWidth(0.4)
        .strokeColor(LINE)
        .stroke();
      let x = left;
      doc.font('Helvetica').fontSize(fontSize).fillColor('#1d2925');
      texts.forEach((t, i) => {
        const c = report.columns[i];
        doc.text(t, x + pad, y + pad, {
          width: widths[i] - pad * 2,
          align: c.align ?? (c.kind === 'number' || c.kind === 'percent' ? 'right' : 'left'),
        });
        x += widths[i];
      });
      doc.y = y + h;
    });
  }

  // ---- Closing note and signatures
  const signatures = report.signatures ?? [];
  const closingHeight = 40 + (signatures.length ? 60 : 0);
  if (doc.y + closingHeight > bottomLimit()) newPage();
  doc.moveDown(1);
  doc
    .fillColor(MUTED)
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text(
      `Fim do relatório. ${report.rows.length} registo(s). Documento gerado automaticamente pelo sistema de gestão do ${meta.institution.name}; a autenticidade pode ser confirmada na área administrativa com o número ${meta.number}.`,
      left,
      doc.y,
      { width },
    );
  if (signatures.length) {
    const sy = doc.y + 34;
    const sw = (width - (signatures.length - 1) * 30) / signatures.length;
    signatures.forEach((label, i) => {
      const x = left + i * (sw + 30);
      doc
        .moveTo(x, sy)
        .lineTo(x + sw, sy)
        .lineWidth(0.6)
        .strokeColor('#555')
        .stroke();
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(label, x, sy + 4, { width: sw, align: 'center' });
    });
    doc.y = sy + 20;
  }

  // ---- Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // writing inside the margin must not trigger a new page
    const y = doc.page.height - 38;
    doc.rect(left, y - 6, width, 0.6).fill(LINE);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(7)
      .text(
        `${meta.institution.name} · Documento N.º ${meta.number} · Verificação ${meta.hash.slice(0, 16).toUpperCase()} · Emitido em ${formatDate(meta.generatedAt, true)}`,
        left,
        y,
        { width: width - 90, lineBreak: false },
      )
      .text(`Página ${i + 1} de ${range.count}`, left + width - 90, y, {
        width: 90,
        align: 'right',
        lineBreak: false,
      });
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  return done;
}

/* ====================================================================== */
/* Excel                                                                  */
/* ====================================================================== */

export async function renderXlsx(report: ReportData, meta: ReportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.institution.name;
  wb.lastModifiedBy = meta.generatedBy;
  wb.created = meta.generatedAt;
  wb.title = `${report.title} — ${meta.number}`;
  wb.subject = report.subtitle ?? report.title;
  wb.keywords = `${meta.number} ${meta.hash}`;
  wb.company = meta.institution.name;

  const sheetName = report.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9,
      orientation: report.landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddHeader: `&L&"Arial,Bold"${meta.institution.name}&R${report.title} · N.º ${meta.number}`,
      oddFooter: `&LVerificação ${meta.hash.slice(0, 16).toUpperCase()} · Emitido em ${formatDate(meta.generatedAt, true)}&RPágina &P de &N`,
    },
    views: [{ state: 'frozen', ySplit: 0 }],
  });
  const lastCol = report.columns.length;
  const green = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF234D40' },
  };

  const logo = logoBuffer();
  const offset = logo ? 1 : 0; // keep column A narrow for the logo when present
  if (logo) {
    const imageId = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 92, height: 52 } });
  }
  const headerLines: [string, Partial<ExcelJS.Font>][] = [
    [meta.institution.name, { bold: true, size: 14, color: { argb: 'FF12352E' } }],
    [contactLine(meta), { size: 9, color: { argb: 'FF66736D' } }],
    [report.title, { bold: true, size: 13, color: { argb: 'FF12352E' } }],
    [
      [meta.range ? `Período: ${meta.range}` : null, ...meta.filters.map(([k, v]) => `${k}: ${v}`)]
        .filter(Boolean)
        .join('   ·   ') || 'Sem filtros',
      { size: 9 },
    ],
    [
      `Documento N.º ${meta.number}   ·   Emitido em ${formatDate(meta.generatedAt, true)} por ${meta.generatedBy}   ·   Verificação ${meta.hash.slice(0, 16).toUpperCase()}`,
      { size: 9, italic: true, color: { argb: 'FF66736D' } },
    ],
  ];
  headerLines.forEach(([text, font], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1 + offset).value = text;
    row.getCell(1 + offset).font = { name: 'Arial', ...font };
    ws.mergeCells(i + 1, 1 + offset, i + 1, Math.max(lastCol, 2 + offset));
    row.height = i === 0 ? 22 : 16;
  });

  let rowIndex = headerLines.length + 2;
  if (report.summary?.length) {
    report.summary.forEach(([label, value], i) => {
      const cell = ws.getCell(rowIndex, 1 + (i % Math.max(1, Math.floor(lastCol / 2))) * 2);
      cell.value = `${label}: ${value}`;
      cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF234D40' } };
      if ((i + 1) % Math.max(1, Math.floor(lastCol / 2)) === 0) rowIndex++;
    });
    rowIndex += 2;
  }

  const headerRow = ws.getRow(rowIndex);
  report.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = green;
    cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c.align ?? 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF12352E' } } };
    ws.getColumn(i + 1).width = Math.max(8, Math.round(c.width * 1.15));
  });
  headerRow.height = 22;
  const firstData = rowIndex + 1;

  report.rows.forEach((r, n) => {
    const row = ws.getRow(firstData + n);
    report.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = r[c.key];
      if (v === null || v === undefined || v === '') cell.value = null;
      else if (c.kind === 'date' || c.kind === 'datetime') {
        const d = v instanceof Date ? v : new Date(String(v));
        cell.value = Number.isNaN(d.getTime()) ? String(v) : d;
        cell.numFmt = c.kind === 'date' ? 'dd/mm/yyyy' : 'dd/mm/yyyy hh:mm';
      } else if (c.kind === 'number') cell.value = Number(v);
      else if (c.kind === 'percent') {
        cell.value = Number(v);
        cell.numFmt = '0%';
      } else cell.value = String(v);
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c.align };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDFE4DC' } } };
      if (n % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8F3' } };
    });
  });

  if (report.rows.length) {
    ws.autoFilter = {
      from: { row: rowIndex, column: 1 },
      to: { row: rowIndex + report.rows.length, column: lastCol },
    };
  } else {
    ws.getCell(firstData, 1).value = 'Sem registos para os critérios seleccionados.';
    ws.getCell(firstData, 1).font = { name: 'Arial', italic: true, color: { argb: 'FF66736D' } };
  }
  ws.views = [{ state: 'frozen', ySplit: rowIndex }];
  ws.pageSetup.printTitlesRow = `${rowIndex}:${rowIndex}`;

  const end = firstData + Math.max(report.rows.length, 1) + 1;
  ws.getCell(end, 1).value =
    `Fim do relatório · ${report.rows.length} registo(s) · Documento N.º ${meta.number}`;
  ws.getCell(end, 1).font = { name: 'Arial', italic: true, size: 9, color: { argb: 'FF66736D' } };

  // Second sheet: everything an auditor needs to identify and verify the document.
  const info = wb.addWorksheet('Identificação');
  info.columns = [{ width: 28 }, { width: 80 }];
  const infoRows: [string, string | number][] = [
    ['Instituição', meta.institution.name],
    ['Relatório', report.title],
    ['Documento N.º', meta.number],
    ['Emitido em', formatDate(meta.generatedAt, true)],
    ['Emitido por', meta.generatedBy],
    ...(meta.range ? ([['Período', meta.range]] as [string, string][]) : []),
    ...meta.filters,
    ['Total de registos', report.rows.length],
    ...(report.summary ?? []),
    ['Código de verificação (SHA-256)', meta.hash],
  ];
  infoRows.forEach(([k, v], i) => {
    const row = info.getRow(i + 1);
    row.getCell(1).value = k;
    row.getCell(1).font = { name: 'Arial', bold: true, color: { argb: 'FF234D40' } };
    row.getCell(2).value = v;
    row.getCell(2).font = { name: 'Arial' };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
