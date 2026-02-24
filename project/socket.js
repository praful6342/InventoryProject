const { Server } = require('socket.io');

function setupSocket(server) {
  const io = new Server(server);

  io.on('connection', (socket) => {
    // You can log or handle connections here
  });

  // Expose a function to emit product updates
  return {
    emitProductUpdate: () => io.emit('products-updated')
  };
}

module.exports = setupSocket;
