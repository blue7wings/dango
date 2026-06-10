#include "display.h"
#include "claude_logo.h"
#include <SPI.h>

static uint16_t lerpColor565(uint16_t c0, uint16_t c1, float t) {
  uint8_t r0 = (c0 >> 11) & 0x1F, g0 = (c0 >> 5) & 0x3F, b0 = c0 & 0x1F;
  uint8_t r1 = (c1 >> 11) & 0x1F, g1 = (c1 >> 5) & 0x3F, b1 = c1 & 0x1F;
  uint8_t r = r0 + (int)(((int)r1 - r0) * t);
  uint8_t g = g0 + (int)(((int)g1 - g0) * t);
  uint8_t b = b0 + (int)(((int)b1 - b0) * t);
  return (r << 11) | (g << 5) | b;
}

void St7789DisplayDriver::begin() {
  pinMode(TFT_BLK, OUTPUT);
  setBacklight(true);

  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.init(DISP_W, DISP_H);
  tft.setSPISpeed(40000000);
  tft.setRotation(1);

  orange = tft.color565(218, 17, 0);
  green = tft.color565(52, 224, 112);
  yellow = tft.color565(242, 190, 56);
  red = tft.color565(235, 68, 68);

  tft.fillScreen(orange);
  for (uint16_t i = 0; i < LOGO_TRI_COUNT; i++) {
    tft.fillTriangle(
        pgm_read_word(&LOGO_TRIS[i][0]), pgm_read_word(&LOGO_TRIS[i][1]),
        pgm_read_word(&LOGO_TRIS[i][2]), pgm_read_word(&LOGO_TRIS[i][3]),
        pgm_read_word(&LOGO_TRIS[i][4]), pgm_read_word(&LOGO_TRIS[i][5]),
        ST77XX_WHITE);
  }
  delay(1200);
  clear();
}

void St7789DisplayDriver::setBacklight(bool on) {
  digitalWrite(TFT_BLK, on ? HIGH : LOW);
}

void St7789DisplayDriver::clear() {
  tft.fillScreen(orange);
  hasSmoothFrame = false;
  lastExtra = {0, 0, 0, 0};
  lastIndicator = Indicator::Off;
}

void St7789DisplayDriver::renderEyes(const EyeGeometry& leftEye, const EyeGeometry& rightEye, EyeStyle style, bool visible) {
  const DrawRect nextLeft = boundsForEye(leftEye);
  const DrawRect nextRight = boundsForEye(rightEye);

  if (!hasSmoothFrame) {
    clear();
    hasSmoothFrame = true;
  } else if (!visible) {
    eraseRect(unionRect(lastLeft, nextLeft));
    eraseRect(unionRect(lastRight, nextRight));
  }

  if (!visible) {
    lastLeft = nextLeft;
    lastRight = nextRight;
    return;
  }

  drawSmoothEye(leftEye);
  drawSmoothEye(rightEye);
  if (hasSmoothFrame) {
    eraseOutsideNew(lastLeft, nextLeft);
    eraseOutsideNew(lastRight, nextRight);
  }

  lastLeft = nextLeft;
  lastRight = nextRight;
}

void St7789DisplayDriver::renderIndicator(Indicator indicator, float phase) {
  const DrawRect indicatorRect = {190, 10, 38, 38};

  if (indicator == Indicator::Off && lastIndicator != Indicator::Off) {
    eraseRect(indicatorRect);
    lastIndicator = Indicator::Off;
    return;
  }

  if (indicator == Indicator::Off) return;

  uint16_t color = orange;
  switch (indicator) {
    case Indicator::GreenSolid:
      color = green;
      break;
    case Indicator::GreenBreathe:
      color = lerpColor565(orange, green, phase);
      break;
    case Indicator::YellowSolid:
      color = yellow;
      break;
    case Indicator::YellowBreathe:
      color = lerpColor565(orange, yellow, phase);
      break;
    case Indicator::RedSolid:
      color = red;
      break;
    case Indicator::RedBreathe:
      color = lerpColor565(orange, red, phase);
      break;
    default:
      break;
  }

  drawCircleIndicator(color);
  lastIndicator = indicator;
}

