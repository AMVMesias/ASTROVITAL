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


class FirmwareCsvTests(unittest.TestCase):
    def test_ble_firmware_eleven_columns_fragmented(self):
        line = "1.2,68,100,5,12.0,100,98,72,200,55000,49000\n"
        frames = Frames()
        received = []
        for index in range(0,len(line),20):
            received.extend(frames.feed(line[index:index+20].encode()))
        self.assertEqual(len(received),1)
        route, body = decode_serial(received[0], STAMP, "host:1", 11)
        self.assertEqual(route,"/api/v1/measurements")
        self.assertEqual(body["value"],68)
        self.assertNotEqual(body["value"],72)
        self.assertIn("host_received_csv_snapshot",body["note"])
        with self.assertRaises(ValueError):
            decode_serial(received[0],STAMP,"host:1")

    def test_ble_csv_missing_contact_and_zero_are_not_pulse(self):
        for state,bpm,status in [(0,0,"no_contact"),(50,0,"no_signal"),(100,0,"insufficient")]:
            line=f"0,{bpm},{state},0,0,50,0,0,50,0,0"
            route,body=decode_serial(line,STAMP,"host:1",11)
            self.assertEqual(route,"/api/v1/devices/status")
            self.assertEqual(body["status"],status)
        with self.assertRaises(ValueError):
            decode_serial("nan,68,100,0,0,50,0,0,50,0,0",STAMP,"host:1",11)


class BleConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_connected_bluez_device_does_not_require_advertising(self):
        from unittest.mock import AsyncMock, patch
        from bridge import find_ble_device
        device = object()
        scanner = AsyncMock()
        with patch("bridge.sys.platform", "linux"), patch("bridge.connected_bluez_device", new=AsyncMock(return_value=device)):
            self.assertIs(await find_ble_device("68:09:47:48:6A:CA", scanner), device)
        scanner.find_device_by_address.assert_not_awaited()

    async def test_scan_when_disconnected_and_report_not_found(self):
        from unittest.mock import AsyncMock, patch
        from bridge import find_ble_device, ble_error_message
        scanner = AsyncMock()
        scanner.find_device_by_address.return_value = None
        with patch("bridge.sys.platform", "linux"), patch("bridge.connected_bluez_device", new=AsyncMock(return_value=None)):
            with self.assertRaises(LookupError) as raised:
                await find_ble_device("68:09:47:48:6A:CA", scanner)
        self.assertIn("no descubierto", ble_error_message(raised.exception))
        scanner.find_device_by_address.assert_awaited_once()

    async def test_dbus_failure_is_not_reported_as_missing_device(self):
        from unittest.mock import AsyncMock, patch
        from bridge import find_ble_device, ble_error_message
        scanner = AsyncMock()
        with patch("bridge.sys.platform", "linux"), patch("bridge.connected_bluez_device", new=AsyncMock(side_effect=PermissionError(13, "private detail"))):
            with self.assertRaises(PermissionError) as raised:
                await find_ble_device("68:09:47:48:6A:CA", scanner)
        message = ble_error_message(raised.exception)
        self.assertIn("sin permiso", message)
        self.assertNotIn("private detail", message)
        scanner.find_device_by_address.assert_not_awaited()


class InspectionTests(unittest.TestCase):
    def test_every_fragmented_line_is_counted_without_sampling(self):
        from bridge import CsvInspection
        inspection = CsvInspection()
        lines = ["1,68,100,0,12,100,98,72,200,55000,49000\n",
                 "0,0,0,0,0,50,0,0,50,0,0\n",
                 "0,0,50,0,0,50,0,0,50,0,0\n",
                 "0,0,100,0,0,50,0,0,50,0,0\n",
                 "broken\n"]
        raw = "".join(lines).encode()
        for index in range(0,len(raw),20):
            inspection.feed(raw[index:index+20])
        summary = inspection.summary()
        self.assertEqual(summary.pop("duplicate_fragments_removed"),0)
        sample = summary.pop("last_sample")
        self.assertEqual(summary.pop("last_invalid_csv"),"broken")
        self.assertLessEqual(len(summary.pop("recent_notifications")),6)
        self.assertEqual(sample["ecg_status"],"insufficient")
        self.assertEqual(sample["fields"]["bpm_ecg"],0)
        self.assertEqual(sample["fields"]["estado_ecg_x50"],100)
        self.assertEqual(summary, {"complete":5,"invalid":1,"valid_bpm":1,
            "no_contact":1,"no_signal":1,"insufficient":1,"partial_bytes":0,
            "invalid_reasons":{"columns_1_expected_11":1}})


class InspectionReasonTests(unittest.TestCase):
    def test_distinguishes_changed_protocol_and_invalid_values(self):
        from bridge import CsvInspection
        inspection = CsvInspection()
        for line in ["1,68,2,0,12,100,98,72,200,55000,49000",
                     "1,301,100,0,12,100,98,72,200,55000,49000",
                     "label,68,100,0,12,100,98,72,200,55000,49000",
                     "nan,68,100,0,12,100,98,72,200,55000,49000"]:
            inspection.feed((line+"\n").encode())
        self.assertEqual(inspection.summary()["invalid_reasons"],{
            "ecg_state_not_0_50_100":1,"bpm_out_of_range":1,"non_numeric":1,"non_finite":1})


class NotificationCopyTests(unittest.TestCase):
    def test_observed_double_fragments_reconstruct_csv(self):
        from bridge import CsvInspection
        inspection = CsvInspection(2)
        parts = [b"0.0,0,0,0,0.0,50,0,0", b",50,1501,2313\n"]
        for part in parts:
            inspection.feed(part)
            inspection.feed(part)
        result = inspection.summary()
        self.assertEqual(result["complete"],1)
        self.assertEqual(result["invalid"],0)
        self.assertEqual(result["no_contact"],1)
        self.assertEqual(result["duplicate_fragments_removed"],2)

    def test_unmatched_pair_discards_partial_frame(self):
        from bridge import CsvInspection
        inspection = CsvInspection(2)
        inspection.feed(b"0.0,0,0,0,0.0,50,0,0")
        inspection.feed(b"0.0,0,0,0,0.0,50,0,0")
        inspection.feed(b",50,1501,2313\n")
        inspection.feed(b"different\n")
        self.assertEqual(inspection.summary()["invalid"],1)
        self.assertEqual(inspection.summary()["partial_bytes"],0)
        self.assertIsNone(inspection.summary()["last_sample"])
        self.assertEqual(inspection.summary()["invalid_reasons"],{
            "notification_copy_mismatch_check_BLE_NOTIFICATION_COPIES":1})


class TelemetryTests(unittest.TestCase):
    def test_all_fields_survive_no_contact_and_acknowledge_separately(self):
        from bridge import decode_telemetry
        value=decode_telemetry("0.0,0,0,-1,0.0,50,0,0,50,1490,2316",STAMP,"host:1")
        self.assertEqual(len(value["fields"]),11)
        self.assertEqual(value["fields"]["resp_mg"],-1)
        self.assertEqual(value["fields"]["ir"],1490)
        with tempfile.TemporaryDirectory() as directory:
            spool=Spool(str(Path(directory)/"telemetry.sqlite"))
            spool.put("esp32","host:1:telemetry","/api/v1/devices/telemetry",value)
            spool.flush("http://localhost","esp32","secret",lambda *args:(200,{"status":"recorded","readingId":"host:1"}))
            self.assertEqual(spool.db.execute("SELECT state FROM bridge_outbox").fetchone()[0],"confirmed")
            spool.close()


if __name__ == "__main__":
    unittest.main()
