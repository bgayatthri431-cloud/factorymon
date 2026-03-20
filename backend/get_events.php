<?php
// ── get_events.php — Module 5: Chart & History Engine ────
// API for fetching events, stats, chart data, machines

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

include 'db.php';

$action = $_GET['action'] ?? 'events';

switch ($action) {

    // ── All Events (Event Log page) ───────────────────────
    case 'events':
        $limit  = min((int)($_GET['limit'] ?? 50), 200);
        $offset = (int)($_GET['offset'] ?? 0);
        $line   = isset($_GET['line']) && in_array($_GET['line'], ['A','B'])
                  ? $conn->real_escape_string($_GET['line']) : null;
        $status = isset($_GET['status']) && in_array($_GET['status'], ['normal','warning','critical'])
                  ? $conn->real_escape_string($_GET['status']) : null;

        $where = '1=1';
        if ($line)   $where .= " AND line='$line'";
        if ($status) $where .= " AND status='$status'";

        $result = $conn->query(
            "SELECT * FROM machine_events
             WHERE $where
             ORDER BY created_at DESC
             LIMIT $limit OFFSET $offset"
        );

        $events = [];
        while ($row = $result->fetch_assoc()) $events[] = $row;

        $total = $conn->query("SELECT COUNT(*) as c FROM machine_events WHERE $where")->fetch_assoc()['c'];

        echo json_encode([
            'events' => $events,
            'count'  => count($events),
            'total'  => (int)$total
        ]);
        break;

    // ── Chart Data ────────────────────────────────────────
    case 'chart':
        $machine_id = $conn->real_escape_string($_GET['machine_id'] ?? 'M1');
        $limit      = min((int)($_GET['limit'] ?? 20), 50);

        $result = $conn->query(
            "SELECT sensor_value, status, created_at
             FROM machine_events
             WHERE machine_id='$machine_id'
             ORDER BY created_at DESC
             LIMIT $limit"
        );

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        $rows = array_reverse($rows);

        $labels = $values = $statuses = [];
        foreach ($rows as $row) {
            $labels[]   = date('H:i:s', strtotime($row['created_at']));
            $values[]   = (float)$row['sensor_value'];
            $statuses[] = $row['status'];
        }

        echo json_encode([
            'labels'   => $labels,
            'values'   => $values,
            'statuses' => $statuses
        ]);
        break;

    // ── Fault Log ─────────────────────────────────────────
    case 'faults':
        $limit  = min((int)($_GET['limit'] ?? 20), 100);
        $result = $conn->query(
            "SELECT * FROM fault_log
             ORDER BY fault_time DESC
             LIMIT $limit"
        );
        $faults = [];
        while ($row = $result->fetch_assoc()) $faults[] = $row;
        echo json_encode(['faults' => $faults, 'count' => count($faults)]);
        break;

    // ── All Machines ──────────────────────────────────────
    case 'machines':
        $result = $conn->query(
            "SELECT * FROM machines
             WHERE is_active = 1
             ORDER BY line, machine_id"
        );
        $machines = [];
        while ($row = $result->fetch_assoc()) $machines[] = $row;
        echo json_encode(['machines' => $machines]);
        break;

    // ── Live Stats ────────────────────────────────────────
    case 'stats':
        $total    = (int)$conn->query("SELECT COUNT(*) as c FROM machine_events")->fetch_assoc()['c'];
        $faults   = (int)$conn->query("SELECT COUNT(*) as c FROM machine_events WHERE event_type='fault'")->fetch_assoc()['c'];
        $normal   = (int)$conn->query("SELECT COUNT(*) as c FROM machine_events WHERE status='normal'")->fetch_assoc()['c'];
        $warning  = (int)$conn->query("SELECT COUNT(*) as c FROM machine_events WHERE status='warning'")->fetch_assoc()['c'];
        $critical = (int)$conn->query("SELECT COUNT(*) as c FROM machine_events WHERE status='critical'")->fetch_assoc()['c'];

        echo json_encode(compact('total', 'faults', 'normal', 'warning', 'critical'));
        break;

    // ── Clear All Events (Demo reset) ─────────────────────
    case 'clear':
        $conn->query("TRUNCATE TABLE machine_events");
        $conn->query("TRUNCATE TABLE fault_log");
        echo json_encode(['success' => true, 'message' => 'All events cleared']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}

$conn->close();
?>
