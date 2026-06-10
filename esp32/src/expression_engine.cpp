#include "expression_engine.h"

Expression expressionFromString(const String& value) {
  if (value == "working") return Expression::Working;
  if (value == "tool_call_start") return Expression::ToolCallStart;
  if (value == "tool_call_end") return Expression::ToolCallEnd;
  if (value == "error") return Expression::Error;
  return Expression::Idle;
}

String expressionToString(Expression expression) {
  switch (expression) {
    case Expression::Working: return "working";
    case Expression::ToolCallStart: return "tool_call_start";
    case Expression::ToolCallEnd: return "tool_call_end";
    case Expression::Error: return "error";
    case Expression::Idle:
    default: return "idle";
  }
}

EyePair eyesFor(Expression expression) {
  switch (expression) {
    case Expression::Working: return {"|", "|"};
    case Expression::ToolCallStart:
    case Expression::ToolCallEnd: return {"|", "|"};
    case Expression::Error: return {"|", "|"};
    case Expression::Idle:
    default: return {"|", "|"};
  }
}
