#include "state_machine.h"

Expression expressionFromString(const String& value) {
  if (value == "focused") return Expression::Working;
  return Expression::Idle;
}

Indicator indicatorFromString(const String& value) {
  if (value == "green_solid") return Indicator::GreenSolid;
  if (value == "green_breathe") return Indicator::GreenBreathe;
  if (value == "yellow_solid") return Indicator::YellowSolid;
  if (value == "yellow_breathe") return Indicator::YellowBreathe;
  if (value == "red_solid") return Indicator::RedSolid;
  if (value == "red_breathe") return Indicator::RedBreathe;
  return Indicator::Off;
}

DisplayPower displayPowerFromString(const String& value) {
  if (value == "off") return DisplayPower::Off;
  return DisplayPower::On;
}
