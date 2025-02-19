# Treehacks 2025: 
## 🏠 Miru: Indoor Navigation for the Visually Impaired  

<p float="center">
   <img src="/assets/img.png" width="375" /> 
  <img src="https://github.com/user-attachments/assets/8d32c9e0-c16d-4ccf-98b5-19fc11a33543" width="369" />
</p>

## 🚀 Inspiration  
Over **20 million Americans** experience visual impairment, with **1 million classified as legally blind**. While GPS-based navigation tools exist for outdoor spaces, indoor navigation remains a major challenge due to **GPS limitations and lack of reliable spatial data**.  

With the rise of **smart glasses** like Meta Ray-Ban and Apple Vision Pro, we saw an opportunity to **harness wearable technology and computer vision** to empower visually impaired individuals with **independent indoor mobility**.

---

## How It Works  
**Miru** is an **indoor navigation system** for the visually impaired, providing **real-time, step-by-step guidance** using a combination of **floor plans, wearable smart glasses, and haptic feedback**.  

1. **Upload a Floor Plan**  
   - Extracts architectural features using **Canny edge detection**.  
   - Generates **waypoints and navigation paths** using **A\* pathfinding**.  

2. **Wear Meta Ray-Ban Smart Glasses**  
   - Streams live video for **real-time localization**.  
   - Uses **WhatsApp streaming** to minimize latency (<1s).  

3. **Receive Haptic Feedback via a Servo Belt**  
   - A wearable **servo motor belt** provides tactile feedback to guide movement.  
   - Supports five directional instructions: **left, right, forward, left-forward, right-forward**.  

---

## 🛠️ How We Built It  
### 🗺 Indoor Mapping & Navigation  
- **Converted fire escape plans** into navigable maps using **computer vision**.  
- **Pathfinding** performed with **A* algorithm** for optimal routes.  

### 📍 Real-Time Localization  
- Captured **1,500+ geotagged images** and embedded them using **CLIP**.  
- Stored in **Vespa AI vector database** for efficient querying.  
- Filtered out noisy location data (>5m deviation).  

### 🎯 Orientation & Feedback  
- Developed an **iOS compass app** to determine direction.  
- Integrated a **haptic belt** with servo motors for **non-visual navigation**.  

---

## 🚧 Challenges We Faced  
- **High Latency in Ray-Ban Streaming**  
  - Meta Ray-Ban glasses do **not support native laptop streaming**.  
  - **Solution**: Streamed via **WhatsApp** instead of **Instagram Live**, reducing latency from **30s to <1s**.  

- **Localization Without GPS**  
  - GPS **does not work indoors**, making navigation extremely difficult.  
  - **Solution**: Used **computer vision and vector search** instead of traditional GPS.  

- **IMU Sensor Drift for Orientation**  
  - **Solution**: Used iOS **compass data** for more accurate direction sensing.  

---

## 🎉 Accomplishments We're Proud Of  
✅ Built a **real-time, GPS-free** indoor navigation system in **just 36 hours**.  
✅ Created an **intuitive haptic feedback belt** for non-visual navigation.  
✅ Successfully integrated **computer vision, vector embeddings, and hardware** into a seamless user experience.  

---

## 🔮 What’s Next?  
🔹 **Multi-Floor Navigation** – Guide users across **stairwells & elevators**.  
🔹 **SLAM-Based Real-Time Mapping** – Dynamically update maps without reference images.  
🔹 **Scaling to Public Spaces** – Expand to **airports, malls, hospitals, and transit hubs** using public floor plans.  

---

## Devpost:
https://devpost.com/software/mapdash
