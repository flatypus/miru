from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.websockets import WebSocketState
import asyncio

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Global variables
degrees: float = 0
last_degrees: float = None
# try:
#     ser = serial.Serial('/dev/ttyUSB0', 9600)  # Adjust port as needed
# except:
#     print("Warning: Could not connect to serial port")


@app.get("/")
async def root():
    return {"message": "lmfao"}


@app.websocket("/ws-for-ios")
async def websocket_endpoint_for_ios(websocket: WebSocket):
    global degrees
    await websocket.accept()
    print("IOS connection accepted")
    try:
        while True:
            degrees = await websocket.receive_json()
            with open("degrees.txt", "w") as f:
                f.write(str(degrees))
    except Exception as e:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        print("IOS connection closed")


@app.websocket("/ws-for-frontend")
async def websocket_endpoint(websocket: WebSocket):
    global last_degrees
    await websocket.accept()
    await websocket.send_json({"data": degrees})
    print("Frontend connection accepted")
    try:
        while True:
            if degrees != last_degrees:
                await websocket.send_json({"data": degrees})
                last_degrees = degrees
            await asyncio.sleep(0.1)
    except Exception as e:
        print("Frontend connection closed")
        await websocket.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)
