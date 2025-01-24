const socket = io();
let currentRoom = null;
let isMyTurn = false;
let playerColor = null;
let playerName = '';
let waitingTimeout = null;
let waitingInterval = null;
let waitingTimeLeft = 30;

// Logger function
function log(message) {
    console.log(`[Client] ${message}`);
}

// Socket connection events
socket.on('connect', () => {
    log(`Connected to server with ID: ${socket.id}`);
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
    }, 500); // Wait for fade out animation
});

socket.on('disconnect', () => {
    log('Disconnected from server');
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
});

// DOM Elements
const menuDiv = document.getElementById('menu');
const gameContainer = document.getElementById('gameContainer');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const roomInput = document.getElementById('roomInput');
const playerTurnSpan = document.getElementById('playerTurn');
const roomCodeSpan = document.getElementById('roomCode');
const nameModal = document.getElementById('nameModal');
const playerNameInput = document.getElementById('playerName');
const startGameBtn = document.getElementById('startGame');
const playerNameDisplay = document.getElementById('playerName');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const roomCodeText = document.getElementById('roomCodeText');
const copyButton = document.getElementById('copyButton');
const resultPopup = document.getElementById('resultPopup');
const resultContent = document.getElementById('resultContent');
const resultEmoji = document.getElementById('resultEmoji');
const resultText = document.getElementById('resultText');
const activeRoomsList = document.getElementById('activeRooms');
const noRoomsMessage = document.getElementById('noRooms');
const loadingOverlay = document.getElementById('loadingOverlay');

// Game Configuration
const config = {
    type: Phaser.AUTO,
    parent: 'gameContainer',
    width: 700,
    height: 600,
    backgroundColor: '#1e293b',
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
    player1: 0xef4444, // Red
    player2: 0xeab308  // Yellow
};

// Event Listeners
createRoomBtn.addEventListener('click', () => {
    log('Creating new room');
    socket.emit('createRoom');
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (roomId) {
        log(`Attempting to join room: ${roomId}`);
        socket.emit('joinRoom', roomId);
    }
});

function updateWaitingMessage() {
    playerTurnSpan.textContent = `Waiting for other player to join... ${waitingTimeLeft}s`;
}

startGameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        log(`Starting game with name: ${name}`);
        localStorage.setItem('playerName', name);
        playerName = name;
        nameModal.classList.add('hidden');
        socket.emit('setPlayerName', { name, room: currentRoom });
        
        // Initialize waiting timer
        waitingTimeLeft = 30;
        updateWaitingMessage();
        playerTurnSpan.classList.add('animate-pulse');
        
        // Update countdown every second
        waitingInterval = setInterval(() => {
            waitingTimeLeft--;
            updateWaitingMessage();
            if (waitingTimeLeft <= 0) {
                clearInterval(waitingInterval);
                waitingInterval = null;
            }
        }, 1000);
        
        // Set 1 minute timeout
        waitingTimeout = setTimeout(() => {
            log('Waiting timeout reached, returning to main menu');
            if (waitingInterval) {
                clearInterval(waitingInterval);
                waitingInterval = null;
            }
            alert('No player joined within 1 minute. Returning to main menu.');
            resetGame();
        }, 30 * 1000);
    }
});

// Initialize name from localStorage
const savedName = localStorage.getItem('playerName') || '';
if (savedName) {
    log(`Loaded saved player name: ${savedName}`);
    playerNameInput.value = savedName;
}

// Socket Events
socket.on('roomCreated', (roomId) => {
    log(`Room created: ${roomId}`);
    currentRoom = roomId;
    playerColor = 'player1';
    showGame(roomId);
});

socket.on('playerJoined', () => {
    log('Another player joined the room');
    roomCodeDisplay.classList.add('hidden');
    showNameModal();
});

socket.on('waitingTimeout', () => {
    log('Room timed out while waiting for players');
    alert('Game room timed out - no player joined within 1 minute.');
    resetGame();
});

socket.on('joinRoom', (roomId) => {
    log(`Joined room: ${roomId}`);
    currentRoom = roomId;
    playerColor = 'player2';
    showGame(roomId);
    showNameModal();
});

