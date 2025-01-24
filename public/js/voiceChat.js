class VoiceChat {
    constructor(socket) {
        this.socket = socket;
        this.peer = null;
        this.connection = null;
        this.stream = null;
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.gainNode = null;
        this.isTalking = false;
        this.isConnected = false;
        
        // UI Elements
        this.voiceChatStatus = document.getElementById('voiceChatStatus');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.toggleMicBtn = document.getElementById('toggleMic');
        this.micStatus = document.getElementById('micStatus');
        this.micIcon = document.getElementById('micIcon');
        this.micSpinner = document.getElementById('micSpinner');
        this.micOnIcon = document.getElementById('micOnIcon');
        this.micOffIcon = document.getElementById('micOffIcon');
        
        // Bind methods
        this.toggleMic = this.toggleMic.bind(this);
        this.handlePeerExchange = this.handlePeerExchange.bind(this);
        
        // Initialize event listeners
        this.toggleMicBtn.addEventListener('click', this.toggleMic);
        this.socket.on('peerIDsExchanged', this.handlePeerExchange);
    }
    
    async initialize(roomId, isCreator) {
        try {
            // Show loading state
            this.showLoadingState();
            
            // Cleanup any existing peer connection
            if (this.peer && !this.peer.destroyed) {
                this.peer.destroy();
            }
            
            // Initialize new peer
            this.peer = new Peer();
            
            // When peer is ready, send ID to server
            this.peer.on('open', (id) => {
                console.log('Peer connection opened:', id);
                this.socket.emit('peerID', { peerId: id, room: roomId });
            });
            
            // Get microphone access
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio context and gain node
            if (this.audioContext) {
                await this.audioContext.close();
            }
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
            this.gainNode = this.audioContext.createGain();
            this.mediaStreamSource.connect(this.gainNode);
            
            // Initially mute the audio
            this.gainNode.gain.value = 0;
            
            // Show voice chat status
            this.voiceChatStatus.classList.remove('hidden');
            
            // Handle errors
            this.peer.on('error', (error) => {
                console.error('Peer connection error:', error);
                this.showError();
            });
            
        } catch (error) {
            console.error('Error initializing voice chat:', error);
            this.showError();
        }
    }
    
    handlePeerExchange({ creator, joiner }) {
        const myPeerId = this.peer.id;
        const otherPeerId = myPeerId === creator ? joiner : creator;
        
        // Establish connection
        if (myPeerId === creator) {
            this.peer.on('connection', this.handleConnection.bind(this));
        } else {
            const conn = this.peer.connect(creator);
            this.handleConnection(conn);
        }
        
        // Set up call
        if (myPeerId === creator) {
            this.peer.on('call', (call) => {
                console.log('Receiving call');
                call.answer(this.stream);
                this.handleCall(call);
            });
        } else {
            const call = this.peer.call(creator, this.stream);
            this.handleCall(call);
        }
    }
    
    handleConnection(conn) {
        this.connection = conn;
        conn.on('open', () => {
            console.log('Data connection established');
            this.isConnected = true;
            this.showConnectedState();
        });
    }
    
    handleCall(call) {
        call.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            const audio = document.createElement('audio');
            
            // Set audio element properties
            audio.id = 'remoteAudio';
            audio.autoplay = true;
            audio.muted = true; // Start muted by default
            
            // Create audio track constraints
            const audioTrack = remoteStream.getAudioTracks()[0];
            if (audioTrack) {
                // Listen for mute/unmute events
                audioTrack.onmute = () => {
                    audio.muted = true;
                    console.log('Remote audio muted');
                };
                
                audioTrack.onunmute = () => {
                    audio.muted = false;
                    console.log('Remote audio unmuted');
                };
                
                // Set initial mute state
                audio.muted = audioTrack.muted;
            }
            
            audio.srcObject = remoteStream;
            audio.play().catch(console.error);
            
            // Store reference to audio element
            this.remoteAudio = audio;
        });
    }
    
    showLoadingState() {
        this.toggleMicBtn.disabled = true;
        this.voiceIndicator.classList.remove('bg-red-500', 'bg-green-500');
        this.voiceIndicator.classList.add('bg-gray-500');
        this.micStatus.textContent = 'Connecting...';
        this.micIcon.classList.add('hidden');
        this.micSpinner.classList.remove('hidden');
    }
    
    showConnectedState() {
        this.toggleMicBtn.disabled = false;
        this.micSpinner.classList.add('hidden');
        this.micIcon.classList.remove('hidden');
        this.updateMicUI(false);
    }
    
    showError() {
        this.toggleMicBtn.disabled = true;
        this.voiceIndicator.classList.remove('bg-gray-500', 'bg-green-500');
        this.voiceIndicator.classList.add('bg-red-500');
        this.micStatus.textContent = 'Connection Failed';
        this.micSpinner.classList.add('hidden');
    }
    
    toggleMic() {
        if (!this.isConnected) return;
        
        this.isTalking = !this.isTalking;
        
        // Toggle audio track enabled state
        if (this.stream) {
            const audioTrack = this.stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = this.isTalking;
            }
        }
        
        // Update gain node value
        this.gainNode.gain.value = this.isTalking ? 1 : 0;
        this.updateMicUI(this.isTalking);
    }
    
    updateMicUI(isOn) {
        if (isOn) {
            this.voiceIndicator.classList.remove('bg-red-500', 'bg-gray-500');
            this.voiceIndicator.classList.add('bg-green-500');
            this.micStatus.textContent = 'Mic On';
            this.micOnIcon.classList.remove('hidden');
            this.micOffIcon.classList.add('hidden');
        } else {
            this.voiceIndicator.classList.remove('bg-green-500', 'bg-gray-500');
            this.voiceIndicator.classList.add('bg-red-500');
            this.micStatus.textContent = 'Mic Off';
            this.micOnIcon.classList.add('hidden');
            this.micOffIcon.classList.remove('hidden');
        }
    }
    
    cleanup() {
        console.log('Cleaning up voice chat');
        // Remove event listeners
        this.toggleMicBtn.removeEventListener('click', this.toggleMic);
        this.socket.off('peerIDsExchanged', this.handlePeerExchange);
        
        // Clean up voice chat resources
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
            this.peer = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.connection = null;
        this.mediaStreamSource = null;
        this.gainNode = null;
        this.isTalking = false;
        this.isConnected = false;
        
        // Hide voice chat status
        this.voiceChatStatus.classList.add('hidden');
    }
}

// Export the class
window.VoiceChat = VoiceChat; 