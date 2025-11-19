import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Game } from './game.js';
import { GAME_CONFIG } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, '../dist')));

const game = new Game();
const TICK_RATE = 1000 / GAME_CONFIG.TICK_RATE;
let lastUpdate = Date.now();

// Game loop
setInterval(() => {
    const now = Date.now();
    const deltaTime = now - lastUpdate;
    lastUpdate = now;

    game.update(deltaTime);

    // Broadcast game state to all clients
    io.emit('gameState', game.getState());
}, TICK_RATE);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join', (username) => {
        const player = game.addPlayer(socket.id, username || 'Anonymous');
        console.log(`${username} joined the game`);

        // Send initial state to the new player
        socket.emit('init', {
            playerId: player.id,
            config: GAME_CONFIG,
        });

        // Broadcast updated player list
        io.emit('playerJoined', {
            id: player.id,
            username: player.username,
        });
    });

    socket.on('input', (input) => {
        game.handleInput(socket.id, input);
    });

    socket.on('disconnect', () => {
        const player = game.players.get(socket.id);
        if (player) {
            console.log(`${player.username} left the game`);
            game.removePlayer(socket.id);
            io.emit('playerLeft', player.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
