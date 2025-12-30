export declare interface Status {
    ping: number;
    version: string;
    motd: string;
    players: number;
    max_players: number;
}
export declare interface McServer {
    host: string;
    port: number;
}
export declare function checkStatus(server: McServer): Promise<Status>;
