let lastErrorTime = 0;
const errorCooldown = 5000; // 5 seconds

export const initializeErrorReporting = () => {
  // Initialize any error reporting setup here if needed
  console.log('Error reporting initialized');
};

export const reportError = (error) => {
  const now = Date.now();
  if (now - lastErrorTime > errorCooldown) {
    console.error('Error reported:', error);
    // You can implement a custom error reporting mechanism here
    // For now, we'll just log to console
    lastErrorTime = now;
  }
};