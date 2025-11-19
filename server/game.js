class Game {
    constructor() {
        this.players = {};
        this.shells = [];
        this.obstacles = [];
        this.width = 800;
        this.height = 600;
        this.shellSpeed = 8;
        this.tankSpeed = 3;
        this.rotationSpeed = 0.05;
        this.tankSize = 30; // Treated as diameter for collision
        this.shellSize = 5; // Radius
        this.maxRicochets = 2;

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
            radius: this.tankSize / 2,
            color: this.getRandomColor(),
            score: 0,
            cooldown: 0
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

        // Rotation
        if (input.left) player.angle -= this.rotationSpeed;
        if (input.right) player.angle += this.rotationSpeed;

        // Movement
        let speed = 0;
        if (input.up) speed = this.tankSpeed;
        if (input.down) speed = -this.tankSpeed;

        if (speed !== 0) {
            const dx = Math.cos(player.angle) * speed;
            const dy = Math.sin(player.angle) * speed;

            const newX = player.x + dx;
            const newY = player.y + dy;

            if (!this.checkCollision(newX, newY, player.radius)) {
                player.x = newX;
                player.y = newY;
            }
        }

        // Shooting
        if (input.space && player.cooldown <= 0) {
            this.fireShell(player);
            player.cooldown = 30;
        }

        if (player.cooldown > 0) player.cooldown--;
    }

    fireShell(player) {
        const vx = Math.cos(player.angle) * this.shellSpeed;
        const vy = Math.sin(player.angle) * this.shellSpeed;
        // Start slightly outside tank
        const sx = player.x + Math.cos(player.angle) * (player.radius + 5);
        const sy = player.y + Math.sin(player.angle) * (player.radius + 5);

        this.shells.push({
            x: sx,
            y: sy,
            vx: vx,
            vy: vy,
            radius: this.shellSize,
            ownerId: player.id,
            ricochets: 0
        });
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
        for (let i = this.shells.length - 1; i >= 0; i--) {
            const shell = this.shells[i];
            shell.x += shell.vx;
            shell.y += shell.vy;

            // Wall Collision
            let hitWall = false;
            for (const obs of this.obstacles) {
                if (this.checkCircleRect(shell.x, shell.y, shell.radius, obs)) {
                    hitWall = true;
                    // Resolve collision / Ricochet
                    // Determine hit side
                    const prevX = shell.x - shell.vx;
                    const prevY = shell.y - shell.vy;

                    // Check X-axis first
                    if (this.checkCircleRect(shell.x, prevY, shell.radius, obs)) {
                        shell.vx = -shell.vx;
                        shell.y = prevY; // Backtrack
                    } else {
                        shell.vy = -shell.vy;
                        shell.x = prevX; // Backtrack
                    }
                    break; // Only bounce off one wall at a time
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
                // Allow self-damage if ricocheted
                if (shell.ownerId === player.id && shell.ricochets === 0) continue;

                const dist = Math.hypot(shell.x - player.x, shell.y - player.y);
                if (dist < shell.radius + player.radius) {
                    // Kill
                    if (this.players[shell.ownerId]) {
                        // If self-kill, maybe -1? For now just point.
                        this.players[shell.ownerId].score++;
                    }

                    // Respawn
                    const spawn = this.getSafeSpawn();
                    player.x = spawn.x;
                    player.y = spawn.y;
                    player.angle = Math.random() * Math.PI * 2;

                    this.shells.splice(i, 1);
                    break;
                }
            }
        }
    }

    getState() {
        return {
            players: this.players,
            shells: this.shells,
            obstacles: this.obstacles
        };
    }
}

module.exports = Game;
