// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));
app.use(express.methodOverride());

// Chatroom

// usernames which are currently connected to the chat
var usernames = {},
    numUsers = 0,
    rooms = [];

io.on('connection', function (socket) {
  var addedUser = false;

  socket.on('enter room',function(data){
    socket.join(data.room);

    socket.username = data.username;
    socket.set('room', data.room, function() {

      var room = data.room;

      // Create Room
      if (rooms[room] == undefined) {
        console.log('room create :' + room);
        rooms[room] = new Object();
        rooms[room].socket_ids = new Object();
      }

      // Store current user's nickname and socket.id to MAP
      rooms[room].socket_ids[data.username] = socket.id;
    });

    // add the client's username to the global list
    usernames[data.username] = data.username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {

    // we tell the client to execute 'new message'
    socket.get('room',function(err, room) {
      socket.broadcast.to(room).emit('new message', {
        username: socket.username,
        message: data
      });
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.get('room',function(err, room) {
      socket.broadcast.to(room).emit('typing', {
        username: socket.username
      });
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.get('room',function(err, room) {
      socket.broadcast.to(room).emit('stop typing', {
        username: socket.username
      });
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    socket.get('room',function(err,room) {
      if (err) throw err;
      if (room != undefined && rooms[room] != undefined && addedUser) {
        delete usernames[socket.username];
        delete rooms[room].socket_ids[socket.username];
        --numUsers;

        // echo globally that this client has left
        socket.broadcast.to(room).emit('user left', {
          username: socket.username,
          numUsers: numUsers
        });
      }
    });
  });
});
