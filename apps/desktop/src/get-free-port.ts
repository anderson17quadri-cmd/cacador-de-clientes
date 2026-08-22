import * as net from 'net';

// Finds an OS-assigned free TCP port. A previous run of the app might not
// have released its port yet, or another program could be using the
// "usual" 3000/3001, so we never hardcode one.
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not determine a free port')));
      }
    });
  });
}
