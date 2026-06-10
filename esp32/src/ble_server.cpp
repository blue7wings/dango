#include "ble_server.h"
#include <ArduinoJson.h>
#include <NimBLEDevice.h>
#include "config.h"

namespace {
AgentEventCallback onAgentEvent;

class CommandCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic) override {
    std::string raw = characteristic->getValue();
    String payload(raw.c_str());
    payload.trim();
    if (payload.length() == 0) return;

    BleCommand command;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err) {
      command.type = doc["type"] | "device_command";
      command.expression = doc["face"] | "";
      command.indicator = doc["indicator"] | "";
      command.display = doc["display"] | "";
      command.scheduleEnabled = doc["enabled"] | false;
      command.displayOffTime = doc["off"] | "22:00";
      command.displayOnTime = doc["on"] | "08:00";
      command.timestamp = doc["timestamp"].as<uint64_t>();
      command.timezoneOffset = doc["timezoneOffset"] | 0;
      command.idleTimeoutMinutes = doc["idleTimeoutMinutes"] | -1;
    }

    if (onAgentEvent) onAgentEvent(command);
  }
};

class ServerCallbacks : public NimBLEServerCallbacks {
  void onDisconnect(NimBLEServer* server) override {
    server->startAdvertising();
  }
};
}  // namespace

AgentBleServer::AgentBleServer(AgentEventCallback callback) : callback(callback) {}

void AgentBleServer::begin() {
  onAgentEvent = callback;
  NimBLEDevice::init(DEVICE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  NimBLEService* service = server->createService(SERVICE_UUID);
  NimBLECharacteristic* command = service->createCharacteristic(
      CHARACTERISTIC_UUID,
      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  command->setCallbacks(new CommandCallbacks());
  service->start();
  advertise();
}

void AgentBleServer::advertise() {
  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();
}
