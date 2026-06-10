#pragma once

#include <Arduino.h>
#include "state_machine.h"

Expression expressionFromString(const String& value);
Indicator indicatorFromString(const String& value);
DisplayPower displayPowerFromString(const String& value);
