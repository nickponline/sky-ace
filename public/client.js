const socket = io();

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
const keys = { up: false, down: false, left: false, right: false, space: false };

document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.up = true; break;
        case 'KeyS': case 'ArrowDown': keys.down = true; break;
        case 'KeyA': case 'ArrowLeft': keys.left = true; break;
        case 'KeyD': case 'ArrowRight': keys.right = true; break;
        case 'Space': keys.space = true; break;
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
    }
    socket.emit('input', keys);
});

function updateGame(state) {
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
            group.add(body);

            // Turret
            const turretGeo = new THREE.CylinderGeometry(5, 5, 20, 8);
            const turretMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
            const turret = new THREE.Mesh(turretGeo, turretMat);
            turret.rotation.z = Math.PI / 2;
            turret.position.set(10, 0, 15);
            group.add(turret);

            scene.add(group);
            players[id] = group;
        }

        // Update position/rotation
        const player = players[id];
        player.position.set(pData.x, pData.y, 0);
        player.rotation.z = pData.angle;
    }

    // Remove disconnected players
    for (const id in players) {
        if (!activeIds.has(id)) {
            scene.remove(players[id]);
            delete players[id];
            createExplosion(players[id].position.x, players[id].position.y, 0xe74c3c);
        }
    }

    // Update Shells
    // Recreate shells every frame for simplicity (or pool them for performance)
    // Since we don't have IDs for shells easily, let's just clear and redraw or try to match?
    // Matching is hard without IDs. Let's clear and re-add. 
    // Optimization: Pool meshes.

    // Remove old shells
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

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const part = new THREE.Mesh(geo, mat);
        part.position.set(x, y, 10);

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        part.userData = {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30
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
        li.textContent = `${p.name}: ${p.score}`;
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
