/**
 * Service de logging centralisé
 * Remplace les console.log/console.error dispersés avec un format uniforme
 */

export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
}

export class Logger {
    private readonly context: string;

    constructor(context: string) {
        this.context = context;
    }

    /**
     * Log un message de niveau DEBUG
     */
    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * Log un message de niveau INFO
     */
    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Log un message de niveau WARN
     */
    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Log un message de niveau ERROR
     */
    error(message: string, error?: any): void {
        this.log(LogLevel.ERROR, message);
        if (error) {
            console.error(error);
        }
    }

    /**
     * Log un message avec un niveau spécifique
     */
    private log(level: LogLevel, message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.context}]`;

        switch (level) {
            case LogLevel.DEBUG:
                console.log(`${prefix} ${message}`, ...args);
                break;
            case LogLevel.INFO:
                console.log(`${prefix} ${message}`, ...args);
                break;
            case LogLevel.WARN:
                console.warn(`${prefix} ${message}`, ...args);
                break;
            case LogLevel.ERROR:
                console.error(`${prefix} ${message}`, ...args);
                break;
        }
    }
}

/**
 * Crée une instance de logger pour un contexte donné
 */
export function createLogger(context: string): Logger {
    return new Logger(context);
}
