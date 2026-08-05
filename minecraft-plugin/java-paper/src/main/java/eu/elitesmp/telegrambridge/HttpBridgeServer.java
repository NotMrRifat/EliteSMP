package eu.elitesmp.telegrambridge;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;

public class HttpBridgeServer {

    private final EliteTelegramBridge plugin;
    private final int port;
    private final String bridgeKey;
    private HttpServer server;

    public HttpBridgeServer(EliteTelegramBridge plugin, int port, String bridgeKey) {
        this.plugin = plugin;
        this.port = port;
        this.bridgeKey = bridgeKey;
    }

    public void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newCachedThreadPool());

        server.createContext("/status", new StatusHandler());
        server.createContext("/players", new PlayersHandler());
        server.createContext("/command", new CommandHandler());
        server.createContext("/say", new SayHandler());

        server.start();
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private boolean checkAuth(HttpExchange exchange) {
        if (bridgeKey == null || bridgeKey.isEmpty() || "change_me_to_your_secure_bridge_key".equals(bridgeKey)) {
            return true;
        }
        List<String> keys = exchange.getRequestHeaders().get("X-Bridge-Key");
        return keys != null && !keys.isEmpty() && bridgeKey.equals(keys.get(0));
    }

    private void sendJson(HttpExchange exchange, int statusCode, String json) throws Exception {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private String readBody(HttpExchange exchange) throws Exception {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
    }

    private class StatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                if (!checkAuth(exchange)) {
                    sendJson(exchange, 401, "{\"ok\":false, \"error\":\"Unauthorized\"}");
                    return;
                }

                int online = Bukkit.getOnlinePlayers().size();
                int max = Bukkit.getMaxPlayers();
                String uptime = plugin.getUptimeFormatted();

                List<String> names = new ArrayList<>();
                for (Player p : Bukkit.getOnlinePlayers()) {
                    names.add(p.getName());
                }

                StringBuilder namesJson = new StringBuilder("[");
                for (int i = 0; i < names.size(); i++) {
                    namesJson.append("\"").append(escapeJson(names.get(i))).append("\"");
                    if (i < names.size() - 1) namesJson.append(",");
                }
                namesJson.append("]");

                String json = String.format(
                    "{\"ok\":true,\"state\":\"🟢 ONLINE\",\"rawState\":\"ONLINE\",\"serverName\":\"%s\",\"players\":{\"online\":%d,\"max\":%d,\"names\":%s},\"uptime\":\"%s\",\"tps\":20.0,\"version\":\"%s\"}",
                    escapeJson(plugin.getConfig().getString("server-name", "EliteSMP")),
                    online, max, namesJson.toString(), escapeJson(uptime), escapeJson(Bukkit.getVersion())
                );

                sendJson(exchange, 200, json);
            } catch (Exception e) {
                try {
                    sendJson(exchange, 500, "{\"ok\":false, \"error\":\"" + escapeJson(e.getMessage()) + "\"}");
                } catch (Exception ignored) {}
            }
        }
    }

    private class PlayersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                if (!checkAuth(exchange)) {
                    sendJson(exchange, 401, "{\"ok\":false, \"error\":\"Unauthorized\"}");
                    return;
                }

                List<String> names = new ArrayList<>();
                for (Player p : Bukkit.getOnlinePlayers()) {
                    names.add(p.getName());
                }

                StringBuilder namesJson = new StringBuilder("[");
                for (int i = 0; i < names.size(); i++) {
                    namesJson.append("\"").append(escapeJson(names.get(i))).append("\"");
                    if (i < names.size() - 1) namesJson.append(",");
                }
                namesJson.append("]");

                String json = String.format(
                    "{\"ok\":true,\"online\":%d,\"max\":%d,\"names\":%s}",
                    names.size(), Bukkit.getMaxPlayers(), namesJson.toString()
                );

                sendJson(exchange, 200, json);
            } catch (Exception e) {
                try {
                    sendJson(exchange, 500, "{\"ok\":false, \"error\":\"" + escapeJson(e.getMessage()) + "\"}");
                } catch (Exception ignored) {}
            }
        }
    }

    private class CommandHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                if (!checkAuth(exchange)) {
                    sendJson(exchange, 401, "{\"ok\":false, \"error\":\"Unauthorized\"}");
                    return;
                }
                if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                    sendJson(exchange, 405, "{\"ok\":false, \"error\":\"Method Not Allowed\"}");
                    return;
                }

                String body = readBody(exchange);
                String command = extractJsonField(body, "command");

                if (command == null || command.isEmpty()) {
                    sendJson(exchange, 400, "{\"ok\":false, \"error\":\"Command string required\"}");
                    return;
                }

                CompletableFuture<Boolean> future = new CompletableFuture<>();
                Bukkit.getScheduler().runTask(plugin, () -> {
                    try {
                        boolean success = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
                        future.complete(success);
                    } catch (Exception ex) {
                        future.completeExceptionally(ex);
                    }
                });

                boolean result = future.get();
                sendJson(exchange, 200, String.format("{\"ok\":true, \"command\":\"%s\", \"output\":\"Executed console command: %s (Success: %b)\"}", escapeJson(command), escapeJson(command), result));
            } catch (Exception e) {
                try {
                    sendJson(exchange, 500, "{\"ok\":false, \"error\":\"" + escapeJson(e.getMessage()) + "\"}");
                } catch (Exception ignored) {}
            }
        }
    }

    private class SayHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                if (!checkAuth(exchange)) {
                    sendJson(exchange, 401, "{\"ok\":false, \"error\":\"Unauthorized\"}");
                    return;
                }
                if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                    sendJson(exchange, 405, "{\"ok\":false, \"error\":\"Method Not Allowed\"}");
                    return;
                }

                String body = readBody(exchange);
                String message = extractJsonField(body, "message");

                if (message == null || message.isEmpty()) {
                    sendJson(exchange, 400, "{\"ok\":false, \"error\":\"Message string required\"}");
                    return;
                }

                final String announcement = "[Telegram] " + message;
                Bukkit.getScheduler().runTask(plugin, () -> {
                    Bukkit.broadcastMessage(announcement);
                });

                sendJson(exchange, 200, String.format("{\"ok\":true, \"message\":\"%s\"}", escapeJson(announcement)));
            } catch (Exception e) {
                try {
                    sendJson(exchange, 500, "{\"ok\":false, \"error\":\"" + escapeJson(e.getMessage()) + "\"}");
                } catch (Exception ignored) {}
            }
        }
    }

    private String extractJsonField(String json, String field) {
        if (json == null) return null;
        String pattern = "\"" + field + "\"\\s*:\\s*\"([^\"]+)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }
}
