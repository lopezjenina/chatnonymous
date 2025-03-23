import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import './App.css';

function App() {
  const [page, setPage] = useState('home');
  const [interests, setInterests] = useState('');
  const [location, setLocation] = useState('');
  const [username, setUsername] = useState('');
  const [partnerUsername, setPartnerUsername] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [searching, setSearching] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Server status state
  const [serverAwake, setServerAwake] = useState(true);
  
  // Typing indicator state
  const [isTyping, setIsTyping] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  
  // Sound refs
  const messageSound = useRef(new Audio('/sounds/message.wav'));
  const connectedSound = useRef(new Audio('/sounds/connected.wav'));
  
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
      'moldy', 'crusty', 'musty', 'greasy', 'dusty', 'soggy', 'busted',
      'funky', 'flimsy', 'lumpy', 'crustaceous', 'floppy', 'wonky', 'gassy',
      'stanky', 'rancid', 'wobbly', 'droopy', 'grimy', 'broke'
    ];
    
    const nouns = [
      'sock', 'nugget', 'dumpster', 'gremlin', 'toenail', 'cabbage', 'pigeon',
      'waffle', 'troll', 'sponge', 'cheeseball', 'noodle', 'trashcan', 'mop',
      'meatball', 'dustpan', 'fungus', 'goblin', 'potato', 'fartcloud'
    ];    
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 100);
    
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  };
  
  // Get user's location
  const getUserLocation = () => {
    setGettingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            
            // Use city if available, otherwise use country
            const userLocation = data.city || data.countryName || '';
            setLocation(userLocation);
            setGettingLocation(false);
          } catch (error) {
            console.error('Error getting location name:', error);
            setGettingLocation(false);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setGettingLocation(false);
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
      setGettingLocation(false);
    }
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

  // Function to wake up the server
  const wakeUpServer = () => {
    setServerAwake(false); // Set to false while attempting to wake up
    fetch('https://chatnonymous-5pt7.onrender.com/status')
      .then(res => res.json())
      .then(data => {
        setServerAwake(true);
        console.log('Server is now awake:', data);
      })
      .catch(err => {
        console.error('Failed to wake up server:', err);
        // Try again after a delay
        setTimeout(() => {
          fetch('https://chatnonymous-5pt7.onrender.com/status')
            .then(res => res.json())
            .then(data => {
              setServerAwake(true);
              console.log('Server is now awake (second attempt):', data);
            })
            .catch(err => {
              console.error('Failed to wake up server (second attempt):', err);
            });
        }, 5000);
      });
  };

  // Check if the server is awake
  useEffect(() => {
    fetch('https://chatnonymous-5pt7.onrender.com/status')
      .then(res => res.json())
      .then(data => {
        setServerAwake(true);
        console.log('Server is awake:', data);
      })
      .catch(err => {
        setServerAwake(false);
        console.error('Server might be sleeping:', err);
      });
  }, []);

  // Connect to socket server when entering chat page
  useEffect(() => {
    if (page === 'chat') {
      console.log("Connecting to socket server...");
      socketRef.current = io('https://chatnonymous-5pt7.onrender.com');
      
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
        const timestamp = data.timestamp && !isNaN(new Date(data.timestamp).getTime())
          ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [...prev, { 
          text: data.message, 
          fromSelf: false, 
          username: data.username,
          timestamp: timestamp
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
  }, [page, interests, location, username]);
  
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
    setShowOptions(false);
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
          <p className="App-subheading">Connect instantly with random people around the world!</p>
          {!serverAwake && (
            <div className="server-status pixel-border">
              <p>Server appears to be sleeping. Please wait a moment or click to wake it up.</p>
              <button className="pixel-button" onClick={wakeUpServer}>Wake Up Server</button>
            </div>
          )}
          
          <div className="form pixel-border">
            <div className="main-actions">
              <button 
                className="pixel-button primary-button" 
                onClick={startChat}
                disabled={!serverAwake}
              >
                Start Chatting
              </button>
              
              <button 
                className="pixel-button secondary-button" 
                onClick={() => setShowOptions(!showOptions)}
              >
                {showOptions ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>
            
            {showOptions && (
              <div className="options-container">
                <div className="form-group">
                  <label><b>Interests</b></label>
                  <input 
                    type="text" 
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="music, travel, gaming, etc."
                  />
                </div>
                
                <div className="form-group location-group">
                  <label><b>Location</b></label>
                  <div className="location-input">
                    <input 
                      type="text" 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="city or country"
                      disabled={gettingLocation}
                    />
                    <button 
                      className="location-button pixel-button"
                      onClick={getUserLocation}
                      disabled={gettingLocation}
                    >
                      {gettingLocation ? <i className='fa fa-spinner fa-spin'></i> : <i className="fa fa-map-marker"></i>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="donate-link">
            <p>
              Support. <a href="https://www.buymeacoffee.com/httpsjen" target="_blank" rel="noopener noreferrer">Buy me a coffee!</a>
            </p>
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
            <p className="username-display">@{username}</p>
          </div>
          
          {!serverAwake && (
            <div className="server-status">
              <p>Server appears to be sleeping. Please wait a moment or click to wake it up.</p>
              <button className="pixel-button" onClick={wakeUpServer}>Wake Up Server</button>
            </div>
          )}
          
          {searching ? (
            <div className="searching-container">
              <p>Looking for someone to chat with...</p>
              <p className="small-text">
                <b>Your username: </b>{username}<br />
                {interests && <><b>Interests: </b>{interests}<br /></>}
                {location && <><b>Location: </b>{location}<br /></>}
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
              <div className="donate-link">
            <p>
              Support. <a href="https://www.buymeacoffee.com/httpsjen" target="_blank" rel="noopener noreferrer">Buy me a coffee!</a>
            </p>
          </div>
            </>
            
          )}
        </div>
      </div>
    );
  }
}

export default App;
