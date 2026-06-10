#include "display.h"
#include "claude_logo.h"
#include <SPI.h>

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
  drawClaudeLogo(ST77XX_WHITE);
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
}

void St7789DisplayDriver::renderEyes(const char* leftEye, const char* rightEye, int16_t ox, int16_t oy) {
  clear();
  const int16_t leftCx = (DISP_W - (EYE_W * 2 + EYE_GAP)) / 2 + EYE_OX + ox + EYE_W / 2;
  const int16_t rightCx = leftCx + EYE_W + EYE_GAP;
  const int16_t cy = (DISP_H - EYE_H) / 2 - EYE_OY + EYE_H / 2 + oy;
  drawGlyph(leftEye, leftCx, cy);
  drawGlyph(rightEye, rightCx, cy);
}

void St7789DisplayDriver::drawClaudeLogo(uint16_t color) {
  // Same filled-triangle renderer and coordinates as the example firmware.
  for (uint16_t i = 0; i < LOGO_TRI_COUNT; i++) {
    tft.fillTriangle(
        pgm_read_word(&LOGO_TRIS[i][0]), pgm_read_word(&LOGO_TRIS[i][1]),
        pgm_read_word(&LOGO_TRIS[i][2]), pgm_read_word(&LOGO_TRIS[i][3]),
        pgm_read_word(&LOGO_TRIS[i][4]), pgm_read_word(&LOGO_TRIS[i][5]),
        color);
  }
}

void St7789DisplayDriver::renderSmoothEyes(const EyeGeometry& leftEye, const EyeGeometry& rightEye, EyeStyle style, bool visible) {
  const DrawRect nextLeft = boundsForEye(leftEye, style);
  const DrawRect nextRight = boundsForEye(rightEye, style);
  const bool solidEyeStyle = isSolidEyeStyle(style);
  const DrawRect nextExtra = (style == EyeStyle::Working || style == EyeStyle::ToolCallStart || style == EyeStyle::Error) ? DrawRect{190, 10, 38, 38} : DrawRect{0, 0, 0, 0};

  if (!hasSmoothFrame) {
    clear();
    hasSmoothFrame = true;
  } else if (!solidEyeStyle || !visible) {
    eraseRect(unionRect(lastLeft, nextLeft));
    eraseRect(unionRect(lastRight, nextRight));
    eraseRect(unionRect(lastExtra, nextExtra));
  } else {
    if (lastExtra.w > 0 && nextExtra.w == 0) eraseRect(lastExtra);
  }

  if (!visible) {
    lastLeft = nextLeft;
    lastRight = nextRight;
    return;
  }

  switch (style) {
    case EyeStyle::Block:
    case EyeStyle::Working:
    case EyeStyle::ToolCallStart:
    case EyeStyle::ToolCallEnd:
    case EyeStyle::Error:
    default:
      drawSmoothEye(leftEye);
      drawSmoothEye(rightEye);
      if (style == EyeStyle::Working) drawWorkingIndicator(leftEye.phase > 0.5f);
      if (style == EyeStyle::ToolCallStart) drawToolCallIndicator(leftEye.phase > 0.5f);
      if (style == EyeStyle::Error) drawErrorIndicator();
      if (hasSmoothFrame) {
        eraseOutsideNew(lastLeft, nextLeft);
        eraseOutsideNew(lastRight, nextRight);
      }
      break;
  }

  lastLeft = nextLeft;
  lastRight = nextRight;
  lastExtra = nextExtra;
}

