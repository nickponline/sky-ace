const socket = io({
    path: '/api/socketio'
});

const loginScreen = document.getElementById('login-screen');
const gameContainer = document.getElementById('game-container');
const threeContainer = document.getElementById('three-container');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const scoreList = document.getElementById('score-list');

let myId = null;
let scene, camera, renderer;
let players = {};
let shells = [];
let obstacles = [];
let particles = [];

// Three.js Setup
function initThree(width, height) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2c3e50);

    // Camera (Top-down)
    camera = new THREE.OrthographicCamera(0, width, 0, height, 1, 1000);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    threeContainer.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 100, 200);
    scene.add(dirLight);
}

function createObstacles(obsData) {
    const geometry = new THREE.BoxGeometry(1, 1, 20);
    const material = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });

    obsData.forEach(obs => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(obs.x + obs.w / 2, obs.y + obs.h / 2, 10);
        mesh.scale.set(obs.w, obs.h, 1);
        scene.add(mesh);
        obstacles.push(mesh);
    });

    // Floor
    const floorGeo = new THREE.PlaneGeometry(800, 600);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x34495e });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(400, 300, -1);
    scene.add(floor);
}

// Game Logic
joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        socket.emit('join', name);
        loginScreen.style.display = 'none';
        gameContainer.style.display = 'block';
    }
});

socket.on('init', (data) => {
    myId = data.id;
    initThree(data.width, data.height);
    createObstacles(data.obstacles);
    animate();
});

socket.on('state', (state) => {
    updateGame(state);
    updateScoreboard(state.players);
});

// Input handling
const keys = { up: false, down: false, left: false, right: false, space: false, shift: false };

document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.up = true; break;
        case 'KeyS': case 'ArrowDown': keys.down = true; break;
        case 'KeyA': case 'ArrowLeft': keys.left = true; break;
        case 'KeyD': case 'ArrowRight': keys.right = true; break;
        case 'Space': keys.space = true; break;
        case 'ShiftLeft': case 'ShiftRight': keys.shift = true; break;
    }
    socket.emit('input', keys);
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.up = false; break;
        case 'KeyS': case 'ArrowDown': keys.down = false; break;
        case 'KeyA': case 'ArrowLeft': keys.left = false; break;
        case 'KeyD': case 'ArrowRight': keys.right = false; break;
        case 'Space': keys.space = false; break;
        case 'ShiftLeft': case 'ShiftRight': keys.shift = false; break;
    }
    socket.emit('input', keys);
});

function updateGame(state) {
    // Handle Events
    if (state.events) {
        state.events.forEach(e => {
            if (e.type === 'explosion') {
                createExplosion(e.x, e.y, e.color, 10);
            } else if (e.type === 'hit') {
                createExplosion(e.x, e.y, e.color, 3); // Smaller hit effect
            }
        });
    }

    // Update Players
    const activeIds = new Set();
    for (const id in state.players) {
        activeIds.add(id);
        const pData = state.players[id];

        if (!players[id]) {
            // Create new player mesh
            const group = new THREE.Group();

            // Body
            const bodyGeo = new THREE.BoxGeometry(pData.radius * 2, pData.radius * 2, 15);
            const bodyMat = new THREE.MeshLambertMaterial({ color: pData.color });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.z = 7.5;
            body.name = 'body';
            group.add(body);

            // Turret
            const turretGeo = new THREE.CylinderGeometry(5, 5, 40, 8);
            turretGeo.translate(0, 20, 0); // Pivot at bottom
            const turretMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
            const turret = new THREE.Mesh(turretGeo, turretMat);
            turret.rotation.z = -Math.PI / 2; // Point right
            turret.position.set(0, 0, 15); // Centered on tank
            turret.name = 'turret';

            group.add(turret);

            scene.add(group);
            players[id] = group;
        }

        // Update position/rotation
        const playerGroup = players[id];
        playerGroup.position.set(pData.x, pData.y, 0);
        playerGroup.rotation.z = pData.angle;

        // Update Turret Rotation (Relative)
        const turret = playerGroup.getObjectByName('turret');
        if (turret) {
            // Turret base rotation is -PI/2 (pointing right).
            // We want to add the relative angle.
            turret.rotation.z = -Math.PI / 2 + pData.turretRelAngle;
        }
    }

    // Remove disconnected players
    for (const id in players) {
        if (!activeIds.has(id)) {
            scene.remove(players[id]);
            delete players[id];
            // createExplosion(players[id].position.x, players[id].position.y, 0xe74c3c); // Handled by event now
        }
    }

    // Update Shells
    shells.forEach(mesh => scene.remove(mesh));
    shells = [];

    state.shells.forEach(sData => {
        const geo = new THREE.SphereGeometry(sData.radius, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xecf0f1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(sData.x, sData.y, 10);
        scene.add(mesh);
        shells.push(mesh);
    });
}

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const part = new THREE.Mesh(geo, mat);
        part.position.set(x, y, 10);

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        part.userData = {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20
        };

        scene.add(part);
        particles.push(part);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.x += p.userData.vx;
        p.position.y += p.userData.vy;
        p.userData.life--;
        p.scale.multiplyScalar(0.9);

        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

function updateScoreboard(playersData) {
    scoreList.innerHTML = '';
    const sorted = Object.values(playersData).sort((a, b) => b.score - a.score);
    sorted.forEach(p => {
        const li = document.createElement('li');

        // Cooldown indicator
        const cdPercent = Math.max(0, (p.maxCooldown - p.cooldown) / p.maxCooldown * 100);
        const ready = p.cooldown <= 0 ? 'READY' : 'RELOADING';
        const color = p.cooldown <= 0 ? '#2ecc71' : '#e74c3c';

        li.innerHTML = `
            <span style="display:inline-block; width: 10px; height: 10px; background: ${p.color}; margin-right: 5px;"></span>
            ${p.name}: ${p.score} 
            <span style="font-size: 0.8em; color: ${color}; margin-left: 10px;">[${ready}]</span>
        `;

        if (p.id === myId) {
            li.style.fontWeight = 'bold';
            li.style.color = '#f1c40f';
        }
        scoreList.appendChild(li);
    });
}

function animate() {
    requestAnimationFrame(animate);
    updateParticles();
    renderer.render(scene, camera);
}
