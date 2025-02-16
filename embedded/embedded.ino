#include "SoftwareSerial.h"
#include <PWMServo.h>
#include <Wire.h>

PWMServo servo1;

#pragma region SensorObjects
#pragma endregion

long BAUD_RATE = 57600;

#pragma region GlobalVariables
#define HMC5883L_ADDRESS 0x1E
#pragma endregion


// void mainSensorThread()
// {
//     while (1)
//     {
//       sensor.read();
//       delay(1);
//     }
// }

void setup()
{
    Serial.begin(BAUD_RATE);
    Wire.begin();

    // Initialize HMC5883L
    Wire.beginTransmission(HMC5883L_ADDRESS);
    Wire.write(0x02);
    Wire.write(0x00);
    Wire.endTransmission();
    servo1.attach(22);
}

void println(const char *data)
{
    int dataLength = strlen(data);
    char *str = (char *)malloc(15 + dataLength + (dataLength / 10));
    sprintf(str, "AT+SEND=69,%d,%s", dataLength, data);
    Serial.print("[Sending]: ");
    Serial.println(str);
    free(str);
}

void loop()
{
  // char buffer[255];
  // sprintf(
  //     buffer,
  //     "%i,%i,%i,%i,%i,%i,%i,%i,%i,%i,%i,%i",
  //     realTemperature, realPressure, realAltitude, relativeAltitude, latitude, longitude, accelX, accelY, accelZ, gyroX, gyroY, gyroZ);

  // if (confirmation == 1)
  // {
  //     confirmation = 0;
  //     delay(250);
  // }

  // println(buffer);

  int16_t x, y, z;
  
  Wire.beginTransmission(HMC5883L_ADDRESS);
  Wire.write(0x03); // Select register 3, X MSB register
  Wire.endTransmission();

  Wire.requestFrom(HMC5883L_ADDRESS, 6); // Read 6 bytes
  if (Wire.available() == 6) {
    x = Wire.read() << 8 | Wire.read();
    z = Wire.read() << 8 | Wire.read();
    y = Wire.read() << 8 | Wire.read();
  }

  // Calculate heading
  float heading = atan2(y, x) * 180.0 / PI;
  if (heading < 0) heading += 360; // Convert to 0-360 degrees

  Serial.print("Heading: ");
  Serial.print(heading);
  Serial.println("°");

  delay(500);
}