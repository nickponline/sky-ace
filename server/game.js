import { GAME_CONFIG, POWERUP_TYPES, WEAPON_TYPES } from '../shared/constants.js';

export class Game {
    constructor() {
        this.players = new Map();
        this.projectiles = [];
        this.powerups = [];
        this.obstacles = [];
        this.nextPlayerId = 1;
        this.nextProjectileId = 1;
        this.nextPowerupId = 1;

        // Create some static obstacles
        this.createObstacles();

        // Spawn powerups periodically
        setInterval(() => this.spawnPowerup(), 10000);
    }

    createObstacles() {
        // Create some platforms/obstacles in the arena
        const obstacleConfigs = [
            { x: 500, y: 300, width: 100, height: 20 },
            { x: 1500, y: 600, width: 100, height: 20 },
            { x: 1000, y: 900, width: 150, height: 20 },
            { x: 300, y: 800, width: 80, height: 20 },
            { x: 1700, y: 400, width: 120, height: 20 },
        ];

        this.obstacles = obstacleConfigs.map(config => ({
            ...config,
            type: 'platform'
        }));
    }

    spawnPowerup() {
        if (this.powerups.length >= 5) return; // Max 5 powerups at once

        const types = Object.values(POWERUP_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];

        this.powerups.push({
            id: this.nextPowerupId++,
            type,
            x: Math.random() * (GAME_CONFIG.ARENA_WIDTH - 100) + 50,
            y: Math.random() * (GAME_CONFIG.ARENA_HEIGHT - 100) + 50,
            collected: false,
        });
    }

    addPlayer(socketId, username) {
        const id = this.nextPlayerId++;
        const player = {
            id,
            socketId,
            username,
            x: Math.random() * GAME_CONFIG.ARENA_WIDTH,
            y: GAME_CONFIG.ARENA_HEIGHT / 2,
            vx: 100,
            vy: 0,
            angle: 0,
            health: GAME_CONFIG.PLAYER_HEALTH,
            score: 0,
            alive: true,
            weapon: WEAPON_TYPES.NORMAL,
            weaponTimer: 0,
            shielded: false,
            shieldTimer: 0,
            lastFireTime: 0,
            respawnTimer: 0,
        };

        this.players.set(socketId, player);
        return player;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
    }

    handleInput(socketId, input) {
        const player = this.players.get(socketId);
        if (!player || !player.alive) return;

        player.input = input;
    }

