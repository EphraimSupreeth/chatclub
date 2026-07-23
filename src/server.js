const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public')); // <-- this line serves your css

let users = {};
io.on('connection', (socket) => {
  socket.on('join', (username) => {
    users[socket.id] = username;
    io.emit('userList', Object.values(users));
  });
  socket.on('chatMessage', (msg) => {
    io.emit('message', { user: users[socket.id], text: msg });
  });
  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('userList', Object.values(users));
  });
});

http.listen(3000, () => console.log('Open http://localhost:3000'));