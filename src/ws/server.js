import {WebSocket, WebSocketServer} from 'ws';
function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

function broadcastJson(wss, payload) {
    wss.clients.forEach(client => {
        if(client.readyState !== WebSocket.OPEN) return;
        client.send(JSON.stringify(payload));
    });
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ 
        server,
        path: '/ws',
        maxPayload: 1024 * 1024, // 1MB
     });

    wss.on('connection', (socket) => {
        console.log('WebSocket client connected');
        sendJson(socket, { type: 'Welcome' });

        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    })

    function broadcastMatchCreated(match) {
        broadcastJson(wss, { type: 'match_created', data: match });
    }

    return {broadcastMatchCreated};
}
