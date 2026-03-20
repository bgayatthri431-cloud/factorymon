<?php
// ── post_event.php — Module 1 & 2 ────────────────────────
// Receives sensor reading from ES6 fetch()
// Validates input, detects fault, saves to MySQL

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

include 'db.php';

// Read JSON body
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    die(json_encode(['error' => 'Invalid JSON']));
}

// Validate required fields
$required = ['machine_id', 'machine_name', 'line', 'sensor_value', 'threshold_max'];
foreach ($required as $field) {
    if (!isset($data[$field]) || $data[$field] === '') {
        http_response_code(400);
        die(json_encode(['error' => "Missing field: $field"]));
    }
}

// Sanitize inputs
$machine_id    = $conn->real_escape_string(trim($data['machine_id']));
$machine_name  = $conn->real_escape_string(trim($data['machine_name']));
$line          = in_array($data['line'], ['A','B']) ? $data['line'] : 'A';
$sensor_value  = round((float)$data['sensor_value'], 2);
$threshold_max = round((float)$data['threshold_max'], 2);
$sensor_type   = $conn->real_escape_string($data['sensor_type'] ?? 'temperature');
$unit          = $conn->real_escape_string($data['unit'] ?? 'C');

// ── FAULT DETECTION ENGINE ────────────────────────────────
// normal   → below threshold
// warning  → at or above threshold
// critical → threshold + 10 or above
if ($sensor_value >= $threshold_max + 10) {
    $status     = 'critical';
    $event_type = 'fault';
} elseif ($sensor_value >= $threshold_max) {
    $status     = 'warning';
    $event_type = 'fault';
} else {
    $status     = 'normal';
    $event_type = 'reading';
}

// ── SAVE TO machine_events ────────────────────────────────
$sql = "INSERT INTO machine_events
        (machine_id, machine_name, line, sensor_type, sensor_value, unit, status, event_type, threshold_max)
        VALUES ('$machine_id', '$machine_name', '$line', '$sensor_type', $sensor_value, '$unit', '$status', '$event_type', $threshold_max)";

if (!$conn->query($sql)) {
    http_response_code(500);
    die(json_encode(['error' => 'Failed to save event', 'detail' => $conn->error]));
}

$event_id = $conn->insert_id;

// ── SAVE TO fault_log if fault ────────────────────────────
if ($event_type === 'fault') {
    $fsql = "INSERT INTO fault_log (event_id, machine_id, machine_name, line, fault_value)
             VALUES ($event_id, '$machine_id', '$machine_name', '$line', $sensor_value)";
    $conn->query($fsql);
}

// ── RESPOND ───────────────────────────────────────────────
echo json_encode([
    'success'    => true,
    'event_id'   => $event_id,
    'machine_id' => $machine_id,
    'status'     => $status,
    'event_type' => $event_type,
    'sensor_value' => $sensor_value,
    'threshold_max' => $threshold_max,
    'message'    => $event_type === 'fault'
        ? "FAULT DETECTED: $machine_name at {$sensor_value}°C"
        : "Reading saved: $machine_name at {$sensor_value}°C"
]);
?>
