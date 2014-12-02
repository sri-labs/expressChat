// Setup basic express server 
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

function decorateMsg(msg, socket) {
    message = msg
    re = /^\/([a-z]+) +(.+?)$/i;
    matches =  (re.exec(msg));
    if (!matches || matches.length < 2) {

    }
    else {
        command = matches[1];
        console.log(command);
        switch (command) {
            case 'nick':
                oldname = socket.username;
                newname = matches[2];
                socket.username = newname;
                // add the client's username to the global list
                //usernames[newname] = newname;
                message = oldname + ' nickname changed ' + newname;
                io.to(socket.room).emit('notice', {
                  username: 'admin',
                  message: message
                });

                socket.emit('nick_updated', {'nick': newname}); 
                break;
            default:
                break;

        }

    }
    return message;
}

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connected to the chat
var rooms = [],
    usersCount = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  socket.on('enter room',function(data){
    socket.join(data.room);

    socket.username = data.username;
    socket.room = data.room;

    // Create Room
    if (rooms[data.room] == undefined) {
      console.log('room create :' + data.room);
      rooms[data.room] = new Object();
      rooms[data.room].socket_ids = new Object();
    }

    // Store current user's nickname and socket.id to MAP
    rooms[data.room].socket_ids[data.username] = socket.id;
    ++usersCount;

    addedUser = true;
    socket.emit('login', {
      usersCount: usersCount
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.to(data.room).emit('user joined', {
      username: socket.username,
      usersCount: usersCount
    });
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {

    var room = socket.room;
      
    if (room != undefined && rooms[room] != undefined ) {
      data = decorateMsg(data, socket);

      socket.broadcast.to(room).emit('new message', {
        username: socket.username,
        message: data
      });
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    var room = socket.room;

    if (room != undefined && rooms[room] != undefined ) {
      socket.broadcast.to(room).emit('typing', {
        username: socket.username
      });
    }
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    var room = socket.room;

    if (room != undefined && rooms[room] != undefined ) {
      socket.broadcast.to(room).emit('stop typing', {
        username: socket.username
      });
    }
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    var room = socket.room;

    if (room != undefined && rooms[room] != undefined && addedUser) {
      delete rooms[room].socket_ids[socket.username];
      --usersCount;

      // echo globally that this client has left
      socket.broadcast.to(room).emit('user left', {
        username: socket.username,
        usersCount: usersCount
      });
    }
  });
});
