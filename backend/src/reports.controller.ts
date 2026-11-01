import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { audit, can, requireAdmin, type AuthenticatedAdmin } from './auth';
import { REPORTS, filterOptions, type ReportDefinition } from './reports';
import { formatDate, renderPdf, renderXlsx, type ReportMeta } from './report-render';

const DAY = 864e5;
const MAX_RANGE_DAYS = 3660;

function allowed(admin: AuthenticatedAdmin, report: ReportDefinition) {
  return report.permissions.some((p) => can(admin, p));
}

function parseDay(value: string | undefined, end: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function documentNumber(now: Date) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `REL-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

@Controller('admin/reports')
export class ReportsController {
  constructor(private db: PrismaService) {}

  /** Reports the current admin may emit, with the options for every filter. */
  @Get() async catalog(@Req() req: Request) {
    const admin = await requireAdmin(this.db, req);
    const available = REPORTS.filter((r) => allowed(admin, r));
    const options = await filterOptions(
      this.db,
      available.flatMap((r) => r.filters.map((f) => f.source)),
    );
    return {
      reports: available.map((r) => ({
        key: r.key,
        title: r.title,
        description: r.description,
        icon: r.icon,
        group: r.group,
        dateRange: r.dateRange,
        dateLabel: r.dateLabel,
        filters: r.filters,
      })),
      options,
    };
  }

  /** Latest documents: everyone's for auditors, otherwise only the admin's own. */
  @Get('history') async history(@Req() req: Request) {
    const admin = await requireAdmin(this.db, req);
    const logs = await this.db.auditLog.findMany({
      where: {
        action: 'REPORT_EXPORTED',
        ...(can(admin, 'audit.read') ? {} : { adminId: admin.id }),
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    const admins = await this.db.adminUser.findMany({
      where: { id: { in: [...new Set(logs.map((l) => l.adminId))] } },
      select: { id: true, email: true, displayName: true },
    });
    return logs.map((l) => {
      const a = admins.find((x) => x.id === l.adminId);
      const meta = (l.metadata ?? {}) as Record<string, unknown>;
      return {
        number: l.targetId,
        issuedAt: l.createdAt,
        issuedBy: a ? a.displayName || a.email : 'Conta eliminada',
        report: meta.report,
        format: meta.format,
        rows: meta.rows,
      };
    });
  }

  /** Confirms that a document number was issued by the system and shows how it was produced. */
  @Get('verify/:number') async verify(@Req() req: Request, @Param('number') number: string) {
    await requireAdmin(this.db, req);
    const log = await this.db.auditLog.findFirst({
      where: { action: 'REPORT_EXPORTED', targetId: number.trim().toUpperCase() },
    });
    if (!log) throw new NotFoundException('Nenhum documento emitido com este número.');
    const admin = await this.db.adminUser.findUnique({
      where: { id: log.adminId },
      select: { email: true, displayName: true },
    });
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    return {
      number: log.targetId,
      issuedAt: log.createdAt,
      issuedBy: admin ? admin.displayName || admin.email : 'Conta eliminada',
      ...meta,
    };
  }

  @Get(':key') @Throttle({ default: { limit: 20, ttl: 60000 } }) async generate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('key') key: string,
    @Query() query: Record<string, string>,
  ) {
    const admin = await requireAdmin(this.db, req);
    const report = REPORTS.find((r) => r.key === key);
    if (!report) throw new NotFoundException('Relatório inexistente.');
    if (!allowed(admin, report))
      throw new ForbiddenException('Não tem permissão para emitir este relatório.');
    const format = query.format === 'xlsx' ? 'xlsx' : 'pdf';

    let from = new Date(0);
    let to = new Date();
    if (report.dateRange) {
      const f = parseDay(query.from, false);
      const t = parseDay(query.to, true);
      if (!f || !t) throw new BadRequestException('Indique as datas de início e de fim.');
      if (t < f)
        throw new BadRequestException('A data final deve ser igual ou posterior à inicial.');
      if ((t.getTime() - f.getTime()) / DAY > MAX_RANGE_DAYS)
        throw new BadRequestException('O intervalo máximo é de 10 anos.');
      from = f;
      to = t;
    }
    const filters: Record<string, string> = {};
    for (const f of report.filters) {
      const value = (query[f.key] ?? '').trim();
      if (f.required && !value) throw new BadRequestException(`Seleccione: ${f.label}.`);
      if (value) filters[f.key] = value.slice(0, 100);
    }

    const data = await report.build(this.db, { from, to, filters });
    const options = await filterOptions(
      this.db,
      report.filters.filter((f) => filters[f.key]).map((f) => f.source),
    );
    const appliedFilters: [string, string][] = report.filters
      .filter((f) => filters[f.key])
      .map((f) => [
        f.label,
        options[f.source]?.find((o) => o.value === filters[f.key])?.label ?? filters[f.key],
      ]);

    const generatedAt = new Date();
    const number = documentNumber(generatedAt);
    const hash = createHash('sha256')
      .update(JSON.stringify({ number, key, from, to, filters, rows: data.rows }))
      .digest('hex');
    const settings = await this.db.institutionSetting.findMany();
    const setting = (k: string) => {
      const v = settings.find((s) => s.key === k)?.value;
      return typeof v === 'string' ? v : '';
    };
    const meta: ReportMeta = {
      number,
      hash,
      generatedAt,
      generatedBy: admin.displayName ? `${admin.displayName} (${admin.email})` : admin.email,
      range: report.dateRange
        ? `${report.dateLabel ? `${report.dateLabel} ` : ''}de ${formatDate(from)} a ${formatDate(to)}`
        : null,
      filters: appliedFilters,
      institution: {
        name: setting('institutionName') || 'GIO Centro de Formação',
        email: setting('institutionEmail') || process.env.INSTITUTIONAL_EMAIL || '',
        phone: setting('phone'),
        address: setting('address'),
        website: setting('website'),
      },
    };

    const file = format === 'pdf' ? await renderPdf(data, meta) : await renderXlsx(data, meta);
    await audit(this.db, admin.id, 'REPORT_EXPORTED', number, 'reports', {
      report: report.title,
      reportKey: key,
      format: format.toUpperCase(),
      period: meta.range,
      filters: appliedFilters.map(([k, v]) => `${k}: ${v}`),
      rows: data.rows.length,
      hash,
    });

    const filename = `${number}-${key}.${format}`;
    res.setHeader(
      'Content-Type',
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');
    res.send(file);
  }
}
