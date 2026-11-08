import * as net from 'net';

const server = net.createServer((socket) => {
  const client = net.connect(5432, '127.0.0.1');
  socket.pipe(client).pipe(socket);
  socket.on('error', () => {});
  client.on('error', () => {});
});

server.listen(5433, '127.0.0.1', () => {
  console.log('Postgres port forwarder active: 127.0.0.1:5433 -> 127.0.0.1:5432');
});
