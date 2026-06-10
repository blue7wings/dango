#include <Arduino.h>
#include "animation_engine.h"
#include "ble_server.h"
#include "display.h"
#include "expression_engine.h"
#include "screen_scheduler.h"
#include "state_machine.h"

St7789DisplayDriver display;
AnimationEngine animation(display);
ScreenScheduler screenScheduler(display);

AgentBleServer bleServer([](const BleCommand& command) {
  if (command.type == "display_schedule") {
    screenScheduler.configure(
        command.scheduleEnabled,
        command.displayOffTime,
        command.displayOnTime,
        command.timestamp,
        command.timezoneOffset);
    Serial.printf("display_schedule enabled=%d off=%s on=%s\n",
        command.scheduleEnabled,
        command.displayOffTime.c_str(),
        command.displayOnTime.c_str());
    return;
  }

  if (command.type == "idle_timeout") {
    if (command.idleTimeoutMinutes >= 0) {
      animation.setIdleTimeout(command.idleTimeoutMinutes);
      Serial.printf("idle_timeout=%d min\n", command.idleTimeoutMinutes);
    }
    return;
  }

  if (command.timestamp > 0) {
    screenScheduler.syncClock(command.timestamp);
  }

  if (command.idleTimeoutMinutes >= 0) {
    animation.setIdleTimeout(command.idleTimeoutMinutes);
  }

  DeviceState state;
  state.expression = command.expression.length() > 0
      ? expressionFromString(command.expression)
      : Expression::Idle;
  state.indicator = command.indicator.length() > 0
      ? indicatorFromString(command.indicator)
      : Indicator::Off;
  state.display = command.display.length() > 0
      ? displayPowerFromString(command.display)
      : DisplayPower::On;

  animation.setState(state);
  Serial.printf("face=%s indicator=%s display=%s\n",
      command.expression.c_str(),
      command.indicator.c_str(),
      command.display.c_str());
});

void setup() {
  Serial.begin(115200);
  display.begin();
  DeviceState initial;
  animation.setState(initial);
  bleServer.begin();
  Serial.println("AgentFaceESP32 BLE ready");
}

void loop() {
  screenScheduler.tick();
  if (!screenScheduler.isScreenOff()) {
    animation.tick();
  }
  delay(5);
}
