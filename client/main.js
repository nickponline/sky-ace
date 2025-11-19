import * as THREE from 'three';
import { io } from 'socket.io-client';
import {
    createPlaneTexture,
    createBulletTexture,
    createPowerupTexture,
    createObstacleTexture,
    createExplosionParticles,
    updateParticles,
    createSmokeParticle,
} from './graphics.js';

// Game state
let socket;
let scene, camera, renderer;
let myPlayerId = null;
let gameConfig = null;
let gameState = {
    players: [],
    projectiles: [],
    powerups: [],
    obstacles: [],
};

// Rendering objects
const playerMeshes = new Map();
const projectileMeshes = new Map();
const powerupMeshes = new Map();
const obstacleMeshes = new Map();
const particles = [];
const smokeParticles = [];

// Input state
const input = {
    accelerate: false,
    decelerate: false,
    turnUp: false,
    turnDown: false,
    fire: false,
};

// UI elements
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');

// Initialize
function init() {
    // Setup Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x001a33);

    // Create starfield background
    createStarfield();

    // Camera setup (orthographic for 2D)
    const aspect = window.innerWidth / window.innerHeight;
    const viewHeight = 800;
    const viewWidth = viewHeight * aspect;

    camera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        1,
        1000
    );
    camera.position.z = 100;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Input handlers
    setupInputHandlers();

    // Login form
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim() || 'Anonymous';
        joinGame(username);
    });

    // Focus on username input
    usernameInput.focus();
}

function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 200;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 4000;
        positions[i + 1] = (Math.random() - 0.5) * 2400;
        positions[i + 2] = -50;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

function createArenaBoundaries() {
    if (!gameConfig) return;

    const width = gameConfig.ARENA_WIDTH;
    const height = gameConfig.ARENA_HEIGHT;
    const thickness = 20;

    // Create striped texture for borders
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Draw diagonal yellow/black stripes
    const stripeWidth = 16;
    for (let i = -64; i < 128; i += stripeWidth * 2) {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(i, 0, stripeWidth, 64);
        ctx.fillStyle = '#000000';
        ctx.fillRect(i + stripeWidth, 0, stripeWidth, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    const material = new THREE.MeshBasicMaterial({ map: texture });

    // Top border
    const topGeometry = new THREE.PlaneGeometry(width, thickness);
    const topBorder = new THREE.Mesh(topGeometry, material.clone());
    topBorder.position.set(width / 2, height + thickness / 2, -10);
    topBorder.material.map.repeat.set(width / 64, 1);
    scene.add(topBorder);

    // Bottom border
    const bottomGeometry = new THREE.PlaneGeometry(width, thickness);
    const bottomBorder = new THREE.Mesh(bottomGeometry, material.clone());
    bottomBorder.position.set(width / 2, -thickness / 2, -10);
    bottomBorder.material.map.repeat.set(width / 64, 1);
    scene.add(bottomBorder);

    // Left border
    const leftGeometry = new THREE.PlaneGeometry(thickness, height);
    const leftBorder = new THREE.Mesh(leftGeometry, material.clone());
    leftBorder.position.set(-thickness / 2, height / 2, -10);
    leftBorder.material.map.repeat.set(1, height / 64);
    scene.add(leftBorder);

    // Right border
    const rightGeometry = new THREE.PlaneGeometry(thickness, height);
    const rightBorder = new THREE.Mesh(rightGeometry, material.clone());
    rightBorder.position.set(width + thickness / 2, height / 2, -10);
    rightBorder.material.map.repeat.set(1, height / 64);
    scene.add(rightBorder);
}

function joinGame(username) {
    // Connect to server
    socket = io(window.location.origin);

    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('join', username);
    });

    socket.on('init', (data) => {
        myPlayerId = data.playerId;
        gameConfig = data.config;

        // Hide login screen
        loginScreen.classList.add('hidden');

        // Update HUD
        document.getElementById('player-name').textContent = username;

        // Create arena boundaries
        createArenaBoundaries();

        // Start game loop
        animate();
    });

    socket.on('gameState', (state) => {
        gameState = state;
        updateGameObjects();
        updateHUD();
        updateScoreboard();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

function setupInputHandlers() {
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                input.accelerate = true;
                break;
            case 's':
            case 'arrowdown':
                input.decelerate = true;
                break;
            case 'a':
            case 'arrowleft':
                input.turnUp = true;
                break;
            case 'd':
            case 'arrowright':
                input.turnDown = true;
                break;
            case ' ':
                input.fire = true;
                e.preventDefault();
                break;
        }

        sendInput();
    });

    window.addEventListener('keyup', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                input.accelerate = false;
                break;
            case 's':
            case 'arrowdown':
                input.decelerate = false;
                break;
            case 'a':
            case 'arrowleft':
                input.turnUp = false;
                break;
            case 'd':
            case 'arrowright':
                input.turnDown = false;
                break;
            case ' ':
                input.fire = false;
                break;
        }

        sendInput();
    });
}

function sendInput() {
    if (socket) {
        socket.emit('input', input);
    }
}

