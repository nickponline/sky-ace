class Game {
    constructor() {
        this.players = {};
        this.shells = [];
        this.obstacles = [];
        this.events = []; // For explosions, etc.
        this.width = 800;
        this.height = 600;

        // Physics Constants
        this.shellSpeed = 10; // Faster shells
        this.tankSize = 30;
        this.shellSize = 5;
        this.maxRicochets = 2;

        // Tuned for faster gameplay
        this.ACCELERATION = 0.4;
        this.MAX_SPEED = 6;
        this.FRICTION = 0.92;

        this.ROTATION_ACCEL = 0.01;
        this.MAX_ROTATION_SPEED = 0.12;
        this.ROTATION_FRICTION = 0.90;

        this.initObstacles();
    }

    initObstacles() {
        this.obstacles.push({ x: 100, y: 100, w: 50, h: 200 });
        this.obstacles.push({ x: 650, y: 100, w: 50, h: 200 });
        this.obstacles.push({ x: 300, y: 300, w: 200, h: 50 });
        this.obstacles.push({ x: 100, y: 500, w: 600, h: 50 });
        // Add border walls
        this.obstacles.push({ x: -50, y: 0, w: 50, h: this.height }); // Left
        this.obstacles.push({ x: this.width, y: 0, w: 50, h: this.height }); // Right
        this.obstacles.push({ x: 0, y: -50, w: this.width, h: 50 }); // Top
        this.obstacles.push({ x: 0, y: this.height, w: this.width, h: 50 }); // Bottom
    }

    addPlayer(id, name) {
        const spawn = this.getSafeSpawn();
        this.players[id] = {
            id: id,
            name: name || `Player ${Object.keys(this.players).length + 1}`,
            x: spawn.x,
            y: spawn.y,
            angle: Math.random() * Math.PI * 2,
            turretRelAngle: 0, // Relative to body
            vx: 0,
            vy: 0,
            vAngle: 0,
            vTurretRel: 0,
            radius: this.tankSize / 2,
            color: this.getRandomColor(),
            score: 0,
            cooldown: 0,
            maxCooldown: 30
        };
    }

    getSafeSpawn() {
        let safe = false;
        let x, y;
        let attempts = 0;
        while (!safe && attempts < 100) {
            x = Math.random() * (this.width - 100) + 50;
            y = Math.random() * (this.height - 100) + 50;
            safe = true;

            // Check vs obstacles
            for (const obs of this.obstacles) {
                if (this.checkCircleRect(x, y, this.tankSize / 2 + 10, obs)) {
                    safe = false;
                    break;
                }
            }

            // Check vs other players
            if (safe) {
                for (const id in this.players) {
                    const p = this.players[id];
                    const dist = Math.hypot(p.x - x, p.y - y);
                    if (dist < this.tankSize * 2) {
                        safe = false;
                        break;
                    }
                }
            }
            attempts++;
        }
        return { x, y };
    }

    removePlayer(id) {
        delete this.players[id];
    }

    getRandomColor() {
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#9b59b6', '#1abc9c'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    handleInput(id, input) {
        const player = this.players[id];
        if (!player) return;

        // Rotation Acceleration
        // If Shift is held, rotate turret relative to body
        // If Shift is NOT held, rotate body
        if (input.shift) {
            if (input.left) player.vTurretRel -= this.ROTATION_ACCEL;
            if (input.right) player.vTurretRel += this.ROTATION_ACCEL;
        } else {
            if (input.left) player.vAngle -= this.ROTATION_ACCEL;
            if (input.right) player.vAngle += this.ROTATION_ACCEL;
        }

        // Movement Acceleration
        if (input.up) {
            player.vx += Math.cos(player.angle) * this.ACCELERATION;
            player.vy += Math.sin(player.angle) * this.ACCELERATION;
        }
        if (input.down) {
            player.vx -= Math.cos(player.angle) * this.ACCELERATION;
            player.vy -= Math.sin(player.angle) * this.ACCELERATION;
        }

        // Shooting
        if (input.space && player.cooldown <= 0) {
            this.fireShell(player);
            player.cooldown = player.maxCooldown;
        }

        if (player.cooldown > 0) player.cooldown--;
    }

    fireShell(player) {
        const absTurretAngle = player.angle + player.turretRelAngle;
        const vx = Math.cos(absTurretAngle) * this.shellSpeed;
        const vy = Math.sin(absTurretAngle) * this.shellSpeed;

        // Start slightly outside tank turret
        const sx = player.x + Math.cos(absTurretAngle) * (player.radius + 20);
        const sy = player.y + Math.sin(absTurretAngle) * (player.radius + 20);

        this.shells.push({
            x: sx,
            y: sy,
            vx: vx,
            vy: vy,
            radius: this.shellSize,
            ownerId: player.id,
            ricochets: 0
        });

        // Muzzle flash event?
        // this.events.push({ type: 'flash', x: sx, y: sy });
    }

    checkCollision(x, y, radius) {
        for (const obs of this.obstacles) {
            if (this.checkCircleRect(x, y, radius, obs)) return true;
        }
        return false;
    }

    checkCircleRect(cx, cy, cr, rect) {
        const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
        const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
        const distanceX = cx - closestX;
        const distanceY = cy - closestY;
        return (distanceX * distanceX + distanceY * distanceY) < (cr * cr);
    }

    update() {
        // Update Players
        for (const id in this.players) {
            const p = this.players[id];

            // Apply Friction
            p.vx *= this.FRICTION;
            p.vy *= this.FRICTION;
            p.vAngle *= this.ROTATION_FRICTION;
            p.vTurretRel *= this.ROTATION_FRICTION;

            // Cap Velocity
            const speed = Math.hypot(p.vx, p.vy);
            if (speed > this.MAX_SPEED) {
                const scale = this.MAX_SPEED / speed;
                p.vx *= scale;
                p.vy *= scale;
            }

            // Cap Rotation
            if (Math.abs(p.vAngle) > this.MAX_ROTATION_SPEED) {
                p.vAngle = Math.sign(p.vAngle) * this.MAX_ROTATION_SPEED;
            }
            if (Math.abs(p.vTurretRel) > this.MAX_ROTATION_SPEED) {
                p.vTurretRel = Math.sign(p.vTurretRel) * this.MAX_ROTATION_SPEED;
            }

            // Apply Velocity
            p.angle += p.vAngle;
            p.turretRelAngle += p.vTurretRel;

            const newX = p.x + p.vx;
            const newY = p.y + p.vy;

            // Collision Check
            if (!this.checkCollision(newX, newY, p.radius)) {
                p.x = newX;
                p.y = newY;
            } else {
                if (!this.checkCollision(newX, p.y, p.radius)) {
                    p.x = newX;
                    p.vy *= 0.5;
                } else if (!this.checkCollision(p.x, newY, p.radius)) {
                    p.y = newY;
                    p.vx *= 0.5;
                } else {
                    p.vx = 0;
                    p.vy = 0;
                }
            }
        }

        // Update Shells
        for (let i = this.shells.length - 1; i >= 0; i--) {
            const shell = this.shells[i];
            shell.x += shell.vx;
            shell.y += shell.vy;

            // Wall Collision
            let hitWall = false;
            for (const obs of this.obstacles) {
                if (this.checkCircleRect(shell.x, shell.y, shell.radius, obs)) {
                    hitWall = true;

                    // Event for wall hit
                    this.events.push({ type: 'hit', x: shell.x, y: shell.y, color: 0xbdc3c7 });

                    // Resolve collision / Ricochet
                    const prevX = shell.x - shell.vx;
                    const prevY = shell.y - shell.vy;

                    if (this.checkCircleRect(shell.x, prevY, shell.radius, obs)) {
                        shell.vx = -shell.vx;
                        shell.y = prevY;
                    } else {
                        shell.vy = -shell.vy;
                        shell.x = prevX;
                    }
                    break;
                }
            }

            if (hitWall) {
                shell.ricochets++;
                if (shell.ricochets > this.maxRicochets) {
                    this.shells.splice(i, 1);
                    continue;
                }
            }

            // Player Collision
            for (const id in this.players) {
                const player = this.players[id];
                if (shell.ownerId === player.id && shell.ricochets === 0) continue;

                const dist = Math.hypot(shell.x - player.x, shell.y - player.y);
                if (dist < shell.radius + player.radius) {
                    // Kill
                    if (this.players[shell.ownerId]) {
                        this.players[shell.ownerId].score++;
                    }

                    // Explosion Event
                    this.events.push({ type: 'explosion', x: player.x, y: player.y, color: player.color });

                    // Respawn
                    const spawn = this.getSafeSpawn();
                    player.x = spawn.x;
                    player.y = spawn.y;
                    player.angle = Math.random() * Math.PI * 2;
                    player.turretRelAngle = 0;
                    player.vx = 0;
                    player.vy = 0;
                    player.vAngle = 0;
                    player.vTurretRel = 0;

                    this.shells.splice(i, 1);
                    break;
                }
            }
        }
    }

    getState() {
        const state = {
            players: this.players,
            shells: this.shells,
            obstacles: this.obstacles,
            events: this.events
        };
        this.events = []; // Clear events after sending
        return state;
    }
}

module.exports = Game;
