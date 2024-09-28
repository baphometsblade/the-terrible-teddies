let socket = null;

export const initWebSocket = (url) => {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('WebSocket connection established');
  };

  socket.onmessage = (event) => {
    console.log('Received message:', event.data);
    // Handle incoming messages here
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    // Handle errors here
  };

  socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
    // Attempt to reconnect after a delay
    setTimeout(() => initWebSocket(url), 5000);
  };

  return socket;
};

export const sendMessage = (message) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.error('WebSocket is not connected');
  }
};