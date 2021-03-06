$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $roomInput = $('.roomInput'); // Input for room
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var room;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $roomInput;

  var socket = io();

  var showWriteTime = true;

  var roomsList = [];

  function roomsSearch (data) {

    var rooms = data.room;
    for(var key in rooms) {
      if( rooms[key] !== undefined && rooms[key].usersCount > 0 ) {
        roomsList.push(key);
      }
    }

    if( roomsList.length > 0 ) {
      $roomInput.autocomplete({
        source: roomsList
      });
    }
  }

  function addParticipantsMessage (data) {
    var message = '';
    if (data.usersCount === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.usersCount + " participants";
    }
    log(message);
  }

  // Sets the room & the client's username
  function enterRoom() {
    room = cleanInput($roomInput.val().trim());
    username = cleanInput($usernameInput.val().trim());

    if (room && username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();
      log('Welcome to ' + room + ' room!');

      socket.emit('enter room', {'room':room, 'username':username});
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
        .text(data.username)
        .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
        .text(data.message)      
      ;

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv)
      .append(getTimeString())
      ;

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {    
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  function getTimeString() {
    if ( !showWriteTime ) {
      return '';
    }

    var date = new Date()
    , y = date.getFullYear()
    , m = date.getMonth() + 1
    , d = date.getDate()
    , h = date.getHours()
    , i = date.getMinutes()
    , s = date.getSeconds()

    i = '0'+i.toString();
    i = i.substr(i.length-2, 2);

    s = '0'+s.toString();
    s = s.substr(s.length-2, 2);

    return ' <span class="writeTime">(' + m +'.'+ d + ' ' + h +':'+ i +':'+ s + ')<span>';
    ;

  }

  function roomInfoUpdate(data) {
    var html = '';
    for (var i = 0 ; i < data.length ; i++) {
      html += '<li><span><a hef="#">' + data[i].name + '</a></span><ul class="users">';
      for (var j = 0 ; j < data[i]['users'].length ; j++) {
        var cls = (0 && '내아이디와같다면') ? 'bold' : '';
        html += '<li class="' + cls + '">' + data[i]['users'][j] + '</li>';
      }
      html += '</ul></li>';
    }
    $('#room_list').html(html);
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed    
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      //$currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        enterRoom();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    if( !$roomInput.val() ) {
      $currentInput = $roomInput;
    } else {
      $currentInput = $usernameInput;
    }

    $currentInput.focus();
  })
  .on('click', 'input', function (event) {
    event.stopPropagation();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('notice', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('nick_updated', function (data) {
    username = data.nick;
  });
  
  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    log(data.room);
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  // Whenever the server emits 'room info updated', refresh room info
  socket.on('room info updated', function (data) {
    roomInfoUpdate(data);
  });

  socket.on('rooms info', function (data) {
    roomsSearch(data);
  });

});
