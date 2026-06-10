#include "state_machine.h"

Expression StateMachine::current() const {
  return active;
}

void StateMachine::setExpression(Expression expression) {
  active = expression;
}

Expression StateMachine::applyEvent(const String& event) {
  Expression next = active;
  if (event == "stop") next = Expression::Idle;
  else if (event == "session_start") next = Expression::Idle;
  else if (event == "user_prompt_submit" || event == "ai_running") next = Expression::Working;
  else if (event == "tool_call_start" || event == "tool_use") next = Expression::ToolCallStart;
  else if (event == "tool_call_end" || event == "tool_done") next = Expression::ToolCallEnd;
  else if (event == "permission_request" || event == "error") next = Expression::Error;

  if (event == "stop" || event == "session_start") {
    active = Expression::Idle;
    return active;
  }
  // Error is intentionally sticky until stop or a new session arrives.
  if (active == Expression::Error) {
    return active;
  }
  if (event == "tool_call_end" || event == "tool_done" || priority(next) >= priority(active)) {
    active = next;
  }
  return active;
}

int StateMachine::priority(Expression expression) const {
  switch (expression) {
    case Expression::Error: return 60;
    case Expression::ToolCallStart: return 45;
    case Expression::Working: return 40;
    case Expression::ToolCallEnd: return 35;
    case Expression::Idle:
    default: return 0;
  }
}
