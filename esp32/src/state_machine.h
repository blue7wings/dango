#pragma once

#include <Arduino.h>

enum class Expression {
  Idle,
  Working,
  ToolCallStart,
  ToolCallEnd,
  Error
};

class StateMachine {
 public:
  Expression current() const;
  Expression applyEvent(const String& event);
  void setExpression(Expression expression);

 private:
  Expression active = Expression::Idle;
  int priority(Expression expression) const;
};
