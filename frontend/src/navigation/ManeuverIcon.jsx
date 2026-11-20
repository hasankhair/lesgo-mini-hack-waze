import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Merge,
  Navigation2,
  RotateCw,
  Split,
  Undo2,
} from 'lucide-react';

export function maneuverIconFor(step) {
  if (!step) return ArrowUp;
  const { type, modifier } = step;
  if (type === 'arrive') return Flag;
  if (type === 'depart') return Navigation2;
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn' || type === 'exit roundabout' || type === 'exit rotary') return RotateCw;
  if (type === 'merge') return Merge;
  if (type === 'fork' && !modifier) return Split;
  switch (modifier) {
    case 'uturn':
      return Undo2;
    case 'sharp left':
    case 'left':
      return CornerUpLeft;
    case 'sharp right':
    case 'right':
      return CornerUpRight;
    case 'slight left':
      return ArrowUpLeft;
    case 'slight right':
      return ArrowUpRight;
    default:
      return ArrowUp;
  }
}

export default function ManeuverIcon({ step, className }) {
  const Icon = maneuverIconFor(step);
  return <Icon className={className} aria-hidden />;
}
