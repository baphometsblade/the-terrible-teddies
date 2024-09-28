let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

export const initWebSocket = (url) => {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0;
  };

  socket.onmessage = (event) => {
    console.log('Received message:', event.data);
    // Handle incoming messages here
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
      setTimeout(() => initWebSocket(url), 5000 * reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached. Please check your connection and try again later.');
    }
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