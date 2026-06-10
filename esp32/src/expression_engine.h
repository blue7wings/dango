#pragma once

#include <Arduino.h>
#include "state_machine.h"

struct EyePair {
  const char* left;
  const char* right;
};

Expression expressionFromString(const String& value);
String expressionToString(Expression expression);
EyePair eyesFor(Expression expression);
