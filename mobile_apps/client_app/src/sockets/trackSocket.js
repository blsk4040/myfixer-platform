// src/sockets/trackSocket.js
const socketIO = require('socket.io');

function initializeTrackingSockets(server) {
  // Bind Socket.io engine to your existing Express HTTP server instance
  const io = socketIO(server, {
    cors: {
      origin: "*", // Configure explicitly matching your network ingress parameters
      methods: ["GET", "POST"]
    }
  });

  console.log('⚡ Real-Time Service Dispatch Socket Pipeline Initialized');

  io.on('connection', (socket) => {
    console.log(`🔌 Node Connection established on worker thread: ${socket.id}`);

    // Event A: Client or Technician joins a dedicated telemetry session room
    socket.on('join_job_room', ({ jobId, role }) => {
      const roomName = `job_room_${jobId}`;
      socket.join(roomName);
      console.log(`📡 Identity tagged as [${role}] joined live stream conduit: ${roomName}`);
    });

    // Event B: Intercept incoming GPS telemetry metrics from moving technicians
    socket.on('technician_telemetry_emit', ({ jobId, latitude, longitude, heading, speed }) => {
      const roomName = `job_room_${jobId}`;
      
      const broadcastPayload = {
        latitude,
        longitude,
        heading,
        speed,
        updatedAt: new Date().toISOString()
      };

      // 🚀 Broadcast payload immediately to all other sockets (the clients) in that room
      socket.to(roomName).emit('job_location_changed', broadcastPayload);
      
      console.log(`📍 Route Vector Re-routed for ${jobId}: Lat ${latitude} | Lon ${longitude}`);
    });

    // Event C: Handle abrupt device disconnections gracefully
    socket.on('disconnect', () => {
      console.log(`🔌 Node disconnected from platform pipe matrix: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { initializeTrackingSockets };