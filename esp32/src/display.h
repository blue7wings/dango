#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "config.h"
#include "state_machine.h"

enum class EyeStyle {
  Block,
  Working
};

struct EyeGeometry {
  float cx;
  float cy;
  float w;
  float h;
  float radius;
  float phase;
};

struct DrawRect {
  int16_t x;
  int16_t y;
  int16_t w;
  int16_t h;
};

class DisplayDriver {
 public:
  virtual void begin() = 0;
  virtual void renderEyes(const EyeGeometry& leftEye, const EyeGeometry& rightEye, EyeStyle style, bool visible = true) = 0;
  virtual void renderIndicator(Indicator indicator, float phase) = 0;
  virtual void clear() = 0;
  virtual void setBacklight(bool on) = 0;
  virtual ~DisplayDriver() = default;
};

class St7789DisplayDriver : public DisplayDriver {
 public:
  void begin() override;
  void renderEyes(const EyeGeometry& leftEye, const EyeGeometry& rightEye, EyeStyle style, bool visible = true) override;
  void renderIndicator(Indicator indicator, float phase) override;
  void clear() override;
  void setBacklight(bool on) override;

 private:
  Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);
  uint16_t orange = 0;
  uint16_t green = 0;
  uint16_t yellow = 0;
  uint16_t red = 0;
  bool hasSmoothFrame = false;
  DrawRect lastLeft = {0, 0, 0, 0};
  DrawRect lastRight = {0, 0, 0, 0};
  DrawRect lastExtra = {0, 0, 0, 0};
  Indicator lastIndicator = Indicator::Off;

  void drawSmoothEye(const EyeGeometry& eye);
  void drawCircleIndicator(uint16_t color);
  DrawRect boundsForEye(const EyeGeometry& eye) const;
  DrawRect unionRect(const DrawRect& a, const DrawRect& b) const;
  void eraseRect(const DrawRect& rect);
  void eraseOutsideNew(const DrawRect& oldRect, const DrawRect& newRect);
};
