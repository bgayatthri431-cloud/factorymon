<?php
// ── Module 2: Machine Event Capture ──────────────────────
// Receives sensor readings, detects faults, saves to MySQL
include 'db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['machine_id'], $data['sensor_value'])) {
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

$machine_id   = $conn->real_escape_string($data['machine_id']);
$machine_name = $conn->real_escape_string($data['machine_name'] ?? 'Unknown');
$line         = $conn->real_escape_string($data['line'] ?? 'A');
$sensor_value = (float)$data['sensor_value'];
$threshold    = (float)($data['threshold_max'] ?? 85.00);

// ── Fault Detection Engine ────────────────────────────────
if ($sensor_value >= $threshold) {
    $status     = $sensor_value >= ($threshold + 10) ? 'critical' : 'warning';
    $event_type = 'fault';
} else {
    $status     = 'normal';
    $event_type = 'reading';
}

// ── Save Event to MySQL ───────────────────────────────────
$sql = "INSERT INTO machine_events 
        (machine_id, machine_name, line, sensor_value, status, event_type, threshold_max)
        VALUES ('$machine_id','$machine_name','$line',$sensor_value,'$status','$event_type',$threshold)";

if (!$conn->query($sql)) {
    echo json_encode(['error' => 'Insert failed: ' . $conn->error]);
    exit;
}

$event_id = $conn->insert_id;

// ── Log fault separately ──────────────────────────────────
if ($event_type === 'fault') {
    $conn->query("INSERT INTO fault_log (event_id, machine_id, machine_name, line, fault_value)
                  VALUES ($event_id,'$machine_id','$machine_name','$line',$sensor_value)");
}

echo json_encode([
    'success'     => true,
    'id'          => $event_id,
    'status'      => $status,
    'event_type'  => $event_type,
    'fault'       => $event_type === 'fault'
]);
?>