function updateGameObjects() {
    // Update players
    const currentPlayerIds = new Set(gameState.players.map(p => p.id));

    // Remove disconnected players
    for (const [id, mesh] of playerMeshes) {
        if (!currentPlayerIds.has(id)) {
            scene.remove(mesh);
            if (mesh.shield) scene.remove(mesh.shield);
            mesh.geometry.dispose();
            mesh.material.dispose();
            playerMeshes.delete(id);
        }
    }

    // Update/create player meshes
    for (const player of gameState.players) {
        if (!player.alive) {
            if (playerMeshes.has(player.id)) {
                const mesh = playerMeshes.get(player.id);
                scene.remove(mesh);
                if (mesh.shield) scene.remove(mesh.shield);
                mesh.geometry.dispose();
                mesh.material.dispose();
                playerMeshes.delete(player.id);

                // Create explosion
                const explosion = createExplosionParticles(scene, player.x, player.y);
                particles.push(...explosion);
            }
            continue;
        }

        let mesh = playerMeshes.get(player.id);

        if (!mesh) {
            // Create new player mesh
            const isMe = player.id === myPlayerId;
            const color = isMe ? '#00ff00' : '#ff0000';
            const texture = createPlaneTexture(color);

            const geometry = new THREE.PlaneGeometry(32, 32);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
            });

            mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            playerMeshes.set(player.id, mesh);

            // Create shield mesh
            const shieldGeometry = new THREE.RingGeometry(20, 24, 32);
            const shieldMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.5,
            });
            mesh.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
            mesh.shield.visible = false;
            scene.add(mesh.shield);
        }

        // Update position and rotation
        mesh.position.set(player.x, player.y, 2);
        mesh.rotation.z = player.angle;

        // Update shield
        if (mesh.shield) {
            mesh.shield.position.set(player.x, player.y, 1.5);
            mesh.shield.visible = player.shielded;
        }

        // Emit smoke if damaged
        if (player.health < 50 && Math.random() < 0.1) {
            const smoke = createSmokeParticle(scene, player.x, player.y);
            smokeParticles.push(smoke);
        }
    }

    // Update projectiles
    const currentProjectileIds = new Set(gameState.projectiles.map(p => p.id));

    for (const [id, mesh] of projectileMeshes) {
        if (!currentProjectileIds.has(id)) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            projectileMeshes.delete(id);
        }
    }

    for (const projectile of gameState.projectiles) {
        let mesh = projectileMeshes.get(projectile.id);

        if (!mesh) {
            const texture = createBulletTexture(projectile.type);
            const size = projectile.type === 'missile' ? 12 : 6;

            const geometry = new THREE.PlaneGeometry(size, size);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
            });

            mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            projectileMeshes.set(projectile.id, mesh);
        }

        mesh.position.set(projectile.x, projectile.y, 1);
    }

    // Update powerups
    const currentPowerupIds = new Set(gameState.powerups.map(p => p.id));

    for (const [id, mesh] of powerupMeshes) {
        if (!currentPowerupIds.has(id)) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            powerupMeshes.delete(id);
        }
    }

    for (const powerup of gameState.powerups) {
        let mesh = powerupMeshes.get(powerup.id);

        if (!mesh) {
            const texture = createPowerupTexture(powerup.type);
            const geometry = new THREE.PlaneGeometry(24, 24);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
            });

            mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            powerupMeshes.set(powerup.id, mesh);
        }

        mesh.position.set(powerup.x, powerup.y, 1);
        mesh.rotation.z += 0.02; // Rotate powerups
    }

    // Update obstacles (only create once)
    if (obstacleMeshes.size === 0 && gameState.obstacles.length > 0) {
        const texture = createObstacleTexture();

        for (const obstacle of gameState.obstacles) {
            const geometry = new THREE.PlaneGeometry(obstacle.width, obstacle.height);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
            });

            material.map.repeat.set(obstacle.width / 64, obstacle.height / 64);

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                obstacle.x + obstacle.width / 2,
                obstacle.y + obstacle.height / 2,
                0
            );

            scene.add(mesh);
            obstacleMeshes.set(obstacle, mesh);
        }
    }

    // Update camera to follow player
    const myPlayer = gameState.players.find(p => p.id === myPlayerId);
    if (myPlayer && myPlayer.alive) {
        camera.position.x = myPlayer.x;
        camera.position.y = myPlayer.y;
    }
}

function updateHUD() {
    const myPlayer = gameState.players.find(p => p.id === myPlayerId);
    if (!myPlayer) return;

    document.getElementById('player-health').textContent = Math.max(0, myPlayer.health);
    document.getElementById('player-score').textContent = myPlayer.score;
    document.getElementById('health-fill').style.width = `${Math.max(0, myPlayer.health)}%`;

    const weaponNames = {
        normal: 'NORMAL',
        triple_shot: 'TRIPLE SHOT',
        rapid_fire: 'RAPID FIRE',
        missile: 'MISSILE',
    };
    document.getElementById('player-weapon').textContent = weaponNames[myPlayer.weapon] || 'NORMAL';

    const shieldStatus = document.getElementById('shield-status');
    shieldStatus.style.display = myPlayer.shielded ? 'block' : 'none';
}

function updateScoreboard() {
    const scoreList = document.getElementById('score-list');

    // Sort players by score
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

    scoreList.innerHTML = sortedPlayers.map(player => {
        const isMe = player.id === myPlayerId;
        const status = player.alive ? '✈️' : '💀';
        return `
      <div class="score-entry ${isMe ? 'self' : ''}">
        <span>${status} ${player.username}</span>
        <span>${player.score}</span>
      </div>
    `;
    }).join('');
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewHeight = 800;
    const viewWidth = viewHeight * aspect;

    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Update particles
    updateParticles(particles, deltaTime);
    updateParticles(smokeParticles, deltaTime);

    renderer.render(scene, camera);
}

// Start the game
init();
