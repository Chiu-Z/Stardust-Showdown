
export interface Vector {
  x: number;
  y: number;
}

export enum EntityState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  DASHING = 'DASHING',
  BARRAGE = 'BARRAGE',
  HURT = 'HURT',
  DEAD = 'DEAD',
  ATTACKING = 'ATTACKING',
  TELEPORTING = 'TELEPORTING',
  PREPARING_TIME_STOP = 'PREPARING_TIME_STOP',
  STAR_FINGER = 'STAR_FINGER',
  HEAVY_PUNCH = 'HEAVY_PUNCH',
  SPECIAL_MOVE = 'SPECIAL_MOVE'
}

export interface Entity {
  pos: Vector;
  vel: Vector;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  state: EntityState;
  facing: number; // 1 for right, -1 for left
  stunTimer: number; // Duration in frames
  attackFrame: number; // Current frame of an active attack
}

export interface Knife {
  pos: Vector;
  vel: Vector;
  active: boolean;
  angle: number;
  targetPos?: Vector;
  launchDelay: number;
  deflectedByPlayer?: boolean;
  isHoming?: boolean;
}

export interface TextParticle {
  pos: Vector;
  vel: Vector;
  text: string;
  color: string;
  size: number;
  life: number;
}

export interface GameState {
  player: Entity;
  enemy: Entity;
  knives: Knife[];
  isTimeStopped: boolean;
  isTimeStopCountered: boolean;
  timeStopTimer: number;
  comboCount: number;
  specialMoveTimer: number;
  introTimer: number; // For the cinematic opening
  transitionTimer: number; // For the Phase 2 blood sucking animation
  dioFightPhase: 1 | 2;
  roadRoller: {
    active: boolean;
    pos: Vector;
    warningTimer: number;
    impacted: boolean;
  } | null;
  keys: Record<string, boolean>;
  mouse: { down: boolean };
  particles: { pos: Vector; vel: Vector; color: string; life: number }[];
  textParticles: TextParticle[];
  status: 'PLAYING' | 'VICTORY' | 'DEFEAT';
  cameraShake: { intensity: number; duration: number };
  abilityTimers: {
    barrageActive: number;
    barrageCooldown: number;
    starFingerCooldown: number;
    heavyPunchCooldown: number;
    dioTimeStopCooldown: number;
    dioBarrageCooldown: number;
  };
}
