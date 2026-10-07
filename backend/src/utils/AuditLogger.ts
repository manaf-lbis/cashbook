import { Request } from 'express';

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  actorId?: string;
  actorUsername?: string;
  ip: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details?: Record<string, any>;
}

export class AuditLogger {
  static getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  static log(
    req: Request,
    action: string,
    status: 'SUCCESS' | 'FAILURE' | 'WARNING',
    details?: Record<string, any>
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      actorId: req.user?.userId,
      actorUsername: req.user?.username,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] as string | undefined,
      status,
      details,
    };

    const statusBadge =
      status === 'SUCCESS' ? '✅' : status === 'FAILURE' ? '❌' : '⚠️';

    console.log(
      `[SECURITY AUDIT] ${statusBadge} [${entry.timestamp}] Action: ${entry.action} | Actor: ${entry.actorUsername || 'ANONYMOUS'} (${entry.ip}) | Status: ${entry.status} ${
        entry.details ? JSON.stringify(entry.details) : ''
      }`
    );
  }
}
