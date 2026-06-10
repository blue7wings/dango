#pragma once

#include <Arduino.h>
#include <functional>

struct BleCommand {
  String type;
  String expression;
  String indicator;
  String display;
  // display_schedule fields
  bool scheduleEnabled = false;
  String displayOffTime;
  String displayOnTime;
  uint64_t timestamp = 0;
  int16_t timezoneOffset = 0;
  int16_t idleTimeoutMinutes = -1;
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
