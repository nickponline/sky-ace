import * as THREE from 'three';

// Create 8-bit style textures using canvas
export function createPlaneTexture(color = '#00ff00') {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Draw a simple 8-bit plane
    ctx.fillStyle = color;

    // Fuselage
    ctx.fillRect(8, 14, 16, 4);

    // Wings
    ctx.fillRect(4, 12, 24, 8);

    // Nose
    ctx.fillRect(22, 15, 4, 2);

    // Tail
    ctx.fillRect(6, 13, 4, 6);

    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 15, 4, 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return texture;
}

export function createBulletTexture(type = 'normal') {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');

    if (type === 'missile') {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 2, 8, 4);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(0, 3, 2, 2);
    } else {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(2, 2, 4, 4);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return texture;
}

export function createPowerupTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');

    // Border
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 20, 20);

    // Icon based on type
    ctx.fillStyle = '#ffff00';
    switch (type) {
        case 'triple_shot':
            ctx.fillRect(8, 10, 2, 4);
            ctx.fillRect(11, 10, 2, 4);
            ctx.fillRect(14, 10, 2, 4);
            break;
        case 'rapid_fire':
            ctx.fillRect(10, 8, 4, 2);
            ctx.fillRect(10, 12, 4, 2);
            ctx.fillRect(10, 16, 4, 2);
            break;
        case 'missile':
            ctx.fillRect(8, 10, 8, 4);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(14, 11, 2, 2);
            break;
        case 'shield':
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(12, 12, 6, 0, Math.PI * 2);
            ctx.stroke();
            break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return texture;
}

export function createObstacleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Create a brick pattern
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, 64, 64);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;

    // Draw brick pattern
    for (let y = 0; y < 64; y += 16) {
        for (let x = 0; x < 64; x += 32) {
            ctx.strokeRect(x, y, 32, 16);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
}

export function createExplosionParticles(scene, x, y) {
    const particles = [];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.PlaneGeometry(4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xff6600 : 0xffff00,
            transparent: true,
            opacity: 1,
        });

        const particle = new THREE.Mesh(geometry, material);
        particle.position.set(x, y, 1);

        // Random velocity
        particle.velocity = {
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200,
        };

        particle.lifetime = 1.0;

        scene.add(particle);
        particles.push(particle);
    }

    return particles;
}

export function updateParticles(particles, deltaTime) {
    const dt = deltaTime / 1000;

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        particle.position.x += particle.velocity.x * dt;
        particle.position.y += particle.velocity.y * dt;
        particle.velocity.y -= 300 * dt; // Gravity

        particle.lifetime -= dt;
        particle.material.opacity = particle.lifetime;

        if (particle.lifetime <= 0) {
            particle.parent.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
            particles.splice(i, 1);
        }
    }
}

export function createSmokeParticle(scene, x, y) {
    const geometry = new THREE.PlaneGeometry(6, 6);
    const material = new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.6,
    });

    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, 0.5);

    particle.velocity = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
    };

    particle.lifetime = 2.0;

    scene.add(particle);
    return particle;
}
