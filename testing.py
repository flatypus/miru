import cv2
import torch
import matplotlib.pyplot as plt

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open camera.")
    exit()

# MiDaS v3 - Large     (highest accuracy, slowest inference speed)
# model_type = "DPT_Large"
# model_type = "DPT_Hybrid"   # MiDaS v3 - Hybrid    (medium accuracy, medium inference speed)
# MiDaS v2.1 - Small   (lowest accuracy, highest inference speed)
# model_type = "MiDaS_small"
model_type = "DPT_Hybrid"

midas = torch.hub.load("intel-isl/MiDaS", model_type)
device = torch.device("mps")
midas.to(device)
midas.eval()


midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
transform = midas_transforms.dpt_transform if model_type == "DPT_Large" or model_type == "DPT_Hybrid" else midas_transforms.small_transform

with torch.no_grad():
    try:
        while True:
            ret, frame = cap.read()

            if not ret:
                print("Error: Can't receive frame")
                break

            frame = cv2.resize(frame, (640, 480))
            img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            input_batch = transform(img).to(device)

            prediction = midas(input_batch)

            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=img.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()

            output = prediction.cpu().numpy()

            output_normalized = cv2.normalize(
                output, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)

            output_colored = cv2.applyColorMap(
                output_normalized, cv2.COLORMAP_PLASMA)

            # Blend the original frame with the depth map
            alpha = 0.7  # Adjust this value between 0 and 1 to change blend strength
            blended = cv2.addWeighted(frame, 1-alpha, output_colored, alpha, 0)

            cv2.imshow('Camera Feed', blended)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
