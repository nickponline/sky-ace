// Shared constants between client and server
export const GAME_CONFIG = {
    ARENA_WIDTH: 2000,
    ARENA_HEIGHT: 1200,
    TICK_RATE: 60,
    GRAVITY: 300, // pixels/s^2
    STALL_SPEED: 80, // pixels/s
    MAX_SPEED: 400,
    MIN_SPEED: 0,
    ACCELERATION: 200, // pixels/s^2
    TURN_SPEED: 2.5, // radians/s
    DRAG_COEFFICIENT: 0.3,
    LIFT_COEFFICIENT: 0.8,
    PLANE_SIZE: 32,
    BULLET_SPEED: 500,
    BULLET_LIFETIME: 2000, // ms
    FIRE_RATE: 200, // ms between shots
    PLAYER_HEALTH: 100,
    RESPAWN_TIME: 3000, // ms
};

export const POWERUP_TYPES = {
    TRIPLE_SHOT: 'triple_shot',
    RAPID_FIRE: 'rapid_fire',
    MISSILE: 'missile',
    SHIELD: 'shield',
};

export const WEAPON_TYPES = {
    NORMAL: 'normal',
    TRIPLE_SHOT: 'triple_shot',
    RAPID_FIRE: 'rapid_fire',
    MISSILE: 'missile',
};
