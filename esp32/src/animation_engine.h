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
  void setExpression(Expression expression);
  void tick();

 private:
  DisplayDriver& display;
  Expression expression = Expression::Idle;
  EyePose currentPose;
  EyePose targetPose;
  uint32_t nextAt = 0;
  uint32_t lastActiveAt = 0;
  uint32_t expressionStartedAt = 0;
  bool initialized = false;

  EyePose poseFor(Expression expression, uint32_t now) const;
  EyePose basePose(EyeStyle style = EyeStyle::Block, bool visible = true) const;
  EyeGeometry eye(float cx, float cy, float w, float h, float radius) const;
  void easeToward(const EyePose& target);
  void easeToward(const EyePose& target, float amount);
  bool isSettled(const EyePose& target) const;
  bool isMostlyStatic(Expression expression) const;
  uint32_t frameDelayFor(Expression expression) const;
};
