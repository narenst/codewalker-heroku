var app = require('express').createServer()
var io = require('socket.io').listen(app);

//For heroku, it selects port number on deploy.
var port = process.env.PORT || 9000;
app.listen(port);

console.log("STARTING PORT NUMBER : " + port);

//So that the plugin can use sockets without getting blocked by the browser
app.all('/*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

var masterSelected = {};

var master = {};
var totalParticipants = {};
var socketToRoomMap = {};

function sendSuccess(socket, operation) {
   console.log("sending success to : " + socket.id + " for operation : " + operation);
   socket.emit('success', operation);
}

function sendFailure(socket, operation, reason) {
   console.log("sending failure to : " + socket.id + " for operation : " + operation);
   socket.emit('failure', operation, reason);
}

function sendMasterUpdate(roomId) {
   console.log("sending master update for room : " + roomId);
   ret = {};
   ret["participants"] = totalParticipants.hasOwnProperty(roomId)?
                           totalParticipants[roomId]:
                           0;
   ret["isMasterSelected"] = master.hasOwnProperty(roomId);

   console.log("participants : " + ret["participants"] + 
                  ", isMasterSelected : " + ret["isMasterSelected"]);
   io.sockets.in(roomId).emit('masterUpdate', JSON.stringify(ret));
}

function addParticipant(roomId) {
   if(totalParticipants.hasOwnProperty(roomId)) {
      totalParticipants[roomId] += 1;
   } else {
      totalParticipants[roomId] = 1;
   }
}

function removeParticipant(roomId) {
   if(totalParticipants.hasOwnProperty(roomId)) {
      totalParticipants[roomId] -= 1;
   }
}

function joinRoom(socket, roomId) {
   if (socketToRoomMap.hasOwnProperty(socket.id)) {
      sendFailure(socket, "join", "already part of a room : " + 
                     socketToRoomMap[socket.id]);
      return;
   }
   socketToRoomMap[socket.id] = roomId;
   socket.join(roomId);
   sendSuccess(socket, "join");
   addParticipant(roomId);
   sendMasterUpdate(roomId);
}

function leaveRoom(socket) {
   if (!socketToRoomMap.hasOwnProperty(socket.id)) {
      sendFailure(socket, "leave", "has not joined any room before");
   } else {
      roomId = socketToRoomMap[socket.id];
      delete socketToRoomMap[socket.id];

      //clear master if this socket was the master
      if(master.hasOwnProperty(roomId) &&
         master[roomId] == socket) {
         delete master[roomId];
      }
      socket.leave(roomId);
      sendSuccess(socket, "leave");
      removeParticipant(roomId);
      sendMasterUpdate(roomId);
   }
}

//on new connection
io.sockets.on('connection', function (socket) {

   sendSuccess(socket, "connect");

   //when socket joins a room
   socket.on('join', function (roomId) {
      console.log("received join from client for room : " + roomId);
      joinRoom(socket, roomId);
   });

   //when socket joins a room
   socket.on('leave', function () {
      console.log("received leave room from client");
      leaveRoom(socket);
   });


   // when the master sends 'sendupdate', this listens and executes
   socket.on('sendupdate', function (data) {
      console.log("received update from client : " + data);
      io.sockets.emit('update', "master", data);
   });

   //the master is selected
   socket.on('selectMaster', function (data) {
      console.log("received selectMaster : " + data);
      if (!masterSelected) {
         setMaster(socket);
      }
   });

   socket.on('clearMaster', function (data) {
      console.log("received clearMaster : " + data);
      if (masterSelected) {
         clearMaster();
      }
   });

   function broadcastMasterStatus() {
      console.log("broadcasting masterSelected : " + masterSelected);
      io.sockets.emit('masterSelected', masterSelected);
   }

   function setMaster(socket) {
      masterSelected = true;
      master = socket;
      broadcastMasterStatus();
   }

   function clearMaster() {
      master = null;
      masterSelected = false;
      broadcastMasterStatus();
   }   

   //new client joined
   //broadcastMasterStatus();

   // when the user disconnects.. perform this
   socket.on('disconnect', function(){
      if (socketToRoomMap.hasOwnProperty(socket)) {
         leaveRoom(socket);
      }
   });
});