void St7789DisplayDriver::drawGlyph(const char* glyph, int16_t cx, int16_t cy) {
  const char c = glyph[0];
  if (c == '>') {
    drawChevron(cx, cy, true);
    return;
  }
  if (c == '<') {
    drawChevron(cx, cy, false);
    return;
  }
  if (c == '-' || c == '_') {
    const int16_t h = c == '_' ? 5 : 7;
    tft.fillRect(cx - EYE_W / 2, cy - h / 2, EYE_W, h, ST77XX_BLACK);
    return;
  }
  if (c == '|') {
    tft.fillRect(cx - EYE_W / 2, cy - EYE_H / 2, EYE_W, EYE_H, ST77XX_BLACK);
    return;
  }
  if (c == '+') {
    tft.fillRect(cx - 5, cy - 25, 10, 50, ST77XX_BLACK);
    tft.fillRect(cx - 25, cy - 5, 50, 10, ST77XX_BLACK);
    return;
  }
  if (c == '^') {
    for (int8_t t = -3; t <= 3; t++) {
      tft.drawLine(cx - 18, cy + 12 + t, cx, cy - 18 + t, ST77XX_BLACK);
      tft.drawLine(cx, cy - 18 + t, cx + 18, cy + 12 + t, ST77XX_BLACK);
    }
    return;
  }
  if (c == 'o' || c == 'O') {
    tft.fillCircle(cx, cy, 18, ST77XX_BLACK);
    tft.fillCircle(cx, cy, 8, orange);
    return;
  }
  if (c == 'x' || c == 'X') {
    for (int8_t t = -3; t <= 3; t++) {
      tft.drawLine(cx - 18, cy - 18 + t, cx + 18, cy + 18 + t, ST77XX_BLACK);
      tft.drawLine(cx + 18, cy - 18 + t, cx - 18, cy + 18 + t, ST77XX_BLACK);
    }
    return;
  }

  // Character fallback supports simple legacy glyph rendering.
  tft.setTextColor(ST77XX_BLACK);
  tft.setTextSize(5);
  tft.setCursor(cx - 15, cy - 22);
  tft.print(c);
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

void St7789DisplayDriver::drawWorkingIndicator(bool active) {
  const int16_t cx = 209;
  const int16_t cy = 29;
  const int16_t radius = 13;
  const uint16_t color = active ? green : orange;

  // A 300-degree ring leaves a small gap like the android status LED reference.
  for (int16_t angle = 25; angle <= 325; angle += 3) {
    const float radians = static_cast<float>(angle) * DEG_TO_RAD;
    const int16_t x = roundf(cx + cosf(radians) * radius);
    const int16_t y = roundf(cy + sinf(radians) * radius);
    tft.fillCircle(x, y, 2, color);
  }
}

void St7789DisplayDriver::drawErrorIndicator() {
  const int16_t cx = 209;
  const int16_t cy = 29;
  const int16_t radius = 13;

  for (int16_t angle = 25; angle <= 325; angle += 3) {
    const float radians = static_cast<float>(angle) * DEG_TO_RAD;
    const int16_t x = roundf(cx + cosf(radians) * radius);
    const int16_t y = roundf(cy + sinf(radians) * radius);
    tft.fillCircle(x, y, 2, red);
  }
}

void St7789DisplayDriver::drawToolCallIndicator(bool active) {
  const int16_t cx = 209;
  const int16_t cy = 29;
  const int16_t radius = 13;
  const uint16_t color = active ? yellow : orange;

  for (int16_t angle = 25; angle <= 325; angle += 3) {
    const float radians = static_cast<float>(angle) * DEG_TO_RAD;
    const int16_t x = roundf(cx + cosf(radians) * radius);
    const int16_t y = roundf(cy + sinf(radians) * radius);
    tft.fillCircle(x, y, 2, color);
  }
}

DrawRect St7789DisplayDriver::boundsForEye(const EyeGeometry& eye, EyeStyle style) const {
  int16_t pad = isSolidEyeStyle(style) ? 2 : 8;
  float w = eye.w;
  float h = eye.h;

  int16_t x = roundf(eye.cx - w / 2.0f) - pad;
  int16_t y = roundf(eye.cy - h / 2.0f) - pad;
  int16_t rw = roundf(w) + pad * 2;
  int16_t rh = roundf(h) + pad * 2;

  if (x < 0) {
    rw += x;
    x = 0;
  }
  if (y < 0) {
    rh += y;
    y = 0;
  }
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

bool St7789DisplayDriver::isSolidEyeStyle(EyeStyle style) const {
  return style == EyeStyle::Block || style == EyeStyle::Working || style == EyeStyle::ToolCallStart || style == EyeStyle::ToolCallEnd || style == EyeStyle::Error;
}

void St7789DisplayDriver::drawChevron(int16_t cx, int16_t cy, bool rightFacing) {
  for (int8_t t = -5; t <= 5; t++) {
    if (rightFacing) {
      tft.drawLine(cx - 15, cy - 30 + t, cx + 15, cy + t, ST77XX_BLACK);
      tft.drawLine(cx + 15, cy + t, cx - 15, cy + 30 + t, ST77XX_BLACK);
    } else {
      tft.drawLine(cx + 15, cy - 30 + t, cx - 15, cy + t, ST77XX_BLACK);
      tft.drawLine(cx - 15, cy + t, cx + 15, cy + 30 + t, ST77XX_BLACK);
    }
  }
}
