
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  GRAVITY,
  JUMP_FORCE,
  MOVE_SPEED,
  BARRAGE_DURATION,
  BARRAGE_COOLDOWN,
  STAR_FINGER_COOLDOWN,
  STAR_FINGER_DAMAGE,
  STAR_FINGER_RANGE,
  STAR_FINGER_DURATION,
  HEAVY_PUNCH_COOLDOWN,
  HEAVY_PUNCH_DAMAGE,
  HEAVY_PUNCH_STUN_DURATION,
  HEAVY_PUNCH_DURATION,
  JOTARO_MAX_HEALTH,
  DIO_MAX_HEALTH,
  BARRAGE_DAMAGE,
  KNIFE_DAMAGE,
  ROAD_ROLLER_DAMAGE,
  TIME_STOP_TELEPORT_DAMAGE,
  COLORS,
  PIXEL_SCALE
} from './constants';
import { Entity, EntityState, GameState, Knife, Vector, TextParticle } from './types';

type GamePhase = 'MENU' | 'INTRO' | 'PRE_FIGHT_SCENE' | 'APPROACH_SCENE' | 'TRANSITION' | 'PLAYING' | 'VICTORY' | 'DEFEAT' | 'PAUSED';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const lastPhaseBeforePause = useRef<GamePhase>('PLAYING');
  const currentCheckpoint = useRef<1 | 2>(1);

  const createInitialState = (startingPhase: 1 | 2 = 1): GameState => ({
    player: {
      pos: { x: 200, y: GROUND_Y - 100 },
      vel: { x: 0, y: 0 },
      width: 40,
      height: 80,
      health: JOTARO_MAX_HEALTH,
      maxHealth: JOTARO_MAX_HEALTH,
      state: EntityState.IDLE,
      facing: 1,
      stunTimer: 0,
      attackFrame: 0
    },
    enemy: {
      pos: { x: 900, y: GROUND_Y - 100 },
      vel: { x: 0, y: 0 },
      width: 40,
      height: 80,
      health: startingPhase === 1 ? DIO_MAX_HEALTH : DIO_MAX_HEALTH * 1.5,
      maxHealth: startingPhase === 1 ? DIO_MAX_HEALTH : DIO_MAX_HEALTH * 1.5,
      state: EntityState.IDLE,
      facing: -1,
      stunTimer: 0,
      attackFrame: 0
    },
    knives: [],
    isTimeStopped: false,
    isTimeStopCountered: false,
    timeStopTimer: 0,
    comboCount: 0,
    specialMoveTimer: 0,
    introTimer: 0,
    preFightTimer: 300, // 5 seconds for pre-fight scene
    approachTimer: 450, // 7.5 seconds for approach scene
    transitionTimer: 0,
    dioFightPhase: startingPhase,
    checkpointPhase: startingPhase,
    roadRoller: null,
    keys: {},
    mouse: { down: false },
    particles: [],
    textParticles: [],
    status: 'PLAYING',
    cameraShake: { intensity: 0, duration: 0 },
    abilityTimers: {
      barrageActive: 0,
      barrageCooldown: 0,
      starFingerCooldown: 0,
      heavyPunchCooldown: 0,
      dioTimeStopCooldown: 120,
      dioBarrageCooldown: 0
    },
    globalTimer: 0
  });

  const gameStateRef = useRef<GameState>(createInitialState());

  const [uiState, setUiState] = useState({
    playerHealth: JOTARO_MAX_HEALTH,
    enemyHealth: DIO_MAX_HEALTH,
    barrageCD: 0,
    starFingerCD: 0,
    heavyPunchCD: 0,
    combo: 0,
    isBarrageActive: false,
    isStarFingerActive: false,
    isHeavyPunchActive: false,
    isTimeStopped: false,
    isTimeStopCountered: false,
    playerHurt: false,
    enemyHurt: false,
    dioFightPhase: 1
  });

  const dioActionTimer = useRef(0);
  const dioAIPhase = useRef<'IDLE' | 'ATTACKING'>('IDLE');
  const lastPlayerHealth = useRef(JOTARO_MAX_HEALTH);
  const lastEnemyHealth = useRef(DIO_MAX_HEALTH);

  // Debug State
  const [debugMode, setDebugMode] = useState(false);

  const jotaroImg = useRef<HTMLImageElement>(null);
  const jotaroWalk1Img = useRef<HTMLImageElement>(null);
  const jotaroWalk2Img = useRef<HTMLImageElement>(null);
  const jotaroWalkTransImg = useRef<HTMLImageElement>(null);
  const jotaroJumpImg = useRef<HTMLImageElement>(null);
  const dioImg = useRef<HTMLImageElement>(null);
  const starPlatinumImg = useRef<HTMLImageElement>(null);
  const theWorldImg = useRef<HTMLImageElement>(null);

  // Helper to remove white background AND crop
  const loadAndCropImage = (src: string, ref: React.MutableRefObject<HTMLImageElement | null>) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];

            // Check for White or Light Gray (Checkerboard pattern)
            // Grays are usually neutral (r~=g~=b)
            // Pixel analysis showed background grays go down to ~237. Safe buffer to 230.
            const isNeutral = Math.abs(r - g) < 20 && Math.abs(r - b) < 20 && Math.abs(g - b) < 20;
            const isBright = r > 230;

            if (isNeutral && isBright) {
              d[i + 3] = 0; // Make transparent
            }

            // If not transparent, update bounds
            if (d[i + 3] > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        if (found) {
          const w = maxX - minX + 1;
          const h = maxY - minY + 1;
          const cropC = document.createElement('canvas');
          cropC.width = w; cropC.height = h;
          const cropCtx = cropC.getContext('2d');
          if (cropCtx) {
            cropCtx.putImageData(id, -minX, -minY, 0, 0, c.width, c.height); // Put cleaned image
            const newImg = new Image();
            newImg.src = cropC.toDataURL();
            ref.current = newImg;
          }
        } else {
          // Fallback if empty (shouldn't happen)
          ref.current = img;
        }
      }
    };
  };

  useEffect(() => {
    loadAndCropImage('/jotaro_new.png', jotaroImg);
    loadAndCropImage('/character_walk1.png', jotaroWalk1Img);
    loadAndCropImage('/character_walk2.png', jotaroWalk2Img);
    loadAndCropImage('/character_walk_transition.png', jotaroWalkTransImg);
    loadAndCropImage('/character_jump.png', jotaroJumpImg);
    loadAndCropImage('/dio_new.png', dioImg);
    loadAndCropImage('/star_platinum_new.png', starPlatinumImg);
    loadAndCropImage('/the_world.png', theWorldImg);
  }, []);

  const startGame = (resetCheckpoint: boolean = true) => {
    if (resetCheckpoint) currentCheckpoint.current = 1;
    gameStateRef.current = createInitialState(currentCheckpoint.current);

    // If starting at Phase 2, we jump straight to TRANSITION or PLAYING? 
    // Usually starting at Phase 2 means starting the fight, but let's re-run INTRO/TRANSITION for flavor.
    if (currentCheckpoint.current === 1) {
      gameStateRef.current.introTimer = 180;
      gameStateRef.current.preFightTimer = 300;
      gameStateRef.current.approachTimer = 450;
      setPhase('INTRO');
    } else {
      // Start Phase 2 fight
      setPhase('PLAYING');
    }

    dioActionTimer.current = 0;
    dioAIPhase.current = 'IDLE';
  };

  const resumeGame = () => {
    if (phase === 'PAUSED') {
      setPhase(lastPhaseBeforePause.current);
    }
  };

  const restartGame = () => {
    startGame(false); // Restart from current checkpoint
  };

  const goToMenu = () => {
    setPhase('MENU');
    currentCheckpoint.current = 1;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      gameStateRef.current.keys[key] = true;

      const s = gameStateRef.current;

      if (e.key === 'Escape') {
        if (phase === 'PAUSED') {
          resumeGame();
        } else if (phase === 'PLAYING' || phase === 'INTRO' || phase === 'TRANSITION' || phase === 'PRE_FIGHT_SCENE' || phase === 'APPROACH_SCENE') {
          lastPhaseBeforePause.current = phase;
          setPhase('PAUSED');
        }
        return;
      }

      // Skip Cinematic Logic
      if (key === 'x' && (phase === 'INTRO' || phase === 'PRE_FIGHT_SCENE' || phase === 'APPROACH_SCENE')) {
        s.introTimer = 0;
        s.preFightTimer = 0;
        s.approachTimer = 0;
        s.transitionTimer = 0;

        // Reset positions to fight start
        s.player.pos.x = 200;
        s.player.pos.y = GROUND_Y - 100;
        s.enemy.pos.x = 900;
        s.enemy.pos.y = GROUND_Y - 100;

        s.player.facing = 1;
        s.enemy.facing = -1;

        s.player.state = EntityState.IDLE;
        s.enemy.state = EntityState.IDLE;

        s.knives = [];
        s.textParticles = [];
        s.particles = [];
        s.roadRoller = null;

        setPhase('PLAYING');
        return;
      }

      if (phase !== 'PLAYING' || s.player.state === EntityState.SPECIAL_MOVE) return;

      if (key === 'c' &&
        s.abilityTimers.starFingerCooldown <= 0 &&
        (s.player.state === EntityState.IDLE || s.player.state === EntityState.MOVING)) {
        s.player.state = EntityState.STAR_FINGER;
        s.abilityTimers.starFingerCooldown = STAR_FINGER_COOLDOWN;
        s.player.attackFrame = STAR_FINGER_DURATION;
      }

      if (key === 'x' &&
        s.abilityTimers.heavyPunchCooldown <= 0 &&
        (s.player.state === EntityState.IDLE || s.player.state === EntityState.MOVING)) {
        s.player.state = EntityState.HEAVY_PUNCH;
        s.abilityTimers.heavyPunchCooldown = HEAVY_PUNCH_COOLDOWN;
        s.player.attackFrame = HEAVY_PUNCH_DURATION;
      }

      if ((key === 'w' || key === ' ') &&
        Math.abs(s.player.pos.y - (GROUND_Y - s.player.height)) < 1) {
        if (s.player.state !== EntityState.STAR_FINGER && s.player.state !== EntityState.HEAVY_PUNCH) {
          s.player.vel.y = JUMP_FORCE;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameStateRef.current.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseDown = () => { gameStateRef.current.mouse.down = true; };
    const handleMouseUp = () => { gameStateRef.current.mouse.down = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [phase]);

  const spawnParticles = useCallback((pos: Vector, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      gameStateRef.current.particles.push({
        pos: { ...pos },
        vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 },
        color,
        life: 25 + Math.random() * 25
      });
    }
  }, []);

  const spawnTextParticle = useCallback((pos: Vector, text: string, color: string, customSize?: number) => {
    gameStateRef.current.textParticles.push({
      pos: {
        x: pos.x + (Math.random() - 0.5) * 150,
        y: pos.y + (Math.random() - 0.5) * 150
      },
      vel: { x: (Math.random() - 0.5) * 4, y: -4 - Math.random() * 4 },
      text,
      color,
      life: 40,
      size: customSize || (40 + Math.random() * 30)
    });
  }, []);

  const triggerShake = useCallback((intensity: number, duration: number) => {
    if (gameStateRef.current.cameraShake.intensity < intensity) {
      gameStateRef.current.cameraShake.intensity = intensity;
    }
    if (gameStateRef.current.cameraShake.duration < duration) {
      gameStateRef.current.cameraShake.duration = duration;
    }
  }, []);

  const update = useCallback(() => {
    const s = gameStateRef.current;

    if (phase === 'PAUSED') return;

    if (phase === 'INTRO') {
      s.introTimer--;
      if (s.introTimer <= 0) {
        setPhase('PRE_FIGHT_SCENE');
      }
      if (Math.random() < 0.1) {
        spawnTextParticle({ x: s.enemy.pos.x, y: s.enemy.pos.y }, "ゴ", "rgba(255,255,255,0.2)", 40 + Math.random() * 40);
      }
      s.textParticles.forEach(tp => { tp.pos.x += tp.vel.x; tp.pos.y += tp.vel.y; tp.life--; });
      s.textParticles = s.textParticles.filter(tp => tp.life > 0);
      return;
    }

    s.globalTimer++;

    if (phase === 'PRE_FIGHT_SCENE') {
      s.preFightTimer--;

      // Kakyoin's last stand
      if (s.preFightTimer === 270) {
        spawnTextParticle({ x: 400, y: GROUND_Y - 150 }, "TAKE THIS, DIO!", COLORS.KAKYOIN_GREEN, 50);
      }
      if (s.preFightTimer === 250) {
        spawnTextParticle({ x: 400, y: GROUND_Y - 150 }, "EMERALD SPLASH!", COLORS.KAKYOIN_GREEN, 60);
      }
      if (s.preFightTimer > 200 && s.preFightTimer < 250 && s.preFightTimer % 5 === 0) {
        spawnParticles({ x: 500, y: GROUND_Y - 100 }, COLORS.KAKYOIN_GREEN, 15);
      }

      // The World trigger
      if (s.preFightTimer === 180) {
        spawnTextParticle({ x: 800, y: GROUND_Y - 150 }, "ZA WARUDO!", COLORS.DIO_HAIR, 70);
        triggerShake(10, 10);
      }

      // The Donut
      if (s.preFightTimer === 150) {
        spawnTextParticle({ x: 400, y: GROUND_Y - 150 }, "SHINEI!", COLORS.DIO_HAIR, 80);
        spawnParticles({ x: 400, y: GROUND_Y - 80 }, "red", 60);
        triggerShake(20, 20);
      }

      // Joseph reaction
      if (s.preFightTimer === 100) {
        spawnTextParticle({ x: 300, y: GROUND_Y - 150 }, "KAKYOIN!!", COLORS.JOSEPH_SHIRT, 50);
      }

      // Joseph punched
      if (s.preFightTimer === 50) {
        spawnTextParticle({ x: 500, y: GROUND_Y - 150 }, "USELESS!", COLORS.DIO_HAIR, 60);
        triggerShake(15, 15);
      }

      if (s.preFightTimer <= 0) {
        setPhase('APPROACH_SCENE');
      }

      s.textParticles.forEach(tp => { tp.pos.x += tp.vel.x; tp.pos.y += tp.vel.y; tp.life--; });
      s.textParticles = s.textParticles.filter(tp => tp.life > 0);
      s.particles.forEach(part => { part.pos.x += part.vel.x; part.pos.y += part.vel.y; part.life--; });
      s.particles = s.particles.filter(p => p.life > 0);
      return;
    }

    if (phase === 'APPROACH_SCENE') {
      s.approachTimer--;

      // Reset positions for cinematic
      if (s.approachTimer === 449) {
        s.player.pos.x = 200;
        s.enemy.pos.x = 900;
        s.player.facing = 1;
        s.enemy.facing = -1;
        s.player.state = EntityState.IDLE;
        s.enemy.state = EntityState.IDLE;
      }

      if (s.approachTimer === 430) {
        spawnTextParticle({ x: 900, y: GROUND_Y - 200 }, "Oh? You're approaching me?", COLORS.DIO_HAIR, 45);
      }
      if (s.approachTimer === 350) {
        spawnTextParticle({ x: 900, y: GROUND_Y - 200 }, "Instead of running away,", COLORS.DIO_HAIR, 40);
        spawnTextParticle({ x: 900, y: GROUND_Y - 160 }, "you're coming right to me?", COLORS.DIO_HAIR, 40);
      }
      if (s.approachTimer === 250) {
        spawnTextParticle({ x: 200, y: GROUND_Y - 200 }, "I can't beat the shit out of you", COLORS.STAR_PLATINUM_SKIN, 40);
        spawnTextParticle({ x: 200, y: GROUND_Y - 160 }, "without getting closer.", COLORS.STAR_PLATINUM_SKIN, 40);
      }
      if (s.approachTimer === 150) {
        spawnTextParticle({ x: 900, y: GROUND_Y - 200 }, "Ho ho! Then come as close", COLORS.DIO_HAIR, 45);
        spawnTextParticle({ x: 900, y: GROUND_Y - 160 }, "as you like.", COLORS.DIO_HAIR, 45);
      }

      // Walking animation
      if (s.approachTimer < 150 && s.approachTimer > 10) {
        s.player.pos.x += 1.5;
        s.enemy.pos.x -= 1.5;
        s.player.state = EntityState.MOVING;
        s.enemy.state = EntityState.MOVING;
        if (s.approachTimer % 20 === 0) {
          spawnTextParticle({ x: s.player.pos.x + 50, y: GROUND_Y - 50 }, "ゴ", "rgba(255,255,255,0.2)", 40);
          spawnTextParticle({ x: s.enemy.pos.x - 50, y: GROUND_Y - 50 }, "ゴ", "rgba(255,255,255,0.2)", 40);
        }
      } else {
        s.player.state = EntityState.IDLE;
        s.enemy.state = EntityState.IDLE;
      }

      if (s.approachTimer <= 0) {
        setPhase('PLAYING');
      }

      s.textParticles.forEach(tp => { tp.pos.x += tp.vel.x; tp.pos.y += tp.vel.y; tp.life--; });
      s.textParticles = s.textParticles.filter(tp => tp.life > 0);
      return;
    }

    if (phase === 'TRANSITION') {
      // Trigger Kakyoin's Blessing and Regeneration
      if (s.transitionTimer === 180) {
        const healAmount = JOTARO_MAX_HEALTH * 0.4;
        s.player.health = Math.min(s.player.health + healAmount, JOTARO_MAX_HEALTH);
        spawnTextParticle({ x: s.player.pos.x, y: s.player.pos.y - 100 }, "KAKYOIN'S MESSAGE...", COLORS.KAKYOIN_GREEN, 60);
        spawnParticles(s.player.pos, COLORS.KAKYOIN_GREEN, 50);
      }

      s.transitionTimer--;

      // Kakyoin visual blessing for Jotaro
      if (s.transitionTimer > 0 && s.transitionTimer % 3 === 0) {
        s.particles.push({
          pos: { x: s.player.pos.x + Math.random() * s.player.width, y: s.player.pos.y + Math.random() * s.player.height },
          vel: { x: (Math.random() - 0.5) * 4, y: -4 - Math.random() * 4 },
          color: COLORS.KAKYOIN_GREEN,
          life: 30
        });
      }

      // Regeneration of Dio
      if (s.transitionTimer < 120) {
        const regenAmount = (DIO_MAX_HEALTH * 1.5) / 120;
        s.enemy.health = Math.min(s.enemy.health + regenAmount, DIO_MAX_HEALTH * 1.5);
      }

      if (s.transitionTimer <= 0) {
        s.dioFightPhase = 2;
        currentCheckpoint.current = 2; // Checkpoint reached
        s.enemy.health = DIO_MAX_HEALTH * 1.5;
        s.enemy.maxHealth = DIO_MAX_HEALTH * 1.5;
        setPhase('PLAYING');
      }
      s.textParticles.forEach(tp => { tp.pos.x += tp.vel.x; tp.pos.y += tp.vel.y; tp.life--; });
      s.textParticles = s.textParticles.filter(tp => tp.life > 0);
      s.particles.forEach(part => { part.pos.x += part.vel.x; part.pos.y += part.vel.y; part.life--; });
      s.particles = s.particles.filter(p => p.life > 0);
      return;
    }

    if (phase !== 'PLAYING') {
      if (Math.random() < 0.05) {
        spawnTextParticle({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT }, "ゴ", "rgba(255,255,255,0.1)", 40 + Math.random() * 40);
      }
      s.textParticles.forEach(tp => { tp.pos.x += tp.vel.x; tp.pos.y += tp.vel.y; tp.life--; });
      s.textParticles = s.textParticles.filter(tp => tp.life > 0);
      return;
    }

    if (s.cameraShake.duration > 0) {
      s.cameraShake.duration--;
    } else {
      s.cameraShake.intensity = 0;
    }

    if (s.isTimeStopped && s.player.state !== EntityState.SPECIAL_MOVE) {
      s.timeStopTimer--;
      if (s.timeStopTimer <= 0) {
        s.isTimeStopped = false;
        s.isTimeStopCountered = false;
      }
    }

    const p = s.player;
    const e = s.enemy;
    const isMoving = s.keys['a'] || s.keys['d'];

    if (s.abilityTimers.barrageCooldown > 0) s.abilityTimers.barrageCooldown--;
    if (s.abilityTimers.starFingerCooldown > 0) s.abilityTimers.starFingerCooldown--;
    if (s.abilityTimers.heavyPunchCooldown > 0) s.abilityTimers.heavyPunchCooldown--;
    if (s.abilityTimers.dioTimeStopCooldown > 0) s.abilityTimers.dioTimeStopCooldown--;
    if (s.abilityTimers.dioBarrageCooldown > 0) s.abilityTimers.dioBarrageCooldown--;

    if (p.stunTimer > 0) p.stunTimer--;
    if (e.stunTimer > 0) e.stunTimer--;

    if (p.state === EntityState.SPECIAL_MOVE) {
      s.specialMoveTimer--;
      s.isTimeStopped = true;
      s.isTimeStopCountered = true;
      if (s.specialMoveTimer % 10 === 0) {
        spawnTextParticle(e.pos, 'ORA!', COLORS.STAR_PLATINUM_SKIN, 80 + Math.random() * 40);
        e.health -= HEAVY_PUNCH_DAMAGE / 2;
        spawnParticles(e.pos, COLORS.STAR_PLATINUM_SKIN, 10);
        triggerShake(10, 5);
      }
      const distToDio = e.pos.x - p.pos.x;
      p.pos.x += distToDio * 0.1;
      p.pos.y = e.pos.y;
      p.facing = distToDio > 0 ? 1 : -1;

      if (s.specialMoveTimer <= 0) {
        p.state = EntityState.IDLE;
        e.state = EntityState.IDLE;
        e.stunTimer = 0;
        dioAIPhase.current = 'IDLE';
        dioActionTimer.current = 0;

        s.isTimeStopped = false;
        s.isTimeStopCountered = false;
        s.comboCount = 0;
        spawnTextParticle(e.pos, 'TIME RESUMES!', '#fff', 60);
        triggerShake(20, 30);
      }
    }

    const playerCanAct = p.stunTimer <= 0 && (!s.isTimeStopped || s.isTimeStopCountered || p.state === EntityState.SPECIAL_MOVE);
    const dioCanAct = e.stunTimer <= 0 && (!s.isTimeStopped || (s.isTimeStopped && p.state !== EntityState.SPECIAL_MOVE));

    if (playerCanAct && p.state !== EntityState.SPECIAL_MOVE) {
      if (p.state === EntityState.HEAVY_PUNCH) {
        p.vel.x = 0;
        p.attackFrame--;
        if (p.attackFrame === Math.floor(HEAVY_PUNCH_DURATION / 2)) {
          spawnTextParticle(p.pos, 'ORA!', COLORS.STAR_PLATINUM_SKIN, 150);
          const dist = Math.abs((p.pos.x + p.width / 2) - (e.pos.x + e.width / 2));
          if (dist < 140 && p.facing * (e.pos.x - p.pos.x) > 0) {
            e.health -= HEAVY_PUNCH_DAMAGE;
            s.comboCount++;
            e.stunTimer = HEAVY_PUNCH_STUN_DURATION;
            spawnParticles(e.pos, COLORS.STAR_PLATINUM_SKIN, 40);
            spawnTextParticle(e.pos, 'STUNNED!', '#fff', 50);
            triggerShake(15, 20);
            e.pos.x += p.facing * 30;
          }
        }
        if (p.attackFrame <= 0) p.state = EntityState.IDLE;
      } else if (p.state === EntityState.STAR_FINGER) {
        p.vel.x = 0;
        p.attackFrame--;

        if (p.attackFrame === STAR_FINGER_DURATION - 5) {
          spawnTextParticle(p.pos, 'STAR FINGER!', COLORS.STAR_PLATINUM_FINGER, 70);
          const hitX = p.pos.x + p.width / 2 + (p.facing * STAR_FINGER_RANGE);
          const eX = e.pos.x + e.width / 2;
          const eY = e.pos.y + e.height / 2;
          const pY = p.pos.y + p.height / 2;
          const withinRange = p.facing === 1 ? eX > p.pos.x && eX < hitX : eX < p.pos.x && eX > hitX;
          if (withinRange && Math.abs(eY - pY) < 100) {
            e.health -= STAR_FINGER_DAMAGE;
            s.comboCount++;
            spawnParticles(e.pos, COLORS.STAR_PLATINUM_SKIN, 20);
            triggerShake(10, 15);
            e.pos.x += p.facing * 10;
          }
        }
        if (p.attackFrame <= 0) p.state = EntityState.IDLE;
      } else if (p.state === EntityState.BARRAGE) {
        s.abilityTimers.barrageActive--;
        p.vel.x *= 0.8;
        if (Math.random() < 0.45) {
          spawnTextParticle({ x: p.pos.x + (p.facing * 60), y: p.pos.y }, 'ORA!', COLORS.STAR_PLATINUM_SKIN, 50 + Math.random() * 40);
        }
        const dist = Math.abs((p.pos.x + p.width / 2) - (e.pos.x + e.width / 2));
        const isClashing = e.state === EntityState.BARRAGE && dist < 160;
        if (!isClashing && dist < 130 && p.facing * (e.pos.x - p.pos.x) > 0) {
          e.health -= BARRAGE_DAMAGE;
          s.comboCount++;
          spawnParticles(e.pos, COLORS.THE_WORLD_MAIN, 2);
          triggerShake(3, 5);
          e.pos.x += p.facing * 0.5;
        } else if (isClashing) {
          if (Math.random() < 0.2) spawnTextParticle({ x: (p.pos.x + e.pos.x) / 2, y: p.pos.y }, 'CLASH!', '#fff', 60);
          triggerShake(4, 5);
          p.pos.x -= p.facing * 0.3;
          e.pos.x -= e.facing * 0.3;
        }
        s.knives.forEach(k => {
          if (k.active && !k.deflectedByPlayer && k.launchDelay <= 0) {
            const bX = p.pos.x + p.width / 2;
            const bY = p.pos.y + p.height / 2;
            const bDist = Math.sqrt((k.pos.x - bX) ** 2 + (k.pos.y - bY) ** 2);
            if (bDist < 150 && p.facing * (k.pos.x - bX) > -30) {
              k.deflectedByPlayer = true;
              const speed = 22;
              const willHome = Math.random() < 0.3;
              k.isHoming = willHome;
              if (willHome) {
                const dx = (e.pos.x + e.width / 2) - k.pos.x;
                const dy = (e.pos.y + e.height / 2) - k.pos.y;
                const angle = Math.atan2(dy, dx);
                k.vel.x = Math.cos(angle) * speed;
                k.vel.y = Math.sin(angle) * speed;
                k.angle = angle;
              } else {
                const baseAngle = p.facing === 1 ? -Math.PI / 4 : -3 * Math.PI / 4;
                const angle = baseAngle + (Math.random() - 0.5) * 2.5;
                k.vel.x = Math.cos(angle) * speed;
                k.vel.y = Math.sin(angle) * speed;
                k.angle = angle;
              }
              spawnParticles(k.pos, COLORS.STAR_PLATINUM_SKIN, 8);
              spawnTextParticle(k.pos, willHome ? 'DEFLECT!' : 'PARRY!', COLORS.STAR_PLATINUM_SKIN, 30);
            }
          }
        });
        if (s.abilityTimers.barrageActive <= 0) {
          p.state = EntityState.IDLE;
          s.abilityTimers.barrageCooldown = BARRAGE_COOLDOWN;
        }
      } else {
        if (s.mouse.down && s.abilityTimers.barrageCooldown <= 0) {
          p.state = EntityState.BARRAGE;
          s.abilityTimers.barrageActive = BARRAGE_DURATION;
        } else {
          if (s.keys['a']) { p.vel.x = -MOVE_SPEED; p.facing = -1; }
          else if (s.keys['d']) { p.vel.x = MOVE_SPEED; p.facing = 1; }
          else { p.vel.x = 0; }
          p.state = isMoving ? EntityState.MOVING : EntityState.IDLE;
        }
      }
      p.vel.y += GRAVITY;
      p.pos.x += p.vel.x; p.pos.y += p.vel.y;
      if (p.pos.y > GROUND_Y - p.height) { p.pos.y = GROUND_Y - p.height; p.vel.y = 0; }
      p.pos.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.pos.x));
      e.pos.x = Math.max(0, Math.min(CANVAS_WIDTH - e.width, e.pos.x));

      if (s.comboCount >= 100) {
        p.state = EntityState.SPECIAL_MOVE;
        s.specialMoveTimer = 180;
        spawnTextParticle(p.pos, 'STAR PLATINUM: ZA WARUDO!', COLORS.STAR_PLATINUM_SKIN, 60);
        triggerShake(20, 20);
      }
    }

    if (dioCanAct) {
      dioActionTimer.current++;
      e.facing = p.pos.x > e.pos.x ? 1 : -1;
      const moveSpeed = (s.isTimeStopped ? 11 : 8) * (s.dioFightPhase === 2 ? 1.4 : 1);

      if (dioAIPhase.current === 'IDLE') {
        const checkInterval = 20;
        if (dioActionTimer.current > checkInterval) {
          const dist = Math.abs((p.pos.x + p.width / 2) - (e.pos.x + e.width / 2));
          const rand = Math.random();

          if (rand < 0.4 && s.abilityTimers.dioTimeStopCooldown <= 0 && !s.isTimeStopped) {
            e.state = EntityState.PREPARING_TIME_STOP;
            dioActionTimer.current = 0;
            dioAIPhase.current = 'ATTACKING';
            spawnTextParticle(e.pos, 'ZA WARUDO!', COLORS.DIO_HAIR, 80);
          } else if (dist < 180 && rand < 0.8 && s.abilityTimers.dioBarrageCooldown <= 0) {
            e.state = EntityState.BARRAGE;
            dioActionTimer.current = 0;
            dioAIPhase.current = 'ATTACKING';
          } else if (dist > 350 && rand < 0.7) {
            e.state = EntityState.ATTACKING;
            dioActionTimer.current = 0;
            dioAIPhase.current = 'ATTACKING';
            const count = s.isTimeStopped ? 12 : 6;
            for (let i = 0; i < count; i++) {
              s.knives.push({
                pos: { x: e.pos.x + (e.facing * 50), y: e.pos.y + (i * 20) - 50 },
                vel: { x: 0, y: 0 },
                active: true,
                angle: 0,
                launchDelay: s.isTimeStopped ? 5 : 40 + (i * 8),
                deflectedByPlayer: false,
                isHoming: s.isTimeStopped
              });
            }
          } else if (rand < 0.15 && !s.isTimeStopped && !s.roadRoller) {
            s.roadRoller = { active: true, pos: { x: p.pos.x - 100, y: -450 }, warningTimer: 45, impacted: false };
            dioActionTimer.current = 0;
            dioAIPhase.current = 'ATTACKING';
          } else {
            if (dist > 100) e.pos.x += Math.sign(p.pos.x - e.pos.x) * moveSpeed;
            else if (rand < 0.1) e.pos.x -= Math.sign(p.pos.x - e.pos.x) * moveSpeed;
          }
        } else {
          const dist = Math.abs((p.pos.x + p.width / 2) - (e.pos.x + e.width / 2));
          if (dist > 90) {
            e.pos.x += Math.sign(p.pos.x - e.pos.x) * moveSpeed;
          }
        }
      } else {
        if (e.state === EntityState.PREPARING_TIME_STOP) {
          if (dioActionTimer.current > 30) {
            if (s.keys['q']) {
              s.isTimeStopped = true;
              s.isTimeStopCountered = true;
              s.timeStopTimer = 300;
              spawnTextParticle(p.pos, 'MY WORLD!', COLORS.STAR_PLATINUM_SKIN, 80);
              triggerShake(15, 15);
            } else {
              e.pos.x = p.pos.x - (p.facing * 80); e.pos.y = p.pos.y;
              p.health -= TIME_STOP_TELEPORT_DAMAGE; s.comboCount = 0;
              spawnParticles(p.pos, 'red', 35);
              spawnTextParticle(e.pos, 'MUDA!', COLORS.DIO_HAIR, 100);
              triggerShake(15, 25);
            }
            e.state = EntityState.IDLE; dioAIPhase.current = 'IDLE'; dioActionTimer.current = 0;
            s.abilityTimers.dioTimeStopCooldown = s.dioFightPhase === 2 ? 300 : 420;
          }
        } else if (e.state === EntityState.BARRAGE) {
          if (dioActionTimer.current > (s.isTimeStopped ? 60 : 120)) {
            e.state = EntityState.IDLE; dioAIPhase.current = 'IDLE'; dioActionTimer.current = 0;
            s.abilityTimers.dioBarrageCooldown = s.dioFightPhase === 2 ? 90 : 150;
          } else {
            if (Math.random() < 0.5) spawnTextParticle({ x: e.pos.x + (e.facing * 60), y: e.pos.y }, 'MUDA!', COLORS.DIO_HAIR, 55 + Math.random() * 40);
            const dist = Math.abs((e.pos.x + e.width / 2) - (p.pos.x + p.width / 2));
            const isClashing = p.state === EntityState.BARRAGE && dist < 160;
            if (!isClashing && dist < 110 && e.facing * (p.pos.x - e.pos.x) > 0) {
              p.health -= 5; s.comboCount = 0;
              spawnParticles(p.pos, COLORS.STAR_PLATINUM_SKIN, 2);
              triggerShake(2, 5);
              p.pos.x += e.facing * 0.5;
            }
          }
        } else if (dioActionTimer.current > 150) {
          e.state = EntityState.IDLE; dioAIPhase.current = 'IDLE'; dioActionTimer.current = 0;
        }
      }
      e.vel.y += GRAVITY; e.pos.y += e.vel.y;
      if (e.pos.y > GROUND_Y - e.height) { e.pos.y = GROUND_Y - e.height; e.vel.y = 0; }
      e.pos.x = Math.max(0, Math.min(CANVAS_WIDTH - e.width, e.pos.x));
      p.pos.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.pos.x));
    }

    s.knives = s.knives.filter(k => k.active);
    s.knives.forEach(k => {
      const canMove = !s.isTimeStopped || s.isTimeStopCountered;
      if (k.launchDelay > 0) { if (canMove) k.launchDelay--; }
      else {
        if (k.vel.x === 0 && !k.deflectedByPlayer) {
          const dx = p.pos.x - k.pos.x;
          const dy = (p.pos.y + p.height / 2) - k.pos.y;
          const angle = Math.atan2(dy, dx);
          const speed = (s.isTimeStopped ? 22 : 14) * (s.dioFightPhase === 2 ? 1.2 : 1);
          k.vel.x = Math.cos(angle) * speed; k.vel.y = Math.sin(angle) * speed;
          k.angle = angle;
        }
        if (canMove) { k.pos.x += k.vel.x; k.pos.y += k.vel.y; }
        if (k.deflectedByPlayer) {
          if (k.isHoming && k.pos.x > e.pos.x && k.pos.x < e.pos.x + e.width && k.pos.y > e.pos.y && k.pos.y < e.pos.y + e.height) {
            e.health -= KNIFE_DAMAGE * 1.5; s.comboCount++;
            spawnParticles(e.pos, COLORS.THE_WORLD_MAIN, 15);
            spawnTextParticle(e.pos, 'CRITICAL!', COLORS.DIO_HAIR, 40);
            k.active = false; triggerShake(10, 12);
            e.pos.x += Math.sign(k.vel.x) * 3;
          }
        } else {
          if (k.pos.x > p.pos.x && k.pos.x < p.pos.x + p.width && k.pos.y > p.pos.y && k.pos.y < p.pos.y + p.height) {
            p.health -= KNIFE_DAMAGE; s.comboCount = 0;
            spawnParticles(p.pos, 'red', 10);
            k.active = false; triggerShake(8, 10);
            p.pos.x += Math.sign(k.vel.x) * 2;
          }
        }
        if (k.pos.x < -300 || k.pos.x > CANVAS_WIDTH + 300 || k.pos.y > GROUND_Y + 200 || k.pos.y < -300) k.active = false;
      }
    });

    if (s.roadRoller && s.roadRoller.active) {
      const canFall = !s.isTimeStopped || s.isTimeStopCountered || (s.isTimeStopped && p.state !== EntityState.SPECIAL_MOVE);
      if (s.roadRoller.warningTimer > 0) { if (canFall) s.roadRoller.warningTimer--; }
      else {
        if (canFall) s.roadRoller.pos.y += 28;
        if (s.roadRoller.pos.y > GROUND_Y - 110) {
          s.roadRoller.pos.y = GROUND_Y - 110;
          if (!s.roadRoller.impacted) {
            s.roadRoller.impacted = true;
            spawnParticles(s.roadRoller.pos, COLORS.ROAD_ROLLER, 100);
            spawnTextParticle(s.roadRoller.pos, 'WRYYYY!', COLORS.DIO_HAIR, 180);
            const dist = Math.abs((s.roadRoller.pos.x + 100) - (p.pos.x + p.width / 2));
            if (dist < 150) {
              p.health -= ROAD_ROLLER_DAMAGE; s.comboCount = 0; triggerShake(30, 45);
              p.pos.x += (p.pos.x > s.roadRoller.pos.x + 100 ? 1 : -1) * 60;
            }
            else { triggerShake(12, 22); }
            setTimeout(() => { s.roadRoller = null; }, 1200);
          }
        }
      }
    }

    s.particles.forEach(part => { part.pos.x += part.vel.x; part.pos.y += part.vel.y; part.life--; });
    s.particles = s.particles.filter(p => p.life > 0);
    s.textParticles.forEach(tp => { tp.pos.x += tp.vel.x; tp.pos.y += tp.vel.y; tp.life--; });
    s.textParticles = s.textParticles.filter(tp => tp.life > 0);

    if (p.health <= 0) setPhase('DEFEAT');
    if (e.health <= 0) {
      if (s.dioFightPhase === 1) {
        setPhase('TRANSITION');
        s.transitionTimer = 180;
        s.enemy.health = 0;
        dioAIPhase.current = 'IDLE';
        dioActionTimer.current = 0;
        s.knives = [];
      } else {
        setPhase('VICTORY');
      }
    }

    setUiState({
      playerHealth: Math.max(0, p.health), enemyHealth: Math.max(0, e.health),
      barrageCD: Math.max(0, s.abilityTimers.barrageCooldown),
      starFingerCD: Math.max(0, s.abilityTimers.starFingerCooldown),
      heavyPunchCD: Math.max(0, s.abilityTimers.heavyPunchCooldown),
      combo: s.comboCount,
      isBarrageActive: p.state === EntityState.BARRAGE,
      isStarFingerActive: p.state === EntityState.STAR_FINGER,
      isHeavyPunchActive: p.state === EntityState.HEAVY_PUNCH,
      isTimeStopped: s.isTimeStopped,
      isTimeStopCountered: s.isTimeStopCountered,
      playerHurt: p.health < lastPlayerHealth.current,
      enemyHurt: e.health < lastEnemyHealth.current,
      dioFightPhase: s.dioFightPhase
    });
    lastPlayerHealth.current = p.health; lastEnemyHealth.current = e.health;
  }, [phase, spawnParticles, spawnTextParticle, triggerShake]);

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, COLORS.SKY_NIGHT);
    skyGrad.addColorStop(1, COLORS.SKY_HORIZON);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.BUILDING;
    let cityX = 0;
    const buildingProfile = [120, 180, 90, 220, 150, 100, 260, 130, 95, 170];
    buildingProfile.forEach((h, i) => {
      const w = 80 + Math.sin(i) * 30;
      ctx.fillRect(cityX, GROUND_Y - h, w, h);

      ctx.fillStyle = COLORS.CITY_LIGHT;
      for (let wx = 10; wx < w - 10; wx += 20) {
        for (let wy = 20; wy < h - 20; wy += 35) {
          if (Math.random() < 0.25) {
            ctx.globalAlpha = 0.4 + Math.random() * 0.4;
            ctx.fillRect(cityX + wx, GROUND_Y - h + wy, 6, 8);
          }
        }
      }
      ctx.fillStyle = COLORS.BUILDING;
      ctx.globalAlpha = 1;
      cityX += w + 15;
    });

    ctx.fillStyle = COLORS.BRIDGE_FLOOR;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 60);
    ctx.fillStyle = COLORS.BRIDGE_SIDE;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 10);

    ctx.strokeStyle = COLORS.BRIDGE_RAIL;
    ctx.lineWidth = 4 * PIXEL_SCALE;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 35);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y - 35);
    ctx.stroke();
    for (let rx = 0; rx < CANVAS_WIDTH; rx += 80) {
      ctx.strokeRect(rx, GROUND_Y - 35, 80, 35);
      ctx.fillStyle = COLORS.BRIDGE_RAIL;
      ctx.fillRect(rx - 4, GROUND_Y - 50, 8, 50);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath(); ctx.arc(1050, 110, 65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.MOON;
    ctx.beginPath(); ctx.arc(1050, 110, 50, 0, Math.PI * 2); ctx.fill();
  };

  const drawRoadRoller = (ctx: CanvasRenderingContext2D, rr: any) => {
    const { x, y } = rr.pos;
    ctx.save();
    ctx.translate(x, y);

    if (!rr.impacted) {
      const distToGround = Math.max(0, GROUND_Y - y);
      const shadowScale = Math.max(0, 1 - (distToGround / 500));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(100, distToGround + 10, Math.max(0.1, 150 * shadowScale), Math.max(0.1, 35 * shadowScale), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = COLORS.ROAD_ROLLER;
    ctx.fillRect(0, 0, 200, 110);

    ctx.fillStyle = '#222';
    ctx.fillRect(15, 15, 70, 50);
    ctx.fillStyle = '#55aaff';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(20, 20, 60, 40);
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.ROAD_ROLLER_STRIPE;
    for (let sx = 0; sx < 200; sx += 40) {
      ctx.beginPath();
      ctx.moveTo(sx, 110); ctx.lineTo(sx + 20, 110);
      ctx.lineTo(sx + 40, 90); ctx.lineTo(sx + 20, 90);
      ctx.fill();
    }

    ctx.fillStyle = COLORS.ROAD_ROLLER_DARK;
    ctx.fillRect(140, 20, 45, 70);
    ctx.fillStyle = '#333';
    ctx.fillRect(155, -20, 12, 40);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(161, -20, 10, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(45, 125, 55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();

    ctx.beginPath(); ctx.arc(155, 125, 55, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let rx = 10; rx < 190; rx += 25) {
      ctx.beginPath(); ctx.arc(rx, 8, 4, 0, Math.PI * 2); ctx.fill();
    }


    ctx.strokeStyle = '#222'; ctx.lineWidth = 6 * PIXEL_SCALE;
    ctx.strokeRect(0, 0, 200, 110);

    ctx.restore();
  };

  const drawJotaro = (ctx: CanvasRenderingContext2D, ent: Entity) => {
    const { pos, width, height, facing, state } = ent;
    const time = Date.now() / 150;
    const breathe = Math.sin(time) * 2;
    const moveBob = state === EntityState.MOVING ? Math.sin(time * 2) * 4 : 0;
    const s = gameStateRef.current; // access state for globalTimer

    ctx.save();
    // moveBob is less needed if we have actual walking frames, but can keep for extra juice or remove.
    // Let's keep it subtle or remove if it looks weird with the frames.
    // For now, I'll reduce it slightly if we are using frames.
    const effectiveBob = (state === EntityState.MOVING && (jotaroWalk1Img.current || jotaroWalk2Img.current)) ? 0 : moveBob;

    ctx.translate(pos.x + width / 2, pos.y + height + effectiveBob);
    ctx.scale(facing, 1);

    const isAirborne = Math.abs(pos.y - (GROUND_Y - height)) > 1;

    if (isAirborne && jotaroJumpImg.current) {
      ctx.drawImage(jotaroJumpImg.current, -70, -115, 140, 140);
    } else if (state === EntityState.MOVING && jotaroWalk1Img.current && jotaroWalk2Img.current && jotaroWalkTransImg.current) {
      // 4-step sequence: Walk1 -> Transition -> Walk2 -> Transition
      const frame = Math.floor(s.globalTimer / 8) % 4;
      let currentWalkImg = jotaroWalkTransImg.current;

      if (frame === 0) currentWalkImg = jotaroWalk1Img.current;
      else if (frame === 2) currentWalkImg = jotaroWalk2Img.current;

      // Maintain same offsets/dimensions to prevent jitter
      ctx.drawImage(currentWalkImg, -70, -115, 140, 140);
    } else if (jotaroImg.current) {
      // Sprite is roughly square-ish in generated art, adjustments:
      // Taller Jotaro: 100x130 roughly
      ctx.drawImage(jotaroImg.current, -70, -115, 140, 140);
    } else {
      // Fallback
      ctx.fillStyle = COLORS.JOTARO_COAT;
      ctx.fillRect(-15, -80 + breathe, 30, 60);
    }

    // Star Finger / VFX overlays can stay if needed, simplified for sprite
    if (state === EntityState.STAR_FINGER || state === EntityState.IDLE || state === EntityState.SPECIAL_MOVE) {
      // Optional: Draw overlay effects if needed, but sprite covers most
    }
    ctx.restore();
  };

  const drawDio = (ctx: CanvasRenderingContext2D, ent: Entity, phaseNum: 1 | 2) => {
    const { pos, width, height, facing, state } = ent;
    const time = Date.now() / 150;
    const breathe = Math.sin(time) * 2;

    ctx.save();
    ctx.translate(pos.x + width / 2, pos.y + height);
    ctx.scale(facing, 1);

    if (phaseNum === 2) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f9d423';
    }

    if (dioImg.current) {
      ctx.translate(0, -60);
      ctx.imageSmoothingEnabled = false;
      // New sprite likely different aspect ratio
      ctx.drawImage(dioImg.current, -60, -75, 120, 130);
    } else {
      ctx.fillStyle = COLORS.DIO_JACKET;
      ctx.fillRect(-15, -80 + breathe, 30, 60);
    }

    ctx.restore();
  };

  const drawKakyoin = (ctx: CanvasRenderingContext2D, x: number, y: number, facing: number) => {
    const time = Date.now() / 150;
    const breathe = Math.sin(time) * 2;

    ctx.save();
    ctx.translate(x, y + 80);
    ctx.scale(facing, 1);

    // Legs/Pants
    ctx.fillStyle = COLORS.KAKYOIN_GREEN;
    ctx.fillRect(-12, -30, 10, 30);
    ctx.fillRect(2, -30, 10, 30);

    // Long Coat body
    ctx.fillStyle = COLORS.KAKYOIN_GREEN;
    ctx.beginPath();
    ctx.moveTo(-14, -75 + breathe);
    ctx.lineTo(14, -75 + breathe);
    ctx.lineTo(18, 0); // Coat flair
    ctx.lineTo(-18, 0);
    ctx.fill();

    // Upper body/Chest area
    ctx.fillRect(-14, -75 + breathe, 28, 40);

    // Gold Buttons
    ctx.fillStyle = COLORS.JOTARO_GOLD;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, -70 + breathe + (i * 10), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // High Collar
    ctx.fillStyle = COLORS.KAKYOIN_GREEN;
    ctx.fillRect(-10, -80 + breathe, 20, 8);

    // Head
    ctx.fillStyle = COLORS.JOTARO_SKIN;
    ctx.fillRect(-10, -92 + breathe, 20, 18);

    // Hair - distinct red with noodle
    ctx.fillStyle = '#C04040'; // Cherry Red
    ctx.beginPath();
    ctx.moveTo(-12, -90 + breathe);
    ctx.lineTo(-12, -105 + breathe); // Top left
    ctx.lineTo(15, -100 + breathe); // Top right sweep
    ctx.lineTo(12, -90 + breathe);
    ctx.fill();

    // The Noodle (Hair Curl)
    ctx.strokeStyle = '#C04040';
    ctx.lineWidth = 3 * PIXEL_SCALE;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -100 + breathe);
    ctx.quadraticCurveTo(25, -90 + breathe, 12, -75 + breathe);
    ctx.stroke();

    ctx.restore();
  };

  const drawJosephDetailed = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const time = Date.now() / 150;
    const breathe = Math.sin(time) * 2;

    ctx.save();
    ctx.translate(x, y + 100);

    ctx.fillStyle = '#4a3b2b';
    ctx.fillRect(-14, -5, 12, 5);
    ctx.fillRect(2, -5, 12, 5);

    ctx.fillStyle = COLORS.JOSEPH_PANTS;
    ctx.fillRect(-12, -45, 11, 40);
    ctx.fillRect(1, -45, 11, 40);

    ctx.fillStyle = '#4a3b2b';
    ctx.fillRect(-13, -48 + breathe, 26, 4);

    ctx.fillStyle = COLORS.JOSEPH_SHIRT;
    ctx.fillRect(-16, -95 + breathe, 32, 50);

    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(-12, -85 + breathe, 8, 10);
    ctx.fillRect(4, -85 + breathe, 8, 10);

    ctx.fillStyle = COLORS.JOSEPH_SHIRT;
    ctx.fillRect(-24, -90 + breathe, 8, 30);
    ctx.fillRect(16, -90 + breathe, 8, 30);

    ctx.fillStyle = '#222';
    ctx.fillRect(-24, -65 + breathe, 8, 12);
    ctx.fillRect(16, -65 + breathe, 8, 12);

    ctx.fillStyle = COLORS.JOTARO_SKIN;
    ctx.fillRect(-24, -53 + breathe, 8, 8);
    ctx.fillRect(16, -53 + breathe, 8, 8);

    ctx.fillStyle = COLORS.JOTARO_SKIN;
    ctx.fillRect(-10, -115 + breathe, 20, 20);
    ctx.fillStyle = COLORS.JOSEPH_HAIR;
    ctx.beginPath();
    ctx.moveTo(-10, -100 + breathe);
    ctx.lineTo(0, -90 + breathe);
    ctx.lineTo(10, -100 + breathe);
    ctx.lineTo(10, -105 + breathe);
    ctx.lineTo(-10, -105 + breathe);
    ctx.fill();

    ctx.fillRect(-12, -115 + breathe, 4, 15);
    ctx.fillRect(8, -115 + breathe, 4, 15);

    ctx.fillStyle = COLORS.JOSEPH_HAT;
    ctx.fillRect(-22, -120 + breathe, 44, 4);
    ctx.fillRect(-12, -135 + breathe, 24, 15);
    ctx.fillStyle = COLORS.JOSEPH_BAND;
    ctx.fillRect(-12, -125 + breathe, 24, 3);

    ctx.restore();
  };

  const drawTheWorld = (ctx: CanvasRenderingContext2D, ent: Entity, isBarrage: boolean) => {
    const { pos, width, height, facing, state } = ent;
    const time = Date.now() / 100;
    const hover = Math.sin(time) * 10;

    ctx.save();
    const offset = isBarrage ? 65 : -80;
    ctx.translate(pos.x + width / 2 + (offset * facing), pos.y + height / 2 + hover);
    ctx.scale(facing, 1);

    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.THE_WORLD_MAIN;

    if (theWorldImg.current) {
      ctx.imageSmoothingEnabled = false;
      // Adjust offset for sprite
      ctx.drawImage(theWorldImg.current, -60, -90, 120, 140);
    } else {
      // Fallback geometric
      ctx.fillStyle = COLORS.THE_WORLD_MAIN;
      ctx.beginPath();
      ctx.moveTo(-15, -50); ctx.lineTo(15, -50); ctx.lineTo(15, -20); ctx.lineTo(-15, -20); ctx.fill();
      ctx.fillRect(-15, -65, 5, 15); ctx.fillRect(10, -65, 5, 15);
      ctx.fillStyle = COLORS.THE_WORLD_DARK;
      ctx.fillRect(-10, -35, 20, 10);
      ctx.fillStyle = COLORS.THE_WORLD_EYES;
      ctx.fillRect(-8, -45, 4, 3); ctx.fillRect(4, -45, 4, 3);
      ctx.fillStyle = COLORS.THE_WORLD_MAIN;
      ctx.fillRect(-20, -15, 40, 60);
      ctx.fillStyle = COLORS.THE_WORLD_DARK;
      ctx.fillRect(-5, 0, 10, 30);
      ctx.fillStyle = COLORS.DIO_GREEN;
      ctx.fillRect(-5, 40, 10, 10);
    }

    if (isBarrage) {
      ctx.strokeStyle = COLORS.THE_WORLD_MAIN;
      ctx.lineWidth = 6 * PIXEL_SCALE;
      for (let i = 0; i < 10; i++) {
        const bx = 40 + Math.random() * 160;
        const by = -20 + Math.random() * 80;
        ctx.beginPath(); ctx.moveTo(15, by); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
    ctx.restore();
  };

  const drawStarPlatinum = (ctx: CanvasRenderingContext2D, ent: Entity) => {
    const { pos, width, height, facing, state, attackFrame } = ent;
    const time = Date.now() / 100;
    const hover = Math.sin(time) * 10;
    const s = gameStateRef.current;

    ctx.save();
    let offset = -70;
    if (state === EntityState.BARRAGE) offset = 55;
    if (state === EntityState.SPECIAL_MOVE) offset = 80;

    ctx.translate(pos.x + width / 2 + (offset * facing), pos.y + height / 2 + hover);
    ctx.scale(facing, 1);

    if (state === EntityState.BARRAGE || state === EntityState.SPECIAL_MOVE) {
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 20; ctx.shadowColor = COLORS.STAR_PLATINUM_SKIN;
    } else {
      ctx.globalAlpha = 0.4;
    }

    if (starPlatinumImg.current) {
      ctx.imageSmoothingEnabled = false;
      // Adjust for floating pose
      ctx.drawImage(starPlatinumImg.current, -60, -90, 120, 120);
    } else {
      ctx.fillStyle = COLORS.STAR_PLATINUM_SKIN;
      ctx.fillRect(-15, -60, 30, 35);
    }

    if (state === EntityState.SPECIAL_MOVE) {
      // Just keep punch effects
    } else if (state === EntityState.BARRAGE) {
      ctx.strokeStyle = COLORS.STAR_PLATINUM_SKIN;
      ctx.lineWidth = 8 * PIXEL_SCALE; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const bx = 30 + Math.random() * 150;
        const by = -20 + Math.random() * 80;
        ctx.beginPath(); ctx.moveTo(10, by); ctx.lineTo(bx, by); ctx.stroke();
      }
    } else if (state === EntityState.STAR_FINGER) {
      let length = 0;
      if (attackFrame > 20) {
        length = ((STAR_FINGER_DURATION - attackFrame) / 5) * STAR_FINGER_RANGE;
      } else if (attackFrame > 5) {
        length = STAR_FINGER_RANGE;
      } else {
        length = (attackFrame / 5) * STAR_FINGER_RANGE;
      }

      ctx.save();
      ctx.translate(15, -5);
      ctx.strokeStyle = COLORS.STAR_PLATINUM_FINGER;
      ctx.lineWidth = 18 * PIXEL_SCALE;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = COLORS.STAR_PLATINUM_FINGER;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();

      ctx.strokeStyle = COLORS.STAR_PLATINUM_WHITE;
      ctx.lineWidth = 6 * PIXEL_SCALE;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();

      if (attackFrame === STAR_FINGER_DURATION - 5) {
        ctx.fillStyle = COLORS.STAR_PLATINUM_WHITE;
        ctx.beginPath(); ctx.arc(length, 0, 30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  const drawSpeedLines = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const time = Date.now();

    ctx.save();
    ctx.translate(centerX, centerY);

    // Intense radial lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2 * PIXEL_SCALE;

    for (let i = 0; i < 40; i++) {
      if (Math.random() > 0.5) continue;
      const angle = (i / 40) * Math.PI * 2;
      const startR = 150 + Math.random() * 50;
      const endR = 600;

      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * startR, Math.sin(angle) * startR);
      ctx.lineTo(Math.cos(angle) * endR, Math.sin(angle) * endR);
      ctx.stroke();
    }

    // Motion blur streaks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 40 * PIXEL_SCALE;
    const grad = ctx.createRadialGradient(0, 0, 200, 0, 0, 600);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = gameStateRef.current;
    const e = s.enemy; const p = s.player;
    ctx.save();

    // SCALE EVERYTHING FOR PIXEL ART LOOK
    ctx.scale(1 / PIXEL_SCALE, 1 / PIXEL_SCALE);

    if (phase === 'INTRO') {
      const prog = 1 - (s.introTimer / 180);
      const focusX = e.pos.x + e.width / 2;
      const focusY = e.pos.y + e.height / 4;
      const zoom = (1 + 2.5 * prog);

      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-focusX, -focusY);
    }

    if (s.cameraShake.duration > 0) {
      const offsetX = (Math.random() - 0.5) * s.cameraShake.intensity;
      const offsetY = (Math.random() - 0.5) * s.cameraShake.intensity;
      ctx.translate(offsetX, offsetY);
    }

    drawBackground(ctx);

    if (s.roadRoller && s.roadRoller.active) {
      const rr = s.roadRoller;
      ctx.fillStyle = COLORS.WARNING_RED;
      ctx.fillRect(rr.pos.x, GROUND_Y - 5, 200, 5);
      if (!rr.impacted) {
        drawRoadRoller(ctx, rr);
      }
    }

    if (phase === 'PLAYING' || phase === 'INTRO' || phase === 'PAUSED') {
      if (p.state !== EntityState.IDLE) {
        drawStarPlatinum(ctx, p);
      }
      if (e.state === EntityState.BARRAGE || s.isTimeStopped || e.state === EntityState.PREPARING_TIME_STOP) {
        drawTheWorld(ctx, e, e.state === EntityState.BARRAGE);
      }

      drawJotaro(ctx, p);
      drawDio(ctx, e, s.dioFightPhase);
    }

    s.knives.forEach(k => {
      ctx.save(); ctx.translate(k.pos.x, k.pos.y); ctx.rotate(k.angle);
      ctx.fillStyle = k.deflectedByPlayer ? COLORS.STAR_PLATINUM_FINGER : COLORS.KNIFE;
      ctx.fillRect(-15, -4, 30, 8);
      ctx.restore();
    });

    s.particles.forEach(p => {
      ctx.globalAlpha = p.life / 50; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 3, 0, Math.PI * 2); ctx.fill();
    });

    s.textParticles.forEach(tp => {
      ctx.globalAlpha = tp.life / 40; ctx.fillStyle = tp.color;
      ctx.font = `bold ${Math.max(10, tp.size * 0.6)}px "Press Start 2P", cursive`;
      ctx.textAlign = 'center'; ctx.fillText(tp.text, tp.pos.x, tp.pos.y);
    });

    if (phase === 'INTRO') {
      ctx.restore();
      const prog = 1 - (s.introTimer / 180);

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 60);
      ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60);

      if (prog > 0.3) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, CANVAS_HEIGHT - 140, CANVAS_WIDTH, 140);

        ctx.font = 'bold 24px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f9d423';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4 * PIXEL_SCALE;

        const dialogue = "The more carefully you scheme,the more unexpected events come along...";
        const visibleChars = Math.floor(dialogue.length * Math.min(1, (prog - 0.3) * 2));
        const currentDialogue = dialogue.substring(0, visibleChars);

        ctx.strokeText(currentDialogue, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
        ctx.fillText(currentDialogue, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
        ctx.restore();
      }
    } else if (phase === 'PRE_FIGHT_SCENE') {
      ctx.restore();
      const t = s.preFightTimer;

      // 300-180: Dio vs Kakyoin
      if (t > 180) {
        drawDio(ctx, { ...e, pos: { x: 900, y: GROUND_Y - 100 }, facing: -1 } as Entity, 1);
        drawKakyoin(ctx, 400, GROUND_Y - 100, 1);
      }
      // 180-120: Donut
      else if (t > 120) {
        drawDio(ctx, { ...e, pos: { x: 350, y: GROUND_Y - 100 }, facing: 1, state: EntityState.ATTACKING } as Entity, 1);
        drawKakyoin(ctx, 400, GROUND_Y - 100, 1);
      }
      // 120-60: Joseph appears
      else if (t > 60) {
        if (t > 100) drawKakyoin(ctx, 400 + (120 - t) * 10, GROUND_Y - 100, 1); // Kakyoin flies
        drawJosephDetailed(ctx, 300, GROUND_Y - 100);
        drawDio(ctx, { ...e, pos: { x: 500, y: GROUND_Y - 100 }, facing: -1 } as Entity, 1);
      }
      // 60-0: Dio punches Joseph
      else {
        // Ensure dio is visible
        drawDio(ctx, { ...e, pos: { x: 280, y: GROUND_Y - 100 }, facing: -1, state: EntityState.ATTACKING } as Entity, 1);
        drawJosephDetailed(ctx, 300 - (60 - t) * 15, GROUND_Y - 100);
      }

      ctx.save();
      ctx.fillStyle = 'black';
      // Only draw bars at top/bottom, ensure they don't cover the middle
      ctx.fillRect(0, 0, CANVAS_WIDTH, 40);
      ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 40);
      ctx.restore();
    } else if (phase === 'APPROACH_SCENE') {
      ctx.restore();

      // Draw Jotaro & Dio walking towards center
      drawJotaro(ctx, p);
      drawDio(ctx, e, 1);

      // Manga Speed Lines
      drawSpeedLines(ctx);

      // Cinematic bars
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 80);
      ctx.fillRect(0, CANVAS_HEIGHT - 80, CANVAS_WIDTH, 80);

    } else if (phase === 'TRANSITION') {
      ctx.restore();
      const prog = 1 - (s.transitionTimer / 180);

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;

      ctx.save();
      ctx.translate(centerX + 150, centerY);
      ctx.scale(2.5, 2.5);
      drawDio(ctx, { ...e, pos: { x: -20, y: -40 } } as Entity, 1);
      drawJosephDetailed(ctx, -70, -40);

      if (s.transitionTimer > 60) {
        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 4 * PIXEL_SCALE;
        ctx.beginPath();
        ctx.moveTo(-60, -30);
        ctx.quadraticCurveTo(-40, -50 + Math.sin(Date.now() / 50) * 10, -10, -30);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(150, centerY);
      ctx.scale(1.5, 1.5);
      const time = Date.now() / 200;
      ctx.globalAlpha = 0.4 + Math.sin(time) * 0.2;
      ctx.fillStyle = COLORS.KAKYOIN_GREEN;
      ctx.beginPath();
      ctx.ellipse(0, 40, 40, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      drawJotaro(ctx, { ...p, pos: { x: -20, y: -40 } } as Entity);
      ctx.restore();

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 60);
      ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60);

      if (prog > 0.3) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, CANVAS_HEIGHT - 140, CANVAS_WIDTH, 140);

        ctx.font = 'bold 24px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f9d423';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4 * PIXEL_SCALE;

        const dialogue = "THIS IS THE GREATEST HIGH!";
        const visibleChars = Math.floor(dialogue.length * Math.min(1, (prog - 0.3) * 2));
        const currentDialogue = dialogue.substring(0, visibleChars);

        ctx.strokeText(currentDialogue, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
        ctx.fillText(currentDialogue, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
        ctx.restore();
      }
    } else {
      ctx.restore();
    }

  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let animationFrame: number;
    const loop = () => { update(); draw(ctx); animationFrame = requestAnimationFrame(loop); };
    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [update, draw]);

  const pHealthPct = (uiState.playerHealth / JOTARO_MAX_HEALTH) * 100;
  const eMax = uiState.dioFightPhase === 1 ? DIO_MAX_HEALTH : DIO_MAX_HEALTH * 1.5;
  const eHealthPct = (uiState.enemyHealth / eMax) * 100;


  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center bg-black overflow-hidden select-none font-['Press_Start_2P']">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH / PIXEL_SCALE}
        height={CANVAS_HEIGHT / PIXEL_SCALE}
        className={`block bg-neutral-900 shadow-2xl border border-white/10 ${uiState.isTimeStopped ? 'time-stop-active' : 'time-stop-exit'}`}
        style={{
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          imageRendering: 'pixelated'
        }}
      />

      {phase === 'MENU' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-10 text-center overflow-y-auto">
          <h1 className="text-7xl md:text-8xl font-black italic tracking-tighter text-white mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">STARDUST SHOWDOWN</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mb-10 text-left bg-white/5 p-8 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="space-y-4">
              <h3 className="text-blue-400 font-black text-xl italic uppercase tracking-widest border-b border-blue-400/30 pb-2">Movement</h3>
              <ul className="space-y-2 text-white/80 font-bold">
                <li className="flex justify-between"><span>Walk Left / Right</span> <span className="text-yellow-400">[A] / [D]</span></li>
                <li className="flex justify-between"><span>Jump</span> <span className="text-yellow-400">[W] or [SPACE]</span></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-purple-400 font-black text-xl italic uppercase tracking-widest border-b border-purple-400/30 pb-2">Combat</h3>
              <ul className="space-y-2 text-white/80 font-bold">
                <li className="flex justify-between"><span>Stand Barrage</span> <span className="text-yellow-400">[LMB Hold]</span></li>
                <li className="flex justify-between"><span>Star Finger</span> <span className="text-yellow-400">[C]</span></li>
                <li className="flex justify-between"><span>Heavy Punch</span> <span className="text-yellow-400">[X]</span></li>
              </ul>
            </div>
            <div className="md:col-span-2 space-y-4 mt-4">
              <h3 className="text-yellow-400 font-black text-xl italic uppercase tracking-widest border-b border-yellow-400/30 pb-2">Stand Mechanics</h3>
              <ul className="space-y-2 text-white/80 font-bold">
                <li><span className="text-blue-300">Counter Time Stop:</span> Tap <span className="text-yellow-400">[Q]</span> precisely when Dio shouts <span className="italic">"ZA WARUDO!"</span></li>
                <li><span className="text-blue-300">Deflect Knives:</span> Use your <span className="text-yellow-400">Barrage</span> to punch knives back at Dio.</li>
                <li><span className="text-blue-300">The Ultimate Stand:</span> Reach <span className="text-yellow-400">100 COMBO</span> to trigger <span className="italic">Star Platinum: The World</span>.</li>
                <li><span className="text-blue-300">Cinematics:</span> Press <span className="text-yellow-400">[X]</span> to skip intro scenes.</li>
              </ul>
            </div>
          </div>

          <button onClick={() => startGame(true)} className="group relative px-20 py-6 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-3xl uppercase border-4 border-black transition-all transform hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            <span className="relative z-10">Stand Proud / Start</span>
            <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform skew-x-12"></div>
          </button>
        </div>
      )}

      {(phase === 'PLAYING' || phase === 'TRANSITION' || phase === 'INTRO' || phase === 'PRE_FIGHT_SCENE' || phase === 'APPROACH_SCENE' || phase === 'PAUSED') && (
        <>
          <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-20">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="text-white font-bold uppercase text-xs">Jotaro Kujo</div>
                <div className="relative w-64 h-6 bg-gray-900 border-2 border-white">
                  <div className="absolute inset-0 bg-blue-500 transition-all duration-300" style={{ width: `${pHealthPct}%` }} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white font-bold uppercase w-24">[LMB] Barrage:</span>
                  <span className={`text-sm font-black italic ${uiState.barrageCD > 0 ? 'text-red-500' : 'text-blue-400'}`}>
                    {uiState.barrageCD > 0 ? `${(uiState.barrageCD / 60).toFixed(1)}s` : 'READY'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white font-bold uppercase w-24">[C] Star Finger:</span>
                  <span className={`text-sm font-black italic ${uiState.starFingerCD > 0 ? 'text-red-500' : 'text-purple-400'}`}>
                    {uiState.starFingerCD > 0 ? `${(uiState.starFingerCD / 60).toFixed(1)}s` : 'READY'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white font-bold uppercase w-24">[X] Heavy Punch:</span>
                  <span className={`text-sm font-black italic ${uiState.heavyPunchCD > 0 ? 'text-red-500' : 'text-indigo-400'}`}>
                    {uiState.heavyPunchCD > 0 ? `${(uiState.heavyPunchCD / 60).toFixed(1)}s` : 'READY'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              {uiState.combo > 0 && (
                <div className="animate-bounce">
                  <div className="text-6xl font-black text-yellow-400 italic drop-shadow-lg">{uiState.combo}</div>
                  <div className="text-white font-bold text-xl italic text-center -mt-2">HITS!</div>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-white font-bold uppercase text-xs">Dio Brando {uiState.dioFightPhase === 2 ? '(HIGH)' : ''}</div>
              <div className="relative w-96 h-8 bg-gray-900 border-2 border-white">
                <div className={`absolute inset-0 ${uiState.dioFightPhase === 2 ? 'bg-red-600' : 'bg-yellow-500'} transition-all duration-300 right-0`} style={{ width: `${eHealthPct}%` }} />
              </div>
            </div>
          </div>
        </>
      )}

      {phase === 'PAUSED' && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <h2 className="text-7xl font-black italic text-white mb-10 tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">PAUSED</h2>
          <div className="flex flex-col gap-6 w-80">
            <button onClick={resumeGame} className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl border-4 border-black uppercase transition-all transform hover:scale-105 active:scale-95">
              Resume
            </button>
            <button onClick={restartGame} className="px-10 py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-2xl border-4 border-black uppercase transition-all transform hover:scale-105 active:scale-95">
              Restart
            </button>
            <button onClick={goToMenu} className="px-10 py-5 bg-red-600 hover:bg-red-500 text-white font-black text-2xl border-4 border-black uppercase transition-all transform hover:scale-105 active:scale-95">
              Menu
            </button>
          </div>
          <div className="mt-8 text-white/50 font-bold uppercase tracking-widest text-sm">Press [ESC] to Resume</div>
        </div>
      )}

      {(phase === 'VICTORY' || phase === 'DEFEAT') && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-10 text-center">
          <h2 className={`text-9xl font-black italic mb-8 ${phase === 'VICTORY' ? 'text-yellow-400' : 'text-red-600'}`}>{phase === 'VICTORY' ? 'RETIRED!' : 'DEFEATED'}</h2>
          <div className="flex gap-4">
            <button onClick={restartGame} className="px-12 py-5 bg-white text-black font-bold text-2xl uppercase transition-transform hover:scale-110 active:scale-95">
              {currentCheckpoint.current === 2 && phase === 'DEFEAT' ? 'Try Again (Ph. 2)' : 'Restart'}
            </button>
            <button onClick={goToMenu} className="px-12 py-5 bg-gray-800 text-white font-bold text-2xl uppercase border-2 border-white transition-transform hover:scale-110 active:scale-95">Menu</button>
          </div>
        </div>
      )}


    </div>
  );
};

export default App;
