
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 600;
export const GROUND_Y = CANVAS_HEIGHT - 60;

export const GRAVITY = 0.6;
export const JUMP_FORCE = -14;
export const MOVE_SPEED = 6;

export const BARRAGE_DURATION = 120; // 2 seconds at 60fps
export const BARRAGE_COOLDOWN = 60; // 1 second at 60fps

export const STAR_FINGER_COOLDOWN = 120; // 2 seconds at 60fps
export const HEAVY_PUNCH_COOLDOWN = 480; // 8 seconds at 60fps

export const STAR_FINGER_DAMAGE = 180;
export const STAR_FINGER_RANGE = 450;
export const STAR_FINGER_DURATION = 25;

export const HEAVY_PUNCH_DAMAGE = 250;
export const HEAVY_PUNCH_STUN_DURATION = 60; // 1 second at 60fps
export const HEAVY_PUNCH_DURATION = 30;

export const JOTARO_MAX_HEALTH = 1000;
export const DIO_MAX_HEALTH = 6000;

export const BARRAGE_DAMAGE = 8;
export const KNIFE_DAMAGE = 50;
export const ROAD_ROLLER_DAMAGE = 600; 
export const TIME_STOP_TELEPORT_DAMAGE = 150;

export const COLORS = {
  // Jotaro & Star Platinum
  JOTARO_COAT: '#282528',
  JOTARO_HAT: '#282528',
  JOTARO_GOLD: '#dfb455',
  JOTARO_SHIRT: '#68714e',
  JOTARO_SKIN: '#f5c8b0',
  
  STAR_PLATINUM_SKIN: '#8c78c7',
  STAR_PLATINUM_FINGER: '#b5a1f2',
  STAR_PLATINUM_HAIR: '#1c152a',
  STAR_PLATINUM_SCARF: '#a63c33',
  STAR_PLATINUM_GOLD: '#d68d40',
  STAR_PLATINUM_WHITE: '#ffffff',

  // Dio & The World
  DIO_HAIR: '#f9d423',
  DIO_JACKET: '#e6a623',
  DIO_SHIRT: '#282528',
  DIO_SKIN: '#f2c1ae',
  DIO_GREEN: '#32a852', 
  DIO_GOLD: '#dfb455',
  
  THE_WORLD_MAIN: '#f0c030',
  THE_WORLD_DARK: '#403d39',
  THE_WORLD_EYES: '#ff0000',
  THE_WORLD_AURA: 'rgba(255, 215, 0, 0.4)',

  KNIFE: '#cccccc',
  WARNING_RED: 'rgba(255, 0, 0, 0.7)',
  ROAD_ROLLER: '#f3da35',
  ROAD_ROLLER_DARK: '#8a7500',
  ROAD_ROLLER_STRIPE: '#111111',
  FROZEN_WORLD: 'rgba(0, 0, 40, 0.6)',
  
  // Background Colors - Cairo Night
  SKY_NIGHT: '#050510',
  SKY_HORIZON: '#101030',
  BRIDGE_FLOOR: '#1a1a25',
  BRIDGE_SIDE: '#2a2a35',
  BRIDGE_RAIL: '#4a4a55',
  MOON: '#f0f0ff',
  CITY_LIGHT: '#ffdd44',
  BUILDING: '#0a0a15'
};
