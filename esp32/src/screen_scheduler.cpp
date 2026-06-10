#include "screen_scheduler.h"

ScreenScheduler::ScreenScheduler(St7789DisplayDriver& display) : display(display) {}

void ScreenScheduler::configure(
    bool nextEnabled,
    const String& offTime,
    const String& onTime,
    uint64_t timestampMs,
    int16_t nextTimezoneOffsetMinutes) {
  enabled = nextEnabled;
  offMinute = parseMinute(offTime, offMinute);
  onMinute = parseMinute(onTime, onMinute);
  syncClock(timestampMs, nextTimezoneOffsetMinutes);

  if (!enabled && !screenOn) {
    display.setBacklight(true);
    screenOn = true;
  }
  nextCheckAt = 0;
  applySchedule(millis());
}

void ScreenScheduler::syncClock(uint64_t timestampMs, int16_t nextTimezoneOffsetMinutes) {
  timezoneOffsetMinutes = nextTimezoneOffsetMinutes;
  syncClock(timestampMs);
}

void ScreenScheduler::syncClock(uint64_t timestampMs) {
  if (timestampMs == 0) return;
  baseEpochMs = timestampMs;
  baseMillis = millis();
  clockSynced = true;
}

void ScreenScheduler::tick() {
  const uint32_t now = millis();
  if (static_cast<int32_t>(now - nextCheckAt) < 0) return;
  nextCheckAt = now + 1000;
  applySchedule(now);
}

uint16_t ScreenScheduler::parseMinute(const String& value, uint16_t fallback) const {
  if (value.length() != 5 || value.charAt(2) != ':') return fallback;
  const int hour = value.substring(0, 2).toInt();
  const int minute = value.substring(3, 5).toInt();
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return static_cast<uint16_t>(hour * 60 + minute);
}

bool ScreenScheduler::shouldScreenBeOff(uint16_t localMinute) const {
  if (offMinute == onMinute) return false;
  if (offMinute < onMinute) {
    return localMinute >= offMinute && localMinute < onMinute;
  }
  return localMinute >= offMinute || localMinute < onMinute;
}

void ScreenScheduler::applySchedule(uint32_t now) {
  if (!enabled || !clockSynced) return;

  const uint32_t elapsedMs = now - baseMillis;
  const uint64_t currentEpochMs = baseEpochMs + elapsedMs;
  const int64_t utcMinute = static_cast<int64_t>(currentEpochMs / 60000ULL);
  int64_t localMinute = (utcMinute + timezoneOffsetMinutes) % (24 * 60);
  if (localMinute < 0) localMinute += 24 * 60;

  const bool nextScreenOn = !shouldScreenBeOff(static_cast<uint16_t>(localMinute));
  if (nextScreenOn == screenOn) return;

  display.setBacklight(nextScreenOn);
  screenOn = nextScreenOn;
  Serial.printf("display backlight=%s localMinute=%lld\n", screenOn ? "on" : "off", localMinute);
}
