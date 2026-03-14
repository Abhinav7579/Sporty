import { WebSocketServer,WebSocket } from "ws";

const wss=new WebSocketServer({port:8080});

//connection 
wss.on('connection',(socket,request)=>{
   const ip=request.socket.remoteAddress;
   
   socket.on('message',(data)=>{
    const message=data.toString();
    console.log({data});
     wss.clients.forEach((client)=>{
    if(client.readyState===WebSocket.OPEN)client.send(`server broadcast:${message}`);
   })
   });

   socket.on('error',(e)=>{
    console.log(`error:${e.message} on ip:${ip}`)
   })

   socket.on('close',()=>{
    console.log("socket closed");
   });
});

console.log("webserver live")