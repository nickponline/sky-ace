const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Game = require('./game');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS for Vercel
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

const game = new Game();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (name) => {
        game.addPlayer(socket.id, name);
        // Send initial state to the new player
        socket.emit('init', {
            id: socket.id,
            width: game.width,
            height: game.height,
            obstacles: game.obstacles
        });
    });

    socket.on('input', (input) => {
        game.handleInput(socket.id, input);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        game.removePlayer(socket.id);
    });
});

// Game loop
const FPS = 60;
setInterval(() => {
    game.update();
    io.emit('state', game.getState());
}, 1000 / FPS);

const PORT = process.env.PORT || 3000;

// For local development
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
module.exports.io = io;
module.exports.server = server;
