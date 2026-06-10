#pragma once

#include <Arduino.h>
#include "display.h"

class ScreenScheduler {
 public:
  explicit ScreenScheduler(DisplayDriver& display);

  void configure(bool enabled, const String& offTime, const String& onTime,
                 uint64_t timestampMs, int16_t timezoneOffsetMinutes);
  void syncClock(uint64_t timestampMs);
  void tick();
  bool isScreenOff() const { return !screenOn; }

 private:
  DisplayDriver& display;
  bool enabled = false;
  bool clockSynced = false;
  bool screenOn = true;
  uint16_t offMinute = 22 * 60;
  uint16_t onMinute = 8 * 60;
  int16_t timezoneOffsetMinutes = 0;
  uint64_t baseEpochMs = 0;
  uint32_t baseMillis = 0;
  uint32_t nextCheckAt = 0;

  uint16_t parseMinute(const String& value, uint16_t fallback) const;
  bool shouldScreenBeOff(uint16_t localMinute) const;
};
