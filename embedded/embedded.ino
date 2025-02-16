#include <Servo.h>
#include <Arduino.h>

Servo servoFWD;
Servo servoFWD_LEFT;
Servo servoFWD_RIGHT;
Servo servoLEFT;
Servo servoRIGHT;

void pressure(int dir)
{
  Servo *s;
  switch (dir)
  {
  case 0:
    s = &servoFWD;
    s->attach(6);
    break;
  case 1:
    s = &servoFWD_LEFT;
    s->attach(5);
    break;
  case 2:
    s = &servoFWD_RIGHT;
    s->attach(9);
    break;
  case 3:
    s = &servoLEFT;
    s->attach(10);
    break;
  case 4:
    s = &servoRIGHT;
    s->attach(11);
    break;
  default:
    return;
  }
  s->write(s->read() - 30);
  delay(1000);
  s->detach();
}

void setup()
{
  Serial.begin(9600);
  pressure(0);
  pressure(1);
  pressure(2);
  pressure(3);
  pressure(4);
}

void loop()
{
  if (Serial.available() > 0)
  {
    String data = Serial.readStringUntil('\n');
    pressure(data.toInt());
  }
}
