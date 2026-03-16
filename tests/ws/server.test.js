import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mock the 'ws' module so we never open real network connections
// ---------------------------------------------------------------------------
const mockClients = new Set();

class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = MockWebSocket.OPEN;
    this.send = vi.fn();
  }
  static get OPEN() { return 1; }
  static get CLOSING() { return 2; }
  static get CLOSED() { return 3; }
}

class MockWebSocketServer extends EventEmitter {
  constructor() {
    super();
    this.clients = mockClients;
  }
}

let capturedWss = null;
vi.mock('ws', () => ({
  WebSocket: MockWebSocket,
  WebSocketServer: class extends MockWebSocketServer {
    constructor(opts) {
      super();
      capturedWss = this;
    }
  },
}));

// Import AFTER mocks are in place
const { attachWebSocketServer } = await import('../../src/ws/server.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSocket(readyState = MockWebSocket.OPEN) {
  const s = new MockWebSocket();
  s.readyState = readyState;
  return s;
}

function simulateConnection(socket) {
  capturedWss.emit('connection', socket);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('attachWebSocketServer', () => {
  let broadcastMatchCreated;

  beforeEach(() => {
    mockClients.clear();
    vi.clearAllMocks();
    const result = attachWebSocketServer({});
    broadcastMatchCreated = result.broadcastMatchCreated;
  });

  it('returns a broadcastMatchCreated function', () => {
    expect(typeof broadcastMatchCreated).toBe('function');
  });

  it('sends a Welcome message when a client connects', () => {
    const socket = makeSocket();
    simulateConnection(socket);

    expect(socket.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(sent).toEqual({ type: 'Welcome' });
  });

  it('does NOT send Welcome to a socket that is not OPEN (CLOSING state)', () => {
    const socket = makeSocket(MockWebSocket.CLOSING);
    simulateConnection(socket);

    expect(socket.send).not.toHaveBeenCalled();
  });

  it('does NOT send Welcome to a CLOSED socket', () => {
    const socket = makeSocket(MockWebSocket.CLOSED);
    simulateConnection(socket);

    expect(socket.send).not.toHaveBeenCalled();
  });

  it('broadcastMatchCreated broadcasts to all OPEN clients', () => {
    const s1 = makeSocket();
    const s2 = makeSocket();
    mockClients.add(s1);
    mockClients.add(s2);

    const match = { id: 1, homeTeam: 'A', awayTeam: 'B' };
    broadcastMatchCreated(match);

    const expected = JSON.stringify({ type: 'match_created', data: match });
    expect(s1.send).toHaveBeenCalledWith(expected);
    expect(s2.send).toHaveBeenCalledWith(expected);
  });

  it('broadcastMatchCreated sends correct payload format', () => {
    const s = makeSocket();
    mockClients.add(s);

    const match = { id: 42, sport: 'soccer', homeTeam: 'FC Home', awayTeam: 'FC Away', homeScore: 0, awayScore: 0 };
    broadcastMatchCreated(match);

    expect(s.send).toHaveBeenCalledOnce();
    const payload = JSON.parse(s.send.mock.calls[0][0]);
    expect(payload.type).toBe('match_created');
    expect(payload.data).toEqual(match);
  });

  it('broadcastMatchCreated skips clients that are not OPEN (CLOSED)', () => {
    const openSocket = makeSocket(MockWebSocket.OPEN);
    const closedSocket = makeSocket(MockWebSocket.CLOSED);
    mockClients.add(openSocket);
    mockClients.add(closedSocket);

    broadcastMatchCreated({ id: 5 });

    expect(openSocket.send).toHaveBeenCalledOnce();
    expect(closedSocket.send).not.toHaveBeenCalled();
  });

  it('broadcastMatchCreated skips clients that are CLOSING', () => {
    const openSocket = makeSocket(MockWebSocket.OPEN);
    const closingSocket = makeSocket(MockWebSocket.CLOSING);
    mockClients.add(openSocket);
    mockClients.add(closingSocket);

    broadcastMatchCreated({ id: 6 });

    expect(openSocket.send).toHaveBeenCalledOnce();
    expect(closingSocket.send).not.toHaveBeenCalled();
  });

  it('broadcastMatchCreated with no connected clients does not throw', () => {
    expect(() => broadcastMatchCreated({ id: 99 })).not.toThrow();
  });

  it('broadcastMatchCreated sends valid JSON string', () => {
    const s = makeSocket();
    mockClients.add(s);

    broadcastMatchCreated({ id: 7, nested: { score: 3 } });

    const raw = s.send.mock.calls[0][0];
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw)).toEqual({ type: 'match_created', data: { id: 7, nested: { score: 3 } } });
  });

  it('sends Welcome only to the newly connected socket, not to pre-existing clients', () => {
    const existing = makeSocket();
    mockClients.add(existing);

    const newSocket = makeSocket();
    simulateConnection(newSocket);

    expect(newSocket.send).toHaveBeenCalledOnce();
    expect(existing.send).not.toHaveBeenCalled();
  });

  it('registers an error handler on each connected socket', () => {
    const socket = makeSocket();
    const onSpy = vi.spyOn(socket, 'on');
    simulateConnection(socket);

    const errorHandlerCall = onSpy.mock.calls.find(([event]) => event === 'error');
    expect(errorHandlerCall).toBeDefined();
  });

  it('socket error handler does not crash the server', () => {
    const socket = makeSocket();
    simulateConnection(socket);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('test socket error');
    expect(() => socket.emit('error', err)).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('broadcastMatchCreated sends to each client exactly once per call', () => {
    const s1 = makeSocket();
    const s2 = makeSocket();
    const s3 = makeSocket();
    mockClients.add(s1);
    mockClients.add(s2);
    mockClients.add(s3);

    broadcastMatchCreated({ id: 10 });

    expect(s1.send).toHaveBeenCalledTimes(1);
    expect(s2.send).toHaveBeenCalledTimes(1);
    expect(s3.send).toHaveBeenCalledTimes(1);
  });
});