    update(deltaTime) {
        const dt = deltaTime / 1000; // Convert to seconds

        // Update players
        for (const [socketId, player] of this.players) {
            if (!player.alive) {
                player.respawnTimer -= deltaTime;
                if (player.respawnTimer <= 0) {
                    this.respawnPlayer(player);
                }
                continue;
            }

            this.updatePlayer(player, dt);
        }

        // Update projectiles
        this.projectiles = this.projectiles.filter(proj => {
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.lifetime -= deltaTime;

            // Check collision with players
            for (const [socketId, player] of this.players) {
                if (!player.alive || player.socketId === proj.ownerId) continue;

                if (this.checkCollision(proj, player)) {
                    if (!player.shielded) {
                        player.health -= proj.damage;
                        if (player.health <= 0) {
                            this.killPlayer(player, proj.ownerId);
                        }
                    }
                    return false; // Remove projectile
                }
            }

            // Check collision with obstacles
            for (const obstacle of this.obstacles) {
                if (this.checkRectCollision(proj, obstacle)) {
                    return false;
                }
            }

            return proj.lifetime > 0 &&
                proj.x >= 0 && proj.x <= GAME_CONFIG.ARENA_WIDTH &&
                proj.y >= 0 && proj.y <= GAME_CONFIG.ARENA_HEIGHT;
        });

        // Update powerup timers
        for (const [socketId, player] of this.players) {
            if (player.weaponTimer > 0) {
                player.weaponTimer -= deltaTime;
                if (player.weaponTimer <= 0) {
                    player.weapon = WEAPON_TYPES.NORMAL;
                }
            }

            if (player.shieldTimer > 0) {
                player.shieldTimer -= deltaTime;
                if (player.shieldTimer <= 0) {
                    player.shielded = false;
                }
            }
        }

        // Check powerup collection
        this.powerups = this.powerups.filter(powerup => {
            if (powerup.collected) return false;

            for (const [socketId, player] of this.players) {
                if (!player.alive) continue;

                const dx = player.x - powerup.x;
                const dy = player.y - powerup.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < GAME_CONFIG.PLANE_SIZE) {
                    this.applyPowerup(player, powerup.type);
                    return false;
                }
            }

            return true;
        });
    }

    updatePlayer(player, dt) {
        const input = player.input || {};

        // Calculate thrust
        let thrust = 0;
        if (input.accelerate) thrust += GAME_CONFIG.ACCELERATION;
        if (input.decelerate) thrust -= GAME_CONFIG.ACCELERATION;

        // Calculate current speed
        const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);

        // Turn
        if (input.turnUp) player.angle -= GAME_CONFIG.TURN_SPEED * dt;
        if (input.turnDown) player.angle += GAME_CONFIG.TURN_SPEED * dt;

        // Apply thrust in direction of angle
        const thrustX = Math.cos(player.angle) * thrust * dt;
        const thrustY = Math.sin(player.angle) * thrust * dt;

        player.vx += thrustX;
        player.vy += thrustY;

        // Apply gravity (always downward)
        player.vy += GAME_CONFIG.GRAVITY * dt;

        // Apply drag
        const dragForce = GAME_CONFIG.DRAG_COEFFICIENT * speed;
        if (speed > 0) {
            player.vx -= (player.vx / speed) * dragForce * dt;
            player.vy -= (player.vy / speed) * dragForce * dt;
        }

        // Apply lift (counteracts gravity when moving fast enough)
        if (speed > GAME_CONFIG.STALL_SPEED) {
            const liftForce = GAME_CONFIG.LIFT_COEFFICIENT * speed;
            player.vy -= liftForce * dt;
        }

        // Limit speed
        const newSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (newSpeed > GAME_CONFIG.MAX_SPEED) {
            player.vx = (player.vx / newSpeed) * GAME_CONFIG.MAX_SPEED;
            player.vy = (player.vy / newSpeed) * GAME_CONFIG.MAX_SPEED;
        }

        // Update position
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        // Check arena bounds
        if (player.x < 0 || player.x > GAME_CONFIG.ARENA_WIDTH ||
            player.y < 0 || player.y > GAME_CONFIG.ARENA_HEIGHT) {
            player.score = Math.max(0, player.score - 1);
            this.killPlayer(player, null);
            return;
        }

        // Check collision with obstacles
        for (const obstacle of this.obstacles) {
            if (this.checkRectCollision(player, obstacle)) {
                player.score = Math.max(0, player.score - 1);
                this.killPlayer(player, null);
                return;
            }
        }

        // Check collision with other players
        for (const [otherSocketId, otherPlayer] of this.players) {
            if (otherPlayer.socketId === player.socketId || !otherPlayer.alive) continue;

            const dx = player.x - otherPlayer.x;
            const dy = player.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < GAME_CONFIG.PLANE_SIZE) {
                // Both players crash
                player.score = Math.max(0, player.score - 1);
                otherPlayer.score = Math.max(0, otherPlayer.score - 1);
                this.killPlayer(player, null);
                this.killPlayer(otherPlayer, null);
                return;
            }
        }

        // Handle firing
        if (input.fire) {
            const now = Date.now();
            const fireRate = player.weapon === WEAPON_TYPES.RAPID_FIRE ?
                GAME_CONFIG.FIRE_RATE / 2 : GAME_CONFIG.FIRE_RATE;

            if (now - player.lastFireTime > fireRate) {
                this.fire(player);
                player.lastFireTime = now;
            }
        }
    }

    fire(player) {
        const angle = player.angle;
        const speed = GAME_CONFIG.BULLET_SPEED;

        if (player.weapon === WEAPON_TYPES.TRIPLE_SHOT) {
            // Fire three bullets in a spread
            for (let i = -1; i <= 1; i++) {
                const spreadAngle = angle + (i * 0.2);
                this.createProjectile(player, spreadAngle, speed, 20);
            }
        } else if (player.weapon === WEAPON_TYPES.MISSILE) {
            this.createProjectile(player, angle, speed * 0.8, 50);
        } else {
            this.createProjectile(player, angle, speed, 20);
        }
    }

    createProjectile(player, angle, speed, damage) {
        this.projectiles.push({
            id: this.nextProjectileId++,
            x: player.x + Math.cos(angle) * GAME_CONFIG.PLANE_SIZE,
            y: player.y + Math.sin(angle) * GAME_CONFIG.PLANE_SIZE,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ownerId: player.socketId,
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            damage,
            type: player.weapon,
        });
    }

    applyPowerup(player, type) {
        switch (type) {
            case POWERUP_TYPES.TRIPLE_SHOT:
                player.weapon = WEAPON_TYPES.TRIPLE_SHOT;
                player.weaponTimer = 15000;
                break;
            case POWERUP_TYPES.RAPID_FIRE:
                player.weapon = WEAPON_TYPES.RAPID_FIRE;
                player.weaponTimer = 15000;
                break;
            case POWERUP_TYPES.MISSILE:
                player.weapon = WEAPON_TYPES.MISSILE;
                player.weaponTimer = 15000;
                break;
            case POWERUP_TYPES.SHIELD:
                player.shielded = true;
                player.shieldTimer = 10000;
                break;
        }
    }

    killPlayer(player, killerId) {
        player.alive = false;
        player.health = 0;
        player.respawnTimer = GAME_CONFIG.RESPAWN_TIME;

        if (killerId) {
            const killer = this.players.get(killerId);
            if (killer) {
                killer.score += 1;
            }
        }
    }

    respawnPlayer(player) {
        player.alive = true;
        player.health = GAME_CONFIG.PLAYER_HEALTH;
        player.x = Math.random() * GAME_CONFIG.ARENA_WIDTH;
        player.y = GAME_CONFIG.ARENA_HEIGHT / 2;
        player.vx = 100;
        player.vy = 0;
        player.angle = 0;
        player.weapon = WEAPON_TYPES.NORMAL;
        player.shielded = false;
    }

    checkCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < GAME_CONFIG.PLANE_SIZE / 2;
    }

    checkRectCollision(obj, rect) {
        return obj.x > rect.x && obj.x < rect.x + rect.width &&
            obj.y > rect.y && obj.y < rect.y + rect.height;
    }

    getState() {
        return {
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                socketId: p.socketId,
                username: p.username,
                x: p.x,
                y: p.y,
                angle: p.angle,
                health: p.health,
                score: p.score,
                alive: p.alive,
                weapon: p.weapon,
                shielded: p.shielded,
            })),
            projectiles: this.projectiles,
            powerups: this.powerups,
            obstacles: this.obstacles,
        };
    }
}
