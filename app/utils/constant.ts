// constants.ts
export const CANVAS_SIZE = {
  width: 800,
  height: 600,
};

export const GAME_CONSTANTS = {
  PLAYER_SPEED: 8,
  PLAYER_FRICTION: 0.85,
  INITIAL_LIVES: 3,
  INITIAL_TIME: 1800, // 30 minutes
  ENEMY_SPAWN_RATE: 0.02,
  SCORE_PER_LEVEL: 1000,
  TRAIL_LENGTH: 20,
  STAR_COUNT: 100,
  TIME_DILATION_FACTOR: 0.3,
  GRAVITY: 0.5,
  JUMP_FORCE: -10,
  BIRD_SIZE: 15,
  PIPE_SPEED: 3,
  PIPE_WIDTH: 80,
  PIPE_GAP: 150,
  GROUND_HEIGHT: 100,
};

export const WEAPONS = {
  basic: {
    name: "Basic Cannon",
    damage: 1,
    speed: 12,
    cooldown: 200,
    size: 8,
    color: "#00ff00",
    bounces: 3,
    count: 1,
    spread: 0,
    piercing: false,
  },
  rapid: {
    name: "Rapid Fire",
    damage: 1,
    speed: 15,
    cooldown: 100,
    size: 6,
    color: "#ffff00",
    bounces: 2,
    count: 1,
    spread: 0,
    piercing: false,
  },
  heavy: {
    name: "Heavy Cannon",
    damage: 3,
    speed: 8,
    cooldown: 800,
    size: 12,
    color: "#ff0000",
    bounces: 5,
    count: 1,
    spread: 0,
    piercing: false,
  },
  spread: {
    name: "Spread Shot",
    damage: 1,
    speed: 10,
    cooldown: 400,
    size: 6,
    color: "#ff8800",
    bounces: 2,
    count: 5,
    spread: Math.PI / 3,
    piercing: false,
  },
  laser: {
    name: "Laser Beam",
    damage: 2,
    speed: 20,
    cooldown: 300,
    size: 4,
    color: "#8800ff",
    bounces: 8,
    count: 1,
    spread: 0,
    piercing: true,
  },
  homing: {
    name: "Homing Missile",
    damage: 2,
    speed: 6,
    cooldown: 600,
    size: 8,
    color: "#ff0088",
    bounces: 1,
    count: 1,
    spread: 0,
    piercing: false,
  },
  chain: {
    name: "Chain Lightning",
    damage: 2,
    speed: 16,
    cooldown: 500,
    size: 6,
    color: "#0088ff",
    bounces: 10,
    count: 1,
    spread: 0,
    piercing: true,
  },
};

export const INITIAL_WEAPON_AMMO = {
  basic: Infinity,
  rapid: 100,
  heavy: 20,
  spread: 50,
  laser: 30,
  homing: 15,
  chain: 25,
};

export const FORCE_FIELD_DURATION = 180; // 3 seconds at 60fps
export const FORCE_FIELD_COOLDOWN_TIME = 600; // 10 seconds at 60fps

export const ULTIMATE_ABILITIES = {
  orbital: {
    name: "Orbital Strike",
    cooldown: 30000, // 30 seconds
    duration: 2000, // 2 seconds
  },
  timeDilation: {
    name: "Time Dilation",
    cooldown: 45000, // 45 seconds
    duration: 8000, // 8 seconds
  },
  overdrive: {
    name: "Energy Overdrive",
    cooldown: 60000, // 60 seconds
    duration: 10000, // 10 seconds
  },
};

export const BIRD_CONFIG = {
  BIRD_SIZE: 30,
  GRAVITY: 0.5,
  JUMP_FORCE: -10,
  MAX_VELOCITY: 15,
  ROTATION_SPEED: 0.1,
  x: 100,
  radius: 15,
};

export const PIPE_CONFIG = {
  PIPE_WIDTH: 80,
  PIPE_GAP: 150,
  PIPE_SPEED: 3,
  MIN_PIPE_HEIGHT: 50,
  MAX_PIPE_HEIGHT: 350,
  minHeight: 50,
  maxHeight: 350,
  spawnInterval: 90,
};

export const PARTICLE_CONFIG = {
  MAX_PARTICLES: 50,
  PARTICLE_LIFETIME: 30,
  PARTICLE_SIZE: 4,
  PARTICLE_SPEED: 2,
  lifetime: 30,
  speed: 2,
};

export const GROUND_HEIGHT = 100;
