const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isBlockedEitherWay } = require("./blockHelpers");

let io = null;
// userId (string) -> Set of socket.id - ek user ek se zyada tab/device khol sakta hai
const onlineUsers = new Map();
// conversationId (group call room) -> Map<userId, {name, avatar}> jo abhi call me maujood hain
const activeGroupCalls = new Map();

// server.js se ek hi baar call hota hai jab HTTP server ban jata hai
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || "*" },
  });

  // Har socket connection pe JWT verify karna - login wale token se hi connect ho sakta hai
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not authorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id name avatar");
      if (!user) return next(new Error("User no longer exists"));

      socket.userId = String(user._id);
      socket.userName = user.name;
      socket.userAvatar = user.avatar;
      next();
    } catch (err) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    // Har user apne khud ke "room" me hota hai - notifications/messages usi room ko bheji jati hain
    socket.join(`user:${userId}`);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    io.emit("userOnline", { userId });

    // Messages page khuli ho to "typing..." dikhane ke liye chat room join karna
    socket.on("joinConversation", (conversationId) => {
      if (conversationId) socket.join(`conv:${conversationId}`);
    });
    socket.on("leaveConversation", (conversationId) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });
    socket.on("typing", ({ conversationId }) => {
      if (conversationId) socket.to(`conv:${conversationId}`).emit("typing", { conversationId, userId });
    });
    socket.on("stopTyping", ({ conversationId }) => {
      if (conversationId) socket.to(`conv:${conversationId}`).emit("stopTyping", { conversationId, userId });
    });

    /* =========================================================
       1-TO-1 VOICE / VIDEO CALL SIGNALING (WebRTC) - server sirf
       messages relay karta hai, actual audio/video seedha browsers
       ke beech peer-to-peer jata hai
       ========================================================= */

    socket.on("callUser", async ({ to, offer, callType, conversationId }) => {
      if (!to || !offer) return;
      if (await isBlockedEitherWay(userId, to)) return; // block ho to call bhi nahi ja sakti
      socket.activeCallWith = String(to); // disconnect ke waqt doosre ko batane ke liye
      io.to(`user:${to}`).emit("incomingCall", {
        from: userId,
        offer,
        callType,
        conversationId,
        callerName: socket.userName,
        callerAvatar: socket.userAvatar,
      });
    });

    socket.on("answerCall", ({ to, answer }) => {
      if (!to || !answer) return;
      socket.activeCallWith = String(to);
      io.to(`user:${to}`).emit("callAnswered", { from: userId, answer });
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
      if (!to || !candidate) return;
      io.to(`user:${to}`).emit("iceCandidate", { from: userId, candidate });
    });

    socket.on("rejectCall", ({ to }) => {
      if (!to) return;
      io.to(`user:${to}`).emit("callRejected", { from: userId });
    });

    socket.on("endCall", ({ to }) => {
      socket.activeCallWith = null;
      if (!to) return;
      io.to(`user:${to}`).emit("callEnded", { from: userId });
    });

    /* =========================================================
       GROUP CALL SIGNALING - full-mesh WebRTC (har participant
       baqi sab participants se seedha connect hota hai). Server
       sirf "kaun room me hai" track karta hai aur offers/answers/
       ICE candidates ko sahi banday tak relay karta hai.
       ========================================================= */

    // Group call shuru karna - conversation ke baqi online members ko ring karta hai
    socket.on("startGroupCall", ({ conversationId, callType, participantIds }) => {
      if (!conversationId || !Array.isArray(participantIds)) return;

      if (!activeGroupCalls.has(conversationId)) activeGroupCalls.set(conversationId, new Map());
      activeGroupCalls.get(conversationId).set(userId, { name: socket.userName, avatar: socket.userAvatar });
      socket.join(`groupcall:${conversationId}`);
      socket.activeGroupCallId = conversationId;

      participantIds
        .filter((pid) => pid !== userId)
        .forEach((pid) => {
          io.to(`user:${pid}`).emit("incomingGroupCall", {
            from: userId,
            callerName: socket.userName,
            callerAvatar: socket.userAvatar,
            conversationId,
            callType,
          });
        });
    });

    // Kisi ne group call join karne se pehle decline kar diya (sirf unke liye ring band ho jati hai)
    socket.on("declineGroupCall", ({ conversationId }) => {
      // Koi room-state change nahi - bas caller ko koi extra event ki zaroorat nahi,
      // wo khud dusre logon ke join hone ka wait karta rehta hai
    });

    // Koi group call join karta hai - usay batate hain kaun kaun pehle se maujood hai,
    // aur pehle walon ko batate hain ke koi naya aya hai
    socket.on("joinGroupCall", ({ conversationId }) => {
      if (!conversationId) return;

      const room = activeGroupCalls.get(conversationId) || new Map();
      const existingParticipants = [...room.entries()]
        .filter(([id]) => id !== userId)
        .map(([id, info]) => ({ userId: id, userName: info.name, userAvatar: info.avatar }));

      room.set(userId, { name: socket.userName, avatar: socket.userAvatar });
      activeGroupCalls.set(conversationId, room);
      socket.join(`groupcall:${conversationId}`);
      socket.activeGroupCallId = conversationId;

      socket.emit("groupCallParticipants", {
        conversationId,
        participants: existingParticipants,
      });

      socket.to(`groupcall:${conversationId}`).emit("userJoinedGroupCall", {
        conversationId,
        userId,
        userName: socket.userName,
        userAvatar: socket.userAvatar,
      });
    });

    // Mesh connections banane ke liye offer/answer/ICE - har pair ke beech alag se
    socket.on("groupCallOffer", ({ to, offer, conversationId }) => {
      if (!to || !offer) return;
      io.to(`user:${to}`).emit("groupCallOffer", {
        from: userId,
        offer,
        conversationId,
        userName: socket.userName,
        userAvatar: socket.userAvatar,
      });
    });
    socket.on("groupCallAnswer", ({ to, answer }) => {
      if (!to || !answer) return;
      io.to(`user:${to}`).emit("groupCallAnswer", { from: userId, answer });
    });
    socket.on("groupCallIce", ({ to, candidate }) => {
      if (!to || !candidate) return;
      io.to(`user:${to}`).emit("groupCallIce", { from: userId, candidate });
    });

    socket.on("leaveGroupCall", ({ conversationId }) => {
      leaveGroupCallRoom(socket, conversationId);
    });

    socket.on("disconnect", () => {
      // Agar user 1-to-1 call ke beech me hi disconnect ho gaya to doosre ko turant bata dena
      if (socket.activeCallWith) {
        io.to(`user:${socket.activeCallWith}`).emit("callEnded", { from: userId });
      }
      // Agar group call me tha to bhi room se sahi tarike se nikal dena
      if (socket.activeGroupCallId) {
        leaveGroupCallRoom(socket, socket.activeGroupCallId);
      }

      const set = onlineUsers.get(userId);
      if (!set) return;
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(userId);
        io.emit("userOffline", { userId });
      }
    });

    function leaveGroupCallRoom(socket, conversationId) {
      if (!conversationId) return;
      const room = activeGroupCalls.get(conversationId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) activeGroupCalls.delete(conversationId);
      }
      socket.leave(`groupcall:${conversationId}`);
      socket.activeGroupCallId = null;
      socket.to(`groupcall:${conversationId}`).emit("userLeftGroupCall", { conversationId, userId });
    }
  });
}

// Baqi controllers is function se kisi bhi user ko real-time event bhej saktay hain
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

module.exports = { initSocket, emitToUser, isUserOnline };
