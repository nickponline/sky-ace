const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

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
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