void St7789DisplayDriver::drawCircleIndicator(uint16_t color) {
  const int16_t cx = 209;
  const int16_t cy = 29;
  const int16_t radius = 13;

  for (int16_t angle = 0; angle < 360; angle += 3) {
    const float radians = static_cast<float>(angle) * DEG_TO_RAD;
    const int16_t x = roundf(cx + cosf(radians) * radius);
    const int16_t y = roundf(cy + sinf(radians) * radius);
    tft.fillCircle(x, y, 2, color);
  }
}

void St7789DisplayDriver::drawSmoothEye(const EyeGeometry& eye) {
  const int16_t x = roundf(eye.cx - eye.w / 2.0f);
  const int16_t y = roundf(eye.cy - eye.h / 2.0f);
  const int16_t w = roundf(eye.w);
  const int16_t h = roundf(eye.h);
  const int16_t r = roundf(eye.radius);

  if (r <= 1) {
    tft.fillRect(x, y, w, h, ST77XX_BLACK);
  } else {
    tft.fillRoundRect(x, y, w, h, r, ST77XX_BLACK);
  }
}

DrawRect St7789DisplayDriver::boundsForEye(const EyeGeometry& eye) const {
  const int16_t pad = 2;
  int16_t x = roundf(eye.cx - eye.w / 2.0f) - pad;
  int16_t y = roundf(eye.cy - eye.h / 2.0f) - pad;
  int16_t rw = roundf(eye.w) + pad * 2;
  int16_t rh = roundf(eye.h) + pad * 2;

  if (x < 0) { rw += x; x = 0; }
  if (y < 0) { rh += y; y = 0; }
  if (x + rw > DISP_W) rw = DISP_W - x;
  if (y + rh > DISP_H) rh = DISP_H - y;
  return {x, y, max<int16_t>(0, rw), max<int16_t>(0, rh)};
}

DrawRect St7789DisplayDriver::unionRect(const DrawRect& a, const DrawRect& b) const {
  const int16_t x1 = min(a.x, b.x);
  const int16_t y1 = min(a.y, b.y);
  const int16_t x2 = max<int16_t>(a.x + a.w, b.x + b.w);
  const int16_t y2 = max<int16_t>(a.y + a.h, b.y + b.h);
  return {x1, y1, static_cast<int16_t>(x2 - x1), static_cast<int16_t>(y2 - y1)};
}

void St7789DisplayDriver::eraseRect(const DrawRect& rect) {
  if (rect.w <= 0 || rect.h <= 0) return;
  tft.fillRect(rect.x, rect.y, rect.w, rect.h, orange);
}

void St7789DisplayDriver::eraseOutsideNew(const DrawRect& oldRect, const DrawRect& newRect) {
  const int16_t oldRight = oldRect.x + oldRect.w;
  const int16_t oldBottom = oldRect.y + oldRect.h;
  const int16_t newRight = newRect.x + newRect.w;
  const int16_t newBottom = newRect.y + newRect.h;

  const int16_t ix1 = max(oldRect.x, newRect.x);
  const int16_t iy1 = max(oldRect.y, newRect.y);
  const int16_t ix2 = min(oldRight, newRight);
  const int16_t iy2 = min(oldBottom, newBottom);

  if (ix1 >= ix2 || iy1 >= iy2) {
    eraseRect(oldRect);
    return;
  }

  eraseRect({oldRect.x, oldRect.y, oldRect.w, static_cast<int16_t>(iy1 - oldRect.y)});
  eraseRect({oldRect.x, iy2, oldRect.w, static_cast<int16_t>(oldBottom - iy2)});
  eraseRect({oldRect.x, iy1, static_cast<int16_t>(ix1 - oldRect.x), static_cast<int16_t>(iy2 - iy1)});
  eraseRect({ix2, iy1, static_cast<int16_t>(oldRight - ix2), static_cast<int16_t>(iy2 - iy1)});
}
