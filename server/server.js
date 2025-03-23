const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');


const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.get('/', (req, res) => {
  res.send('Anonymous Chat Server is running. Connect with a Socket.io client.');
});


app.get('/status', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'online',
    waitingUsers: waitingUsers.length,
    activePairs: Object.keys(activePairs).length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});


const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Store active users waiting for a match
const waitingUsers = [];
// Store active chat pairs
const activePairs = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Handle find match request
  socket.on('find_match', (data) => {
    const { interests, location, username } = data;
    
    // Remove user from any existing pairs
    for (const [pairId, pair] of activePairs.entries()) {
      if (pair.user1 === socket.id || pair.user2 === socket.id) {
        const partnerId = pair.user1 === socket.id ? pair.user2 : pair.user1;
        io.to(partnerId).emit('partner_disconnected');
        activePairs.delete(pairId);
        break;
      }
    }
    
    // Remove from waiting list if already there
    const waitingIndex = waitingUsers.findIndex(user => user.id === socket.id);
    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }
    
    // Convert interests to array and trim whitespace
    const userInterests = interests
      ? interests.split(',').map(tag => tag.trim().toLowerCase())
      : [];
    
    // Find a matching user
    const matchIndex = waitingUsers.findIndex(user => {
      // Don't match with self (shouldn't happen, but just in case)
      if (user.id === socket.id) {
        return false;
      }
      
      // If location is specified, try to match it
      if (location && user.location) {
        if (user.location.toLowerCase() !== location.toLowerCase()) {
          return false;
        }
      }
      
      // If interests are specified, try to find at least one common interest
      if (userInterests.length > 0 && user.interests.length > 0) {
        return userInterests.some(interest => 
          user.interests.includes(interest)
        );
      }
      
      // If no specific criteria, match with anyone
      return true;
    });
    
    if (matchIndex !== -1) {
      // Match found
      const match = waitingUsers.splice(matchIndex, 1)[0];
      
      // Create a pair
      const pairId = `${socket.id}-${match.id}`;
      activePairs.set(pairId, {
        user1: socket.id,
        user2: match.id
      });
      
      console.log(`Matched ${socket.id} with ${match.id}`);
      
      // Notify both users with usernames
      io.to(socket.id).emit('match_found', { 
        partnerId: match.id,
        partnerUsername: match.username 
      });
      io.to(match.id).emit('match_found', { 
        partnerId: socket.id,
        partnerUsername: username || 'Anonymous'
      });
    } else {
      // No match, add to waiting list
      waitingUsers.push({
        id: socket.id,
        interests: userInterests,
        location: location ? location.toLowerCase() : null,
        username: username || 'Anonymous'
      });
      
      console.log(`Added ${socket.id} to waiting list. Total waiting: ${waitingUsers.length}`);
    }
  });
  
  // Handle message sending
  socket.on('send_message', (data) => {
    const { to, message, username } = data;
    // Only send to the recipient, not back to the sender
    socket.to(to).emit('receive_message', { 
      message,
      username: username || 'Anonymous',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    console.log(`Message from ${socket.id} to ${to}: ${message}`);
  });
  
  // Handle typing indicators
  socket.on('typing', (data) => {
    const { to } = data;
    socket.to(to).emit('typing');
  });
  
  socket.on('stop_typing', (data) => {
    const { to } = data;
    socket.to(to).emit('stop_typing');
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove from waiting list
    const waitingIndex = waitingUsers.findIndex(user => user.id === socket.id);
    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }
    
    // Notify partner if in active chat
    for (const [pairId, pair] of activePairs.entries()) {
      if (pair.user1 === socket.id || pair.user2 === socket.id) {
        const partnerId = pair.user1 === socket.id ? pair.user2 : pair.user1;
        io.to(partnerId).emit('partner_disconnected');
        activePairs.delete(pairId);
        console.log(`Removed chat pair ${pairId} due to disconnection`);
        break;
      }
    }
  });
});
