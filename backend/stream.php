<?php
// ── Module 3: Production Line Broadcast Engine ────────────
// Keeps connection open and pushes new events to browser via SSE
include 'db.php';

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Access-Control-Allow-Origin: *');

$lastId = (int)($_GET['lastId'] ?? 0);
$line   = isset($_GET['line']) ? $conn->real_escape_string($_GET['line']) : null;

// Send a comment to keep connection alive immediately
echo ": connected\n\n";
ob_flush(); flush();

while (true) {
    // Build query — filter by line if specified
    $where = "id > $lastId";
    if ($line && in_array($line, ['A', 'B'])) {
        $where .= " AND line = '$line'";
    }

    $result = $conn->query("SELECT * FROM machine_events WHERE $where ORDER BY id ASC");

    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            echo "id: " . $row['id'] . "\n";
            echo "data: " . json_encode($row) . "\n\n";
            $lastId = $row['id'];
        }
        ob_flush(); flush();
    }

    // Send heartbeat every cycle to keep connection alive
    echo ": heartbeat\n\n";
    ob_flush(); flush();

    if (connection_aborted()) break;

    sleep(2);
}
?>
