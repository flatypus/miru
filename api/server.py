from fastapi import FastAPI, WebSocket
from fastapi.concurrency import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketState
import asyncio
import serial

degrees: float = 0
last_degrees: float = None

ser = serial.Serial('/dev/cu.usbmodem1101', 9600, timeout=1)
print(f"Connected to {ser.name}")
ser.write(b'Hello, serial port!')


async def send_zero():
    while True:
        v = open("value.txt", "r").read()
        print(f"Sending {v} to serial")
        ser.write(str(v).encode())
        await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(send_zero())
    yield
    ser.close()

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

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
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        print("Frontend connection closed")


@app.websocket("/ws-for-buttons")
async def websocket_endpoint_buttons(websocket: WebSocket):
    await websocket.accept()
    print("Buttons connection accepted")
    try:
        while True:
            message = await websocket.receive_json()
            print(f"Received message: {message}")
            with open("value.txt", "w") as f:
                f.write(str(message["index"]))
    except Exception as e:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        print("Buttons connection closed", e)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)
