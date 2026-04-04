import Handlebars from 'handlebars';
import type { ISpool } from '@/types/spoolman';
import { normalizeUrl } from '@/lib/spoolmanApi';

// Register custom helpers
Handlebars.registerHelper('ifval', function (
  this: Record<string, unknown>,
  value: unknown,
  options: Handlebars.HelperOptions
) {
  if (value === null || value === undefined || value === '' || value === 0 || value === false) {
    return options.inverse ? options.inverse(this) : '';
  }
  return options.fn(this);
});

Handlebars.registerHelper('eq', function (
  this: Record<string, unknown>,
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions
) {
  if (a === b) return options.fn(this);
  return options.inverse ? options.inverse(this) : '';
});

export interface TemplateContext extends Record<string, unknown> {
  id: number;
  spoolman_host: string;
  filament: Record<string, unknown>;
  remaining_weight: number | null;
  used_weight: number;
  location: string | null;
  comment: string | null;
}

export function buildTemplateContext(spool: ISpool, spoolmanHost: string): TemplateContext {
  const filament: Record<string, unknown> = { ...spool.filament };

  // Parse JSON string fields in extra if present
  if (spool.filament.extra) {
    for (const [k, v] of Object.entries(spool.filament.extra)) {
      try {
        filament[`extra_${k}`] = JSON.parse(v);
      } catch {
        filament[`extra_${k}`] = v;
      }
    }
  }

  return {
    ...spool,
    filament,
    spoolman_host: normalizeUrl(spoolmanHost),
  };
}

function compileTemplate(template: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(template, { noEscape: true });
}

export function renderTemplate(template: string, context: TemplateContext): string {
  const compiled = compileTemplate(template);
  return compiled(context);
}
