import * as http from 'http';

// Polls a URL until it answers (any HTTP response, even a 404, counts -
// we only care that something is listening) or the timeout elapses. Used
// so the window never opens before the backend/frontend can actually
// serve a request.
export function waitForHttp(url: string, timeoutMs = 30000, intervalMs = 250): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
    };
    attempt();
  });
}
