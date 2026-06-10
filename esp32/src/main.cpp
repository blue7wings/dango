#include <Arduino.h>
#include "animation_engine.h"
#include "ble_server.h"
#include "display.h"
#include "expression_engine.h"
#include "screen_scheduler.h"
#include "state_machine.h"

St7789DisplayDriver display;
StateMachine stateMachine;
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
    Serial.printf(
        "display_schedule enabled=%d off=%s on=%s timezone=%d\n",
        command.scheduleEnabled,
        command.displayOffTime.c_str(),
        command.displayOnTime.c_str(),
        command.timezoneOffset);
    return;
  }

  if (command.timestamp > 0) {
    screenScheduler.syncClock(command.timestamp);
  }

  Expression next = command.expression.length() > 0
      ? expressionFromString(command.expression)
      : stateMachine.applyEvent(command.event);

  if (command.expression.length() > 0) {
    // Desktop can send an explicit expression for the test controls.
    stateMachine.setExpression(next);
  }
  animation.setExpression(next);
  Serial.printf("event=%s expression=%s\n", command.event.c_str(), expressionToString(next).c_str());
});

void setup() {
  Serial.begin(115200);
  display.begin();
  animation.setExpression(Expression::Idle);
  bleServer.begin();
  Serial.println("AgentFaceESP32 BLE ready");
}

void loop() {
  screenScheduler.tick();
  animation.tick();
  delay(5);
}
