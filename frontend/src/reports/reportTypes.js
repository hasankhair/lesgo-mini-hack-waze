import { Ban, CarFront, Construction, Gauge, Info, Shield, TriangleAlert, Waves, Wrench } from 'lucide-react';

// Display metadata for community report categories. `value` must match the
// database check constraint on traffic_reports.report_type.
export const REPORT_TYPES = [
  { value: 'accident', label: 'Accident', color: '#dc2626', icon: CarFront },
  { value: 'traffic_jam', label: 'Traffic jam', color: '#f97316', icon: Gauge },
  { value: 'roadblock', label: 'Roadblock', color: '#be123c', icon: Ban },
  { value: 'police', label: 'Police checkpoint', color: '#2563eb', icon: Shield },
  { value: 'construction', label: 'Road construction', color: '#7c3aed', icon: Construction },
  { value: 'flood', label: 'Flood', color: '#0891b2', icon: Waves },
  { value: 'hazard', label: 'Road hazard', color: '#ca8a04', icon: TriangleAlert },
  { value: 'breakdown', label: 'Vehicle breakdown', color: '#78716c', icon: Wrench },
  { value: 'other', label: 'Other', color: '#475569', icon: Info },
];

const BY_VALUE = Object.fromEntries(REPORT_TYPES.map((t) => [t.value, t]));

export const getReportType = (value) => BY_VALUE[value] ?? BY_VALUE.other;
