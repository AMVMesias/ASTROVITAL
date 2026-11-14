import json
import tempfile
import unittest
from pathlib import Path
from bridge import Frames, Spool, decode_ble, decode_serial, utc

STAMP = "2026-01-01T12:00:00.000Z"
VALID = "1.2,68,100,5,12.0,100,120,98,68,150"


class BridgeTests(unittest.TestCase):
    def test_original_csv_is_sampled_pulse_not_ecg_or_oximetry(self):
        route, value = decode_serial(VALID, STAMP, "host-boot:1")
        self.assertEqual(route, "/api/v1/measurements")
        self.assertEqual(value["value"], 68)
        self.assertEqual(value["capturedAt"], STAMP)
        self.assertIn("host_received_csv_snapshot", value["note"])
        self.assertNotIn("spo2", value)

    def test_zero_and_signal_loss_are_status_not_measurement(self):
        for state, bpm, expected in [(0, 0, "no_contact"), (50, 0, "no_signal"), (100, 0, "insufficient")]:
            fields = VALID.split(",")
            fields[1:3] = [str(bpm), str(state)]
            route, body = decode_serial(",".join(fields), STAMP, "host:1")
            self.assertEqual(route, "/api/v1/devices/status")
            self.assertEqual(body["status"], expected)
            self.assertNotIn("value", body)

    def test_rejects_debug_csv_infinite_values_and_bad_dates(self):
        for line in ["LO+: 1", "1,2,3", VALID.replace("68", "nan"), VALID.replace("100", "99", 1)]:
            with self.assertRaises(ValueError):
                decode_serial(line, STAMP, "x")
        with self.assertRaises(ValueError):
            utc("2026-02-30T12:00:00Z")

    def test_fragmented_ble_frame_and_device_binding(self):
        frames = Frames()
        packet = {"v": 1, "deviceId": "esp32", "bootId": "boot01", "sequence": 1, "quality": "valid", "bpm": 68, "capturedAt": STAMP}
        data = (json.dumps(packet) + "\n").encode()
        self.assertEqual(frames.feed(data[:10]), [])
        line = frames.feed(data[10:])[0]
        event_id, route, body = decode_ble(line, "esp32", STAMP)
        self.assertEqual(event_id, "boot01:1")
        self.assertEqual(body["capturedAt"], STAMP)
        self.assertIn("firmware_utc", body["note"])
        with self.assertRaises(ValueError):
            decode_ble(line, "another", STAMP)
        packet["sequence"] = True
        with self.assertRaises(ValueError):
            decode_ble(json.dumps(packet), "esp32", STAMP)
        with self.assertRaises(ValueError):
            Frames().feed(b"x" * 16385)

    def test_outbox_survives_restart_and_lost_confirmation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "bridge.sqlite")
            spool = Spool(path)
            route, body = decode_serial(VALID, STAMP, "boot:1")
            spool.put("esp32", "boot:1", route, body)
            calls = []
            def lost(_url, _device, _token, encoded):
                calls.append(encoded)
                raise OSError("lost confirmation")
            spool.flush("http://localhost", "esp32", "not-stored", lost)
            spool.close()
            spool = Spool(path)
            def ack(_url, _device, _token, encoded):
                calls.append(encoded)
                return 200, {"measurement": {"readingId": "boot:1"}}
            spool.flush("http://localhost", "esp32", "not-stored", ack)
            self.assertEqual(calls[0], calls[1])
            self.assertEqual(spool.observed_at("esp32", "boot:1"), STAMP)
            self.assertEqual(spool.db.execute("SELECT state,attempts FROM bridge_outbox").fetchone(), ("confirmed", 2))
            spool.put("esp32", "boot:1", route, body)
            with self.assertRaises(ValueError):
                spool.put("esp32", "boot:1", route, {**body, "value": 70})
            spool.close()

    def test_rejections_visible_retry_explicit_and_device_scoped(self):
        with tempfile.TemporaryDirectory() as directory:
            spool = Spool(str(Path(directory) / "bridge.sqlite"))
            route, body = decode_serial(VALID, STAMP, "boot:1")
            spool.put("esp32", "boot:1", route, body)
            spool.flush("http://localhost", "another", "secret", lambda *args: self.fail("Must not send another device"))
            spool.flush("http://localhost", "esp32", "secret", lambda *args: (401, {"error": {"code": "DEVICE_UNAUTHORIZED"}}))
            self.assertEqual(spool.db.execute("SELECT state,reason FROM bridge_outbox").fetchone(), ("rejected", "DEVICE_UNAUTHORIZED"))
            spool.retry("esp32")
            self.assertEqual(spool.db.execute("SELECT state FROM bridge_outbox").fetchone()[0], "pending")
            self.assertNotIn("secret", json.dumps(spool.db.execute("SELECT * FROM bridge_outbox").fetchall()))
            spool.close()


if __name__ == "__main__":
    unittest.main()
