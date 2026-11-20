import { describe, expect, it } from 'vitest';
import { reportIcon } from '../src/maps/markerIcons.js';
import { REPORT_TYPES } from '../src/reports/reportTypes.js';

describe('report marker icons', () => {
  it.each(REPORT_TYPES.map((t) => [t.value, t]))('renders the %s icon as inline SVG', (value, type) => {
    const html = reportIcon(value).options.html;
    expect(html).toContain(`aria-label="${type.label}"`);
    expect(html).toContain(type.color);
    // Pin outline plus the Lucide glyph.
    expect(html.match(/<svg/g)).toHaveLength(2);
  });

  it('adds a badge to confirmed reports', () => {
    expect(reportIcon('flood', { confirmed: true }).options.html).toContain('#10b981');
    expect(reportIcon('flood').options.html).not.toContain('#10b981');
  });
});
