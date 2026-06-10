#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "config.h"

enum class EyeStyle {
  Block,
  Working,
  ToolCallStart,
  ToolCallEnd,
  Error
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
  virtual void renderEyes(const char* leftEye, const char* rightEye, int16_t ox = 0, int16_t oy = 0) = 0;
  virtual void renderSmoothEyes(const EyeGeometry& leftEye, const EyeGeometry& rightEye, EyeStyle style, bool visible = true) = 0;
  virtual void clear() = 0;
  virtual ~DisplayDriver() = default;
};

class St7789DisplayDriver : public DisplayDriver {
 public:
  void begin() override;
  void renderEyes(const char* leftEye, const char* rightEye, int16_t ox = 0, int16_t oy = 0) override;
  void renderSmoothEyes(const EyeGeometry& leftEye, const EyeGeometry& rightEye, EyeStyle style, bool visible = true) override;
  void clear() override;
  void setBacklight(bool on);

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

  void drawGlyph(const char* glyph, int16_t cx, int16_t cy);
  void drawClaudeLogo(uint16_t color);
  void drawChevron(int16_t cx, int16_t cy, bool rightFacing);
  void drawSmoothEye(const EyeGeometry& eye);
  void drawWorkingIndicator(bool active);
  void drawToolCallIndicator(bool active);
  void drawErrorIndicator();
  DrawRect boundsForEye(const EyeGeometry& eye, EyeStyle style) const;
  DrawRect unionRect(const DrawRect& a, const DrawRect& b) const;
  void eraseRect(const DrawRect& rect);
  void eraseOutsideNew(const DrawRect& oldRect, const DrawRect& newRect);
  bool isSolidEyeStyle(EyeStyle style) const;
};
