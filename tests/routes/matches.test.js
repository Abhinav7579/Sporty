import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database and schema modules before importing the router
vi.mock('../../src/db/db.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('../../src/db/schema.js', () => ({
  matches: {},
}));

vi.mock('../../src/utils/match-status.js', () => ({
  getMatchStatus: vi.fn(() => 'scheduled'),
}));

// Import after mocks are set up
const { db } = await import('../../src/db/db.js');
const { matchesRouter } = await import('../../src/routes/matches.js');

// ---------------------------------------------------------------------------
// Helpers – lightweight req/res mocks (no network required)
// ---------------------------------------------------------------------------
const VALID_BODY = {
  sport: 'soccer',
  homeTeam: 'Home FC',
  awayTeam: 'Away FC',
  startTime: '2030-01-01T10:00:00.000Z',
  endTime: '2030-01-01T12:00:00.000Z',
};

const CREATED_EVENT = {
  id: 1,
  sport: 'soccer',
  homeTeam: 'Home FC',
  awayTeam: 'Away FC',
  homeScore: 0,
  awayScore: 0,
  status: 'scheduled',
  startTime: new Date('2030-01-01T10:00:00.000Z'),
  endTime: new Date('2030-01-01T12:00:00.000Z'),
};

/**
 * Build a mock Express-like req/res pair that records the response.
 * The returned `res` object accumulates calls to .status()/.json() so tests
 * can inspect them without any HTTP server.
 */
function makeMockReqRes({ body = {}, locals = {} } = {}) {
  const result = { statusCode: null, body: null };

  const res = {
    app: { locals },
    statusCode: 200,
    status(code) {
      result.statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data) {
      result.body = data;
      return this;
    },
    send(data) {
      result.body = data;
      return this;
    },
  };

  const req = {
    body,
    query: {},
    method: 'POST',
    url: '/',
    path: '/',
    app: { locals },
  };

  return { req, res, result };
}

/**
 * Directly invoke the first matching POST handler registered on matchesRouter.
 * Express Router instances expose their stack of layers; we find the POST
 * handler for '/' and call it with our mock req/res.
 */
async function invokePostHandler(req, res) {
  const layers = matchesRouter.stack.filter(
    (l) => l.route && l.route.methods.post && l.route.path === '/'
  );
  if (layers.length === 0) throw new Error('POST / handler not found on matchesRouter');
  const handler = layers[0].route.stack[0].handle;
  await handler(req, res, (err) => {
    if (err) throw err;
  });
}

function setupDbInsertMock(returnValue = CREATED_EVENT) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  db.insert.mockReturnValue({ values: valuesMock });
  return { returningMock, valuesMock };
}

// ---------------------------------------------------------------------------
// Tests – focused on the PR change: broadcastMatchCreated call in POST handler
// ---------------------------------------------------------------------------
describe('POST /matches - broadcastMatchCreated integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls broadcastMatchCreated with the created event when it exists in app.locals', async () => {
    setupDbInsertMock();
    const broadcast = vi.fn();
    const { req, res } = makeMockReqRes({ body: VALID_BODY, locals: { broadcastMatchCreated: broadcast } });

    await invokePostHandler(req, res);

    expect(broadcast).toHaveBeenCalledOnce();
    expect(broadcast).toHaveBeenCalledWith(CREATED_EVENT);
  });

  it('does not throw when broadcastMatchCreated is absent from app.locals', async () => {
    setupDbInsertMock();
    const { req, res, result } = makeMockReqRes({ body: VALID_BODY, locals: {} });

    await expect(invokePostHandler(req, res)).resolves.not.toThrow();
    expect(result.statusCode).toBe(201);
  });

  it('does not throw when broadcastMatchCreated is explicitly null in app.locals', async () => {
    setupDbInsertMock();
    const { req, res, result } = makeMockReqRes({ body: VALID_BODY, locals: { broadcastMatchCreated: null } });

    await expect(invokePostHandler(req, res)).resolves.not.toThrow();
    expect(result.statusCode).toBe(201);
  });

  it('returns 201 with message and data after successful creation', async () => {
    setupDbInsertMock();
    const { req, res, result } = makeMockReqRes({ body: VALID_BODY, locals: { broadcastMatchCreated: vi.fn() } });

    await invokePostHandler(req, res);

    expect(result.statusCode).toBe(201);
    expect(result.body.message).toBe('Match created');
    expect(result.body.data).toBeDefined();
  });

  it('broadcastMatchCreated receives exactly the DB-returned event (not the raw input)', async () => {
    const dbEvent = { ...CREATED_EVENT, id: 99, homeScore: 2 };
    setupDbInsertMock(dbEvent);
    const broadcast = vi.fn();
    const { req, res } = makeMockReqRes({ body: VALID_BODY, locals: { broadcastMatchCreated: broadcast } });

    await invokePostHandler(req, res);

    expect(broadcast).toHaveBeenCalledWith(dbEvent);
    expect(broadcast).not.toHaveBeenCalledWith(expect.objectContaining({ id: undefined }));
  });

  it('returns 400 and does not call broadcastMatchCreated when body is invalid', async () => {
    const broadcast = vi.fn();
    const { req, res, result } = makeMockReqRes({
      body: { sport: '' },
      locals: { broadcastMatchCreated: broadcast },
    });

    await invokePostHandler(req, res);

    expect(result.statusCode).toBe(400);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('returns 400 when endTime is before startTime (validation guard)', async () => {
    const broadcast = vi.fn();
    const { req, res, result } = makeMockReqRes({
      body: { ...VALID_BODY, endTime: '2029-12-31T09:00:00.000Z' },
      locals: { broadcastMatchCreated: broadcast },
    });

    await invokePostHandler(req, res);

    expect(result.statusCode).toBe(400);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('returns 500 and does not call broadcastMatchCreated when db throws', async () => {
    const returningMock = vi.fn().mockRejectedValue(new Error('DB connection failed'));
    db.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: returningMock }) });

    const broadcast = vi.fn();
    const { req, res, result } = makeMockReqRes({
      body: VALID_BODY,
      locals: { broadcastMatchCreated: broadcast },
    });

    await invokePostHandler(req, res);

    expect(result.statusCode).toBe(500);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('does not call broadcastMatchCreated more than once per request', async () => {
    setupDbInsertMock();
    const broadcast = vi.fn();
    const { req, res } = makeMockReqRes({ body: VALID_BODY, locals: { broadcastMatchCreated: broadcast } });

    await invokePostHandler(req, res);

    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('response data matches the event returned from the database', async () => {
    const dbEvent = { ...CREATED_EVENT, id: 55 };
    setupDbInsertMock(dbEvent);
    const { req, res, result } = makeMockReqRes({ body: VALID_BODY, locals: { broadcastMatchCreated: vi.fn() } });

    await invokePostHandler(req, res);

    expect(result.body.data).toEqual(dbEvent);
  });
});