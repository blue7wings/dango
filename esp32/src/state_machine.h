#pragma once

#include <Arduino.h>

enum class Expression {
  Idle,
  Working
};

enum class Indicator {
  Off,
  GreenSolid,
  GreenBreathe,
  YellowSolid,
  YellowBreathe,
  RedSolid,
  RedBreathe
};

enum class DisplayPower {
  On,
  Off
};

struct DeviceState {
  Expression expression = Expression::Idle;
  Indicator indicator = Indicator::Off;
  DisplayPower display = DisplayPower::On;
};
