// Decides what to say during navigation, and when. Pure functions, so the
// timing rules can be tested without a speech engine.

// Announcement stages for the next maneuver, from far to near (metres).
export const STAGES = [
  { id: 'far', within: 1000 },
  { id: 'near', within: 250 },
  { id: 'now', within: 40 },
];

// "In 300 metres" / "In 1.5 kilometres", rounded the way people speak.
export function spokenDistance(meters) {
  if (meters >= 950) {
    const km = Math.round(meters / 500) / 2;
    return `${km === 1 ? '1 kilometre' : `${km} kilometres`}`;
  }
  const rounded = meters >= 100 ? Math.round(meters / 50) * 50 : Math.max(10, Math.round(meters / 10) * 10);
  return `${rounded} metres`;
}

const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function maneuverPhrase(step, distance, stageId) {
  if (!step) return null;
  if (step.type === 'arrive') {
    return stageId === 'now' ? 'You have arrived at your destination.' : `In ${spokenDistance(distance)}, you will arrive at your destination.`;
  }
  if (stageId === 'now') return `${step.instruction}.`;
  return `In ${spokenDistance(distance)}, ${lowerFirst(step.instruction)}.`;
}

// Given live progress and the set of announcements already made, returns the
// phrase to speak now (or null) and the keys to mark as spoken.
//
// Each maneuver is announced at most once per stage. If the driver first
// sees a maneuver already inside a nearer stage (a short step), the farther
// stages are skipped rather than spoken late.
export function nextAnnouncement(progress, spoken) {
  if (!progress?.nextStep) return null;
  const { nextStepIndex, nextStep, distanceToNextStep } = progress;

  if (progress.arrived) {
    const key = 'arrived';
    return spoken.has(key) ? null : { text: 'You have arrived at your destination.', keys: [key] };
  }

  const stageIndex = STAGES.findLastIndex((s) => distanceToNextStep <= s.within);
  if (stageIndex === -1) return null;

  const stage = STAGES[stageIndex];
  const key = `${nextStepIndex}:${stage.id}`;
  if (spoken.has(key)) return null;

  // Mark this stage and every farther one, so we never go back to them.
  const keys = STAGES.slice(0, stageIndex + 1).map((s) => `${nextStepIndex}:${s.id}`);
  return { text: maneuverPhrase(nextStep, distanceToNextStep, stage.id), keys };
}
