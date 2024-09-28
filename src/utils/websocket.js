import { toast } from '@/components/ui/use-toast';

class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds
  }

  connect() {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      this.reconnectAttempts = 0;
      toast({
        title: "Connected",
        description: "You're now connected to the game server.",
        variant: "success",
      });
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle incoming messages here
      console.log('Received message:', data);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "There was an error connecting to the game server.",
        variant: "destructive",
      });
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      this.reconnect();
    };
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      console.error('Max reconnect attempts reached. Please check your connection and try again later.');
      toast({
        title: "Connection Failed",
        description: "Unable to connect to the game server. Please try again later.",
        variant: "destructive",
      });
    }
  }

  sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      toast({
        title: "Send Error",
        description: "Unable to send message. Please check your connection.",
        variant: "destructive",
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

export const webSocketManager = new WebSocketManager('wss://lov-p-1db83e7a-8789-4219-a42f-bff44602358e.fly.dev/');