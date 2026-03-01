module.exports = {
    apps: [
        {
            name: "lavalink",
            script: "Lavalink.jar",
            interpreter: "java",
            interpreter_args: "-Xms64m -Xmx256m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+UseStringDeduplication -jar",
            cwd: "/home/ubuntu/lavalink",
            max_memory_restart: "300M",
            restart_delay: 8000,
            max_restarts: 5,
            min_uptime: "15s",
            kill_timeout: 15000,
            log_date_format: "YYYY-MM-DDTHH:mm:ss",
            out_file: "/home/ubuntu/discord-bot-llm/logs/lavalink-out.log",
            error_file: "/home/ubuntu/discord-bot-llm/logs/lavalink-err.log",
            merge_logs: true,
        },
        {
            name: "discord-bot-netricsa",
            script: "dist/bot.js",
            cwd: "/home/ubuntu/discord-bot-llm",
            exec_mode: "fork",
            instances: 1,
            env_file: ".env",
            max_memory_restart: "280M",
            restart_delay: 5000,
            max_restarts: 10,
            min_uptime: "10s",
            kill_timeout: 10000,
            // Attendre 30s après le démarrage de Lavalink (~23s de boot)
            wait_ready: false,
            listen_timeout: 30000,
            log_date_format: "YYYY-MM-DDTHH:mm:ss",
            out_file: "/home/ubuntu/discord-bot-llm/logs/bot-out.log",
            error_file: "/home/ubuntu/discord-bot-llm/logs/bot-err.log",
            merge_logs: true,
        }
    ]
};

