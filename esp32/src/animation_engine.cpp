#include "animation_engine.h"
#include <math.h>

namespace {
constexpr uint16_t FRAME_MS = 33;
constexpr float EASE = 0.22f;
constexpr float LEFT_BASE_X = 70.0f;
constexpr float RIGHT_BASE_X = 170.0f;
constexpr float BASE_Y = 82.0f;
constexpr float BLOCK_W = 18.0f;
constexpr float BLOCK_H = 56.0f;

struct LookOffset { float x; float y; };

LookOffset idleLookOffset(uint32_t age) {
  const uint32_t t = age % 13200UL;
  if (t < 1200UL) return {0, 0};
  if (t < 2600UL) return {-28, 0};
  if (t < 3700UL) return {0, 0};
  if (t < 5000UL) return {28, 0};
  if (t < 6100UL) return {0, 0};
  if (t < 7400UL) return {0, -22};
  if (t < 8500UL) return {0, 18};
  if (t < 9800UL) return {-24, -20};
  if (t < 10900UL) return {0, 0};
  if (t < 12200UL) return {24, -20};
  return {0, 0};
}

bool idleBlink(uint32_t age) {
  const uint32_t t = age % 13200UL;
  return (t > 2760UL && t < 3060UL) || (t > 6860UL && t < 7160UL) || (t > 12560UL && t < 12860UL);
}

bool workingBlink(uint32_t age) {
  const uint32_t t = age % 4800UL;
  return t > 3500UL && t < 3740UL;
}
}  // namespace

AnimationEngine::AnimationEngine(DisplayDriver& display) : display(display), lastCommandAt(millis()) {}

void AnimationEngine::setState(const DeviceState& state) {
  const bool expressionChanged = (state.expression != deviceState.expression);
  deviceState = state;
  lastCommandAt = millis();
  timedOut = false;

  if (state.display == DisplayPower::Off) {
    display.setBacklight(false);
    return;
  }
  display.setBacklight(true);

  if (expressionChanged) {
    expressionStartedAt = millis();
    nextAt = 0;
  }

  if (!initialized) {
    currentPose = basePose();
    targetPose = currentPose;
    initialized = true;
  }
}

void AnimationEngine::setIdleTimeout(uint32_t minutes) {
  idleTimeoutMs = minutes > 0 ? minutes * 60UL * 1000UL : 0;
  lastCommandAt = millis();
  timedOut = false;
}

void AnimationEngine::tick() {
  if (deviceState.display == DisplayPower::Off) return;

  const uint32_t now = millis();

  // Auto-idle after timeout
  if (idleTimeoutMs > 0 && !timedOut && deviceState.expression != Expression::Idle) {
    if (now - lastCommandAt >= idleTimeoutMs) {
      timedOut = true;
      deviceState.expression = Expression::Idle;
      deviceState.indicator = Indicator::Off;
      expressionStartedAt = now;
      nextAt = 0;
      Serial.println("idle timeout");
    }
  }

  if (now < nextAt) return;

  targetPose = poseFor(deviceState.expression, now);
  easeToward(targetPose, deviceState.expression == Expression::Idle ? 0.34f : 0.55f);
  display.renderEyes(currentPose.left, currentPose.right, currentPose.style, currentPose.visible);
  display.renderIndicator(deviceState.indicator, breathePhase(now));

  nextAt = now + FRAME_MS;
}

float AnimationEngine::breathePhase(uint32_t now) const {
  return (sinf(now * 0.003f) + 1.0f) * 0.5f;
}

EyePose AnimationEngine::poseFor(Expression exp, uint32_t now) const {
  const uint32_t age = now - expressionStartedAt;
  EyePose pose = basePose();

  switch (exp) {
    case Expression::Idle: {
      const LookOffset look = idleLookOffset(age);
      pose.left.cx = LEFT_BASE_X + look.x;
      pose.right.cx = RIGHT_BASE_X + look.x;
      pose.left.cy = BASE_Y + look.y;
      pose.right.cy = BASE_Y + look.y;
      if (idleBlink(age)) {
        pose.left.h = 3.0f;
        pose.right.h = 3.0f;
        pose.left.w = BLOCK_W + 14.0f;
        pose.right.w = BLOCK_W + 14.0f;
      }
      return pose;
    }

    case Expression::Working:
      pose = basePose(EyeStyle::Working);
      if (workingBlink(age)) {
        pose.left.h = 3.0f;
        pose.right.h = 3.0f;
        pose.left.w = BLOCK_W + 14.0f;
        pose.right.w = BLOCK_W + 14.0f;
      }
      return pose;
  }

  return pose;
}

EyePose AnimationEngine::basePose(EyeStyle style, bool visible) const {
  return {
      eye(LEFT_BASE_X, BASE_Y, BLOCK_W, BLOCK_H, 0.0f),
      eye(RIGHT_BASE_X, BASE_Y, BLOCK_W, BLOCK_H, 0.0f),
      style,
      visible};
}

EyeGeometry AnimationEngine::eye(float cx, float cy, float w, float h, float radius) const {
  return {cx, cy, w, h, radius, 0.0f};
}

void AnimationEngine::easeToward(const EyePose& target, float amount) {
  currentPose.style = target.style;
  currentPose.visible = target.visible;

  currentPose.left.cx += (target.left.cx - currentPose.left.cx) * amount;
  currentPose.left.cy += (target.left.cy - currentPose.left.cy) * amount;
  currentPose.left.w += (target.left.w - currentPose.left.w) * amount;
  currentPose.left.h += (target.left.h - currentPose.left.h) * amount;
  currentPose.left.radius += (target.left.radius - currentPose.left.radius) * amount;

  currentPose.right.cx += (target.right.cx - currentPose.right.cx) * amount;
  currentPose.right.cy += (target.right.cy - currentPose.right.cy) * amount;
  currentPose.right.w += (target.right.w - currentPose.right.w) * amount;
  currentPose.right.h += (target.right.h - currentPose.right.h) * amount;
  currentPose.right.radius += (target.right.radius - currentPose.right.radius) * amount;
}

bool AnimationEngine::isSettled(const EyePose& target) const {
  const float total =
      fabsf(target.left.cx - currentPose.left.cx) +
      fabsf(target.left.cy - currentPose.left.cy) +
      fabsf(target.left.w - currentPose.left.w) +
      fabsf(target.left.h - currentPose.left.h) +
      fabsf(target.right.cx - currentPose.right.cx) +
      fabsf(target.right.cy - currentPose.right.cy) +
      fabsf(target.right.w - currentPose.right.w) +
      fabsf(target.right.h - currentPose.right.h);
  return total < 1.5f;
}
