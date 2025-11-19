const { Server } = require('socket.io');
const Game = require('../server/game');

let io;
let game;

module.exports = (req, res) => {
    if (!io) {
        io = new Server(res.socket.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling'],
            path: '/api/socketio'
        });

        game = new Game();

        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);

            socket.on('join', (name) => {
                game.addPlayer(socket.id, name);
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

        res.socket.server.io = io;
    }

    res.end();
};
