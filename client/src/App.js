import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import './App.css';

function App() {
  const [page, setPage] = useState('home');
  const [interests, setInterests] = useState('');
  const [location, setLocation] = useState('');
  const [username, setUsername] = useState('');
  const [partnerUsername, setPartnerUsername] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [searching, setSearching] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Typing indicator state
  const [isTyping, setIsTyping] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  
  // Sound refs
  const messageSound = useRef(new Audio('/sounds/message.mp3'));
  const connectedSound = useRef(new Audio('/sounds/connected.mp3'));
  
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const partnerUsernameRef = useRef('');
  // Update the ref when partnerUsername changes
useEffect(() => {
  partnerUsernameRef.current = partnerUsername;
}, [partnerUsername]);

  
  // Random username generator
  const generateRandomUsername = () => {
    const adjectives = [
      'Happy', 'Sleepy', 'Grumpy', 'Sneezy', 'Dopey', 'Bashful', 'Doc',
      'Witty', 'Clever', 'Swift', 'Brave', 'Mighty', 'Noble', 'Gentle',
      'Wise', 'Calm', 'Eager', 'Jolly', 'Lively', 'Mysterious'
    ];
    
    const nouns = [
      'Panda', 'Tiger', 'Dolphin', 'Eagle', 'Wolf', 'Fox', 'Rabbit',
      'Dragon', 'Phoenix', 'Unicorn', 'Knight', 'Wizard', 'Ninja', 'Pirate',
      'Explorer', 'Astronaut', 'Voyager', 'Pioneer', 'Wanderer', 'Nomad'
    ];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 100);
    
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  };
  
  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    if (messagesEndRef.current) {
      scrollToBottom();
    }
  }, [messages]);
  
  // In server.js
const io = new Server(server, {
  cors: {
    // Replace with your frontend URL when deployed
    origin: ["http://localhost:3000", "https://your-frontend-domain.com"],
    methods: ['GET', 'POST']
  }
});

  // Connect to socket server when entering chat page
  useEffect(() => {
    if (page === 'chat') {
      console.log("Connecting to socket server...");
      socketRef.current = io(process.env.REACT_APP_SOCKET_SERVER);
      
      // Send user preferences for matching
      socketRef.current.emit('find_match', { interests, location, username });
      
      // Listen for match found
      socketRef.current.on('match_found', (data) => {
        console.log("Match found with partner:", data.partnerId);
        setPartnerId(data.partnerId);
        setPartnerUsername(data.partnerUsername || 'Anonymous');
        setSearching(false);
        setConnected(true);
        setMessages([{ 
          text: `You are now connected with ${data.partnerUsername || 'an anonymous chatter'}. Say hello!`, 
          system: true 
        }]);
        connectedSound.current.play().catch(e => console.log('Error playing sound:', e));
      });
      
      // Listen for incoming messages
      socketRef.current.on('receive_message', (data) => {
        console.log("Received message:", data.message);
        setMessages((prev) => [...prev, { 
          text: data.message, 
          fromSelf: false, 
          username: data.username,
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        messageSound.current.play().catch(e => console.log('Error playing sound:', e));
      });
      
      // Listen for partner disconnect
socketRef.current.on('partner_disconnected', () => {
  console.log("Partner disconnected");
  setConnected(false);
  setPartnerIsTyping(false);
  setMessages((prev) => {
    const disconnectMessage = { 
      text: `${partnerUsernameRef.current} has disconnected.`, 
      system: true 
    };
    return [...prev, disconnectMessage];
  });
});

      
      // Listen for typing indicator
      socketRef.current.on('typing', () => {
        setPartnerIsTyping(true);
      });
      
      // Listen for stopped typing
      socketRef.current.on('stop_typing', () => {
        setPartnerIsTyping(false);
      });
      
      return () => {
        console.log("Disconnecting socket");
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [page, interests, location, username]); // Removed partnerUsername from dependencies
  
  const startChat = () => {
    console.log('Starting chat with:', interests, location);
    const newUsername = generateRandomUsername();
    setUsername(newUsername);
    setPage('chat');
  };
  
  const goBack = () => {
    setPage('home');
    setMessages([]);
    setConnected(false);
    setSearching(true);
    setPartnerId(null);
    setPartnerIsTyping(false);
    setPartnerUsername('');
  };
  
  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    // Handle typing indicator
    if (!isTyping && connected) {
      setIsTyping(true);
      socketRef.current.emit('typing', { to: partnerId });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (connected) {
        socketRef.current.emit('stop_typing', { to: partnerId });
      }
    }, 1000);
  };
  
  const sendMessage = () => {
    if (message.trim() && connected) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      console.log("Sending message to:", partnerId, "message:", message);
      socketRef.current.emit('send_message', { 
        to: partnerId, 
        message: message.trim(),
        username: username
      });
      
      setMessages((prev) => [...prev, { 
        text: message, 
        fromSelf: true,
        username: username,
        timestamp: timestamp
      }]);
      setMessage('');
    }
  };
  
  const findNewMatch = () => {
    console.log("Finding new match");
    const newUsername = generateRandomUsername();
    setUsername(newUsername);
    setMessages([]);
    setSearching(true);
    setConnected(false);
    setPartnerIsTyping(false);
    setPartnerUsername('');
    socketRef.current.emit('find_match', { interests, location, username: newUsername });
  };
  
  const onEmojiClick = (emojiObject) => {
    setMessage(prevMessage => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false);
  };
  
  if (page === 'home') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>CHATNONYMOUS</h1>
          <div className="form pixel-border">
            <div className="form-group">
              <label><b>Interest</b></label>
              <input 
                type="text" 
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="music, travel, gaming, etc."
              />
            </div>
            <div className="form-group">
              <label><b>Location</b></label>
              <input 
                type="text" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="city or country"
              />
            </div>
            <button className="pixel-button" onClick={startChat}>Chat Anonymously</button>
          </div>
        </header>
      </div>
    );
  } else {
    return (
      <div className="App">
        <div className="chat-container">
          <div className="chat-header">
            <button className="pixel-button" onClick={goBack}>Back</button>
            <h2>CHATNONYMOUS</h2>
            <button className="pixel-button" onClick={findNewMatch}>New Chat</button>
          </div>
          
          {searching ? (
            <div className="searching-container">
              <p>Looking for someone to chat with...</p>
              <p className="small-text">
                <b>Your username: </b>{username}<br />
                <b>Interests: </b>{interests || 'None'}<br />
                <b>Location: </b>{location || 'Any'}
              </p>
            </div>
          ) : (
            <>
              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`message ${
                      msg.system 
                        ? 'message-system' 
                        : msg.fromSelf 
                          ? 'message-self' 
                          : 'message-other'
                    }`}
                  >
                    {!msg.system && (
                      <div className="message-header">
                        <span className="message-username">
                          {msg.fromSelf ? 'You ' : partnerUsername + ' '}
                        </span>
                        <span className="message-timestamp">{msg.timestamp}</span>
                      </div>
                    )}
                    <div className="message-text">{msg.text}</div>
                  </div>
                ))}
                {partnerIsTyping && (
                  <div className="typing-indicator">
                    <span>{partnerUsername} is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="input-container">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={message}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={!connected}
                />
                <button 
                  className="pixel-button"
                  onClick={sendMessage}
                  disabled={!connected}
                >
                  Send
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker-container">
                    <EmojiPicker onEmojiClick={onEmojiClick} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

export default App;
