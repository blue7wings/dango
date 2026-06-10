#pragma once

#include <Arduino.h>
#include <functional>

struct BleCommand {
  String type;
  String event;
  String expression;
  String source;
  bool scheduleEnabled = false;
  String displayOffTime;
  String displayOnTime;
  uint64_t timestamp = 0;
  int16_t timezoneOffset = 0;
};

using AgentEventCallback = std::function<void(const BleCommand& command)>;

class AgentBleServer {
 public:
  explicit AgentBleServer(AgentEventCallback callback);
  void begin();
  void advertise();

 private:
  AgentEventCallback callback;
};
