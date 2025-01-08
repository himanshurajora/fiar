const socket = io();
let currentRoom = null;
let isMyTurn = false;
let playerColor = null;

// DOM Elements
const menuDiv = document.getElementById('menu');
const gameContainer = document.getElementById('gameContainer');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const roomInput = document.getElementById('roomInput');
const playerTurnSpan = document.getElementById('playerTurn');
const roomCodeSpan = document.getElementById('roomCode');

// Game Configuration
const config = {
    type: Phaser.AUTO,
    parent: 'gameContainer',
    width: 700,
    height: 600,
    backgroundColor: '#2563eb',
    scene: {
        preload: preload,
        create: create
    }
};

// Game variables
let game = null;
let gameScene = null;
let graphics = null;
let board = Array(6).fill().map(() => Array(7).fill(null));
let discs = [];
const CELL_SIZE = 100;
const COLORS = {
    player1: 0xff4444, // Brighter Red
    player2: 0xffff44  // Brighter Yellow
};

// Event Listeners
createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom');
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (roomId) {
        socket.emit('joinRoom', roomId);
    }
});

// Socket Events
socket.on('roomCreated', (roomId) => {
    currentRoom = roomId;
    playerColor = 'player1';
    showGame(roomId);
});

socket.on('gameStart', ({ player1, player2 }) => {
    currentRoom = roomInput.value.trim() || currentRoom;
    playerColor = socket.id === player1 ? 'player1' : 'player2';
    showGame(currentRoom);
    if (!game) {
        game = new Phaser.Game(config);
    }
    isMyTurn = socket.id === player1;
    updateTurnDisplay();
});

socket.on('moveMade', ({ row, column, playerId }) => {
    const color = COLORS[playerId === socket.id ? playerColor : (playerColor === 'player1' ? 'player2' : 'player1')];
    const finalY = row * CELL_SIZE + CELL_SIZE/2;
    const x = column * CELL_SIZE + CELL_SIZE/2;
    
    // Create disc with 3D effect
    const discGroup = gameScene.add.container(x, 0);
    
    // Disc shadow
    const shadow = gameScene.add.circle(3, 3, CELL_SIZE/2 - 12, 0x000000, 0.3);
    
    // Main disc
    const disc = gameScene.add.circle(0, 0, CELL_SIZE/2 - 12, color);
    
    // Highlight for 3D effect
    const highlight = gameScene.add.circle(-8, -8, CELL_SIZE/2 - 20, 0xffffff, 0.3);
    
    discGroup.add([shadow, disc, highlight]);
    discs.push(discGroup);
    
    // Animate fall with bounce
    gameScene.tweens.add({
        targets: discGroup,
        y: finalY,
        duration: 500,
        ease: 'Bounce.easeOut',
        onUpdate: () => {
            // Rotate slightly during fall
            discGroup.rotation += 0.01;
        }
    });
    
    board[row][column] = color;
    isMyTurn = playerId !== socket.id;
    updateTurnDisplay();
});

socket.on('gameWon', (winnerId) => {
    const message = winnerId === socket.id ? 'You won!' : 'You lost!';
    alert(message);
    resetGame();
});

socket.on('playerDisconnected', () => {
    alert('Other player disconnected');
    resetGame();
});

socket.on('joinError', (message) => {
    alert(message);
});

function showGame(roomId) {
    menuDiv.style.display = 'none';
    gameContainer.style.display = 'block';
    roomCodeSpan.textContent = `Room: ${roomId}`;
}

function updateTurnDisplay() {
    playerTurnSpan.textContent = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
}

function resetGame() {
    board = Array(6).fill().map(() => Array(7).fill(null));
    discs.forEach(disc => disc.destroy());
    discs = [];
    if (gameScene) {
        gameScene.scene.restart();
    }
    menuDiv.style.display = 'block';
    gameContainer.style.display = 'none';
    currentRoom = null;
    isMyTurn = false;
}

function preload() {
    // No assets to preload
}

function create() {
    gameScene = this;
    graphics = this.add.graphics();
    discs = [];
    drawBoard();
    
    this.input.on('pointerdown', (pointer) => {
        if (!isMyTurn) return;
        
        const column = Math.floor(pointer.x / CELL_SIZE);
        if (column >= 0 && column < 7 && currentRoom) {
            socket.emit('makeMove', {
                roomId: currentRoom,
                column: column,
                playerId: socket.id
            });
        }
    });
}

function drawBoard() {
    graphics.clear();
    
    // Draw board shadow
    graphics.fillStyle(0x1e40af);
    graphics.fillRect(10, 10, 700, 600);
    
    // Draw main board
    graphics.lineStyle(2, 0x1d4ed8);
    graphics.fillStyle(0x2563eb);
    graphics.fillRect(0, 0, 700, 600);
    
    // Draw cells with 3D effect
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            const x = col * CELL_SIZE;
            const y = row * CELL_SIZE;
            
            // Cell shadow
            graphics.fillStyle(0x1e40af);
            graphics.fillCircle(x + CELL_SIZE/2 + 3, y + CELL_SIZE/2 + 3, CELL_SIZE/2 - 5);
            
            // Main cell
            graphics.fillStyle(0xffffff);
            graphics.fillCircle(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE/2 - 5);
            
            // Cell inner shadow
            graphics.lineStyle(2, 0xe5e7eb);
            graphics.strokeCircle(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE/2 - 8);
        }
    }
}

function dropDisc(row, column, color) {
    board[row][column] = color;
} 