socket.on('gameStart', ({ player1, player2, names }) => {
    log(`Game starting - Player 1: ${names[0]}, Player 2: ${names[1]}`);
    // Clear waiting timeout and interval as game is starting
    if (waitingTimeout) {
        clearTimeout(waitingTimeout);
        waitingTimeout = null;
    }
    if (waitingInterval) {
        clearInterval(waitingInterval);
        waitingInterval = null;
    }
    
    menuDiv.style.display = 'none';
    gameContainer.classList.remove('hidden');
    gameContainer.style.display = 'block'; // Ensure container is visible
    roomCodeDisplay.classList.add('hidden');
    playerTurnSpan.classList.remove('animate-pulse'); // Remove pulse animation
    
    // Create new game instance
    if (game) {
        game.destroy(true);
        game = null;
        gameScene = null;
        graphics = null;
    }
    game = new Phaser.Game(config);
    
    isMyTurn = socket.id === player1;
    updateTurnDisplay(names);
});

function showNameModal() {
    log('Showing name input modal');
    nameModal.classList.remove('hidden');
    if (!playerNameInput.value) {
        playerNameInput.focus();
    }
}

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
    const isWinner = winnerId === socket.id;
    celebrate(isWinner);
    setTimeout(() => {
        showResult(isWinner);
    }, 1000);
});

socket.on('playerLeft', ({ message, disconnectedId }) => {
    log(`Player ${disconnectedId} left the game`);
    alert(message);
    resetGame();
});

socket.on('joinError', (message) => {
    log(`Join room error: ${message}`);
    alert(message);
});

function showGame(roomId) {
    log(`Showing game UI for room: ${roomId}`);
    menuDiv.style.display = 'none';
    gameContainer.classList.remove('hidden');
    if (playerColor === 'player1') {
        showRoomCode(roomId);
    }
}

function updateTurnDisplay(names) {
    playerTurnSpan.textContent = isMyTurn ? 'Your turn' : "Opponent's turn";
    playerNameDisplay.textContent = playerName;
}

function resetGame() {
    log('Resetting game state');
    // Clear waiting timeout and interval if they exist
    if (waitingTimeout) {
        clearTimeout(waitingTimeout);
        waitingTimeout = null;
    }
    if (waitingInterval) {
        clearInterval(waitingInterval);
        waitingInterval = null;
    }
    
    hideResult();
    board = Array(6).fill().map(() => Array(7).fill(null));
    discs.forEach(disc => disc.destroy());
    discs = [];
    
    // Properly destroy the Phaser game instance
    if (game) {
        game.destroy(true);
        game = null;
        gameScene = null;
        graphics = null;
    }
    
    // Reset UI elements
    menuDiv.style.display = 'block';
    gameContainer.style.display = 'none';
    roomCodeDisplay.classList.add('hidden');
    nameModal.classList.add('hidden');
    playerTurnSpan.classList.remove('animate-pulse');
    
    // Reset game state
    currentRoom = null;
    isMyTurn = false;
    playerColor = null;
    
    // Also notify server to cleanup the room if we're resetting due to timeout
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
    }
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
    graphics.fillStyle(0x0f172a);
    graphics.fillRect(10, 10, 700, 600);
    
    // Draw main board
    graphics.lineStyle(2, 0x1e293b);
    graphics.fillStyle(0x1e293b);
    graphics.fillRect(0, 0, 700, 600);
    
    // Draw cells with 3D effect
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            const x = col * CELL_SIZE;
            const y = row * CELL_SIZE;
            
            // Cell shadow
            graphics.fillStyle(0x0f172a);
            graphics.fillCircle(x + CELL_SIZE/2 + 3, y + CELL_SIZE/2 + 3, CELL_SIZE/2 - 5);
            
            // Main cell
            graphics.fillStyle(0x334155);
            graphics.fillCircle(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE/2 - 5);
            
            // Cell inner shadow
            graphics.lineStyle(2, 0x1e293b);
            graphics.strokeCircle(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE/2 - 8);
        }
    }
}

function dropDisc(row, column, color) {
    board[row][column] = color;
}

// Copy button functionality
copyButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(currentRoom);
        log(`Room code copied to clipboard: ${currentRoom}`);
        copyButton.classList.add('copied');
        setTimeout(() => copyButton.classList.remove('copied'), 2000);
    } catch (err) {
        log(`Error copying room code: ${err.message}`);
    }
});

// Add celebration animations
function celebrate(isWinner) {
    if (isWinner) {
        // Fire multiple confetti bursts
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
        }, 250);
    } else {
        // Create heartbreak effect
        const hearts = 15;
        const defaults = { startVelocity: 15, spread: 360, ticks: 60, zIndex: 0 };
        
        for (let i = 0; i < hearts; i++) {
            confetti({
                ...defaults,
                shapes: ['heart'],
                particleCount: 1,
                scalar: 2,
                origin: { x: Math.random(), y: Math.random() - 0.2 },
                colors: ['#ff0000']
            });
        }
    }
}

