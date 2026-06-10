#pragma once

#include <Arduino.h>
#include "display.h"
#include "state_machine.h"

struct EyePose {
  EyeGeometry left;
  EyeGeometry right;
  EyeStyle style;
  bool visible;
};

class AnimationEngine {
 public:
  explicit AnimationEngine(DisplayDriver& display);
  void setState(const DeviceState& state);
  void setIdleTimeout(uint32_t minutes);
  void tick();
  bool isTimedOut() const { return timedOut; }

 private:
  DisplayDriver& display;
  DeviceState deviceState;
  EyePose currentPose;
  EyePose targetPose;
  uint32_t nextAt = 0;
  uint32_t expressionStartedAt = 0;
  uint32_t lastCommandAt = 0;
  uint32_t idleTimeoutMs = 10UL * 60UL * 1000UL;
  bool initialized = false;
  bool timedOut = false;

  EyePose poseFor(Expression expression, uint32_t now) const;
  EyePose basePose(EyeStyle style = EyeStyle::Block, bool visible = true) const;
  EyeGeometry eye(float cx, float cy, float w, float h, float radius) const;
  void easeToward(const EyePose& target, float amount);
  bool isSettled(const EyePose& target) const;
  float breathePhase(uint32_t now) const;
};
