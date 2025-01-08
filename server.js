const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Game rooms storage
const rooms = new Map();

// Room timeout duration (1 minute)
const ROOM_TIMEOUT = 60000;

function emitActiveRooms() {
    const activeRooms = Array.from(rooms.entries())
        .filter(([_, room]) => room.players.length < 2)
        .map(([id, room]) => ({
            id,
            createdAt: room.createdAt,
            playerCount: room.players.length
        }));
    io.emit('activeRooms', activeRooms);
}

function cleanupRoom(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        io.to(roomId).emit('roomExpired');
        rooms.delete(roomId);
        emitActiveRooms();
    }
}

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send active rooms to new connection
    emitActiveRooms();

    socket.on('createRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 8);
        rooms.set(roomId, { 
            players: [socket.id], 
            names: {},
            board: Array(6).fill().map(() => Array(7).fill(null)),
            createdAt: Date.now(),
            timeoutId: setTimeout(() => cleanupRoom(roomId), ROOM_TIMEOUT)
        });
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        emitActiveRooms();
    });

    socket.on('joinRoom', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players.length < 2) {
            // Clear timeout as room is being joined
            clearTimeout(room.timeoutId);
            
            room.players.push(socket.id);
            socket.join(roomId);
            socket.emit('joinRoom', roomId);
            io.to(roomId).emit('playerJoined');
            emitActiveRooms();
        } else {
            socket.emit('joinError', 'Room full or not found');
        }
    });

    socket.on('setPlayerName', ({ name, room }) => {
        const gameRoom = rooms.get(room);
        if (gameRoom) {
            gameRoom.names[socket.id] = name;
            if (Object.keys(gameRoom.names).length === 2) {
                io.to(room).emit('gameStart', {
                    player1: gameRoom.players[0],
                    player2: gameRoom.players[1],
                    names: [gameRoom.names[gameRoom.players[0]], gameRoom.names[gameRoom.players[1]]]
                });
            }
        }
    });

    socket.on('makeMove', ({ roomId, column, playerId }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const board = room.board;
        // Find the lowest empty row in the selected column
        for (let row = 5; row >= 0; row--) {
            if (!board[row][column]) {
                board[row][column] = playerId;
                io.to(roomId).emit('moveMade', { 
                    row, 
                    column, 
                    playerId,
                    playerName: room.names[playerId]
                });
                
                // Check for win condition
                if (checkWin(board, row, column, playerId)) {
                    io.to(roomId).emit('gameWon', playerId);
                }
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.includes(socket.id)) {
                io.to(roomId).emit('playerDisconnected');
                rooms.delete(roomId);
                emitActiveRooms();
            }
        }
    });
});

function checkWin(board, row, col, player) {
    // Check horizontal
    for (let c = 0; c <= 3; c++) {
        if (board[row][c] === player && 
            board[row][c+1] === player && 
            board[row][c+2] === player && 
            board[row][c+3] === player) {
            return true;
        }
    }

    // Check vertical
    for (let r = 0; r <= 2; r++) {
        if (board[r][col] === player && 
            board[r+1][col] === player && 
            board[r+2][col] === player && 
            board[r+3][col] === player) {
            return true;
        }
    }

    // Check diagonal (positive slope)
    for (let r = 3; r < 6; r++) {
        for (let c = 0; c <= 3; c++) {
            if (board[r][c] === player && 
                board[r-1][c+1] === player && 
                board[r-2][c+2] === player && 
                board[r-3][c+3] === player) {
                return true;
            }
        }
    }

    // Check diagonal (negative slope)
    for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 3; c++) {
            if (board[r][c] === player && 
                board[r+1][c+1] === player && 
                board[r+2][c+2] === player && 
                board[r+3][c+3] === player) {
                return true;
            }
        }
    }

    return false;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
}); 