function showRoomCode(roomId) {
    log(`Displaying room code: ${roomId}`);
    roomCodeDisplay.classList.remove('hidden');
    roomCodeText.textContent = roomId;
    
    const closeOnClick = (e) => {
        if (e.target === roomCodeDisplay) {
            log('Room code display closed');
            roomCodeDisplay.classList.add('hidden');
            roomCodeDisplay.removeEventListener('click', closeOnClick);
        }
    };
    roomCodeDisplay.addEventListener('click', closeOnClick);
}

function showResult(isWinner) {
    log(`Showing game result - Winner: ${isWinner ? 'local player' : 'opponent'}`);
    resultPopup.classList.remove('hidden');
    
    if (isWinner) {
        resultEmoji.textContent = '🏆';
        resultText.textContent = 'You Won!';
        resultText.className = 'text-3xl font-bold mb-4 text-blue-500';
    } else {
        resultEmoji.textContent = '💔';
        resultText.textContent = 'You Lost!';
        resultText.className = 'text-3xl font-bold mb-4 text-red-500';
    }
    
    setTimeout(() => {
        resultContent.style.transform = 'scale(1)';
    }, 100);
}

function hideResult() {
    log('Hiding game result popup');
    resultContent.style.transform = 'scale(0)';
    setTimeout(() => {
        resultPopup.classList.add('hidden');
    }, 500);
}

// Add click outside to close
resultPopup.addEventListener('click', (e) => {
    if (e.target === resultPopup) {
        resetGame();
    }
});

// Function to create room item element
function createRoomElement(room) {
    const div = document.createElement('div');
    div.className = 'room-item bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center justify-between';
    div.dataset.roomId = room.id;
    
    const timeLeft = Math.max(0, 60 - Math.floor((Date.now() - room.createdAt) / 1000));
    
    div.innerHTML = `
        <div class="flex-1">
            <div class="flex items-center gap-3">
                <span class="text-blue-500 font-mono font-bold">#${room.id}</span>
                <span class="text-gray-400 text-sm">${timeLeft}s left</span>
            </div>
        </div>
        <button class="join-room-btn bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105"
                onclick="joinExistingRoom('${room.id}')">
            Join
        </button>
    `;
    
    return div;
}

// Function to update room list
function updateRoomsList(rooms) {
    log(`Updating rooms list UI with ${rooms.length} rooms`);
    const currentRooms = new Set(rooms.map(r => r.id));
    const existingRooms = new Set();
    
    // Remove rooms that no longer exist
    activeRoomsList.querySelectorAll('.room-item').forEach(el => {
        if (!currentRooms.has(el.dataset.roomId)) {
            log(`Removing expired room from UI: ${el.dataset.roomId}`);
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        } else {
            existingRooms.add(el.dataset.roomId);
        }
    });
    
    // Add new rooms
    rooms.forEach(room => {
        if (!existingRooms.has(room.id)) {
            log(`Adding new room to UI: ${room.id}`);
            const roomElement = createRoomElement(room);
            activeRoomsList.appendChild(roomElement);
        }
    });
    
    // Update timer for existing rooms
    rooms.forEach(room => {
        const roomElement = activeRoomsList.querySelector(`[data-room-id="${room.id}"]`);
        if (roomElement) {
            const timeLeft = Math.max(0, 60 - Math.floor((Date.now() - room.createdAt) / 1000));
            roomElement.querySelector('.text-gray-400').textContent = `${timeLeft}s left`;
        }
    });
    
    // Show/hide no rooms message
    noRoomsMessage.classList.toggle('hidden', rooms.length > 0);
}

// Function to join existing room
function joinExistingRoom(roomId) {
    log(`Joining existing room: ${roomId}`);
    socket.emit('joinRoom', roomId);
}

// Add socket event for active rooms
socket.on('activeRooms', (rooms) => {
    log(`Received active rooms update: ${rooms.length} rooms available`);
    updateRoomsList(rooms);
});

// Add socket event for room expiry
socket.on('roomExpired', () => {
    log('Room expired due to inactivity');
    resetGame();
    alert('Room expired due to inactivity');
});

// Start timer updates
setInterval(() => {
    activeRoomsList.querySelectorAll('.room-item').forEach(el => {
        const timeSpan = el.querySelector('.text-gray-400');
        const currentTime = parseInt(timeSpan.textContent);
        if (currentTime > 0) {
            timeSpan.textContent = `${currentTime - 1}s left`;
        }
    });
}, 1000);

// Add a beforeunload event listener to handle page closes/refreshes
window.addEventListener('beforeunload', () => {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
    }
}); 