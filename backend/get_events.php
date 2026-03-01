<?php
// ── Module 5: Event History & Chart Data API ──────────────
include 'db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$action = $_GET['action'] ?? 'events';

switch ($action) {

    // Get recent events (for event log page)
    case 'events':
        $line   = isset($_GET['line']) ? $conn->real_escape_string($_GET['line']) : null;
        $limit  = (int)($_GET['limit'] ?? 50);
        $offset = (int)($_GET['offset'] ?? 0);

        $where = $line && in_array($line, ['A','B']) ? "WHERE line='$line'" : "";
        $result = $conn->query(
            "SELECT * FROM machine_events $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset"
        );
        $events = [];
        while ($row = $result->fetch_assoc()) $events[] = $row;
        echo json_encode(['events' => $events, 'count' => count($events)]);
        break;

    // Get chart data — temperature over time per machine
    case 'chart':
        $machine_id = $conn->real_escape_string($_GET['machine_id'] ?? 'M1');
        $limit      = (int)($_GET['limit'] ?? 20);
        $result = $conn->query(
            "SELECT sensor_value, status, created_at FROM machine_events
             WHERE machine_id='$machine_id'
             ORDER BY created_at DESC LIMIT $limit"
        );
        $labels = []; $values = []; $statuses = [];
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        $rows = array_reverse($rows);
        foreach ($rows as $row) {
            $labels[]   = date('H:i:s', strtotime($row['created_at']));
            $values[]   = (float)$row['sensor_value'];
            $statuses[] = $row['status'];
        }
        echo json_encode(['labels' => $labels, 'values' => $values, 'statuses' => $statuses]);
        break;

    // Get fault summary
    case 'faults':
        $result = $conn->query(
            "SELECT * FROM fault_log ORDER BY fault_time DESC LIMIT 20"
        );
        $faults = [];
        while ($row = $result->fetch_assoc()) $faults[] = $row;
        echo json_encode(['faults' => $faults]);
        break;

    // Get all machines
    case 'machines':
        $result = $conn->query("SELECT * FROM machines WHERE is_active=1 ORDER BY line, machine_id");
        $machines = [];
        while ($row = $result->fetch_assoc()) $machines[] = $row;
        echo json_encode(['machines' => $machines]);
        break;

    // Live stats summary
    case 'stats':
        $total   = $conn->query("SELECT COUNT(*) as c FROM machine_events")->fetch_assoc()['c'];
        $faults  = $conn->query("SELECT COUNT(*) as c FROM machine_events WHERE event_type='fault'")->fetch_assoc()['c'];
        $normal  = $conn->query("SELECT COUNT(*) as c FROM machine_events WHERE status='normal'")->fetch_assoc()['c'];
        $critical= $conn->query("SELECT COUNT(*) as c FROM machine_events WHERE status='critical'")->fetch_assoc()['c'];
        echo json_encode(compact('total','faults','normal','critical'));
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
?>
