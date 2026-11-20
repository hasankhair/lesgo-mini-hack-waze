// Builds human-readable English instructions from OSRM maneuvers.

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const direction = (modifier) => {
  switch (modifier) {
    case 'uturn':
      return 'Make a U-turn';
    case 'sharp right':
      return 'Turn sharp right';
    case 'right':
      return 'Turn right';
    case 'slight right':
      return 'Bear right';
    case 'straight':
      return 'Continue straight';
    case 'slight left':
      return 'Bear left';
    case 'left':
      return 'Turn left';
    case 'sharp left':
      return 'Turn sharp left';
    default:
      return 'Continue';
  }
};

const side = (modifier = '') => (modifier.includes('left') ? 'left' : modifier.includes('right') ? 'right' : null);

export function osrmInstruction(step) {
  const { maneuver = {}, name = '', ref = '', destinations = '' } = step;
  const { type, modifier, exit } = maneuver;
  const road = name || ref;
  const onto = road ? ` onto ${road}` : '';
  const towards = destinations ? ` towards ${destinations.split(':').pop().trim()}` : '';

  switch (type) {
    case 'depart':
      return road ? `Head out on ${road}` : 'Start driving';
    case 'arrive':
      return side(modifier) ? `Arrive at your destination on the ${side(modifier)}` : 'Arrive at your destination';
    case 'merge':
      return `Merge${side(modifier) ? ` ${side(modifier)}` : ''}${onto}`;
    case 'on ramp':
      return `Take the ramp${side(modifier) ? ` on the ${side(modifier)}` : ''}${onto || towards}`;
    case 'off ramp':
      return `Take the exit${side(modifier) ? ` on the ${side(modifier)}` : ''}${onto || towards}`;
    case 'fork':
      return `Keep ${side(modifier) || 'straight'} at the fork${onto || towards}`;
    case 'end of road':
      return `${direction(modifier)} at the end of the road${onto}`;
    case 'roundabout':
    case 'rotary':
      return exit ? `At the roundabout, take the ${ordinal(exit)} exit${onto}` : `Enter the roundabout${onto}`;
    case 'roundabout turn':
      return `At the roundabout, ${direction(modifier).toLowerCase()}${onto}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto}`;
    case 'new name':
      return road ? `Continue onto ${road}` : 'Continue';
    case 'continue':
      return modifier && modifier !== 'straight' ? `${direction(modifier)} to stay${onto || ' on the road'}` : `Continue${onto}`;
    case 'use lane':
      return `${direction(modifier)}${onto}`;
    default:
      return `${direction(modifier)}${onto}`;
  }
}
