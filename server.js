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

var masterSelected = false;
var master = null;

//on new connection
io.sockets.on('connection', function (socket) {

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
   broadcastMasterStatus();

   // when the user disconnects.. perform this
   socket.on('disconnect', function(){
      if (socket == master) {
         clearMaster();
      }
   });
});