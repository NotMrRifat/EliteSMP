<?php

namespace EliteTelegramBridge;

use pocketmine\plugin\PluginBase;
use pocketmine\event\Listener;
use pocketmine\event\player\PlayerJoinEvent;
use pocketmine\event\player\PlayerQuitEvent;
use pocketmine\console\ConsoleCommandSender;
use pocketmine\scheduler\ClosureTask;

class Main extends PluginBase implements Listener {

    private string $webhookUrl = "";
    private string $bridgeKey = "";
    private string $serverName = "EliteSMP Bedrock";
    private int $startTime = 0;
    private array $lastEventTimes = [];

    public function onEnable(): void {
        $this->saveDefaultConfig();
        $this->startTime = time();

        $config = $this->getConfig();
        $this->webhookUrl = (string) $config->get("vercel-events-url", "https://elitesmp.vercel.app/api/events");
        $this->bridgeKey = (string) $config->get("bridge-key", "change_me_to_your_secure_bridge_key");
        $this->serverName = (string) $config->get("server-name", "EliteSMP Bedrock");

        $this->getServer()->getPluginManager()->registerEvents($this, $this);

        $this->getLogger()->info("EliteTelegramBridge Bedrock Plugin (PocketMine-MP) enabled!");

        if (!empty($this->webhookUrl) && $config->get("enable-event-webhooks", true)) {
            $this->getLogger()->info("Event webhooks targeting: " . $this->webhookUrl);
            $this->sendEventAsync("SERVER_ONLINE", null, count($this->getServer()->getOnlinePlayers()), $this->getServer()->getMaxPlayers());

            // Schedule periodic command polling (every 5 seconds) to fetch queued Telegram commands
            $this->getScheduler()->scheduleRepeatingTask(new ClosureTask(function(): void {
                $this->pollQueuedCommands();
            }), 100); // 100 ticks = 5 seconds
        }
    }

    public function onDisable(): void {
        if (!empty($this->webhookUrl) && $this->getConfig()->get("enable-event-webhooks", true)) {
            $this->sendEventSync("SERVER_OFFLINE", null, 0, $this->getServer()->getMaxPlayers());
        }
        $this->getLogger()->info("EliteTelegramBridge disabled.");
    }

    public function onPlayerJoin(PlayerJoinEvent $event): void {
        $player = $event->getPlayer()->getName();
        $online = count($this->getServer()->getOnlinePlayers());
        $max = $this->getServer()->getMaxPlayers();

        $this->sendEventAsync("PLAYER_JOIN", $player, $online, $max);
    }

    public function onPlayerQuit(PlayerQuitEvent $event): void {
        $player = $event->getPlayer()->getName();
        $online = max(0, count($this->getServer()->getOnlinePlayers()) - 1);
        $max = $this->getServer()->getMaxPlayers();

        $this->sendEventAsync("PLAYER_QUIT", $player, $online, $max);
    }

    /**
     * Send event webhook to Vercel (Async)
     */
    public function sendEventAsync(string $type, ?string $player, int $online, int $max): void {
        $eventKey = $type . ":" . ($player ?? "server");
        $now = time();
        if (isset($this->lastEventTimes[$eventKey]) && ($now - $this->lastEventTimes[$eventKey]) < 3) {
            return;
        }
        $this->lastEventTimes[$eventKey] = $now;

        $url = $this->webhookUrl;
        $key = $this->bridgeKey;

        if (empty($url)) return;

        $payload = json_encode([
            "type" => $type,
            "player" => $player,
            "online" => $online,
            "max" => $max,
            "server" => $this->serverName,
            "platform" => "Bedrock (PocketMine-MP)"
        ]);

        $this->getScheduler()->scheduleTask(new ClosureTask(function() use ($url, $key, $payload): void {
            $this->postHttps($url, $key, $payload);
        }));
    }

    /**
     * Send event webhook synchronously (for disable)
     */
    public function sendEventSync(string $type, ?string $player, int $online, int $max): void {
        $url = $this->webhookUrl;
        $key = $this->bridgeKey;

        if (empty($url)) return;

        $payload = json_encode([
            "type" => $type,
            "player" => $player,
            "online" => $online,
            "max" => $max,
            "server" => $this->serverName,
            "platform" => "Bedrock (PocketMine-MP)"
        ]);

        $this->postHttps($url, $key, $payload);
    }

    /**
     * Poll Vercel for queued Telegram admin commands (/cmd & /announce)
     */
    private function pollQueuedCommands(): void {
        $url = rtrim($this->webhookUrl, "/") . "?action=poll";
        $key = $this->bridgeKey;

        if (empty($url)) return;

        $response = $this->getHttps($url, $key);
        if ($response === null) return;

        $data = json_decode($response, true);
        if (!is_array($data) || empty($data["commands"])) return;

        foreach ($data["commands"] as $cmdItem) {
            $id = $cmdItem["id"] ?? null;
            $type = $cmdItem["type"] ?? null;
            $payload = $cmdItem["payload"] ?? null;

            if (!$id || !$payload) continue;

            if ($type === "say") {
                $announcement = "[Telegram] " . $payload;
                $this->getServer()->broadcastMessage($announcement);
                $this->sendResult($id, true, "Broadcasted announcement: " . $announcement);
            } elseif ($type === "command") {
                $sender = new ConsoleCommandSender($this->getServer(), $this->getServer()->getLanguage());
                $this->getServer()->dispatchCommand($sender, $payload);
                $this->sendResult($id, true, "Executed console command: " . $payload);
            }
        }
    }

    private function sendResult(string $id, bool $success, string $output): void {
        $url = $this->webhookUrl;
        $key = $this->bridgeKey;
        $payload = json_encode([
            "action" => "command_result",
            "id" => $id,
            "success" => $success,
            "output" => $output
        ]);

        $this->postHttps($url, $key, $payload);
    }

    private function postHttps(string $url, string $key, string $payload): ?string {
        if (function_exists("curl_init")) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Content-Type: application/json",
                "X-Bridge-Key: " . $key
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 4);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $res = curl_exec($ch);
            curl_close($ch);
            return is_string($res) ? $res : null;
        }

        // Fallback using stream context if cURL extension is not loaded
        $opts = [
            "http" => [
                "method" => "POST",
                "header" => "Content-Type: application/json\r\n" . "X-Bridge-Key: " . $key . "\r\n",
                "content" => $payload,
                "timeout" => 4
            ],
            "ssl" => [
                "verify_peer" => false,
                "verify_peer_name" => false
            ]
        ];
        $context = stream_context_create($opts);
        $res = @file_get_contents($url, false, $context);
        return is_string($res) ? $res : null;
    }

    private function getHttps(string $url, string $key): ?string {
        if (function_exists("curl_init")) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Content-Type: application/json",
                "X-Bridge-Key: " . $key
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 4);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $res = curl_exec($ch);
            curl_close($ch);
            return is_string($res) ? $res : null;
        }

        $opts = [
            "http" => [
                "method" => "GET",
                "header" => "Content-Type: application/json\r\n" . "X-Bridge-Key: " . $key . "\r\n",
                "timeout" => 4
            ],
            "ssl" => [
                "verify_peer" => false,
                "verify_peer_name" => false
            ]
        ];
        $context = stream_context_create($opts);
        $res = @file_get_contents($url, false, $context);
        return is_string($res) ? $res : null;
    }
}
