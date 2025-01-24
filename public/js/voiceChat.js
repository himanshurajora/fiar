class VoiceChat {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.stream = null;
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.gainNode = null;
        this.isTalking = false;
        this.voiceChatStatus = document.getElementById('voiceChatStatus');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        
        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        // Initialize event listeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }
    
    async initialize(roomId, isCreator) {
        try {
            // Initialize peer with a random ID based on room and role
            this.peer = new Peer(`${roomId}-${isCreator ? 'creator' : 'joiner'}`);
            
            // Get microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio context and gain node
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
            this.gainNode = this.audioContext.createGain();
            this.mediaStreamSource.connect(this.gainNode);
            
            // Initially mute the audio
            this.gainNode.gain.value = 0;
            
            if (isCreator) {
                // Room creator waits for connection
                this.peer.on('connection', (conn) => this.handleConnection(conn));
            } else {
                // Joiner initiates connection
                this.connection = this.peer.connect(`${roomId}-creator`);
                this.handleConnection(this.connection);
            }
            
            // Show voice chat status
            this.voiceChatStatus.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error initializing voice chat:', error);
        }
    }
    
    handleConnection(conn) {
        this.connection = conn;
        
        conn.on('open', () => {
            // Set up call after data connection is established
            if (!this.peer.destroyed) {
                if (conn.peer > this.peer.id) {
                    const call = this.peer.call(conn.peer, this.stream);
                    this.handleCall(call);
                }
            }
        });
        
        this.peer.on('call', (call) => {
            call.answer(this.stream);
            this.handleCall(call);
        });
    }
    
    handleCall(call) {
        call.on('stream', (remoteStream) => {
            // Create audio element for remote stream
            const audio = document.createElement('audio');
            audio.srcObject = remoteStream;
            audio.play();
        });
    }
    
    handleKeyDown(event) {
        if (event.code === 'Space' && !event.repeat && !this.isTalking) {
            this.isTalking = true;
            this.gainNode.gain.value = 1;
            this.voiceIndicator.classList.remove('bg-red-500');
            this.voiceIndicator.classList.add('bg-green-500');
        }
    }
    
    handleKeyUp(event) {
        if (event.code === 'Space' && this.isTalking) {
            this.isTalking = false;
            this.gainNode.gain.value = 0;
            this.voiceIndicator.classList.remove('bg-green-500');
            this.voiceIndicator.classList.add('bg-red-500');
        }
    }
    
    cleanup() {
        // Clean up voice chat resources
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        // Hide voice chat status
        this.voiceChatStatus.classList.add('hidden');
        
        // Reset properties
        this.peer = null;
        this.connection = null;
        this.stream = null;
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.gainNode = null;
        this.isTalking = false;
    }
}

// Export the class
window.VoiceChat = VoiceChat; 