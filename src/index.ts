import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";

const port = process.env.PORT || 5001;

const server = http.createServer(app);

const io = new SocketIOServer(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://localhost",
            "https://localhost/",
            "http://192.168.1.47:3000",
            "https://apex-packaging-industries.onrender.com/",
            "https://jconstruction-frontend.onrender.com",
            "https://jconstruction-frontend-prod.onrender.com",
        ],
        credentials: true,
    },
});

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
